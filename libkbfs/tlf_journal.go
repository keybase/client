// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// tlfJournalConfig is the subset of the Config interface needed by
// tlfJournal (for ease of testing).
type tlfJournalConfig interface {
	Codec() Codec
	Crypto() Crypto
	KBPKI() KBPKI
	MDServer() MDServer
}

// TLFJournalStatus represents the status of a TLF's journal for
// display in diagnostics. It is suitable for encoding directly as
// JSON.
type TLFJournalStatus struct {
	RevisionStart MetadataRevision
	RevisionEnd   MetadataRevision
	BlockOpCount  uint64
}

// TLFJournalBackgroundWorkStatus indicates whether a journal should
// be doing background work or not.
type TLFJournalBackgroundWorkStatus int

const (
	// TLFJournalBackgroundWorkPaused indicates that the journal
	// should not currently be doing background work.
	TLFJournalBackgroundWorkPaused TLFJournalBackgroundWorkStatus = iota
	// TLFJournalBackgroundWorkEnabled indicates that the journal
	// should be doing background work.
	TLFJournalBackgroundWorkEnabled
)

func (bws TLFJournalBackgroundWorkStatus) String() string {
	switch bws {
	case TLFJournalBackgroundWorkEnabled:
		return "Background work enabled"
	case TLFJournalBackgroundWorkPaused:
		return "Background work paused"
	default:
		return fmt.Sprintf("TLFJournalBackgroundWorkStatus(%d)", bws)
	}
}

// bwState indicates the state of the background work goroutine.
type bwState int

const (
	bwBusy bwState = iota
	bwIdle
	bwPaused
)

func (bws bwState) String() string {
	switch bws {
	case bwBusy:
		return "bwBusy"
	case bwIdle:
		return "bwIdle"
	case bwPaused:
		return "bwPaused"
	default:
		return fmt.Sprintf("bwState(%d)", bws)
	}
}

// tlfJournalBWDelegate is used by tests to know what the background
// goroutine is doing, and also to enforce a timeout (via the
// context).
type tlfJournalBWDelegate interface {
	GetBackgroundContext() context.Context
	OnNewState(ctx context.Context, bws bwState)
	OnShutdown(ctx context.Context)
}

// A tlfJournal contains all the journals for a TLF and controls the
// synchronization between the objects that are adding to those
// journals (via journalBlockServer or journalMDOps) and a background
// goroutine that flushes journal entries to the servers.
type tlfJournal struct {
	tlfID               TlfID
	config              tlfJournalConfig
	delegateBlockServer BlockServer
	log                 logger.Logger
	deferLog            logger.Logger

	// All the channels below are used as simple on/off
	// signals. They're buffered for one object, and all sends are
	// asynchronous, so multiple sends get collapsed into one
	// signal.
	hasWorkCh      chan struct{}
	needPauseCh    chan struct{}
	needResumeCh   chan struct{}
	needShutdownCh chan struct{}

	// Protects all operations on blockJournal and mdJournal.
	//
	// TODO: Don't let flushing block put operations. See
	// KBFS-1433.
	//
	// TODO: Consider using https://github.com/pkg/singlefile
	// instead.
	lock sync.RWMutex

	blockJournal *blockJournal
	mdJournal    *mdJournal

	bwDelegate tlfJournalBWDelegate
}

func makeTLFJournal(
	ctx context.Context, dir string, tlfID TlfID, config tlfJournalConfig,
	delegateBlockServer BlockServer, log logger.Logger,
	bws TLFJournalBackgroundWorkStatus,
	bwDelegate tlfJournalBWDelegate) (*tlfJournal, error) {
	tlfDir := filepath.Join(dir, tlfID.String())

	blockJournal, err := makeBlockJournal(
		ctx, config.Codec(), config.Crypto(), tlfDir, log)
	if err != nil {
		return nil, err
	}

	_, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return nil, err
	}

	key, err := config.KBPKI().GetCurrentVerifyingKey(ctx)
	if err != nil {
		return nil, err
	}

	mdJournal, err := makeMDJournal(
		uid, key, config.Codec(), config.Crypto(), tlfDir, log)
	if err != nil {
		return nil, err
	}

	j := &tlfJournal{
		tlfID:               tlfID,
		config:              config,
		delegateBlockServer: delegateBlockServer,
		log:                 log,
		deferLog:            log.CloneWithAddedDepth(1),
		hasWorkCh:           make(chan struct{}, 1),
		needPauseCh:         make(chan struct{}, 1),
		needResumeCh:        make(chan struct{}, 1),
		needShutdownCh:      make(chan struct{}, 1),
		blockJournal:        blockJournal,
		mdJournal:           mdJournal,
		bwDelegate:          bwDelegate,
	}

	go j.doBackgroundWorkLoop(bws)

	// Signal work to pick up any existing journal entries.
	j.signalWork()

	j.log.CDebugf(ctx, "Enabled journal for %s with path %s", tlfID, tlfDir)
	return j, nil
}

