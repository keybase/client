// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/kbfssync"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"github.com/vividcortex/ewma"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

// tlfJournalConfig is the subset of the Config interface needed by
// tlfJournal (for ease of testing).
type tlfJournalConfig interface {
	BlockSplitter() BlockSplitter
	Clock() Clock
	Codec() kbfscodec.Codec
	Crypto() Crypto
	BlockCache() BlockCache
	BlockOps() BlockOps
	MDCache() MDCache
	MetadataVersion() kbfsmd.MetadataVer
	Reporter() Reporter
	encryptionKeyGetter() encryptionKeyGetter
	mdDecryptionKeyGetter() mdDecryptionKeyGetter
	MDServer() MDServer
	usernameGetter() normalizedUsernameGetter
	resolver() resolver
	MakeLogger(module string) logger.Logger
	diskLimitTimeout() time.Duration
	teamMembershipChecker() kbfsmd.TeamMembershipChecker
	BGFlushDirOpBatchSize() int
	syncedTlfGetterSetter
}

// tlfJournalConfigWrapper is an adapter for Config objects to the
// tlfJournalConfig interface.
type tlfJournalConfigAdapter struct {
	Config
}

func (ca tlfJournalConfigAdapter) encryptionKeyGetter() encryptionKeyGetter {
	return ca.Config.KeyManager()
}

func (ca tlfJournalConfigAdapter) mdDecryptionKeyGetter() mdDecryptionKeyGetter {
	return ca.Config.KeyManager()
}

func (ca tlfJournalConfigAdapter) usernameGetter() normalizedUsernameGetter {
	return ca.Config.KBPKI()
}

func (ca tlfJournalConfigAdapter) resolver() resolver {
	return ca.Config.KBPKI()
}

func (ca tlfJournalConfigAdapter) teamMembershipChecker() kbfsmd.TeamMembershipChecker {
	return ca.Config.KBPKI()
}

func (ca tlfJournalConfigAdapter) diskLimitTimeout() time.Duration {
	// Set this to slightly larger than the max delay, so that we
	// don't start failing writes when we hit the max delay.
	return defaultDiskLimitMaxDelay + time.Second
}

const (
	// Maximum number of blocks that can be flushed in a single batch
	// by the journal.  TODO: make this configurable, so that users
	// can choose how much bandwidth is used by the journal.
	maxJournalBlockFlushBatchSize = 25
	// This will be the final entry for unflushed paths if there are
	// too many revisions to process at once.
	incompleteUnflushedPathsMarker = "..."
	// ForcedBranchSquashRevThreshold is the minimum number of MD
	// revisions in the journal that will trigger an automatic branch
	// conversion (and subsequent resolution).
	ForcedBranchSquashRevThreshold = 20
	// ForcedBranchSquashBytesThresholdDefault is the minimum number of
	// unsquashed MD bytes in the journal that will trigger an
	// automatic branch conversion (and subsequent resolution).
	ForcedBranchSquashBytesThresholdDefault = uint64(25 << 20) // 25 MB
	// Maximum number of blocks to delete from the local saved block
	// journal at a time while holding the lock.
	maxSavedBlockRemovalsAtATime = uint64(500)
	// How often to check the server for conflicts while flushing.
	tlfJournalServerMDCheckInterval = 1 * time.Minute
)

// TLFJournalStatus represents the status of a TLF's journal for
// display in diagnostics. It is suitable for encoding directly as
// JSON.
type TLFJournalStatus struct {
	Dir           string
	RevisionStart kbfsmd.Revision
	RevisionEnd   kbfsmd.Revision
	BranchID      string
	BlockOpCount  uint64
	// The byte counters below are signed because
	// os.FileInfo.Size() is signed. The file counter is signed
	// for consistency.
	StoredBytes     int64
	StoredFiles     int64
	UnflushedBytes  int64
	UnflushedPaths  []string
	EndEstimate     *time.Time
	QuotaUsedBytes  int64
	QuotaLimitBytes int64
	LastFlushErr    string `json:",omitempty"`
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
	// TLFJournalSingleOpBackgroundWorkEnabled indicates that the
	// journal should make all of its work visible to other readers as
	// a single operation. That means blocks may be uploaded as they
	// come in, but MDs must be squashed together and only one MD
	// update total should be uploaded.  The end of the operation will
	// be indicated by an explicit call to
	// `tlfJournal.finishSingleOp`.
	//
	// Note that this is an explicit per-TLF setting, rather than
	// taken from `Config.Mode()`, in case we find it useful in the
	// future to be able to turn this on for individual TLFs running
	// in normal KBFS mode.
	TLFJournalSingleOpBackgroundWorkEnabled
)

type tlfJournalPauseType int

const (
	journalPauseConflict tlfJournalPauseType = 1 << iota
	journalPauseCommand
)

