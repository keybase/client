// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
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
	BlockSplitter() BlockSplitter
	Codec() Codec
	Crypto() Crypto
	BlockCache() BlockCache
	MDCache() MDCache
	Reporter() Reporter
	currentInfoGetter() currentInfoGetter
	encryptionKeyGetter() encryptionKeyGetter
	MDServer() MDServer
	MakeLogger(module string) logger.Logger
}

// tlfJournalConfigWrapper is an adapter for Config objects to the
// tlfJournalConfig interface.
type tlfJournalConfigAdapter struct {
	Config
}

func (ca tlfJournalConfigAdapter) currentInfoGetter() currentInfoGetter {
	return ca.Config.KBPKI()
}

func (ca tlfJournalConfigAdapter) encryptionKeyGetter() encryptionKeyGetter {
	return ca.Config.KeyManager()
}

// TLFJournalStatus represents the status of a TLF's journal for
// display in diagnostics. It is suitable for encoding directly as
// JSON.
type TLFJournalStatus struct {
	RevisionStart  MetadataRevision
	RevisionEnd    MetadataRevision
	BranchID       string
	BlockOpCount   uint64
	UnflushedBytes int64 // (signed because os.FileInfo.Size() is signed)
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
	onBranchChange      branchChangeListener

	// All the channels below are used as simple on/off
	// signals. They're buffered for one object, and all sends are
	// asynchronous, so multiple sends get collapsed into one
	// signal.
	hasWorkCh      chan struct{}
	needPauseCh    chan struct{}
	needResumeCh   chan struct{}
	needShutdownCh chan struct{}

	// Serializes all flushes.
	flushLock sync.Mutex

	// Tracks background work.
	wg RepeatedWaitGroup

	// Protects all operations on blockJournal and mdJournal.
	//
	// TODO: Consider using https://github.com/pkg/singlefile
	// instead.
	journalLock sync.RWMutex
	// both of these are nil after shutdown() is called.
	blockJournal *blockJournal
	mdJournal    *mdJournal

	bwDelegate tlfJournalBWDelegate
}

func makeTLFJournal(
	ctx context.Context, dir string, tlfID TlfID, config tlfJournalConfig,
	delegateBlockServer BlockServer, bws TLFJournalBackgroundWorkStatus,
	bwDelegate tlfJournalBWDelegate, onBranchChange branchChangeListener) (
	*tlfJournal, error) {
	log := config.MakeLogger("TLFJ")

	tlfDir := filepath.Join(dir, tlfID.String())

	blockJournal, err := makeBlockJournal(
		ctx, config.Codec(), config.Crypto(), tlfDir, log)
	if err != nil {
		return nil, err
	}

	uid, key, err :=
		getCurrentUIDAndVerifyingKey(ctx, config.currentInfoGetter())
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
		onBranchChange:      onBranchChange,
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
	j.wg.Add(1)
	select {
	case j.hasWorkCh <- struct{}{}:
	default:
		j.wg.Done()
	}
}

// CtxJournalTagKey is the type used for unique context tags within
// background journal work.
type CtxJournalTagKey int

const (
	// CtxJournalIDKey is the type of the tag for unique operation IDs
	// within background journal work.
	CtxJournalIDKey CtxJournalTagKey = iota
)

// CtxJournalOpID is the display name for the unique operation
// enqueued journal ID tag.
const CtxJournalOpID = "JID"