func (j *tlfJournal) signalWork() {
	select {
	case j.hasWorkCh <- struct{}{}:
	default:
	}
}

// doBackgroundWorkLoop is the main function for the background
// goroutine. It spawns off a worker goroutine to call
// doBackgroundWork whenever there is work, and can be paused and
// resumed.
func (j *tlfJournal) doBackgroundWorkLoop(bws TLFJournalBackgroundWorkStatus) {
	ctx := context.Background()
	if j.bwDelegate != nil {
		ctx = j.bwDelegate.GetBackgroundContext()
	}
	ctx = ctxWithRandomID(ctx, "journal-auto-flush", "1", j.log)
	defer func() {
		if j.bwDelegate != nil {
			j.bwDelegate.OnShutdown(ctx)
		}
	}()

	// Below we have a state machine with three states:
	//
	// 1) Idle, where we wait for new work or to be paused;
	// 2) Busy, where we wait for the worker goroutine to
	//    finish, or to be paused;
	// 3) Paused, where we wait to be resumed.
	//
	// We run this state machine until we are shutdown. Also, if
	// we exit the busy state for any reason other than the worker
	// goroutine finished, we stop the worker goroutine (via
	// bwCancel below).

	// errCh and bwCancel are non-nil only when we're in the busy
	// state. errCh is the channel on which we receive the error
	// from the worker goroutine, and bwCancel is the CancelFunc
	// corresponding to the context passed to the worker
	// goroutine.
	var errCh <-chan error
	var bwCancel context.CancelFunc
	// Handle the case where we panic while in the busy state.
	defer func() {
		if bwCancel != nil {
			bwCancel()
		}
	}()

	for {
		switch {
		case bws == TLFJournalBackgroundWorkEnabled && errCh == nil:
			// 1) Idle.
			if j.bwDelegate != nil {
				j.bwDelegate.OnNewState(ctx, bwIdle)
			}
			j.log.CDebugf(
				ctx, "Waiting for the work signal for %s",
				j.tlfID)
			select {
			case <-j.hasWorkCh:
				j.log.CDebugf(
					ctx, "Got work signal for %s", j.tlfID)
				bwCtx, cancel := context.WithCancel(ctx)
				errCh = j.doBackgroundWork(bwCtx)
				bwCancel = cancel

			case <-j.needPauseCh:
				j.log.CDebugf(ctx,
					"Got pause signal for %s", j.tlfID)
				bws = TLFJournalBackgroundWorkPaused

			case <-j.needShutdownCh:
				j.log.CDebugf(ctx,
					"Got shutdown signal for %s", j.tlfID)
				return
			}

		case bws == TLFJournalBackgroundWorkEnabled && errCh != nil:
			// 2) Busy.
			if j.bwDelegate != nil {
				j.bwDelegate.OnNewState(ctx, bwBusy)
			}
			j.log.CDebugf(ctx,
				"Waiting for background work to be done for %s",
				j.tlfID)
			needShutdown := false
			select {
			case err := <-errCh:
				if err != nil {
					j.log.CWarningf(ctx,
						"Background work error for %s: %v",
						j.tlfID, err)

					// TODO: Perhaps backoff and
					// retry the background work
					// again?
				}

			case <-j.needPauseCh:
				j.log.CDebugf(ctx,
					"Got pause signal for %s", j.tlfID)
				bws = TLFJournalBackgroundWorkPaused

			case <-j.needShutdownCh:
				j.log.CDebugf(ctx,
					"Got shutdown signal for %s", j.tlfID)
				needShutdown = true
			}

			errCh = nil
			// Cancel the worker goroutine as we exit this
			// state.
			bwCancel()
			bwCancel = nil
			if needShutdown {
				return
			}

		case bws == TLFJournalBackgroundWorkPaused:
			// 3) Paused
			if j.bwDelegate != nil {
				j.bwDelegate.OnNewState(ctx, bwPaused)
			}
			j.log.CDebugf(
				ctx, "Waiting to resume background work for %s",
				j.tlfID)
			select {
			case <-j.needResumeCh:
				j.log.CDebugf(ctx,
					"Got resume signal for %s", j.tlfID)
				bws = TLFJournalBackgroundWorkEnabled

			case <-j.needShutdownCh:
				j.log.CDebugf(ctx,
					"Got shutdown signal for %s", j.tlfID)
				return
			}

		default:
			j.log.CErrorf(
				ctx, "Unknown TLFJournalBackgroundStatus %s",
				bws)
			return
		}
	}
}