func (bws TLFJournalBackgroundWorkStatus) String() string {
	switch bws {
	case TLFJournalBackgroundWorkEnabled:
		return "Background work enabled"
	case TLFJournalBackgroundWorkPaused:
		return "Background work paused"
	case TLFJournalSingleOpBackgroundWorkEnabled:
		return "Background work in single-op mode"
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

type singleOpMode int

const (
	singleOpDisabled singleOpMode = iota
	singleOpRunning
	singleOpFinished
)

type flushContext struct {
	lockContextForPut *keybase1.LockContext
	priorityForPut    keybase1.MDPriority
}

func defaultFlushContext() flushContext {
	return flushContext{priorityForPut: keybase1.MDPriorityNormal}
}

// A tlfJournal contains all the journals for a (TLF, user, device)
// tuple and controls the synchronization between the objects that are
// adding to those journals (via journalBlockServer or journalMDOps)
// and a background goroutine that flushes journal entries to the
// servers.
//
// The maximum number of characters added to the root dir by a TLF
// journal is 51, which just the max of the block journal and MD
// journal numbers.
type tlfJournal struct {
	uid                 keybase1.UID
	key                 kbfscrypto.VerifyingKey
	tlfID               tlf.ID
	chargedTo           keybase1.UserOrTeamID
	dir                 string
	config              tlfJournalConfig
	delegateBlockServer BlockServer
	log                 traceLogger
	deferLog            traceLogger
	onBranchChange      branchChangeListener
	onMDFlush           mdFlushListener
	forcedSquashByBytes uint64

	// Invariant: this tlfJournal acquires exactly
	// blockJournal.getStoredBytes() and
	// blockJournal.getStoredFiles() until shutdown.
	diskLimiter DiskLimiter

	// All the channels below are used as simple on/off
	// signals. They're buffered for one object, and all sends are
	// asynchronous, so multiple sends get collapsed into one
	// signal.
	hasWorkCh         chan struct{}
	needPauseCh       chan struct{}
	needResumeCh      chan struct{}
	needShutdownCh    chan struct{}
	needBranchCheckCh chan struct{}

	// Track the ways in which the journal is paused.  We don't allow
	// work to resume unless a resume has come in corresponding to
	// each type of paused that's happened.
	pauseLock sync.Mutex
	pauseType tlfJournalPauseType

	// This channel is closed when background work shuts down.
	backgroundShutdownCh chan struct{}

	// Serializes all flushes, and protects `lastServerMDCheck` and
	// `singleOpMode`.
	flushLock            sync.Mutex
	lastServerMDCheck    time.Time
	singleOpMode         singleOpMode
	finishSingleOpCh     chan flushContext
	singleOpFlushContext flushContext

	// Tracks background work.
	wg kbfssync.RepeatedWaitGroup

	// Protects all operations on blockJournal and mdJournal, and all
	// the fields until the next blank line.
	//
	// TODO: Consider using https://github.com/pkg/singlefile
	// instead.
	journalLock sync.RWMutex
	// both of these are nil after shutdown() is called.
	blockJournal   *blockJournal
	mdJournal      *mdJournal
	disabled       bool
	lastFlushErr   error
	unflushedPaths *unflushedPathCache
	// An estimate of how many bytes have been written since the last
	// squash.
	unsquashedBytes uint64
	flushingBlocks  map[kbfsblock.ID]bool
	// An exponential moving average of the perceived block upload
	// bandwidth of this journal.  Since we don't add values at
	// regular time intervals, this ends up weighting the average by
	// number of samples.
	bytesPerSecEstimate ewma.MovingAverage
	currBytesFlushing   int64
	currFlushStarted    time.Time
	needInfoFile        bool

	bwDelegate tlfJournalBWDelegate
}

func getTLFJournalInfoFilePath(dir string) string {
	return filepath.Join(dir, "info.json")
}

// tlfJournalInfo is the structure stored in
// getTLFJournalInfoFilePath(dir).
type tlfJournalInfo struct {
	UID          keybase1.UID
	VerifyingKey kbfscrypto.VerifyingKey
	TlfID        tlf.ID
	ChargedTo    keybase1.UserOrTeamID
}

func readTLFJournalInfoFile(dir string) (
	keybase1.UID, kbfscrypto.VerifyingKey, tlf.ID,
	keybase1.UserOrTeamID, error) {
	var info tlfJournalInfo
	err := ioutil.DeserializeFromJSONFile(
		getTLFJournalInfoFilePath(dir), &info)
	if err != nil {
		return keybase1.UID(""), kbfscrypto.VerifyingKey{}, tlf.ID{},
			keybase1.UserOrTeamID(""), err
	}

	chargedTo := info.UID.AsUserOrTeam()
	if info.ChargedTo.Exists() {
		chargedTo = info.ChargedTo
	}

	return info.UID, info.VerifyingKey, info.TlfID, chargedTo, nil
}

func writeTLFJournalInfoFile(dir string, uid keybase1.UID,
	key kbfscrypto.VerifyingKey, tlfID tlf.ID,
	chargedTo keybase1.UserOrTeamID) error {
	info := tlfJournalInfo{uid, key, tlfID, chargedTo}
	return ioutil.SerializeToJSONFile(info, getTLFJournalInfoFilePath(dir))
}

func makeTLFJournal(
	ctx context.Context, uid keybase1.UID, key kbfscrypto.VerifyingKey,
	dir string, tlfID tlf.ID, chargedTo keybase1.UserOrTeamID,
	config tlfJournalConfig, delegateBlockServer BlockServer,
	bws TLFJournalBackgroundWorkStatus, bwDelegate tlfJournalBWDelegate,
	onBranchChange branchChangeListener, onMDFlush mdFlushListener,
	diskLimiter DiskLimiter) (*tlfJournal, error) {
	if uid == keybase1.UID("") {
		return nil, errors.New("Empty user")
	}
	if key == (kbfscrypto.VerifyingKey{}) {
		return nil, errors.New("Empty verifying key")
	}
	if tlfID == (tlf.ID{}) {
		return nil, errors.New("Empty tlf.ID")
	}

	if tlfID.Type() == tlf.SingleTeam && chargedTo.IsUser() {
		return nil, errors.New("Team ID required for single-team TLF")
	} else if tlfID.Type() != tlf.SingleTeam && !chargedTo.IsUser() {
		return nil, errors.New("User ID required for non-team TLF")
	}

	readUID, readKey, readTlfID, readChargedTo, err :=
		readTLFJournalInfoFile(dir)
	switch {
	case ioutil.IsNotExist(err):
		// Info file doesn't exist, so write it.
		err := writeTLFJournalInfoFile(dir, uid, key, tlfID, chargedTo)
		if err != nil {
			return nil, err
		}

	case err != nil:
		return nil, err

	default:
		// Info file exists, so it should match passed-in
		// parameters.
		if uid != readUID {
			return nil, errors.Errorf(
				"Expected UID %s, got %s", uid, readUID)
		}

		if key != readKey {
			return nil, errors.Errorf(
				"Expected verifying key %s, got %s",
				key, readKey)
		}

		if tlfID != readTlfID {
			return nil, errors.Errorf(
				"Expected TLF ID %s, got %s", tlfID, readTlfID)
		}

		if chargedTo != readChargedTo {
			return nil, errors.Errorf(
				"Expected chargedTo ID %s, got %s", chargedTo, readChargedTo)
		}
	}

	log := config.MakeLogger("TLFJ")

	blockJournal, err := makeBlockJournal(ctx, config.Codec(), dir, log)
	if err != nil {
		return nil, err
	}

	mdJournal, err := makeMDJournal(
		ctx, uid, key, config.Codec(), config.Crypto(), config.Clock(),
		config.teamMembershipChecker(), tlfID, config.MetadataVersion(), dir,
		log)
	if err != nil {
		return nil, err
	}

	// TODO(KBFS-2217): if this is a team TLF, transform the given
	// disk limiter into one that checks the team's quota, not the
	// user's.

	j := &tlfJournal{
		uid:                  uid,
		key:                  key,
		tlfID:                tlfID,
		chargedTo:            chargedTo,
		dir:                  dir,
		config:               config,
		delegateBlockServer:  delegateBlockServer,
		log:                  traceLogger{log},
		deferLog:             traceLogger{log.CloneWithAddedDepth(1)},
		onBranchChange:       onBranchChange,
		onMDFlush:            onMDFlush,
		forcedSquashByBytes:  ForcedBranchSquashBytesThresholdDefault,
		diskLimiter:          diskLimiter,
		hasWorkCh:            make(chan struct{}, 1),
		needPauseCh:          make(chan struct{}, 1),
		needResumeCh:         make(chan struct{}, 1),
		needShutdownCh:       make(chan struct{}, 1),
		needBranchCheckCh:    make(chan struct{}, 1),
		backgroundShutdownCh: make(chan struct{}),
		finishSingleOpCh:     make(chan flushContext, 1),
		singleOpFlushContext: defaultFlushContext(),
		blockJournal:         blockJournal,
		mdJournal:            mdJournal,
		unflushedPaths:       &unflushedPathCache{},
		flushingBlocks:       make(map[kbfsblock.ID]bool),
		bytesPerSecEstimate:  ewma.NewMovingAverage(),
		bwDelegate:           bwDelegate,
	}

	switch bws {
	case TLFJournalSingleOpBackgroundWorkEnabled:
		j.singleOpMode = singleOpRunning
		j.log.CDebugf(
			ctx, "Starting journal for %s in single op mode", tlfID.String())
		// Now that we've set `j.singleOpMode`, `bws` can be the
		// normal background work mode again, just to keep the
		// transition logic in `doBackgroundWorkLoop` simple (it
		// doesn't depend on single-opness).
		bws = TLFJournalBackgroundWorkEnabled
	case TLFJournalBackgroundWorkPaused:
		j.pauseType |= journalPauseCommand
	}

	isConflict, err := j.isOnConflictBranch()
	if err != nil {
		return nil, err
	}
	if isConflict {
		// Conflict branches must start off paused until the first
		// resolution.
		j.log.CDebugf(ctx, "Journal for %s has a conflict, so starting off "+
			"paused (requested status %s)", tlfID, bws)
		bws = TLFJournalBackgroundWorkPaused
		j.pauseType |= journalPauseConflict
	}
	if bws == TLFJournalBackgroundWorkPaused {
		j.wg.Pause()
	}

	// Do this only once we're sure we won't error.
	storedBytes := j.blockJournal.getStoredBytes()
	unflushedBytes := j.blockJournal.getUnflushedBytes()
	storedFiles := j.blockJournal.getStoredFiles()
	availableBytes, availableFiles := j.diskLimiter.onJournalEnable(
		ctx, storedBytes, unflushedBytes, storedFiles, j.chargedTo)

	retry := backoff.NewExponentialBackOff()
	retry.MaxElapsedTime = 0
	go j.doBackgroundWorkLoop(bws, retry)

	// Signal work to pick up any existing journal entries.
	j.signalWork()

	j.log.CDebugf(ctx,
		"Enabled journal for %s (stored bytes=%d/files=%d, available bytes=%d/files=%d) with path %s",
		tlfID, storedBytes, storedFiles, availableBytes, availableFiles, dir)
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
func (j *tlfJournal) doBackgroundWorkLoop(
	bws TLFJournalBackgroundWorkStatus, retry backoff.BackOff) {
	ctx := context.Background()
	if j.bwDelegate != nil {
		ctx = j.bwDelegate.GetBackgroundContext()
	}

	// Non-nil when a retry has been scheduled for the future.
	var retryTimer *time.Timer
	defer func() {
		close(j.backgroundShutdownCh)
		if j.bwDelegate != nil {
			j.bwDelegate.OnShutdown(ctx)
		}
		if retryTimer != nil {
			retryTimer.Stop()
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
		ctx := CtxWithRandomIDReplayable(ctx, CtxJournalIDKey, CtxJournalOpID,
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
				j.log.CDebugf(ctx, "Got work signal for %s", j.tlfID)
				if retryTimer != nil {
					retryTimer.Stop()
					retryTimer = nil
				}
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
				if retryTimer != nil {
					panic("Retry timer should be nil after work is done")
				}

				if err != nil {
					j.log.CWarningf(ctx,
						"Background work error for %s: %+v",
						j.tlfID, err)

					bTime := retry.NextBackOff()
					if bTime != backoff.Stop {
						j.log.CWarningf(ctx, "Retrying in %s", bTime)
						retryTimer = time.AfterFunc(bTime, j.signalWork)
					}
				} else {
					retry.Reset()
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

			// Cancel the worker goroutine as we exit this
			// state.
			bwCancel()
			bwCancel = nil

			// Ensure the worker finishes after being canceled, so it
			// doesn't pick up any new work.  For example, if the
			// worker doesn't check for cancellations before checking
			// the journal for new work, it might process some journal
			// entries before returning an error.
			<-errCh
			errCh = nil

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
func (j *tlfJournal) doBackgroundWork(ctx context.Context) <-chan error {
	errCh := make(chan error, 1)
	// TODO: Handle panics.
	go func() {
		defer j.wg.Done()
		errCh <- j.flush(ctx)
		close(errCh)
	}()
	return errCh
}

// We don't guarantee that background pause/resume requests will be
// processed in strict FIFO order. In particular, multiple pause
// requests are collapsed into one (also multiple resume requests), so
// it's possible that a pause-resume-pause sequence will be processed
// as pause-resume. But that's okay, since these are just for
// infrequent ad-hoc testing.

func (j *tlfJournal) pause(pauseType tlfJournalPauseType) {
	j.pauseLock.Lock()
	defer j.pauseLock.Unlock()
	oldPauseType := j.pauseType
	j.pauseType |= pauseType

	if oldPauseType > 0 {
		// No signal is needed since someone already called pause.
		return
	}

	j.wg.Pause()
	select {
	case j.needPauseCh <- struct{}{}:
	default:
	}
}

func (j *tlfJournal) pauseBackgroundWork() {
	j.pause(journalPauseCommand)
}

func (j *tlfJournal) resume(pauseType tlfJournalPauseType) {
	j.pauseLock.Lock()
	defer j.pauseLock.Unlock()
	if j.pauseType == 0 {
		// Nothing has paused us yet (possibly because we are still
		// flushing blocks after we ran branch conversion -- see
		// KBFS-2501), so no need to resume.
		return
	}

	j.pauseType &= ^pauseType

	if j.pauseType != 0 {
		return
	}

	select {
	case j.needResumeCh <- struct{}{}:
		// Resume the wait group right away, so future callers will block
		// even before the background goroutine picks up this signal.
		j.wg.Resume()
	default:
	}
}

func (j *tlfJournal) resumeBackgroundWork() {
	j.resume(journalPauseCommand)
}

func (j *tlfJournal) checkEnabledLocked() error {
	if j.blockJournal == nil || j.mdJournal == nil {
		return errors.WithStack(errTLFJournalShutdown{})
	}
	if j.disabled {
		return errors.WithStack(errTLFJournalDisabled{})
	}
	return nil
}

func (j *tlfJournal) getJournalEnds(ctx context.Context) (
	blockEnd journalOrdinal, mdEnd kbfsmd.Revision, err error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return 0, kbfsmd.RevisionUninitialized, err
	}

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

func (j *tlfJournal) checkAndFinishSingleOpFlushLocked(
	ctx context.Context) error {
	switch j.singleOpMode {
	case singleOpDisabled:
		j.log.CDebugf(ctx, "Single op mode is disabled; cannot finish")
	case singleOpFinished:
		j.log.CDebugf(ctx, "Single op mode already finished")
	case singleOpRunning:
		j.log.CDebugf(ctx, "Marking single op as finished")
		j.singleOpMode = singleOpFinished
	default:
		return errors.Errorf("Unrecognized single op mode: %d", j.singleOpMode)
	}
	return nil
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
		j.journalLock.Lock()
		j.lastFlushErr = err
		j.journalLock.Unlock()
	}()

	for {
		select {
		case <-ctx.Done():
			j.log.CDebugf(ctx, "Flush canceled: %+v", ctx.Err())
			return nil
		default:
		}

		isConflict, err := j.isOnConflictBranch()
		if err != nil {
			return err
		}
		if isConflict {
			j.log.CDebugf(ctx, "Ignoring flush while on conflict branch")
			// It's safe to send a pause signal here, because even if
			// CR has already resolved the conflict and send the
			// resume signal, we know the background work loop is
			// still waiting for this flush() loop to finish before it
			// processes either the pause or the resume channel.
			j.pause(journalPauseConflict)
			return nil
		}

		select {
		case j.singleOpFlushContext = <-j.finishSingleOpCh:
			err := j.checkAndFinishSingleOpFlushLocked(ctx)
			if err != nil {
				return err
			}
		default:
		}

		converted, err := j.convertMDsToBranchIfOverThreshold(ctx, true)
		if err != nil {
			return err
		}
		if converted {
			return nil
		}

		blockEnd, mdEnd, err := j.getJournalEnds(ctx)
		if err != nil {
			return err
		}

		if blockEnd == 0 &&
			(mdEnd == kbfsmd.RevisionUninitialized ||
				j.singleOpMode == singleOpRunning) {
			j.log.CDebugf(ctx, "Nothing else to flush")
			if j.singleOpMode == singleOpFinished {
				j.log.CDebugf(ctx, "Resetting single op mode")
				j.singleOpMode = singleOpRunning
				j.singleOpFlushContext = defaultFlushContext()
			}
			break
		}

		j.log.CDebugf(ctx, "Flushing up to blockEnd=%d and mdEnd=%d",
			blockEnd, mdEnd)

		// Flush the block journal ops in parallel.
		numFlushed, maxMDRevToFlush, converted, err :=
			j.flushBlockEntries(ctx, blockEnd)
		if err != nil {
			return err
		}
		flushedBlockEntries += numFlushed

		if numFlushed == 0 {
			// If converted is true, the journal may have
			// shrunk, and so mdEnd would be obsolete. But
			// converted is always false when numFlushed
			// is 0.
			if converted {
				panic("numFlushed == 0 and converted is true")
			}

			// There were no blocks to flush, so we can
			// flush all of the remaining MDs.
			maxMDRevToFlush = mdEnd
		}

		if j.singleOpMode == singleOpRunning {
			j.log.CDebugf(ctx, "Skipping MD flushes in single-op mode")
			continue
		}

		// TODO: Flush MDs in batch.

		flushedOneMD := false
		for {
			flushed, err := j.flushOneMDOp(ctx,
				maxMDRevToFlush, j.singleOpFlushContext)
			if err != nil {
				return err
			}
			if !flushed {
				break
			}
			flushedOneMD = true
			j.lastServerMDCheck = j.config.Clock().Now()
			flushedMDEntries++
		}

		if !flushedOneMD {
			err = j.checkServerForConflicts(ctx, nil)
			if err != nil {
				return err
			}
		}
	}

	j.log.CDebugf(ctx, "Flushed %d block entries and %d MD entries for %s",
		flushedBlockEntries, flushedMDEntries, j.tlfID)
	return nil
}

type errTLFJournalShutdown struct{}

func (e errTLFJournalShutdown) Error() string {
	return "tlfJournal is shutdown"
}

type errTLFJournalDisabled struct{}

func (e errTLFJournalDisabled) Error() string {
	return "tlfJournal is disabled"
}

type errTLFJournalNotEmpty struct{}

func (e errTLFJournalNotEmpty) Error() string {
	return "tlfJournal is not empty"
}

func (j *tlfJournal) checkServerForConflicts(ctx context.Context,
	needLock *keybase1.LockID) error {
	durSinceCheck := j.config.Clock().Now().Sub(j.lastServerMDCheck)
	if durSinceCheck < tlfJournalServerMDCheckInterval {
		return nil
	}

	isConflict, err := j.isOnConflictBranch()
	if err != nil {
		return err
	}
	if isConflict {
		return nil
	}

	nextMDToFlush, err := func() (kbfsmd.Revision, error) {
		j.journalLock.RLock()
		defer j.journalLock.RUnlock()
		return j.mdJournal.readEarliestRevision()
	}()
	if err != nil {
		return err
	}
	if nextMDToFlush == kbfsmd.RevisionUninitialized {
		return nil
	}

	j.log.CDebugf(ctx, "Checking the MD server for the latest revision; "+
		"next MD revision in the journal is %d", nextMDToFlush)
	// TODO(KBFS-2186): implement a lighterweight server RPC that just
	// returns the latest revision number, so we don't have to fetch
	// the entire MD?
	currHead, err := j.config.MDServer().GetForTLF(
		ctx, j.tlfID, kbfsmd.NullBranchID, kbfsmd.Merged, needLock)
	if err != nil {
		return err
	}
	j.lastServerMDCheck = j.config.Clock().Now()
	if currHead == nil {
		return nil
	}
	if currHead.MD.RevisionNumber()+1 == nextMDToFlush {
		// We're still up-to-date with the server.  Nothing left to do.
		return nil
	}

	j.log.CDebugf(ctx, "Server is ahead of local journal (rev=%d), "+
		"indicating a conflict", currHead.MD.RevisionNumber())
	return j.convertMDsToBranch(ctx)
}

func (j *tlfJournal) getNextBlockEntriesToFlush(
	ctx context.Context, end journalOrdinal) (
	entries blockEntriesToFlush, bytesToFlush int64,
	maxMDRevToFlush kbfsmd.Revision, err error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return blockEntriesToFlush{}, 0, kbfsmd.RevisionUninitialized, err
	}

	return j.blockJournal.getNextEntriesToFlush(ctx, end,
		maxJournalBlockFlushBatchSize)
}

func (j *tlfJournal) removeFlushedBlockEntries(ctx context.Context,
	entries blockEntriesToFlush, flushEnded time.Time) error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return err
	}

	storedBytesBefore := j.blockJournal.getStoredBytes()

	// TODO: Check storedFiles also.

	flushedBytes, err := j.blockJournal.removeFlushedEntries(
		ctx, entries, j.tlfID, j.config.Reporter())
	if err != nil {
		return err
	}
	storedBytesAfter := j.blockJournal.getStoredBytes()

	// storedBytes shouldn't change since removedBytes is 0.
	if storedBytesAfter != storedBytesBefore {
		panic(fmt.Sprintf(
			"storedBytes unexpectedly changed from %d to %d",
			storedBytesBefore, storedBytesAfter))
	}

	timeToFlush := flushEnded.Sub(j.currFlushStarted)
	j.currBytesFlushing = 0
	j.currFlushStarted = time.Time{}
	if flushedBytes > 0 {
		j.bytesPerSecEstimate.Add(float64(flushedBytes) / timeToFlush.Seconds())
	}
	j.diskLimiter.onBlocksFlush(ctx, flushedBytes, j.chargedTo)
	j.log.CDebugf(ctx, "Flushed %d bytes in %s; new bandwidth estimate "+
		"is %f bytes/sec", flushedBytes, timeToFlush,
		j.bytesPerSecEstimate.Value())

	return nil
}

func (j *tlfJournal) startFlush(bytesToFlush int64) {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	j.currBytesFlushing = bytesToFlush
	j.currFlushStarted = j.config.Clock().Now()
}

func (j *tlfJournal) flushBlockEntries(
	ctx context.Context, end journalOrdinal) (
	numFlushed int, maxMDRevToFlush kbfsmd.Revision,
	converted bool, err error) {
	entries, bytesToFlush, maxMDRevToFlush, err := j.getNextBlockEntriesToFlush(
		ctx, end)
	if err != nil {
		return 0, kbfsmd.RevisionUninitialized, false, err
	}

	if entries.length() == 0 {
		return 0, maxMDRevToFlush, false, nil
	}

	j.log.CDebugf(ctx, "Flushing %d blocks, up to rev %d",
		entries.puts.numBlocks(), maxMDRevToFlush)

	// Mark these blocks as flushing, and clear when done.
	err = j.markFlushingBlockIDs(entries)
	if err != nil {
		return 0, kbfsmd.RevisionUninitialized, false, err
	}
	cleared := false
	defer func() {
		if !cleared {
			clearErr := j.clearFlushingBlockIDs(entries)
			if err == nil {
				err = clearErr
			}
		}
	}()

	// TODO: fill this in for logging/error purposes.
	var tlfName tlf.CanonicalName

	eg, groupCtx := errgroup.WithContext(ctx)
	convertCtx, convertCancel := context.WithCancel(groupCtx)

	// Flush the blocks in a goroutine. Alongside make another
	// goroutine that listens for MD puts and checks the size of the
	// MD journal, and converts to a local squash branch if it gets
	// too large.  While the 2nd goroutine is waiting, it should exit
	// immediately as soon as the 1st one finishes, but if it is
	// already working on a conversion it should finish that work.
	//
	// If the 2nd goroutine makes a branch, foreground writes could
	// trigger CR while blocks are still being flushed.  This can't
	// usually happen, because flushing is paused while CR is
	// happening.  flush() has to make sure to get the new MD journal
	// end, and we need to make sure `maxMDRevToFlush` is still valid.
	j.startFlush(bytesToFlush)
	eg.Go(func() error {
		defer convertCancel()
		cacheType := DiskBlockAnyCache
		if j.config.IsSyncedTlf(j.tlfID) {
			cacheType = DiskBlockSyncCache
		}
		return flushBlockEntries(groupCtx, j.log, j.deferLog,
			j.delegateBlockServer, j.config.BlockCache(), j.config.Reporter(),
			j.tlfID, tlfName, entries, cacheType)
	})
	converted = false
	eg.Go(func() error {
		// We might need to run multiple conversions during a single
		// batch of block flushes, so loop until the batch finishes.
		for {
			select {
			case <-j.needBranchCheckCh:
				// Don't signal a pause when doing this conversion in
				// a separate goroutine, because it ends up canceling
				// the flush context, which means all the block puts
				// would get canceled and we don't want that.
				// Instead, let the current iteration of the flush
				// finish, and then signal at the top of the next
				// iteration.
				convertedNow, err :=
					j.convertMDsToBranchIfOverThreshold(groupCtx, false)
				if err != nil {
					return err
				}
				converted = converted || convertedNow
			case <-convertCtx.Done():
				return nil // Canceled because the block puts finished
			}
		}
	})

	err = eg.Wait()
	if err != nil {
		return 0, kbfsmd.RevisionUninitialized, false, err
	}
	endFlush := j.config.Clock().Now()

	err = j.clearFlushingBlockIDs(entries)
	cleared = true
	if err != nil {
		return 0, kbfsmd.RevisionUninitialized, false, err
	}

	err = j.removeFlushedBlockEntries(ctx, entries, endFlush)
	if err != nil {
		return 0, kbfsmd.RevisionUninitialized, false, err
	}

	// If a conversion happened, the original `maxMDRevToFlush` only
	// applies for sure if its mdRevMarker entry was already for a
	// local squash.  TODO: conversion might not have actually
	// happened yet, in which case it's still ok to flush
	// maxMDRevToFlush.
	if converted && maxMDRevToFlush != kbfsmd.RevisionUninitialized &&
		!entries.revIsLocalSquash(maxMDRevToFlush) {
		maxMDRevToFlush = kbfsmd.RevisionUninitialized
	}

	return entries.length(), maxMDRevToFlush, converted, nil
}

func (j *tlfJournal) getNextMDEntryToFlush(ctx context.Context,
	end kbfsmd.Revision) (kbfsmd.ID, *RootMetadataSigned, kbfsmd.ExtraMetadata, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return kbfsmd.ID{}, nil, nil, err
	}

	return j.mdJournal.getNextEntryToFlush(ctx, end, j.config.Crypto())
}

func (j *tlfJournal) convertMDsToBranchLocked(
	ctx context.Context, bid kbfsmd.BranchID, doSignal bool) error {
	err := j.mdJournal.convertToBranch(
		ctx, bid, j.config.Crypto(), j.config.Codec(), j.tlfID,
		j.config.MDCache())
	if err != nil {
		return err
	}
	j.unsquashedBytes = 0

	if j.onBranchChange != nil {
		j.onBranchChange.onTLFBranchChange(j.tlfID, bid)
	}

	// Pause while on a conflict branch.
	if doSignal {
		j.pause(journalPauseConflict)
	}

	return nil
}

func (j *tlfJournal) convertMDsToBranch(ctx context.Context) error {
	bid, err := j.config.Crypto().MakeRandomBranchID()
	if err != nil {
		return err
	}

	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return err
	}

	return j.convertMDsToBranchLocked(ctx, bid, true)
}

func (j *tlfJournal) convertMDsToBranchIfOverThreshold(ctx context.Context,
	doSignal bool) (bool, error) {
	if j.singleOpMode == singleOpRunning {
		// Don't squash until the single operation is complete.
		return false, nil
	}

	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return false, err
	}

	if j.mdJournal.getBranchID() != kbfsmd.NullBranchID {
		// Already on a conflict branch, so nothing to do.
		return false, nil
	}

	atLeastOneRev, err := j.mdJournal.atLeastNNonLocalSquashes(1)
	if err != nil {
		return false, err
	}
	if !atLeastOneRev {
		// If there isn't at least one non-local-squash revision, we can
		// bail early since there's definitely nothing to do.
		return false, nil
	}

	squashByRev := false
	if j.singleOpMode == singleOpFinished {
		j.log.CDebugf(ctx, "Squashing due to single op completion")
		// Always squash if we've finished the single op and have more
		// than one revision pending.
		squashByRev = true
		j.unsquashedBytes = 0
	} else if j.config.BGFlushDirOpBatchSize() == 1 {
		squashByRev, err =
			j.mdJournal.atLeastNNonLocalSquashes(ForcedBranchSquashRevThreshold)
		if err != nil {
			return false, err
		}
	} else {
		// Squashing is already done in folderBranchOps, so just mark
		// this revision as squashed, so simply turn it off here.
		j.unsquashedBytes = 0
	}

	// Note that j.unsquashedBytes is just an estimate -- it doesn't
	// account for blocks that will be eliminated as part of the
	// squash, and it doesn't count unsquashed bytes that were written
	// to disk before this tlfJournal instance started.  But it should
	// be close enough to work for the purposes of this optimization.
	squashByBytes := j.unsquashedBytes >= j.forcedSquashByBytes
	if !squashByRev && !squashByBytes {
		// Not over either threshold yet.
		return false, nil
	}

	j.log.CDebugf(ctx, "Converting journal with %d unsquashed bytes "+
		"to a branch", j.unsquashedBytes)

	// If we're squashing by bytes, and there's exactly one
	// non-local-squash revision, just directly mark it as squashed to
	// avoid the CR overhead.
	if !squashByRev {
		moreThanOneRev, err := j.mdJournal.atLeastNNonLocalSquashes(2)
		if err != nil {
			return false, err
		}

		if !moreThanOneRev {
			j.log.CDebugf(ctx, "Avoiding CR when there is only one "+
				"revision that needs squashing; marking as local squash")
			err = j.mdJournal.markLatestAsLocalSquash(ctx)
			if err != nil {
				return false, err
			}

			err = j.blockJournal.markLatestRevMarkerAsLocalSquash()
			if err != nil {
				return false, err
			}

			j.unsquashedBytes = 0
			return true, nil
		}
	}

	err = j.convertMDsToBranchLocked(ctx, kbfsmd.PendingLocalSquashBranchID, doSignal)
	if err != nil {
		return false, err
	}
	return true, nil
}

// getBlockDeferredGCRange wraps blockJournal.getDeferredGCRange. The
// returned blockJournal should be used instead of j.blockJournal, as
// we want to call blockJournal.doGC outside of journalLock.
func (j *tlfJournal) getBlockDeferredGCRange() (
	blockJournal *blockJournal, length int,
	earliest, latest journalOrdinal, err error) {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return nil, 0, 0, 0, err
	}
	length, earliest, latest, err = j.blockJournal.getDeferredGCRange()
	if err != nil {
		return nil, 0, 0, 0, err
	}
	return j.blockJournal, length, earliest, latest, nil
}