// doBackgroundWorkLoop is the main function for the background
// goroutine. It spawns off a worker goroutine to call
// doBackgroundWork whenever there is work, and can be paused and
// resumed.
func (j *tlfJournal) doBackgroundWorkLoop(bws TLFJournalBackgroundWorkStatus) {
	ctx := context.Background()
	if j.bwDelegate != nil {
		ctx = j.bwDelegate.GetBackgroundContext()
	}

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
		ctx := ctxWithRandomIDReplayable(ctx, CtxJournalIDKey, CtxJournalOpID,
			j.log)
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
	// TODO: Handle panics.
	go func() {
		defer j.wg.Done()
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

func (j *tlfJournal) getJournalEnds(ctx context.Context) (
	blockEnd journalOrdinal, mdEnd MetadataRevision, err error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	blockEnd, err = j.blockJournal.end()
	if err != nil {
		return 0, 0, err
	}

	mdEnd, err = j.mdJournal.end()
	if err != nil {
		return 0, 0, err
	}

	return blockEnd, mdEnd, nil
}

func (j *tlfJournal) flush(ctx context.Context) (err error) {
	j.flushLock.Lock()
	defer j.flushLock.Unlock()

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

	// TODO: Avoid starving flushing MD ops if there are many
	// block ops. See KBFS-1502.

	for {
		blockEnd, mdEnd, err := j.getJournalEnds(ctx)
		if err != nil {
			return err
		}

		if blockEnd == 0 && mdEnd == MetadataRevisionUninitialized {
			j.log.CDebugf(ctx, "Nothing else to flush")
			break
		}

		j.log.CDebugf(ctx, "Flushing up to blockEnd=%d and mdEnd=%d",
			blockEnd, mdEnd)

		// Flush the block journal ops in parallel.
		numFlushed, err := j.flushBlockEntries(ctx, blockEnd)
		if err != nil {
			return err
		}
		flushedBlockEntries += numFlushed

		// TODO: Flush MDs in batch.

		for {
			flushed, err := j.flushOneMDOp(ctx, mdEnd)
			if err != nil {
				return err
			}
			if !flushed {
				break
			}
			flushedMDEntries++
		}
	}

	j.log.CDebugf(ctx, "Flushed %d block entries and %d MD entries for %s",
		flushedBlockEntries, flushedMDEntries, j.tlfID)
	return nil
}

var errTLFJournalShutdown = errors.New("tlfJournal is shutdown")

func (j *tlfJournal) checkShutdownLocked() error {
	if j.blockJournal == nil || j.mdJournal == nil {
		return errTLFJournalShutdown
	}
	return nil
}

func (j *tlfJournal) getNextBlockEntriesToFlush(
	ctx context.Context, end journalOrdinal) (
	entries blockEntriesToFlush, err error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkShutdownLocked(); err != nil {
		return blockEntriesToFlush{}, err
	}

	return j.blockJournal.getNextEntriesToFlush(ctx, end)
}

func (j *tlfJournal) removeFlushedBlockEntries(ctx context.Context,
	entries blockEntriesToFlush) error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkShutdownLocked(); err != nil {
		return err
	}

	return j.blockJournal.removeFlushedEntries(ctx, entries, j.tlfID,
		j.config.Reporter())
}

func (j *tlfJournal) flushBlockEntries(
	ctx context.Context, end journalOrdinal) (int, error) {
	entries, err := j.getNextBlockEntriesToFlush(ctx, end)
	if err != nil {
		return 0, err
	}

	if entries.length() == 0 {
		return 0, nil
	}

	// TODO: fill this in for logging/error purposes.
	var tlfName CanonicalTlfName
	err = flushBlockEntries(ctx, j.log, j.delegateBlockServer,
		j.config.BlockCache(), j.config.Reporter(),
		j.tlfID, tlfName, entries)
	if err != nil {
		return 0, err
	}

	err = j.removeFlushedBlockEntries(ctx, entries)
	if err != nil {
		return 0, err
	}

	return entries.length(), nil
}

func (j *tlfJournal) getNextMDEntryToFlush(ctx context.Context,
	currentUID keybase1.UID, currentVerifyingKey VerifyingKey,
	end MetadataRevision) (
	MdID, *RootMetadataSigned, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkShutdownLocked(); err != nil {
		return MdID{}, nil, err
	}

	return j.mdJournal.getNextEntryToFlush(
		ctx, currentUID, currentVerifyingKey, end, j.config.Crypto())
}

func (j *tlfJournal) convertMDsToBranchAndGetNextEntry(
	ctx context.Context, currentUID keybase1.UID,
	currentVerifyingKey VerifyingKey,
	nextEntryEnd MetadataRevision) (MdID, *RootMetadataSigned, error) {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkShutdownLocked(); err != nil {
		return MdID{}, nil, err
	}

	bid, err := j.mdJournal.convertToBranch(
		ctx, currentUID, currentVerifyingKey, j.config.Crypto(),
		j.tlfID, j.config.MDCache())
	if err != nil {
		return MdID{}, nil, err
	}

	if j.onBranchChange != nil {
		j.onBranchChange.onTLFBranchChange(j.tlfID, bid)
	}

	return j.mdJournal.getNextEntryToFlush(
		ctx, currentUID, currentVerifyingKey, nextEntryEnd,
		j.config.Crypto())
}

func (j *tlfJournal) removeFlushedMDEntry(ctx context.Context,
	currentUID keybase1.UID, currentVerifyingKey VerifyingKey,
	mdID MdID, rmds *RootMetadataSigned) error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkShutdownLocked(); err != nil {
		return err
	}

	return j.mdJournal.removeFlushedEntry(
		ctx, currentUID, currentVerifyingKey, mdID, rmds)
}