// doBackgroundWork currently only does auto-flushing. It assumes that
// ctx is canceled when the background processing should stop.
//
// TODO: Handle garbage collection too.
func (j *tlfJournal) doBackgroundWork(ctx context.Context) <-chan error {
	errCh := make(chan error, 1)
	go func() {
		errCh <- j.flush(ctx)
	}()
	return errCh
}

// We don't guarantee that pause/resume requests will be processed in
// strict FIFO order. In particular, multiple pause requests are
// collapsed into one (also multiple resume requests), so it's
// possible that a pause-resume-pause sequence will be processed as
// pause-resume. But that's okay, since these are just for infrequent
// ad-hoc testing.

func (j *tlfJournal) pauseBackgroundWork() {
	select {
	case j.needPauseCh <- struct{}{}:
	default:
	}
}

func (j *tlfJournal) resumeBackgroundWork() {
	select {
	case j.needResumeCh <- struct{}{}:
	default:
	}
}

func (j *tlfJournal) flush(ctx context.Context) (err error) {
	flushedBlockEntries := 0
	flushedMDEntries := 0
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Flushed %d block entries and %d MD entries "+
					"for %s, but got error %v",
				flushedBlockEntries, flushedMDEntries,
				j.tlfID, err)
		}
	}()

	// TODO: Interleave block flushes with their related MD
	// flushes.

	// TODO: Parallelize block puts.

	for {
		flushed, err := j.flushOneBlockOp(ctx)
		if err != nil {
			return err
		}
		if !flushed {
			break
		}
		flushedBlockEntries++
	}

	for {
		flushed, err := j.flushOneMDOp(ctx)
		if err != nil {
			return err
		}
		if !flushed {
			break
		}
		flushedMDEntries++
	}

	j.log.CDebugf(ctx, "Flushed %d block entries and %d MD entries for %s",
		flushedBlockEntries, flushedMDEntries, j.tlfID)
	return nil
}

func (j *tlfJournal) flushOneBlockOp(ctx context.Context) (bool, error) {
	j.lock.Lock()
	defer j.lock.Unlock()
	return j.blockJournal.flushOne(ctx, j.delegateBlockServer, j.tlfID)
}

func (j *tlfJournal) flushOneMDOp(ctx context.Context) (bool, error) {
	_, currentUID, err := j.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return false, err
	}

	currentVerifyingKey, err := j.config.KBPKI().GetCurrentVerifyingKey(ctx)
	if err != nil {
		return false, err
	}

	j.lock.Lock()
	defer j.lock.Unlock()
	return j.mdJournal.flushOne(
		ctx, currentUID, currentVerifyingKey, j.config.Crypto(),
		j.config.MDServer())
}

func (j *tlfJournal) getJournalEntryCounts() (
	blockEntryCount, mdEntryCount uint64, err error) {
	j.lock.RLock()
	defer j.lock.RUnlock()
	blockEntryCount, err = j.blockJournal.length()
	if err != nil {
		return 0, 0, err
	}

	mdEntryCount, err = j.mdJournal.length()
	if err != nil {
		return 0, 0, err
	}

	return blockEntryCount, mdEntryCount, nil
}