func (j *tlfJournal) doOnMDFlushAndRemoveFlushedMDEntry(ctx context.Context,
	mdID kbfsmd.ID, rmds *RootMetadataSigned) error {
	if j.onMDFlush != nil {
		j.onMDFlush.onMDFlush(rmds.MD.TlfID(), rmds.MD.BID(),
			rmds.MD.RevisionNumber())
	}

	blockJournal, length, earliest, latest, err :=
		j.getBlockDeferredGCRange()
	if err != nil {
		return err
	}

	var removedBytes, removedFiles int64
	if length != 0 {
		// doGC() only needs to be called under the flushLock, not the
		// journalLock, as it doesn't touch the actual journal, only
		// the deferred GC journal.
		var err error
		removedBytes, removedFiles, err = blockJournal.doGC(
			ctx, earliest, latest)
		if err != nil {
			return err
		}

		j.diskLimiter.release(ctx, journalLimitTrackerType, removedBytes,
			removedFiles)
	}

	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return err
	}

	if length != 0 {
		clearedBlockJournal, aggregateInfo, err :=
			j.blockJournal.clearDeferredGCRange(
				ctx, removedBytes, removedFiles, earliest, latest)
		if err != nil {
			return err
		}

		if clearedBlockJournal {
			equal, err := kbfscodec.Equal(
				j.config.Codec(), aggregateInfo, blockAggregateInfo{})
			if err != nil {
				return err
			}
			if !equal {
				j.log.CWarningf(ctx,
					"Cleared block journal for %s, but still has aggregate info %+v",
					j.tlfID, aggregateInfo)
				// TODO: Consider trying to adjust the disk
				// limiter state to compensate for the
				// leftover bytes/files here. Ideally, the
				// disk limiter would keep track of per-TLF
				// state, so we could just call
				// j.diskLimiter.onJournalClear(tlfID) to have
				// it clear its state for this TLF.
			}
		}
	}

	clearedMDJournal, err := j.removeFlushedMDEntryLocked(ctx, mdID, rmds)
	if err != nil {
		return err
	}

	// If we check just clearedBlockJournal here, we'll miss the
	// chance to clear the TLF journal if the block journal
	// empties out before the MD journal does.
	if j.blockJournal.empty() && clearedMDJournal {
		j.log.CDebugf(ctx,
			"TLF journal is now empty; removing all files in %s", j.dir)

		// If we ever need to upgrade the journal version,
		// this would be the place to do it.

		// Reset to initial state.
		j.unflushedPaths = &unflushedPathCache{}
		j.unsquashedBytes = 0
		j.flushingBlocks = make(map[kbfsblock.ID]bool)

		err := ioutil.RemoveAll(j.dir)
		if err != nil {
			return err
		}
		// Remember to make the info file again if more data comes
		// into this journal.
		j.needInfoFile = true
	}

	return nil
}