func (j *tlfJournal) flushOneMDOp(
	ctx context.Context, end MetadataRevision) (bool, error) {
	uid, key, err :=
		getCurrentUIDAndVerifyingKey(ctx, j.config.currentInfoGetter())
	if err != nil {
		return false, err
	}

	j.log.CDebugf(ctx, "Flushing one MD to server")
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx, "Flush failed with %v", err)
		}
	}()

	mdServer := j.config.MDServer()

	mdID, rmds, err := j.getNextMDEntryToFlush(ctx, uid, key, end)
	if err != nil {
		return false, err
	}
	if mdID == (MdID{}) {
		return false, nil
	}

	j.log.CDebugf(ctx, "Flushing MD for TLF=%s with id=%s, rev=%s, bid=%s",
		rmds.MD.TlfID(), mdID, rmds.MD.RevisionNumber(), rmds.MD.BID())
	pushErr := mdServer.Put(ctx, rmds)
	if isRevisionConflict(pushErr) {
		headMdID, err := getMdID(ctx, mdServer, j.mdJournal.crypto,
			rmds.MD.TlfID(), rmds.MD.BID(), rmds.MD.MergedStatus(),
			rmds.MD.RevisionNumber())
		if err != nil {
			j.log.CWarningf(ctx,
				"getMdID failed for TLF %s, BID %s, and revision %d: %v",
				rmds.MD.TlfID(), rmds.MD.BID(), rmds.MD.RevisionNumber(), err)
		} else if headMdID == mdID {
			if headMdID == (MdID{}) {
				panic("nil earliestID and revision conflict error returned by pushEarliestToServer")
			}
			// We must have already flushed this MD, so continue.
			pushErr = nil
		} else if rmds.MD.MergedStatus() == Merged {
			j.log.CDebugf(ctx, "Conflict detected %v", pushErr)
			// Convert MDs to a branch and retry the put.
			mdID, rmds, err = j.convertMDsToBranchAndGetNextEntry(
				ctx, uid, key, end)
			if err != nil {
				return false, err
			}
			if mdID == (MdID{}) {
				return false, errors.New("Unexpected nil MdID")
			}
			j.log.CDebugf(ctx, "Flushing newly-unmerged MD for TLF=%s with id=%s, rev=%s, bid=%s",
				rmds.MD.TlfID(), mdID, rmds.MD.RevisionNumber(), rmds.MD.BID())
			pushErr = mdServer.Put(ctx, rmds)
		}
	}
	if pushErr != nil {
		return false, pushErr
	}

	err = j.removeFlushedMDEntry(ctx, uid, key, mdID, rmds)
	if err != nil {
		return false, err
	}

	return true, nil
}

func (j *tlfJournal) getJournalEntryCounts() (
	blockEntryCount, mdEntryCount uint64, err error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkShutdownLocked(); err != nil {
		return 0, 0, err
	}

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
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkShutdownLocked(); err != nil {
		return TLFJournalStatus{}, err
	}

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
		BranchID:       j.mdJournal.getBranchID().String(),
		RevisionStart:  earliestRevision,
		RevisionEnd:    latestRevision,
		BlockOpCount:   blockEntryCount,
		UnflushedBytes: j.blockJournal.unflushedBytes,
	}, nil
}

func (j *tlfJournal) getUnflushedBytes() int64 {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	return j.blockJournal.unflushedBytes
}

func (j *tlfJournal) shutdown() {
	select {
	case j.needShutdownCh <- struct{}{}:
	default:
	}

	// This may happen before the background goroutine finishes,
	// but that's ok.
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkShutdownLocked(); err != nil {
		// Already shutdown.
		return
	}

	ctx := context.Background()
	err := j.blockJournal.checkInSync(ctx)
	if err != nil {
		panic(err)
	}
	// Make further accesses error out.
	j.blockJournal = nil
	j.mdJournal = nil
}