func (j *tlfJournal) getJournalStatus() (TLFJournalStatus, error) {
	j.lock.RLock()
	defer j.lock.RUnlock()
	earliestRevision, err := j.mdJournal.readEarliestRevision()
	if err != nil {
		return TLFJournalStatus{}, err
	}
	latestRevision, err := j.mdJournal.readLatestRevision()
	if err != nil {
		return TLFJournalStatus{}, err
	}
	blockEntryCount, err := j.blockJournal.length()
	if err != nil {
		return TLFJournalStatus{}, err
	}
	return TLFJournalStatus{
		RevisionStart: earliestRevision,
		RevisionEnd:   latestRevision,
		BlockOpCount:  blockEntryCount,
	}, nil
}

func (j *tlfJournal) shutdown() {
	select {
	case j.needShutdownCh <- struct{}{}:
	default:
	}
}

// All the functions below just do the equivalent blockJournal or
// mdJournal function under j.lock.

func (j *tlfJournal) getBlockDataWithContext(
	id BlockID, context BlockContext) (
	[]byte, BlockCryptKeyServerHalf, error) {
	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.blockJournal.getDataWithContext(id, context)
}

func (j *tlfJournal) putBlockData(
	ctx context.Context, id BlockID, context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
	j.lock.Lock()
	defer j.lock.Unlock()
	err := j.blockJournal.putData(ctx, id, context, buf, serverHalf)
	if err != nil {
		return err
	}

	j.signalWork()

	return nil
}

func (j *tlfJournal) addBlockReference(
	ctx context.Context, id BlockID, context BlockContext) error {
	j.lock.Lock()
	defer j.lock.Unlock()
	err := j.blockJournal.addReference(ctx, id, context)
	if err != nil {
		return err
	}

	j.signalWork()

	return nil
}

func (j *tlfJournal) removeBlockReferences(
	ctx context.Context, contexts map[BlockID][]BlockContext) (
	liveCounts map[BlockID]int, err error) {
	j.lock.Lock()
	defer j.lock.Unlock()
	// Don't remove the block data if we remove the last
	// reference; we still need it to flush the initial put
	// operation.
	//
	// TODO: It would be nice if we could detect that case and
	// avoid having to flush the put.
	liveCounts, err = j.blockJournal.removeReferences(
		ctx, contexts, false)
	if err != nil {
		return nil, err
	}

	j.signalWork()

	return liveCounts, nil
}

func (j *tlfJournal) archiveBlockReferences(
	ctx context.Context, contexts map[BlockID][]BlockContext) error {
	j.lock.Lock()
	defer j.lock.Unlock()
	err := j.blockJournal.archiveReferences(ctx, contexts)
	if err != nil {
		return err
	}

	j.signalWork()

	return nil
}

func (j *tlfJournal) getMDHead(
	ctx context.Context) (ImmutableBareRootMetadata, error) {
	_, uid, err := j.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}

	key, err := j.config.KBPKI().GetCurrentVerifyingKey(ctx)
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}

	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.mdJournal.getHead(uid, key)
}

func (j *tlfJournal) getMDRange(
	ctx context.Context, start, stop MetadataRevision) (
	[]ImmutableBareRootMetadata, error) {
	_, uid, err := j.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return nil, err
	}

	key, err := j.config.KBPKI().GetCurrentVerifyingKey(ctx)
	if err != nil {
		return nil, err
	}

	j.lock.RLock()
	defer j.lock.RUnlock()
	return j.mdJournal.getRange(uid, key, start, stop)
}

func (j *tlfJournal) putMD(
	ctx context.Context, signer cryptoSigner,
	ekg encryptionKeyGetter, bsplit BlockSplitter, rmd *RootMetadata) (
	MdID, error) {
	_, uid, err := j.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return MdID{}, err
	}

	key, err := j.config.KBPKI().GetCurrentVerifyingKey(ctx)
	if err != nil {
		return MdID{}, err
	}

	j.lock.Lock()
	defer j.lock.Unlock()
	mdID, err := j.mdJournal.put(ctx, uid, key, signer, ekg, bsplit, rmd)
	if err != nil {
		return MdID{}, err
	}

	j.signalWork()

	return mdID, nil
}

func (j *tlfJournal) clearMDs(
	ctx context.Context, currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey, bid BranchID) error {
	_, uid, err := j.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return err
	}

	key, err := j.config.KBPKI().GetCurrentVerifyingKey(ctx)
	if err != nil {
		return err
	}

	j.lock.Lock()
	defer j.lock.Unlock()
	// No need to signal work in this case.
	return j.mdJournal.clear(ctx, uid, key, bid)
}