func (j *tlfJournal) removeFlushedMDEntryLocked(ctx context.Context,
	mdID kbfsmd.ID, rmds *RootMetadataSigned) (clearedMDJournal bool, err error) {
	clearedMDJournal, err = j.mdJournal.removeFlushedEntry(ctx, mdID, rmds)
	if err != nil {
		return false, err
	}

	j.unflushedPaths.removeFromCache(rmds.MD.RevisionNumber())
	return clearedMDJournal, nil
}

func (j *tlfJournal) flushOneMDOp(ctx context.Context,
	maxMDRevToFlush kbfsmd.Revision, flushCtx flushContext) (
	flushed bool, err error) {
	if maxMDRevToFlush == kbfsmd.RevisionUninitialized {
		// Avoid a call to `getNextMDEntryToFlush`, which
		// would otherwise unnecessarily read an MD from disk.
		return false, nil
	}

	j.log.CDebugf(ctx, "Flushing one MD to server")
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx, "Flush failed with %v", err)
		}
	}()

	mdServer := j.config.MDServer()

	mdID, rmds, extra, err := j.getNextMDEntryToFlush(ctx, maxMDRevToFlush+1)
	if err != nil {
		return false, err
	}
	if mdID == (kbfsmd.ID{}) {
		return false, nil
	}

	// If this is the first revision, and there are more MD entries
	// still to be flushed, don't pass in lc yet, wait for the next
	// flush.  Normally the lock context is used in single-op mode,
	// and there will always only be one revision to flush.  The
	// exception is when the first revision of the TLF hasn't been
	// pushed yet, since it can't be squashed.  In that case, there
	// could be 2 revisions in the MD journal.  Don't unlock on the
	// first flush, since we'll still need to hold the lock until the
	// second flush.
	if flushCtx.lockContextForPut != nil {
		_, mdCount, err := j.getJournalEntryCounts()
		if err != nil {
			return false, err
		}
		if mdCount > 1 {
			if rmds.MD.RevisionNumber() != kbfsmd.RevisionInitial {
				return false, errors.New("Unexpectedly flushing more " +
					"than one revision while unlocking, and the first one " +
					"isn't the initial revision")
			}

			j.log.CDebugf(ctx, "Ignoring lock context for initial MD flush")
			flushCtx.lockContextForPut = nil
		}
	}

	j.log.CDebugf(ctx, "Flushing MD for TLF=%s with id=%s, rev=%s, bid=%s",
		rmds.MD.TlfID(), mdID, rmds.MD.RevisionNumber(), rmds.MD.BID())
	pushErr := mdServer.Put(ctx, rmds, extra,
		flushCtx.lockContextForPut, flushCtx.priorityForPut)
	if isRevisionConflict(pushErr) {
		headMdID, err := getMdID(ctx, mdServer, j.config.Codec(),
			rmds.MD.TlfID(), rmds.MD.BID(), rmds.MD.MergedStatus(),
			rmds.MD.RevisionNumber(), nil)
		if err != nil {
			j.log.CWarningf(ctx,
				"getMdID failed for TLF %s, BID %s, and revision %d: %v",
				rmds.MD.TlfID(), rmds.MD.BID(), rmds.MD.RevisionNumber(), err)
		} else if headMdID == mdID {
			if headMdID == (kbfsmd.ID{}) {
				panic("nil earliestID and revision conflict error returned by pushEarliestToServer")
			}
			// We must have already flushed this MD, so continue.
			pushErr = nil
		} else if rmds.MD.MergedStatus() == kbfsmd.Merged {
			j.log.CDebugf(ctx, "Conflict detected %v", pushErr)
			// Convert MDs to a branch and return -- the journal
			// pauses until the resolution is complete.
			err = j.convertMDsToBranch(ctx)
			if err != nil {
				return false, err
			}
			return false, nil
		}
	}
	if pushErr != nil {
		return false, pushErr
	}

	j.config.MDCache().MarkPutToServer(
		rmds.MD.TlfID(), rmds.MD.RevisionNumber(), rmds.MD.BID())

	err = j.doOnMDFlushAndRemoveFlushedMDEntry(ctx, mdID, rmds)
	if err != nil {
		return false, err
	}

	return true, nil
}