// All the functions below just do the equivalent blockJournal or
// mdJournal function under j.journalLock.

func (j *tlfJournal) getBlockDataWithContext(
	id BlockID, context BlockContext) (
	[]byte, BlockCryptKeyServerHalf, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkShutdownLocked(); err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	return j.blockJournal.getDataWithContext(id, context)
}

func (j *tlfJournal) putBlockData(
	ctx context.Context, id BlockID, context BlockContext, buf []byte,
	serverHalf BlockCryptKeyServerHalf) error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkShutdownLocked(); err != nil {
		return err
	}

	err := j.blockJournal.putData(ctx, id, context, buf, serverHalf)
	if err != nil {
		return err
	}

	j.config.Reporter().NotifySyncStatus(ctx, &keybase1.FSPathSyncStatus{
		PublicTopLevelFolder: j.tlfID.IsPublic(),
		// Path: TODO,
		// TODO: should this be the complete total for the file/directory,
		// rather than the diff?
		SyncingBytes: int64(len(buf)),
		// SyncingOps: TODO,
	})

	j.signalWork()

	return nil
}

func (j *tlfJournal) addBlockReference(
	ctx context.Context, id BlockID, context BlockContext) error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkShutdownLocked(); err != nil {
		return err
	}

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
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkShutdownLocked(); err != nil {
		return nil, err
	}

	// Don't remove the block data if we remove the last
	// reference; we still need it to flush the initial put
	// operation.
	//
	// TODO: It would be nice if we could detect that case and
	// avoid having to flush the put.
	liveCounts, err = j.blockJournal.removeReferences(ctx, contexts)
	if err != nil {
		return nil, err
	}

	j.signalWork()

	return liveCounts, nil
}

func (j *tlfJournal) archiveBlockReferences(
	ctx context.Context, contexts map[BlockID][]BlockContext) error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkShutdownLocked(); err != nil {
		return err
	}

	err := j.blockJournal.archiveReferences(ctx, contexts)
	if err != nil {
		return err
	}

	j.signalWork()

	return nil
}

func (j *tlfJournal) getMDHead(
	ctx context.Context) (ImmutableBareRootMetadata, error) {
	uid, key, err :=
		getCurrentUIDAndVerifyingKey(ctx, j.config.currentInfoGetter())
	if err != nil {
		return ImmutableBareRootMetadata{}, err
	}

	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkShutdownLocked(); err != nil {
		return ImmutableBareRootMetadata{}, err
	}

	return j.mdJournal.getHead(uid, key)
}

func (j *tlfJournal) getMDRange(
	ctx context.Context, start, stop MetadataRevision) (
	[]ImmutableBareRootMetadata, error) {
	uid, key, err :=
		getCurrentUIDAndVerifyingKey(ctx, j.config.currentInfoGetter())
	if err != nil {
		return nil, err
	}

	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkShutdownLocked(); err != nil {
		return nil, err
	}

	return j.mdJournal.getRange(uid, key, start, stop)
}

func (j *tlfJournal) putMD(ctx context.Context, rmd *RootMetadata) (
	MdID, error) {
	uid, key, err :=
		getCurrentUIDAndVerifyingKey(ctx, j.config.currentInfoGetter())
	if err != nil {
		return MdID{}, err
	}

	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkShutdownLocked(); err != nil {
		return MdID{}, err
	}

	mdID, err := j.mdJournal.put(ctx, uid, key, j.config.Crypto(),
		j.config.encryptionKeyGetter(), j.config.BlockSplitter(), rmd)
	if err != nil {
		return MdID{}, err
	}

	j.signalWork()

	return mdID, nil
}

func (j *tlfJournal) clearMDs(ctx context.Context, bid BranchID) error {
	uid, key, err :=
		getCurrentUIDAndVerifyingKey(ctx, j.config.currentInfoGetter())
	if err != nil {
		return err
	}

	if j.onBranchChange != nil {
		j.onBranchChange.onTLFBranchChange(j.tlfID, NullBranchID)
	}

	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkShutdownLocked(); err != nil {
		return err
	}

	// No need to signal work in this case.
	return j.mdJournal.clear(ctx, uid, key, bid)
}

func (j *tlfJournal) wait(ctx context.Context) error {
	// TODO: figure out if the journal is currently paused; if so,
	// return an error.
	return j.wg.Wait(ctx)
}