func (j *tlfJournal) getJournalEntryCounts() (
	blockEntryCount, mdEntryCount uint64, err error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return 0, 0, err
	}

	blockEntryCount = j.blockJournal.length()
	mdEntryCount = j.mdJournal.length()
	return blockEntryCount, mdEntryCount, nil
}

func (j *tlfJournal) isOnConflictBranch() (bool, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()

	if err := j.checkEnabledLocked(); err != nil {
		return false, err
	}

	return j.mdJournal.getBranchID() != kbfsmd.NullBranchID, nil
}

func (j *tlfJournal) getJournalStatusLocked() (TLFJournalStatus, error) {
	if err := j.checkEnabledLocked(); err != nil {
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
	blockEntryCount := j.blockJournal.length()
	lastFlushErr := ""
	if j.lastFlushErr != nil {
		lastFlushErr = j.lastFlushErr.Error()
	}
	storedBytes := j.blockJournal.getStoredBytes()
	storedFiles := j.blockJournal.getStoredFiles()
	unflushedBytes := j.blockJournal.getUnflushedBytes()
	quotaUsed, quotaLimit := j.diskLimiter.getQuotaInfo(j.chargedTo)
	var endEstimate *time.Time
	if unflushedBytes > 0 {
		now := j.config.Clock().Now()
		bwEstimate := j.bytesPerSecEstimate.Value()

		// How long do we think is remaining in the current flush?
		timeLeftInCurrFlush := time.Duration(0)
		if j.currBytesFlushing > 0 {
			timeFlushingSoFar := now.Sub(j.currFlushStarted)
			totalExpectedTime := time.Duration(0)
			if bwEstimate > 0 {
				totalExpectedTime = time.Duration(
					float64(j.currBytesFlushing)/bwEstimate) * time.Second
			}

			if totalExpectedTime > timeFlushingSoFar {
				timeLeftInCurrFlush = totalExpectedTime - timeFlushingSoFar
			} else {
				// Arbitrarily say that there's one second left, if
				// we've taken longer than expected to flush so far.
				timeLeftInCurrFlush = 1 * time.Second
			}
		}

		// Add the estimate for the blocks that haven't started flushing yet.

		// If we have no estimate for this TLF yet, pick 10 seconds
		// arbitrarily.
		restOfTimeLeftEstimate := 10 * time.Second
		if bwEstimate > 0 {
			bytesLeft := unflushedBytes - j.currBytesFlushing
			restOfTimeLeftEstimate = time.Duration(
				float64(bytesLeft)/bwEstimate) * time.Second
		}

		t := now.Add(timeLeftInCurrFlush + restOfTimeLeftEstimate)
		endEstimate = &t
	}
	return TLFJournalStatus{
		Dir:             j.dir,
		BranchID:        j.mdJournal.getBranchID().String(),
		RevisionStart:   earliestRevision,
		RevisionEnd:     latestRevision,
		BlockOpCount:    blockEntryCount,
		StoredBytes:     storedBytes,
		StoredFiles:     storedFiles,
		QuotaUsedBytes:  quotaUsed,
		QuotaLimitBytes: quotaLimit,
		UnflushedBytes:  unflushedBytes,
		EndEstimate:     endEstimate,
		LastFlushErr:    lastFlushErr,
	}, nil
}

func (j *tlfJournal) getJournalStatus() (TLFJournalStatus, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	return j.getJournalStatusLocked()
}

// getJournalStatusWithRange returns the journal status, and either a
// non-nil unflushedPathsMap is returned, which can be used directly
// to fill in UnflushedPaths, or a list of ImmutableBareRootMetadatas
// is returned (along with a bool indicating whether that list is
// complete), which can be used to build an unflushedPathsMap. If
// complete is true, then the list may be empty; otherwise, it is
// guaranteed to not be empty.
func (j *tlfJournal) getJournalStatusWithRange(ctx context.Context) (
	jStatus TLFJournalStatus, unflushedPaths unflushedPathsMap,
	ibrmds []ImmutableBareRootMetadata, complete bool, err error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	jStatus, err = j.getJournalStatusLocked()
	if err != nil {
		return TLFJournalStatus{}, nil, nil, false, err
	}

	unflushedPaths = j.unflushedPaths.getUnflushedPaths()
	if unflushedPaths != nil {
		return jStatus, unflushedPaths, nil, true, nil
	}

	if jStatus.RevisionEnd == kbfsmd.RevisionUninitialized {
		return jStatus, nil, nil, true, nil
	}

	complete = true
	stop := jStatus.RevisionEnd
	if stop > jStatus.RevisionStart+1000 {
		stop = jStatus.RevisionStart + 1000
		complete = false
	}
	// It would be nice to avoid getting this range if we are not
	// the initializer, but at this point we don't know if we'll
	// need to initialize or not.
	ibrmds, err = j.mdJournal.getRange(
		ctx, j.mdJournal.branchID, jStatus.RevisionStart, stop)
	if err != nil {
		return TLFJournalStatus{}, nil, nil, false, err
	}
	return jStatus, nil, ibrmds, complete, nil
}

// getUnflushedPathMDInfos converts the given list of bare root
// metadatas into unflushedPathMDInfo objects. The caller must NOT
// hold `j.journalLock`, because blocks from the journal may need to
// be read as part of the decryption.
func (j *tlfJournal) getUnflushedPathMDInfos(ctx context.Context,
	ibrmds []ImmutableBareRootMetadata) ([]unflushedPathMDInfo, error) {
	if len(ibrmds) == 0 {
		return nil, nil
	}

	ibrmdBareHandle, err := ibrmds[0].MakeBareTlfHandleWithExtra()
	if err != nil {
		return nil, err
	}

	handle, err := MakeTlfHandle(
		ctx, ibrmdBareHandle, j.tlfID.Type(), j.config.resolver(),
		j.config.usernameGetter(), constIDGetter{j.tlfID})
	if err != nil {
		return nil, err
	}

	mdInfos := make([]unflushedPathMDInfo, 0, len(ibrmds))

	for _, ibrmd := range ibrmds {
		// TODO: Avoid having to do this type assertion and
		// convert to RootMetadata.
		brmd, ok := ibrmd.RootMetadata.(kbfsmd.MutableRootMetadata)
		if !ok {
			return nil, kbfsmd.MutableRootMetadataNoImplError{}
		}
		rmd := makeRootMetadata(brmd, ibrmd.extra, handle)

		// Assume, since journal is running, that we're in default mode.
		mode := NewInitModeFromType(InitDefault)
		pmd, err := decryptMDPrivateData(
			ctx, j.config.Codec(), j.config.Crypto(),
			j.config.BlockCache(), j.config.BlockOps(),
			j.config.mdDecryptionKeyGetter(), j.config.teamMembershipChecker(),
			mode, j.uid, rmd.GetSerializedPrivateMetadata(), rmd, rmd, j.log)
		if err != nil {
			return nil, err
		}
		rmd.data = pmd

		mdInfo := unflushedPathMDInfo{
			revision:       ibrmd.RevisionNumber(),
			kmd:            rmd,
			pmd:            pmd,
			localTimestamp: ibrmd.localTimestamp,
		}
		mdInfos = append(mdInfos, mdInfo)
	}
	return mdInfos, nil
}

func (j *tlfJournal) getJournalStatusWithPaths(ctx context.Context,
	cpp chainsPathPopulator) (jStatus TLFJournalStatus, err error) {
	// This loop is limited only by the lifetime of `ctx`.
	var unflushedPaths unflushedPathsMap
	var complete bool
	for {
		var ibrmds []ImmutableBareRootMetadata
		jStatus, unflushedPaths, ibrmds, complete, err =
			j.getJournalStatusWithRange(ctx)
		if err != nil {
			return TLFJournalStatus{}, err
		}

		if unflushedPaths != nil {
			break
		}

		// We need to make or initialize the unflushed paths.
		if !complete {
			// Figure out the paths for the truncated MD range,
			// but don't cache it.
			unflushedPaths = make(unflushedPathsMap)
			j.log.CDebugf(ctx, "Making incomplete unflushed path cache")
			mdInfos, err := j.getUnflushedPathMDInfos(ctx, ibrmds)
			if err != nil {
				return TLFJournalStatus{}, err
			}
			err = addUnflushedPaths(ctx, j.uid, j.key,
				j.config.Codec(), j.log, mdInfos, cpp,
				unflushedPaths)
			if err != nil {
				return TLFJournalStatus{}, err
			}
			break
		}

		// We need to init it ourselves, or wait for someone else to
		// do it.  Save the cache in a local variable in case it gets
		// cleared when the journal is flushed while it's
		// initializing.
		upCache := j.unflushedPaths
		doInit, err := upCache.startInitializeOrWait(ctx)
		if err != nil {
			return TLFJournalStatus{}, err
		}
		if doInit {
			initSuccess := false
			defer func() {
				if !initSuccess || err != nil {
					upCache.abortInitialization()
				}
			}()
			mdInfos, err := j.getUnflushedPathMDInfos(ctx, ibrmds)
			if err != nil {
				return TLFJournalStatus{}, err
			}
			unflushedPaths, initSuccess, err = upCache.initialize(
				ctx, j.uid, j.key, j.config.Codec(), j.log, cpp, mdInfos)
			if err != nil {
				return TLFJournalStatus{}, err
			}
			// All done!
			break
		}

		j.log.CDebugf(ctx, "Waited for unflushed paths initialization, "+
			"trying again to get the status")
	}

	pathsSeen := make(map[string]bool)
	for _, revPaths := range unflushedPaths {
		for path := range revPaths {
			if !pathsSeen[path] {
				jStatus.UnflushedPaths = append(jStatus.UnflushedPaths, path)
				pathsSeen[path] = true
			}
		}
	}

	if !complete {
		jStatus.UnflushedPaths =
			append(jStatus.UnflushedPaths, incompleteUnflushedPathsMarker)
	}
	return jStatus, nil
}

func (j *tlfJournal) getByteCounts() (
	storedBytes, storedFiles, unflushedBytes int64, err error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return 0, 0, 0, err
	}

	return j.blockJournal.getStoredBytes(), j.blockJournal.getStoredFiles(),
		j.blockJournal.getUnflushedBytes(), nil
}

func (j *tlfJournal) shutdown(ctx context.Context) {
	select {
	case j.needShutdownCh <- struct{}{}:
	default:
	}

	<-j.backgroundShutdownCh

	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		// Already shutdown.
		return
	}

	// Even if we shut down the journal, its blocks still take up
	// space, but we don't want to double-count them if we start
	// up this journal again, so we need to adjust them here.
	//
	// TODO: If we ever expect to shut down non-empty journals any
	// time other than during shutdown, we should still count
	// shut-down journals against the disk limit.
	storedBytes := j.blockJournal.getStoredBytes()
	unflushedBytes := j.blockJournal.getUnflushedBytes()
	storedFiles := j.blockJournal.getStoredFiles()
	j.diskLimiter.onJournalDisable(
		ctx, storedBytes, unflushedBytes, storedFiles, j.chargedTo)

	// Make further accesses error out.
	j.blockJournal = nil
	j.mdJournal = nil
}

// disable prevents new operations from hitting the journal.  Will
// fail unless the journal is completely empty.
func (j *tlfJournal) disable() (wasEnabled bool, err error) {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	err = j.checkEnabledLocked()
	switch errors.Cause(err).(type) {
	case nil:
		// Continue.
		break
	case errTLFJournalDisabled:
		// Already disabled.
		return false, nil
	default:
		return false, err
	}

	blockEntryCount := j.blockJournal.length()
	mdEntryCount := j.mdJournal.length()

	// You can only disable an empty journal.
	if blockEntryCount > 0 || mdEntryCount > 0 {
		return false, errors.WithStack(errTLFJournalNotEmpty{})
	}

	j.disabled = true
	return true, nil
}

func (j *tlfJournal) enable() error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	err := j.checkEnabledLocked()
	switch errors.Cause(err).(type) {
	case nil:
		// Already enabled.
		return nil
	case errTLFJournalDisabled:
		// Continue.
		break
	default:
		return err
	}

	j.disabled = false
	return nil
}

// All the functions below just do the equivalent blockJournal or
// mdJournal function under j.journalLock.

// getBlockData doesn't take a block context param, unlike the remote
// block server, since we still want to serve blocks even if all local
// references have been deleted (for example, a block that's been
// flushed but is still being and served on disk until the next
// successful MD flush).  This is safe because the journal doesn't
// support removing references for anything other than a flush (see
// the comment in tlfJournal.removeBlockReferences).
func (j *tlfJournal) getBlockData(id kbfsblock.ID) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}

	return j.blockJournal.getData(id)
}

func (j *tlfJournal) getBlockSize(id kbfsblock.ID) (uint32, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return 0, err
	}

	size, err := j.blockJournal.getDataSize(id)
	if err != nil {
		return 0, err
	}
	// Block sizes are restricted, but `size` is an int64 because
	// that's what the OS gives us.  Convert it to a uint32. TODO:
	// check this is safe?
	return uint32(size), nil
}

// ErrDiskLimitTimeout is returned when putBlockData exceeds
// diskLimitTimeout when trying to acquire bytes to put.
type ErrDiskLimitTimeout struct {
	timeout        time.Duration
	requestedBytes int64
	requestedFiles int64
	availableBytes int64
	availableFiles int64
	usageBytes     int64
	usageFiles     int64
	limitBytes     float64
	limitFiles     float64
	err            error
	reportable     bool
}

// Error implements the error interface for ErrDiskLimitTimeout.  It
// has a pointer receiver because `block_util.go` need to
// modify it in some cases while preserving any stacks attached to it
// via the `errors` package.
func (e *ErrDiskLimitTimeout) Error() string {
	return fmt.Sprintf("Disk limit timeout of %s reached; requested %d bytes and %d files, %d bytes and %d files available: %+v",
		e.timeout, e.requestedBytes, e.requestedFiles,
		e.availableBytes, e.availableFiles, e.err)
}

func (j *tlfJournal) checkInfoFileLocked() error {
	if !j.needInfoFile {
		return nil
	}

	err := writeTLFJournalInfoFile(
		j.dir, j.uid, j.key, j.tlfID, j.chargedTo)
	if err != nil {
		return err
	}
	j.needInfoFile = false
	return nil
}

func (j *tlfJournal) putBlockData(
	ctx context.Context, id kbfsblock.ID, blockCtx kbfsblock.Context, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	// Since beforeBlockPut can block, it should happen outside of
	// the journal lock.

	timeout := j.config.diskLimitTimeout()
	acquireCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	bufLen := int64(len(buf))
	availableBytes, availableFiles, err := j.diskLimiter.reserveWithBackpressure(
		acquireCtx, journalLimitTrackerType, bufLen, filesPerBlockMax, j.chargedTo)
	switch errors.Cause(err) {
	case nil:
		// Continue.
	case context.DeadlineExceeded:
		// NOTE: there is a slight race here, where if a flush
		// finishes between the `beforeBlockPut` call and here, we
		// could put out-of-date limit info in the error, and it might
		// look like there is available space.  It doesn't seem worth
		// changing the interface of `beforeBlockPut` to fix, though.
		usageBytes, limitBytes, usageFiles, limitFiles :=
			j.diskLimiter.getDiskLimitInfo()
		return errors.WithStack(&ErrDiskLimitTimeout{
			timeout, bufLen, filesPerBlockMax,
			availableBytes, availableFiles, usageBytes, usageFiles,
			limitBytes, limitFiles, err, false,
		})
	default:
		return err
	}

	var putData bool
	defer func() {
		j.diskLimiter.commitOrRollback(ctx, journalLimitTrackerType, bufLen,
			filesPerBlockMax, putData, j.chargedTo)
	}()

	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return err
	}

	if err := j.checkInfoFileLocked(); err != nil {
		return err
	}

	storedBytesBefore := j.blockJournal.getStoredBytes()

	putData, err = j.blockJournal.putData(
		ctx, id, blockCtx, buf, serverHalf)
	if err != nil {
		return err
	}

	storedBytesAfter := j.blockJournal.getStoredBytes()

	if putData && storedBytesAfter != (storedBytesBefore+bufLen) {
		panic(fmt.Sprintf(
			"storedBytes changed from %d to %d, but %d bytes of data was put",
			storedBytesBefore, storedBytesAfter, bufLen))
	} else if !putData && storedBytesBefore != storedBytesAfter {
		panic(fmt.Sprintf(
			"storedBytes changed from %d to %d, but data was not put",
			storedBytesBefore, storedBytesAfter))
	}

	if putData && j.mdJournal.branchID == kbfsmd.NullBranchID {
		j.unsquashedBytes += uint64(bufLen)
	}

	j.config.Reporter().NotifySyncStatus(ctx, &keybase1.FSPathSyncStatus{
		FolderType: j.tlfID.Type().FolderType(),
		// Path: TODO,
		// TODO: should this be the complete total for the file/directory,
		// rather than the diff?
		SyncingBytes: bufLen,
		// SyncingOps: TODO,
	})

	j.signalWork()

	return nil
}

func (j *tlfJournal) getQuotaInfo() (usedQuotaBytes, quotaBytes int64) {
	return j.diskLimiter.getQuotaInfo(j.chargedTo)
}

func (j *tlfJournal) addBlockReference(
	ctx context.Context, id kbfsblock.ID, context kbfsblock.Context) error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return err
	}

	if err := j.checkInfoFileLocked(); err != nil {
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
	ctx context.Context, contexts kbfsblock.ContextMap) (
	liveCounts map[kbfsblock.ID]int, err error) {
	// Currently the block journal will still serve block data even if
	// all journal references to a block have been removed (i.e.,
	// because they have all been flushed to the remote server).  If
	// we ever need to support the `BlockServer.RemoveReferences` call
	// in the journal, we might need to change the journal so that it
	// marks blocks as flushed-but-still-readable, so that we can
	// distinguish them from blocks that has had all its references
	// removed and shouldn't be served anymore.  For now, just fail
	// this call to make sure no uses of it creep in.
	return nil, errors.Errorf(
		"Removing block references is currently unsupported in the journal")
}

func (j *tlfJournal) archiveBlockReferences(
	ctx context.Context, contexts kbfsblock.ContextMap) error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return err
	}

	if err := j.checkInfoFileLocked(); err != nil {
		return err
	}

	err := j.blockJournal.archiveReferences(ctx, contexts)
	if err != nil {
		return err
	}

	j.signalWork()

	return nil
}

func (j *tlfJournal) isBlockUnflushed(id kbfsblock.ID) (bool, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return false, err
	}

	// Conservatively assume that a block that's on its way to the
	// server _has_ been flushed, so that the caller will try to clean
	// it up if it's not needed anymore.
	if j.flushingBlocks[id] {
		return true, nil
	}

	return j.blockJournal.isUnflushed(id)
}

func (j *tlfJournal) markFlushingBlockIDs(entries blockEntriesToFlush) error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return err
	}

	entries.markFlushingBlockIDs(j.flushingBlocks)
	return nil
}

func (j *tlfJournal) clearFlushingBlockIDs(entries blockEntriesToFlush) error {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return err
	}

	entries.clearFlushingBlockIDs(j.flushingBlocks)
	return nil
}

func (j *tlfJournal) getBranchID() (kbfsmd.BranchID, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return kbfsmd.NullBranchID, err
	}

	return j.mdJournal.branchID, nil
}

func (j *tlfJournal) getMDHead(
	ctx context.Context, bid kbfsmd.BranchID) (ImmutableBareRootMetadata, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return ImmutableBareRootMetadata{}, err
	}

	return j.mdJournal.getHead(ctx, bid)
}

func (j *tlfJournal) getMDRange(
	ctx context.Context, bid kbfsmd.BranchID, start, stop kbfsmd.Revision) (
	[]ImmutableBareRootMetadata, error) {
	j.journalLock.RLock()
	defer j.journalLock.RUnlock()
	if err := j.checkEnabledLocked(); err != nil {
		return nil, err
	}

	return j.mdJournal.getRange(ctx, bid, start, stop)
}

func (j *tlfJournal) doPutMD(ctx context.Context, rmd *RootMetadata,
	mdInfo unflushedPathMDInfo, perRevMap unflushedPathsPerRevMap,
	verifyingKey kbfscrypto.VerifyingKey) (
	irmd ImmutableRootMetadata, retryPut bool, err error) {
	// Now take the lock and put the MD, merging in the unflushed
	// paths while under the lock.
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return ImmutableRootMetadata{}, false, err
	}

	if err := j.checkInfoFileLocked(); err != nil {
		return ImmutableRootMetadata{}, false, err
	}

	if !j.unflushedPaths.appendToCache(mdInfo, perRevMap) {
		return ImmutableRootMetadata{}, true, nil
	}

	// Treat the first revision as a squash, so that it doesn't end up
	// as the earliest revision in a range during a CR squash.
	isFirstRev := rmd.Revision() == kbfsmd.RevisionInitial

	// TODO: remove the revision from the cache on any errors below?
	// Tricky when the append is only queued.

	mdID, err := j.mdJournal.put(ctx, j.config.Crypto(),
		j.config.encryptionKeyGetter(), j.config.BlockSplitter(),
		rmd, isFirstRev)
	if err != nil {
		return ImmutableRootMetadata{}, false, err
	}

	err = j.blockJournal.markMDRevision(ctx, rmd.Revision(), isFirstRev)
	if err != nil {
		return ImmutableRootMetadata{}, false, err
	}

	// Put the MD into the cache under the same lock as it is put in
	// the journal, to guarantee it will be replaced if the journal is
	// converted into a branch before any of the upper layer have a
	// chance to cache it.
	irmd = MakeImmutableRootMetadata(
		rmd, verifyingKey, mdID, j.config.Clock().Now(), false)
	// Revisions created locally should always override anything else
	// in the cache, so use `Replace` rather than `Put`.
	err = j.config.MDCache().Replace(irmd, irmd.BID())
	if err != nil {
		return ImmutableRootMetadata{}, false, err
	}
	j.log.CDebugf(ctx, "Put update rev=%d id=%s", rmd.Revision(), mdID)

	j.signalWork()

	select {
	case j.needBranchCheckCh <- struct{}{}:
	default:
	}

	return irmd, false, nil
}

// prepAndAddRMDWithRetry prepare the paths without holding the lock,
// as `f` might need to take the lock.  This is a no-op if the
// unflushed path cache is uninitialized.  TODO: avoid doing this if
// we can somehow be sure the cache won't be initialized by the time
// we finish this operation.
func (j *tlfJournal) prepAndAddRMDWithRetry(ctx context.Context,
	rmd *RootMetadata,
	f func(unflushedPathMDInfo, unflushedPathsPerRevMap) (bool, error)) error {
	mdInfo := unflushedPathMDInfo{
		revision: rmd.Revision(),
		kmd:      rmd,
		pmd:      *rmd.Data(),
		// TODO: Plumb through clock?  Though the timestamp doesn't
		// matter for the unflushed path cache.
		localTimestamp: time.Now(),
	}
	perRevMap, err := j.unflushedPaths.prepUnflushedPaths(
		ctx, j.uid, j.key, j.config.Codec(), j.log, mdInfo)
	if err != nil {
		return err
	}

	retry, err := f(mdInfo, perRevMap)
	if err != nil {
		return err
	}

	if retry {
		// The cache was initialized after the last time we tried to
		// prepare the unflushed paths.
		perRevMap, err = j.unflushedPaths.prepUnflushedPaths(
			ctx, j.uid, j.key, j.config.Codec(), j.log, mdInfo)
		if err != nil {
			return err
		}

		retry, err := f(mdInfo, perRevMap)
		if err != nil {
			return err
		}

		if retry {
			return errors.New("Unexpectedly asked to retry " +
				"MD put more than once")
		}
	}
	return nil
}

func (j *tlfJournal) putMD(ctx context.Context, rmd *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey) (irmd ImmutableRootMetadata, err error) {
	err = j.prepAndAddRMDWithRetry(ctx, rmd,
		func(mdInfo unflushedPathMDInfo, perRevMap unflushedPathsPerRevMap) (
			retry bool, err error) {
			irmd, retry, err = j.doPutMD(
				ctx, rmd, mdInfo, perRevMap, verifyingKey)
			return retry, err
		})
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	return irmd, nil
}

func (j *tlfJournal) clearMDs(ctx context.Context, bid kbfsmd.BranchID) error {
	if j.onBranchChange != nil {
		j.onBranchChange.onTLFBranchChange(j.tlfID, kbfsmd.NullBranchID)
	}

	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return err
	}

	if err := j.checkInfoFileLocked(); err != nil {
		return err
	}

	err := j.mdJournal.clear(ctx, bid)
	if err != nil {
		return err
	}

	j.resume(journalPauseConflict)
	return nil
}

func (j *tlfJournal) doResolveBranch(ctx context.Context,
	bid kbfsmd.BranchID, blocksToDelete []kbfsblock.ID, rmd *RootMetadata,
	mdInfo unflushedPathMDInfo, perRevMap unflushedPathsPerRevMap,
	verifyingKey kbfscrypto.VerifyingKey) (
	irmd ImmutableRootMetadata, retry bool, err error) {
	j.journalLock.Lock()
	defer j.journalLock.Unlock()
	if err := j.checkEnabledLocked(); err != nil {
		return ImmutableRootMetadata{}, false, err
	}

	if err := j.checkInfoFileLocked(); err != nil {
		return ImmutableRootMetadata{}, false, err
	}

	// The set of unflushed paths could change as part of the
	// resolution, and the revision numbers definitely change.
	isPendingLocalSquash := bid == kbfsmd.PendingLocalSquashBranchID
	if !j.unflushedPaths.reinitializeWithResolution(
		mdInfo, perRevMap, isPendingLocalSquash) {
		return ImmutableRootMetadata{}, true, nil
	}

	// First write the resolution to a new branch, and swap it with
	// the existing branch, then clear the existing branch.
	mdID, err := j.mdJournal.resolveAndClear(
		ctx, j.config.Crypto(), j.config.encryptionKeyGetter(),
		j.config.BlockSplitter(), j.config.MDCache(), bid, rmd)
	if err != nil {
		return ImmutableRootMetadata{}, false, err
	}

	// Then go through and mark blocks and md rev markers for ignoring.
	totalIgnoredBytes, err := j.blockJournal.ignoreBlocksAndMDRevMarkers(
		ctx, blocksToDelete, rmd.Revision())
	if err != nil {
		return ImmutableRootMetadata{}, false, err
	}

	// Treat ignored blocks as flushed for the purposes of
	// accounting.
	j.diskLimiter.onBlocksFlush(ctx, totalIgnoredBytes, j.chargedTo)

	// Finally, append a new, non-ignored md rev marker for the new revision.
	err = j.blockJournal.markMDRevision(
		ctx, rmd.Revision(), isPendingLocalSquash)
	if err != nil {
		return ImmutableRootMetadata{}, false, err
	}

	// Put the MD into the cache under the same lock as it is put in
	// the journal, to guarantee it will be replaced if the journal is
	// converted into a branch before any of the upper layer have a
	// chance to cache it. Revisions created locally should always
	// override anything else in the cache, so use `Replace` rather
	// than `Put`.
	irmd = MakeImmutableRootMetadata(
		rmd, verifyingKey, mdID, j.config.Clock().Now(), false)
	err = j.config.MDCache().Replace(irmd, irmd.BID())
	if err != nil {
		return ImmutableRootMetadata{}, false, err
	}
	j.log.CDebugf(ctx, "Put resolution rev=%d id=%s", rmd.Revision(), mdID)

	j.resume(journalPauseConflict)
	j.signalWork()

	// TODO: kick off a background goroutine that deletes ignored
	// block data files before the flush gets to them.

	return irmd, false, nil
}

func (j *tlfJournal) resolveBranch(ctx context.Context,
	bid kbfsmd.BranchID, blocksToDelete []kbfsblock.ID, rmd *RootMetadata,
	verifyingKey kbfscrypto.VerifyingKey) (
	irmd ImmutableRootMetadata, err error) {
	err = j.prepAndAddRMDWithRetry(ctx, rmd,
		func(mdInfo unflushedPathMDInfo, perRevMap unflushedPathsPerRevMap) (
			retry bool, err error) {
			irmd, retry, err = j.doResolveBranch(
				ctx, bid, blocksToDelete, rmd, mdInfo, perRevMap, verifyingKey)
			return retry, err
		})
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	return irmd, nil
}

func (j *tlfJournal) wait(ctx context.Context) error {
	workLeft, err := j.wg.WaitUnlessPaused(ctx)
	if err != nil {
		return err
	}
	if workLeft {
		j.log.CDebugf(ctx, "Wait completed with work left, "+
			"due to paused journal")
	}
	return nil
}

func (j *tlfJournal) waitForCompleteFlush(ctx context.Context) error {
	// Now we wait for the journal to completely empty.  Waiting on
	// the wg isn't enough, because conflicts/squashes can cause the
	// journal to pause and we'll be called too early.
	for {
		blockEntryCount, mdEntryCount, err := j.getJournalEntryCounts()
		if err != nil {
			return err
		}
		if blockEntryCount == 0 && mdEntryCount == 0 {
			j.log.CDebugf(ctx, "Single op completely flushed")
			return nil
		}

		// Let the background flusher know it should try to flush
		// everything again, once any conflicts have been resolved.
		j.signalWork()

		err = j.wg.Wait(ctx)
		if err != nil {
			return err
		}
		_, noLock := j.lastFlushErr.(kbfsmd.ServerErrorLockConflict)
		if noLock {
			return j.lastFlushErr
		}
	}
}

func (j *tlfJournal) finishSingleOp(ctx context.Context,
	lc *keybase1.LockContext, priority keybase1.MDPriority) error {
	j.log.CDebugf(ctx, "Finishing single op")

	flushCtx := flushContext{
		lockContextForPut: lc,
		priorityForPut:    priority,
	}

	// Let the background flusher know it should change the single op
	// mode to finished, so we can have it set ASAP without waiting to
	// take `flushLock` here.
	select {
	case j.finishSingleOpCh <- flushCtx:
	default:
	}

	return j.waitForCompleteFlush(ctx)
}
