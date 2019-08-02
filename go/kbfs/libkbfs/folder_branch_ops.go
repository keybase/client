// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"io"
	"math/rand"
	"os"
	stdpath "path"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsedits"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/kbfssync"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// mdReadType indicates whether a read needs identifies.
type mdReadType int

const (
	// A read request that doesn't need an identify to be
	// performed.
	mdReadNoIdentify mdReadType = iota
	// A read request that needs an identify to be performed (if
	// it hasn't been already).
	mdReadNeedIdentify
)

// mdUpdateType indicates update type.
type mdUpdateType int

const (
	mdWrite mdUpdateType = iota
	// A rekey request.  Doesn't need an identify to be performed, as
	// a rekey does its own (finer-grained) identifies.
	mdRekey
)

type branchType int

const (
	standard branchType = iota // an online, read-write branch
	archive                    // an online, read-only branch
	conflict                   // a cleared, local conflict branch
)

// Constants used in this file.  TODO: Make these configurable?
const (
	// Maximum number of blocks that can be sent in parallel
	maxParallelBlockPuts = 100
	// Max response size for a single DynamoDB query is 1MB.
	maxMDsAtATime = 10
	// Cap the number of times we retry after a recoverable error
	maxRetriesOnRecoverableErrors = 10
	// If it's been more than this long since our last update, check
	// the current head before downloading all of the new revisions.
	fastForwardTimeThresh = 15 * time.Minute
	// If there are more than this many new revisions, fast forward
	// rather than downloading them all.
	fastForwardRevThresh = 50
	// Period between mark-and-sweep attempts.
	markAndSweepPeriod = 1 * time.Hour
	// A hard-coded reason used to derive the log obfuscator secret.
	obfuscatorDerivationString = "Keybase-Derived-KBFS-Log-Obfuscator-1"
	// How long do we skip identifies after seeing one with a broken
	// proof warning?
	cacheBrokenProofIdentifiesDuration = 5 * time.Minute
)

// ErrStillStagedAfterCR indicates that conflict resolution failed to take
// the FBO out of staging.
type ErrStillStagedAfterCR struct{}

// Error implements the error interface.
func (*ErrStillStagedAfterCR) Error() string {
	return "conflict resolution didn't take us out of staging"
}

type fboMutexLevel kbfssync.MutexLevel

const (
	fboMDWriter fboMutexLevel = 1
	fboHead     fboMutexLevel = 2
	fboBlock    fboMutexLevel = 3
	fboSync     fboMutexLevel = 4
)

func (o fboMutexLevel) String() string {
	switch o {
	case fboMDWriter:
		return "mdWriterLock"
	case fboHead:
		return "headLock"
	case fboBlock:
		return "blockLock"
	case fboSync:
		return "syncLock"
	default:
		return fmt.Sprintf("Invalid fboMutexLevel %d", int(o))
	}
}

func fboMutexLevelToString(o kbfssync.MutexLevel) string {
	return (fboMutexLevel(o)).String()
}

// Rules for working with kbfssync.LockState in FBO:
//
//   - Every "execution flow" (i.e., program flow that happens
//     sequentially) needs its own lockState object. This usually means
//     that each "public" FBO method does:
//
//       lState := makeFBOLockState()
//
//     near the top.
//
//   - Plumb lState through to all functions that hold any of the
//     relevant locks, or are called under those locks.
//
// This way, violations of the lock hierarchy will be detected at
// runtime.

func makeFBOLockState() *kbfssync.LockState {
	return kbfssync.MakeLevelState(fboMutexLevelToString)
}

// blockLock is just like a sync.RWMutex, but with an extra operation
// (DoRUnlockedIfPossible).
type blockLock struct {
	kbfssync.LeveledRWMutex
	locked bool
}

func (bl *blockLock) Lock(lState *kbfssync.LockState) {
	bl.LeveledRWMutex.Lock(lState)
	bl.locked = true
}

func (bl *blockLock) Unlock(lState *kbfssync.LockState) {
	bl.locked = false
	bl.LeveledRWMutex.Unlock(lState)
}

// DoRUnlockedIfPossible must be called when r- or w-locked. If
// r-locked, r-unlocks, runs the given function, and r-locks after
// it's done. Otherwise, just runs the given function.
func (bl *blockLock) DoRUnlockedIfPossible(
	lState *kbfssync.LockState, f func(*kbfssync.LockState)) {
	if !bl.locked {
		bl.RUnlock(lState)
		defer bl.RLock(lState)
	}

	f(lState)
}

// headTrustStatus marks whether the head is from a trusted or
// untrusted source. When rekeying we get the head MD by folder id
// and do not check the tlf handle
type headTrustStatus int

const (
	headUntrusted headTrustStatus = iota
	headTrusted
)

type cachedDirOp struct {
	dirOp op
	nodes []Node
}

type editChannelActivity struct {
	convID  chat1.ConversationID // set to nil to force a re-init
	name    string
	message string
}

// folderBranchOps implements the KBFSOps interface for a specific
// branch of a specific folder.  It is go-routine safe for operations
// within the folder.
//
// We use locks to protect against multiple goroutines accessing the
// same folder-branch.  The goal with our locking strategy is maximize
// concurrent access whenever possible.  See design/state_machine.md
// for more details.  There are three important locks:
//
// 1) mdWriterLock: Any "remote-sync" operation (one which modifies the
//    folder's metadata) must take this lock during the entirety of
//    its operation, to avoid forking the MD.
//
// 2) headLock: This is a read/write mutex.  It must be taken for
//    reading before accessing any part of the current head MD.  It
//    should be taken for the shortest time possible -- that means in
//    general that it should be taken, and the MD copied to a
//    goroutine-local variable, and then it can be released.
//    Remote-sync operations should take it for writing after pushing
//    all of the blocks and MD to the KBFS servers (i.e., all network
//    accesses), and then hold it until after all notifications have
//    been fired, to ensure that no concurrent "local" operations ever
//    see inconsistent state locally.
//
// 3) blockLock: This too is a read/write mutex.  It must be taken for
//    reading before accessing any blocks in the block cache that
//    belong to this folder/branch.  This includes checking their
//    dirty status.  It should be taken for the shortest time possible
//    -- that means in general it should be taken, and then the blocks
//    that will be modified should be copied to local variables in the
//    goroutine, and then it should be released.  The blocks should
//    then be modified locally, and then readied and pushed out
//    remotely.  Only after the blocks have been pushed to the server
//    should a remote-sync operation take the lock again (this time
//    for writing) and put/finalize the blocks.  Write and Truncate
//    should take blockLock for their entire lifetime, since they
//    don't involve writes over the network.  Furthermore, if a block
//    is not in the cache and needs to be fetched, we should release
//    the mutex before doing the network operation, and lock it again
//    before writing the block back to the cache.
//
// We want to allow writes and truncates to a file that's currently
// being sync'd, like any good networked file system.  The tricky part
// is making sure the changes can both: a) be read while the sync is
// happening, and b) be applied to the new file path after the sync is
// done.
//
// For now, we just do the dumb, brute force thing for now: if a block
// is currently being sync'd, it copies the block and puts it back
// into the cache as modified.  Then, when the sync finishes, it
// throws away the modified blocks and re-applies the change to the
// new file path (which might have a completely different set of
// blocks, so we can't just reuse the blocks that were modified during
// the sync.)
type folderBranchOps struct {
	config        Config
	folderBranch  data.FolderBranch
	unmergedBID   kbfsmd.BranchID // protected by mdWriterLock
	bType         branchType
	observers     *observerList
	serviceStatus *kbfsCurrentStatus
	favs          *Favorites

	// The leveled locks below, when locked concurrently by the same
	// goroutine, should only be taken in the following order to avoid
	// deadlock.

	// Taken by any method making MD modifications.
	mdWriterLock kbfssync.LeveledMutex
	dirOps       []cachedDirOp

	// protects access to head, headStatus, latestMergedRevision,
	// and hasBeenCleared.
	headLock   kbfssync.LeveledRWMutex
	head       ImmutableRootMetadata
	headStatus headTrustStatus
	// latestMergedRevision tracks the latest heard merged revision on server
	latestMergedRevision kbfsmd.Revision
	latestMergedUpdated  chan struct{}
	// Has this folder ever been cleared?
	hasBeenCleared bool

	syncLock            kbfssync.LeveledRWMutex
	markAndSweepTrigger chan<- struct{}

	blocks  folderBlockOps
	prepper folderUpdatePrepper

	// nodeCache itself is goroutine-safe, but this object's use
	// of it has special requirements:
	//
	//   - Reads can call PathFromNode() unlocked, since there are
	//     no guarantees with concurrent reads.
	//
	//   - Operations that takes mdWriterLock always needs the
	//     most up-to-date paths, so those must call
	//     PathFromNode() under mdWriterLock.
	//
	//   - Block write operations (write/truncate/sync) need to
	//     coordinate. Specifically, sync must make sure that
	//     blocks referenced in a path (including all of the child
	//     blocks) must exist in the cache during calls to
	//     PathFromNode from write/truncate. This means that sync
	//     must modify dirty file blocks only under blockLock, and
	//     write/truncate must call PathFromNode() under
	//     blockLock.
	//
	//     Furthermore, calls to UpdatePointer() must happen
	//     before the copy-on-write mode induced by Sync() is
	//     finished.
	nodeCache NodeCache

	// Whether we've identified this TLF or not.
	identifyLock            sync.Mutex
	identifyDone            bool
	identifyTime            time.Time
	identifyDoneWithWarning bool

	// The current status summary for this folder
	status *folderBranchStatusKeeper

	// How to log
	log        traceLogger
	deferLog   traceLogger
	defer2Log  traceLogger
	vlog       *libkb.VDebugLog
	deferVlog  *libkb.VDebugLog
	defer2Vlog *libkb.VDebugLog

	// Closed on shutdown
	shutdownChan chan struct{}
	// Wait on this once we're done shutting down. Any goroutine that logs must
	// be registered with this WaitGroup, to avoid test races.
	doneWg sync.WaitGroup

	// Can be used to turn off notifications for a while (e.g., for testing)
	updatePauseChan chan (<-chan struct{})

	cancelUpdatesLock sync.Mutex
	// Cancels the goroutine currently waiting on TLF MD updates.
	cancelUpdates context.CancelFunc

	// This channel will be closed when the register goroutine completes.
	updateDoneChan chan struct{}

	// forceSyncChan is read from by the background sync process
	// to know when it should sync immediately.
	forceSyncChan <-chan struct{}

	// syncNeededChan is signalled when a buffered write happens, and
	// lets the background syncer wait rather than waking up all the
	// time.
	syncNeededChan chan struct{}

	// How to resolve conflicts
	cr *ConflictResolver

	// Helper class for archiving and cleaning up the blocks for this TLF
	fbm *folderBlockManager

	rekeyFSM RekeyFSM

	editHistory               *kbfsedits.TlfHistory
	editChannels              chan editChannelActivity
	refreshEditHistoryChannel chan struct{}

	editsLock sync.Mutex
	// Cancels the goroutine currently waiting on edits
	cancelEdits context.CancelFunc
	// This channel gets created when chat monitoring starts, and
	// closed when it ends, so we can avoid sending messages to the
	// monitorer when they won't be read.
	editMonitoringInProgress chan struct{}
	launchEditMonitor        sync.Once

	branchChanges      kbfssync.RepeatedWaitGroup
	mdFlushes          kbfssync.RepeatedWaitGroup
	forcedFastForwards kbfssync.RepeatedWaitGroup
	editActivity       kbfssync.RepeatedWaitGroup
	partialSyncs       kbfssync.RepeatedWaitGroup

	muLastGetHead sync.Mutex
	// We record a timestamp everytime getHead or getTrustedHead is called, and
	// use this as a heuristic for whether user is actively using KBFS. If user
	// has been generating KBFS activities recently, it makes sense to try to
	// reconnect as soon as possible in case of a deployment causes
	// disconnection.
	lastGetHead time.Time

	convLock sync.Mutex
	convID   chat1.ConversationID

	obLock   sync.RWMutex
	obSecret data.NodeObfuscatorSecret
}

var _ fbmHelper = (*folderBranchOps)(nil)

// newFolderBranchOps constructs a new folderBranchOps object.
func newFolderBranchOps(
	ctx context.Context, appStateUpdater env.AppStateUpdater,
	config Config, fb data.FolderBranch,
	bType branchType,
	quotaUsage *EventuallyConsistentQuotaUsage,
	serviceStatus *kbfsCurrentStatus, favs *Favorites) *folderBranchOps {
	var nodeCache NodeCache
	if config.Mode().NodeCacheEnabled() {
		nodeCache = newNodeCacheStandard(fb)
		for _, f := range config.RootNodeWrappers() {
			nodeCache.AddRootWrapper(f)
		}
		if bType == archive || bType == conflict {
			nodeCache.AddRootWrapper(readonlyWrapper)
		}
	}

	if bType == standard && fb.Branch != data.MasterBranch {
		panic("standard FBOs must use the master branch")
	} else if bType != standard && fb.Branch == data.MasterBranch {
		panic("non-standard FBOs must not use the master branch")
	}

	// make logger
	branchSuffix := ""
	if fb.Branch != data.MasterBranch {
		branchSuffix = " " + string(fb.Branch)
	}
	tlfStringFull := fb.Tlf.String()
	// Shorten the TLF ID for the module name.  8 characters should be
	// unique enough for a local node.
	log := config.MakeLogger(fmt.Sprintf("FBO %s%s", tlfStringFull[:8],
		branchSuffix))
	deferLog := log.CloneWithAddedDepth(1)
	defer2Log := log.CloneWithAddedDepth(2)

	// But print it out once in full, just in case.
	log.CInfof(ctx, "Created new folder-branch for %s", tlfStringFull)

	observers := newObserverList()

	mdWriterLock := kbfssync.MakeLeveledMutex(
		kbfssync.MutexLevel(fboMDWriter), &sync.Mutex{})
	headLock := kbfssync.MakeLeveledRWMutex(
		kbfssync.MutexLevel(fboHead), &sync.RWMutex{})
	blockLockMu := kbfssync.MakeLeveledRWMutex(
		kbfssync.MutexLevel(fboBlock), &sync.RWMutex{})
	syncLock := kbfssync.MakeLeveledRWMutex(
		kbfssync.MutexLevel(fboSync), &sync.RWMutex{})

	forceSyncChan := make(chan struct{})

	fbo := &folderBranchOps{
		config:        config,
		folderBranch:  fb,
		unmergedBID:   kbfsmd.BranchID{},
		bType:         bType,
		observers:     observers,
		serviceStatus: serviceStatus,
		favs:          favs,
		status: newFolderBranchStatusKeeper(
			config, nodeCache, quotaUsage, fb.Tlf.Bytes()),
		mdWriterLock: mdWriterLock,
		headLock:     headLock,
		syncLock:     syncLock,
		blocks: folderBlockOps{
			config:        config,
			log:           log,
			vlog:          config.MakeVLogger(log),
			folderBranch:  fb,
			observers:     observers,
			forceSyncChan: forceSyncChan,
			blockLock: blockLock{
				LeveledRWMutex: blockLockMu,
			},
			dirtyFiles: make(map[data.BlockPointer]*data.DirtyFile),
			deferred:   make(map[data.BlockRef]deferredState),
			unrefCache: make(map[data.BlockRef]*syncInfo),
			dirtyDirs:  make(map[data.BlockPointer][]data.BlockInfo),
			nodeCache:  nodeCache,
		},
		nodeCache:                 nodeCache,
		log:                       traceLogger{log},
		deferLog:                  traceLogger{deferLog},
		defer2Log:                 traceLogger{defer2Log},
		vlog:                      config.MakeVLogger(log),
		deferVlog:                 config.MakeVLogger(deferLog),
		defer2Vlog:                config.MakeVLogger(defer2Log),
		shutdownChan:              make(chan struct{}),
		updatePauseChan:           make(chan (<-chan struct{})),
		forceSyncChan:             forceSyncChan,
		syncNeededChan:            make(chan struct{}, 1),
		editHistory:               kbfsedits.NewTlfHistory(),
		editChannels:              make(chan editChannelActivity, 100),
		refreshEditHistoryChannel: make(chan struct{}, 1),
	}
	fbo.prepper = folderUpdatePrepper{
		config:       config,
		folderBranch: fb,
		blocks:       &fbo.blocks,
		log:          log,
		vlog:         config.MakeVLogger(log),
	}
	fbo.cr = NewConflictResolver(config, fbo)
	fbo.fbm = newFolderBlockManager(appStateUpdater, config, fb, bType, fbo)
	fbo.rekeyFSM = NewRekeyFSM(fbo)
	if config.DoBackgroundFlushes() && bType == standard {
		fbo.goTracked(fbo.backgroundFlusher)
	}
	if config.Mode().NodeCacheEnabled() {
		nodeCache.SetObfuscatorMaker(fbo.makeObfuscator)
	}

	return fbo
}

func (fbo *folderBranchOps) goTracked(f func()) {
	fbo.doneWg.Add(1)
	go func() {
		defer fbo.doneWg.Done()
		f()
	}()
}

// markForReIdentifyIfNeeded checks whether this tlf is identified and mark
// it for lazy reidentification if it exceeds time limits.
func (fbo *folderBranchOps) markForReIdentifyIfNeeded(now time.Time, maxValid time.Duration) {
	fbo.identifyLock.Lock()
	defer fbo.identifyLock.Unlock()
	if fbo.identifyDone && (now.Before(fbo.identifyTime) || fbo.identifyTime.Add(maxValid).Before(now)) {
		fbo.log.CDebugf(
			context.TODO(), "Expiring identify from %v", fbo.identifyTime)
		fbo.identifyDone = false
	}
}

// Shutdown safely shuts down any background goroutines that may have
// been launched by folderBranchOps.
func (fbo *folderBranchOps) Shutdown(ctx context.Context) error {
	if fbo.config.CheckStateOnShutdown() {
		lState := makeFBOLockState()

		switch {
		case fbo.blocks.GetState(lState) == dirtyState:
			fbo.log.CDebugf(ctx, "Skipping state-checking due to dirty state")
		case fbo.isUnmerged(lState):
			fbo.log.CDebugf(ctx, "Skipping state-checking due to being staged")
		default:
			// Make sure we're up to date first
			if err := fbo.SyncFromServer(ctx,
				fbo.folderBranch, nil); err != nil {
				return err
			}

			// Check the state for consistency before shutting down.
			sc := NewStateChecker(fbo.config)
			if err := sc.CheckMergedState(ctx, fbo.id()); err != nil {
				return err
			}
		}
	}

	if err := fbo.fbm.waitForArchives(ctx); err != nil {
		return err
	}

	close(fbo.shutdownChan)
	fbo.cr.Shutdown()
	fbo.fbm.shutdown()
	fbo.rekeyFSM.Shutdown()
	// Wait for all the goroutines to finish, so that we don't have any races
	// with logging during test reporting.
	fbo.doneWg.Wait()
	return nil
}

func (fbo *folderBranchOps) id() tlf.ID {
	return fbo.folderBranch.Tlf
}

func (fbo *folderBranchOps) oa() keybase1.OfflineAvailability {
	return fbo.config.OfflineAvailabilityForID(fbo.id())
}

func (fbo *folderBranchOps) branch() data.BranchName {
	return fbo.folderBranch.Branch
}

func (fbo *folderBranchOps) addToFavorites(
	ctx context.Context, created bool) (err error) {
	lState := makeFBOLockState()
	head := fbo.getTrustedHead(ctx, lState, mdNoCommit)
	if head == (ImmutableRootMetadata{}) {
		return OpsCantHandleFavorite{"Can't add a favorite without a handle"}
	}

	return fbo.addToFavoritesByHandle(ctx, head.GetTlfHandle(), created)
}

func (fbo *folderBranchOps) addToFavoritesByHandle(
	ctx context.Context, handle *tlfhandle.Handle, created bool) (err error) {
	if _, err := fbo.config.KBPKI().GetCurrentSession(ctx); err != nil {
		// Can't favorite while not logged in
		return nil
	}

	fbo.favs.AddAsync(ctx, handle.ToFavToAdd(created))
	return nil
}

func (fbo *folderBranchOps) deleteFromFavorites(ctx context.Context) error {
	if _, err := fbo.config.KBPKI().GetCurrentSession(ctx); err != nil {
		// Can't unfavorite while not logged in
		return nil
	}

	lState := makeFBOLockState()
	head := fbo.getTrustedHead(ctx, lState, mdNoCommit)
	if head == (ImmutableRootMetadata{}) {
		// This can happen when identifies fail and the head is never set.
		return OpsCantHandleFavorite{"Can't delete a favorite without a handle"}
	}

	h := head.GetTlfHandle()
	return fbo.favs.Delete(ctx, h.ToFavorite())
}

func (fbo *folderBranchOps) doFavoritesOp(
	ctx context.Context, fop FavoritesOp, handle *tlfhandle.Handle) error {
	if fbo.bType == conflict {
		// Ignore local conflicts, they should never be added as real favorites.
		return nil
	}
	switch fop {
	case FavoritesOpNoChange:
		return nil
	case FavoritesOpAdd:
		if handle != nil {
			return fbo.addToFavoritesByHandle(ctx, handle, false)
		}
		return fbo.addToFavorites(ctx, false)
	case FavoritesOpAddNewlyCreated:
		if handle != nil {
			return fbo.addToFavoritesByHandle(ctx, handle, true)
		}
		return fbo.addToFavorites(ctx, true)
	case FavoritesOpRemove:
		return fbo.deleteFromFavorites(ctx)
	default:
		return InvalidFavoritesOpError{}
	}
}

func (fbo *folderBranchOps) updateLastGetHeadTimestamp() {
	fbo.muLastGetHead.Lock()
	defer fbo.muLastGetHead.Unlock()
	fbo.lastGetHead = fbo.config.Clock().Now()
}

type mdCommitType int

const (
	mdCommit mdCommitType = iota
	mdNoCommit
)

func (fbo *folderBranchOps) commitHeadLocked(
	ctx context.Context, lState *kbfssync.LockState, ct mdCommitType) {
	fbo.headLock.AssertRLocked(lState)
	if ct == mdNoCommit {
		return
	}
	diskMDCache := fbo.config.DiskMDCache()
	if diskMDCache == nil {
		return
	}

	if !fbo.head.putToServer {
		return
	}
	rev := fbo.head.Revision()

	id := fbo.id()
	log := fbo.log
	fbo.goTracked(func() {
		err := diskMDCache.Commit(context.Background(), id, rev)
		if err != nil {
			log.CDebugf(ctx, "Error commiting revision %d: %+v", rev, err)
		}
	})
}

// getTrustedHead should not be called outside of folder_branch_ops.go.
// Returns ImmutableRootMetadata{} when the head is not trusted.
// See the comment on headTrustedStatus for more information.
func (fbo *folderBranchOps) getTrustedHead(
	ctx context.Context, lState *kbfssync.LockState,
	ct mdCommitType) ImmutableRootMetadata {
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)
	if fbo.headStatus == headUntrusted {
		return ImmutableRootMetadata{}
	}

	// This triggers any mdserver backoff timer to fast forward. In case of a
	// deployment, this causes KBFS client to try to reconnect to mdserver
	// immediately rather than waiting until the random backoff timer is up.
	// Note that this doesn't necessarily guarantee that the fbo handler that
	// called this method would get latest MD.
	fbo.config.MDServer().FastForwardBackoff()
	fbo.updateLastGetHeadTimestamp()
	fbo.commitHeadLocked(ctx, lState, ct)

	return fbo.head
}

// getHead should not be called outside of folder_branch_ops.go.
func (fbo *folderBranchOps) getHead(
	ctx context.Context, lState *kbfssync.LockState, ct mdCommitType) (
	ImmutableRootMetadata, headTrustStatus) {
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)

	// See getTrustedHead for explanation.
	fbo.config.MDServer().FastForwardBackoff()
	fbo.updateLastGetHeadTimestamp()
	fbo.commitHeadLocked(ctx, lState, ct)

	return fbo.head, fbo.headStatus
}

// isUnmerged should not be called if mdWriterLock is already taken.
func (fbo *folderBranchOps) isUnmerged(lState *kbfssync.LockState) bool {
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	return fbo.unmergedBID != kbfsmd.NullBranchID
}

func (fbo *folderBranchOps) isUnmergedLocked(lState *kbfssync.LockState) bool {
	fbo.mdWriterLock.AssertLocked(lState)

	return fbo.unmergedBID != kbfsmd.NullBranchID
}

var errJournalNotAvailable = errors.New("could not get journal for TLF")

// clearConflictView tells the journal to move any pending writes elsewhere,
// resets the CR counter, and resets the FBO to have a synced view of the TLF.
func (fbo *folderBranchOps) clearConflictView(ctx context.Context) (
	err error) {
	// TODO(KBFS-3990): show the cleared conflict view under a special path,
	//  so users can copy any unmerged files manually back into their synced
	//  view before nuking it.

	fbo.log.CDebugf(ctx, "Clearing conflict view")
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Done with clearConflictView: %+v", err)
	}()

	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)

	journalEnabled := TLFJournalEnabled(fbo.config, fbo.id())
	if journalEnabled {
		err = fbo.unstageLocked(ctx, lState, moveJournalsAway)
	} else {
		err = fbo.unstageLocked(ctx, lState, doPruneBranches)
	}
	if err != nil {
		return err
	}
	return fbo.cr.clearConflictRecords(ctx)
}

// forceStuckConflictForTesting forces the TLF into a stuck conflict
// view, for testing.
func (fbo *folderBranchOps) forceStuckConflictForTesting(
	ctx context.Context) (err error) {
	startTime, timer := fbo.startOp(ctx, "Forcing a stuck conflict")
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "Forcing a stuck conflict done: %+v", err)
	}()

	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)

	if fbo.isUnmergedLocked(lState) {
		return errors.New("Cannot force conflict when already unmerged")
	}

	// Disable updates.
	unpauseUpdatesCh := make(chan struct{})
	fbo.updatePauseChan <- unpauseUpdatesCh
	defer func() { unpauseUpdatesCh <- struct{}{} }()

	// Make a no-op revision with an empty resolutionOp. Wait for it
	// to flush to the server.
	origHead, _ := fbo.getHead(ctx, lState, mdNoCommit)
	mergedGCOp := newGCOp(origHead.data.LastGCRevision)
	err = fbo.finalizeGCOpLocked(ctx, lState, mergedGCOp)
	if err != nil {
		return err
	}

	jManager, _ := GetJournalManager(fbo.config)
	if jManager != nil {
		err := fbo.waitForJournalLocked(ctx, lState, jManager)
		if err != nil {
			return err
		}
	}

	// Roll back the local view to the original revision.
	err = func() error {
		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)
		err = fbo.setHeadLocked(ctx, lState, origHead, headTrusted, mdNoCommit)
		if err != nil {
			return err
		}
		fbo.setLatestMergedRevisionLocked(
			ctx, lState, origHead.Revision(), true)
		return nil
	}()
	if err != nil {
		return err
	}

	// Set CR to always fail.
	oldMode := fbo.cr.getFailModeForTesting()
	fbo.cr.setFailModeForTesting(alwaysFailCR)
	defer func() { fbo.cr.setFailModeForTesting(oldMode) }()

	// Make fake conflicting files to trigger CR. Make one for each
	// attempt needed to result in stuck CR.
	handle := origHead.GetTlfHandle()
	rootNode, err := fbo.nodeCache.GetOrCreate(
		origHead.data.Dir.BlockPointer,
		data.NewPathPartString(string(handle.GetCanonicalName()),
			fbo.makeObfuscator()),
		nil, data.Dir)
	if err != nil {
		return err
	}

	for i := 0; i < maxConflictResolutionAttempts+1; i++ {
		filename := fmt.Sprintf("FILE_FOR_STUCK_CONFLICT_%02d", i)
		_, _, err := fbo.createEntryLocked(
			ctx, lState, rootNode, rootNode.ChildName(filename), data.File,
			NoExcl)
		if err != nil {
			return err
		}

		err = fbo.syncAllLocked(ctx, lState, NoExcl)
		if err != nil {
			return err
		}

		if jManager != nil && TLFJournalEnabled(fbo.config, fbo.id()) {
			// Can't use fbo.waitForJournalLocked here, since the
			// flushing won't actually complete.
			err := jManager.Wait(ctx, fbo.id())
			if err != nil {
				return err
			}
			newHead, _ := fbo.getHead(ctx, lState, mdNoCommit)
			fbo.cr.Resolve(
				ctx, newHead.Revision(), kbfsmd.RevisionUninitialized)
		}

		err = fbo.cr.Wait(ctx)
		if err != nil {
			return err
		}
	}

	// Make sure we're stuck.
	isStuck, err := fbo.cr.isStuck()
	if err != nil {
		return err
	}
	if !isStuck {
		return errors.New("CR not stuck after trying to force conflict")
	}

	return nil
}

func (fbo *folderBranchOps) setBranchIDLocked(
	lState *kbfssync.LockState, unmergedBID kbfsmd.BranchID) {
	fbo.mdWriterLock.AssertLocked(lState)

	if fbo.unmergedBID != unmergedBID {
		fbo.cr.BeginNewBranch()
	}

	fbo.unmergedBID = unmergedBID
	if unmergedBID == kbfsmd.NullBranchID {
		fbo.status.setCRSummary(nil, nil)
	}
}

var errNoFlushedRevisions = errors.New("No flushed MDs yet")
var errNoMergedRevWhileStaged = errors.New(
	"Cannot find most recent merged revision while staged")

func (fbo *folderBranchOps) getJournalRevisions(ctx context.Context) (
	predRev, journalEndRev kbfsmd.Revision, err error) {
	jManager, err := GetJournalManager(fbo.config)
	if err != nil {
		// Journaling is disabled entirely.
		return kbfsmd.RevisionUninitialized, kbfsmd.RevisionUninitialized, nil
	}

	jStatus, err := jManager.JournalStatus(fbo.id())
	if err != nil {
		// Journaling is disabled for this TLF, so use the local head.
		// TODO: JournalStatus could return other errors (likely
		// file/disk corruption) that indicate a real problem, so it
		// might be nice to type those errors so we can distinguish
		// them.
		return kbfsmd.RevisionUninitialized, kbfsmd.RevisionUninitialized, nil
	}

	if jStatus.BranchID != kbfsmd.NullBranchID.String() {
		return kbfsmd.RevisionUninitialized, kbfsmd.RevisionUninitialized,
			errNoMergedRevWhileStaged
	}

	if jStatus.RevisionStart == kbfsmd.RevisionUninitialized {
		// The journal is empty, so the local head must be the most recent.
		return kbfsmd.RevisionUninitialized, kbfsmd.RevisionUninitialized, nil
	} else if jStatus.RevisionStart == kbfsmd.RevisionInitial {
		// Nothing has been flushed to the servers yet, so don't
		// return anything.
		return kbfsmd.RevisionUninitialized, kbfsmd.RevisionUninitialized,
			errNoFlushedRevisions
	}

	return jStatus.RevisionStart - 1, jStatus.RevisionEnd, nil
}

// getJournalPredecessorRevision returns the revision that precedes
// the current journal head if journaling enabled and there are
// unflushed MD updates; otherwise it returns
// kbfsmd.RevisionUninitialized.  If there aren't any flushed MD
// revisions, it returns errNoFlushedRevisions.
func (fbo *folderBranchOps) getJournalPredecessorRevision(ctx context.Context) (
	kbfsmd.Revision, error) {
	pred, _, err := fbo.getJournalRevisions(ctx)
	return pred, err
}

// validateHeadLocked validates an untrusted head and sets it as trusted.
// see headTrustedState comment for more information.
func (fbo *folderBranchOps) validateHeadLocked(
	ctx context.Context, lState *kbfssync.LockState,
	md ImmutableRootMetadata) error {
	fbo.headLock.AssertLocked(lState)

	// Validate fbo against fetched md and discard the fetched one.
	if fbo.head.TlfID() != md.TlfID() {
		fbo.log.CCriticalf(ctx, "Fake untrusted TLF encountered %v %v %v %v", fbo.head.TlfID(), md.TlfID(), fbo.head.mdID, md.mdID)
		return kbfsmd.MDTlfIDMismatch{CurrID: fbo.head.TlfID(), NextID: md.TlfID()}
	}
	fbo.headStatus = headTrusted
	return nil
}

func (fbo *folderBranchOps) startMonitorChat(tlfName tlf.CanonicalName) {
	if fbo.bType != standard || !fbo.config.Mode().TLFEditHistoryEnabled() {
		return
	}

	fbo.editsLock.Lock()
	defer fbo.editsLock.Unlock()

	fbo.launchEditMonitor.Do(func() {
		// The first event should initialize all the data.  No need to
		// check the monitoring channel here; we already know
		// monitoring hasn't been started yet.
		fbo.editActivity.Add(1)
		fbo.editChannels <- editChannelActivity{nil, "", ""}
		fbo.goTracked(func() { fbo.monitorEditsChat(tlfName) })
	})
}

var errNeedMDForPartialSyncConfig = errors.New(
	"needs MD for partial sync config")

func (fbo *folderBranchOps) getProtocolSyncConfig(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata) (
	ret keybase1.FolderSyncConfig, tlfPath string, err error) {
	fbo.syncLock.AssertAnyLocked(lState)

	config := fbo.config.GetTlfSyncState(fbo.id())
	ret.Mode = config.Mode
	if ret.Mode != keybase1.FolderSyncMode_PARTIAL {
		return ret, config.TlfPath, nil
	}

	if kmd.TlfID() == tlf.NullID {
		return keybase1.FolderSyncConfig{}, "", errNeedMDForPartialSyncConfig
	}

	var block *data.FileBlock
	// Skip block assembly if it's already cached.
	b, err := fbo.config.BlockCache().Get(config.Paths.Ptr)
	if err == nil {
		var ok bool
		block, ok = b.(*data.FileBlock)
		if !ok {
			return keybase1.FolderSyncConfig{}, "", errors.Errorf(
				"Partial sync block is not a file block, but %T", b)
		}
	} else {
		block = data.NewFileBlock().(*data.FileBlock)
		err = assembleBlock(
			ctx, fbo.config.keyGetter(), fbo.config.Codec(),
			fbo.config.Crypto(), kmd, config.Paths.Ptr, block,
			config.Paths.Buf, config.Paths.ServerHalf)
		if err != nil {
			return keybase1.FolderSyncConfig{}, "", err
		}
	}

	paths, err := syncPathListFromBlock(fbo.config.Codec(), block)
	if err != nil {
		return keybase1.FolderSyncConfig{}, "", err
	}
	ret.Paths = paths.Paths
	return ret, config.TlfPath, nil
}

func (fbo *folderBranchOps) getProtocolSyncConfigUnlocked(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata) (
	ret keybase1.FolderSyncConfig, tlfPath string, err error) {
	fbo.syncLock.RLock(lState)
	defer fbo.syncLock.RUnlock(lState)
	return fbo.getProtocolSyncConfig(ctx, lState, kmd)
}

func (fbo *folderBranchOps) syncOneNode(
	ctx context.Context, node Node, rmd ImmutableRootMetadata,
	priority int, action BlockRequestAction) (data.BlockPointer, error) {
	nodePath := fbo.nodeCache.PathFromNode(node)
	var b data.Block
	if node.EntryType() == data.Dir {
		b = data.NewDirBlock()
	} else {
		b = data.NewFileBlock()
	}
	ptr := nodePath.TailPointer()
	ch := fbo.config.BlockOps().BlockRetriever().Request(
		ctx, priority, rmd, ptr, b, data.TransientEntry, action)
	select {
	case err := <-ch:
		if err != nil {
			return data.ZeroPtr, err
		}
		return ptr, nil
	case <-ctx.Done():
		return data.ZeroPtr, ctx.Err()
	}
}

func (fbo *folderBranchOps) startOp(
	ctx context.Context, fs string, args ...interface{}) (
	time.Time, *time.Timer) {
	now := fbo.config.Clock().Now()
	// Immediately log with vlog, and if the operation takes more than
	// one second, log via the normal logger too.
	fbo.deferVlog.CLogf(ctx, libkb.VLog1, fs, args...)
	timer := time.AfterFunc(1*time.Second, func() {
		select {
		case <-ctx.Done():
			return
		default:
			newArgs := make([]interface{}, len(args)+1)
			newArgs[0] = now
			copy(newArgs[1:], args)
			fbo.deferLog.CDebugf(
				ctx, "(Long operation, started=%s) "+fs, newArgs...)
		}
	})
	return now, timer
}

func (fbo *folderBranchOps) endOp(
	ctx context.Context, startTime time.Time, timer *time.Timer, fs string,
	args ...interface{}) {
	timer.Stop()
	d := fbo.config.Clock().Now().Sub(startTime)
	newArgs := make([]interface{}, len(args)+1)
	newArgs[0] = d
	copy(newArgs[1:], args)
	fbo.defer2Log.CDebugf(ctx, "[duration=%s] "+fs, newArgs...)
}

// doPartialSync iterates through the paths, deep-syncing them and
// also syncing their parent directories up to the root node.
func (fbo *folderBranchOps) doPartialSync(
	ctx context.Context, syncConfig keybase1.FolderSyncConfig,
	latestMerged ImmutableRootMetadata) (err error) {
	startTime, timer := fbo.startOp(
		ctx, "Starting partial sync at revision %d", latestMerged.Revision())
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "Partial sync at revision %d done: %+v",
			latestMerged.Revision(), err)
	}()

	var parentSyncAction, pathSyncAction BlockRequestAction
	var priority int
	switch syncConfig.Mode {
	case keybase1.FolderSyncMode_ENABLED:
		return errors.Errorf("Enabled mode passed to partial sync")
	case keybase1.FolderSyncMode_PARTIAL:
		// Use `PrefetchTail` for directories, to make sure that any child
		// blocks in the directory itself get prefetched.
		parentSyncAction = BlockRequestPrefetchTailWithSync
		pathSyncAction = BlockRequestWithDeepSync
		priority = defaultOnDemandRequestPriority - 1
	default:
		// For TLFs that aren't explicitly configured to be synced in
		// some way, use the working set cache.
		parentSyncAction = BlockRequestPrefetchTail
		// If we run out of space while prefetching the paths, just stop.
		pathSyncAction = BlockRequestPrefetchUntilFull
		// Don't flood outselves with prefetch requests when we're not
		// explicitly trying to sync the folder, just throttle them in
		// the background.
		priority = throttleRequestPriority
	}

	rootNode, _, _, err := fbo.getRootNode(ctx)
	if err != nil {
		return err
	}
	_, err = fbo.syncOneNode(
		ctx, rootNode, latestMerged, priority, parentSyncAction)
	if err != nil {
		return err
	}

	chs := make(map[string]<-chan struct{}, len(syncConfig.Paths))
	lState := makeFBOLockState()
	// Look up and solo-sync each lead-up component of the path.
pathLoop:
	for _, p := range syncConfig.Paths {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Partially-syncing %s", p)

		parentPath, syncedElem := stdpath.Split(p)
		parents := strings.Split(strings.TrimSuffix(parentPath, "/"), "/")
		currNode := rootNode
		for _, parent := range parents {
			if len(parent) == 0 {
				continue
			}
			// TODO: parallelize the parent fetches and lookups.
			currNode, _, err = fbo.blocks.Lookup(
				ctx, lState, latestMerged.ReadOnly(), currNode,
				currNode.ChildName(parent))
			switch errors.Cause(err).(type) {
			case idutil.NoSuchNameError:
				fbo.vlog.CLogf(
					ctx, libkb.VLog1, "Synced path %s doesn't exist yet", p)
				continue pathLoop
			case nil:
			default:
				return err
			}

			// Use `PrefetchTail` for directories, to make sure that
			// any child blocks in the directory itself get
			// prefetched.
			_, err = fbo.syncOneNode(
				ctx, currNode, latestMerged, priority, parentSyncAction)
			if err != nil {
				return err
			}
		}

		// Kick off a full deep sync of `syncedElem`.
		elemNode, _, err := fbo.blocks.Lookup(
			ctx, lState, latestMerged.ReadOnly(), currNode,
			currNode.ChildName(syncedElem))
		switch errors.Cause(err).(type) {
		case idutil.NoSuchNameError:
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Synced element %s doesn't exist yet", p)
			continue pathLoop
		case nil:
		default:
			return err
		}

		ptr, err := fbo.syncOneNode(
			ctx, elemNode, latestMerged, priority, pathSyncAction)
		if err != nil {
			return err
		}
		ch, err := fbo.config.BlockOps().Prefetcher().
			WaitChannelForBlockPrefetch(ctx, ptr)
		if err != nil {
			return err
		}
		chs[p] = ch
	}

	for p, ch := range chs {
		select {
		case <-ch:
			fbo.vlog.CLogf(ctx, libkb.VLog1, "Prefetch for %s complete", p)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

func (fbo *folderBranchOps) kickOffPartialSync(
	ctx context.Context, lState *kbfssync.LockState,
	syncConfig keybase1.FolderSyncConfig, rmd ImmutableRootMetadata) {
	if fbo.config.DiskBlockCache() == nil {
		return
	}

	// Kick off a background partial sync.
	partialSyncCtx, cancel := context.WithCancel(
		fbo.ctxWithFBOID(context.Background()))
	fbo.log.CDebugf(
		ctx, "Partial sync with a new context: FBOID=%s",
		partialSyncCtx.Value(CtxFBOIDKey))
	fbo.partialSyncs.Add(1)
	fbo.goTracked(func() {
		defer cancel()
		defer fbo.partialSyncs.Done()
		_ = fbo.doPartialSync(partialSyncCtx, syncConfig, rmd)
	})

	// Cancel the partial sync if the latest merged revision is updated.
	updatedCh := func() <-chan struct{} {
		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)
		if rmd.Revision() != fbo.latestMergedRevision {
			fbo.vlog.CLogf(
				partialSyncCtx, libkb.VLog1,
				"Latest merged revision is now %d, not %d; "+
					"aborting partial sync", fbo.latestMergedRevision,
				rmd.Revision())
			return nil
		}
		return fbo.latestMergedUpdated
	}()
	if updatedCh == nil {
		cancel()
	} else {
		fbo.goTracked(func() {
			select {
			case <-updatedCh:
				cancel()
			case <-partialSyncCtx.Done():
			}
		})
	}

	if syncConfig.Mode != keybase1.FolderSyncMode_PARTIAL {
		return
	}

	// Kick off a mark-and-sweep for synced TLFs if one doesn't exist yet.
	fbo.syncLock.Lock(lState)
	defer fbo.syncLock.Unlock(lState)
	if fbo.markAndSweepTrigger == nil {
		trigger := make(chan struct{}, 1)
		fbo.markAndSweepTrigger = trigger
		fbo.goTracked(func() { fbo.partialMarkAndSweepLoop(trigger) })
	}
}

func (fbo *folderBranchOps) makeRecentFilesSyncConfig(
	ctx context.Context, rmd ImmutableRootMetadata) (
	keybase1.FolderSyncConfig, error) {
	syncConfig := keybase1.FolderSyncConfig{
		Mode: keybase1.FolderSyncMode_DISABLED,
	}
	h := rmd.GetTlfHandle()
	history := fbo.config.UserHistory().GetTlfHistory(
		h.GetCanonicalName(), fbo.id().Type())
	pathsToSync := make(map[string]bool)
	for _, wh := range history.History {
		for _, e := range wh.Edits {
			parts := strings.SplitN(e.Filename, "/", 5)
			if len(parts) < 5 {
				continue
			}
			pathsToSync[parts[4]] = true
		}
	}
	for p := range pathsToSync {
		syncConfig.Paths = append(syncConfig.Paths, p)
	}
	return syncConfig, nil
}

func (fbo *folderBranchOps) kickOffPartialSyncIfNeeded(
	ctx context.Context, lState *kbfssync.LockState,
	rmd ImmutableRootMetadata) {
	// Check if we need to kick off a partial sync.
	syncConfig, _, err := fbo.getProtocolSyncConfigUnlocked(ctx, lState, rmd)
	if err != nil {
		fbo.log.CDebugf(ctx, "Couldn't get sync config: %+v", err)
		return
	}

	switch syncConfig.Mode {
	case keybase1.FolderSyncMode_ENABLED:
		// If fully syncing this TLF, the root block fetch is enable
		// to kick off the sync.
		return
	case keybase1.FolderSyncMode_DISABLED:
		// If we're not syncing the TLF at all, start a partial "sync"
		// using the recently-edited files list, storing the blocks in
		// the working set cache.
		if !fbo.config.Mode().TLFEditHistoryEnabled() ||
			fbo.config.Mode().DefaultBlockRequestAction() == BlockRequestSolo {
			return
		}
		err := fbo.editActivity.Wait(ctx)
		if err != nil {
			fbo.log.CDebugf(ctx, "Error waiting for edit activity: %+v", err)
			return
		}
		syncConfig, err = fbo.makeRecentFilesSyncConfig(ctx, rmd)
		if err != nil {
			fbo.log.CDebugf(ctx,
				"Error making recent files sync config: %+v", err)
			return
		}
	}

	fbo.kickOffPartialSync(ctx, lState, syncConfig, rmd)
}

func (fbo *folderBranchOps) markRecursive(
	ctx context.Context, lState *kbfssync.LockState, node Node,
	rmd ImmutableRootMetadata, tag string, cacheType DiskBlockCacheType) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	err := fbo.blocks.MarkNode(ctx, lState, node, rmd, tag, cacheType)
	if err != nil {
		return err
	}

	if node.EntryType() != data.Dir {
		return nil
	}

	p := fbo.nodeCache.PathFromNode(node)
	children, err := fbo.blocks.GetChildren(ctx, lState, rmd, p)
	if err != nil {
		return err
	}
	for child := range children {
		childNode, _, err := fbo.Lookup(ctx, node, child)
		if err != nil {
			return err
		}
		if childNode == nil {
			// A symlink.
			continue
		}
		err = fbo.markRecursive(ctx, lState, childNode, rmd, tag, cacheType)
		if err != nil {
			return err
		}
	}
	return nil
}

// doPartialMarkAndSweep runs a mark-and-sweep algorithm against all
// the currently-synced paths, to delete any blocks not reachable from
// one of these paths.
func (fbo *folderBranchOps) doPartialMarkAndSweep(
	ctx context.Context, syncConfig keybase1.FolderSyncConfig,
	latestMerged ImmutableRootMetadata) (err error) {
	startTime, timer := fbo.startOp(
		ctx, "Starting partial mark-and-sweep at revision %d",
		latestMerged.Revision())
	defer func() {
		fbo.endOp(
			ctx, startTime, timer,
			"Partial mark-and-sweep at revision %d done: %+v",
			latestMerged.Revision(), err)
	}()

	if syncConfig.Mode != keybase1.FolderSyncMode_PARTIAL {
		return errors.Errorf(
			"Bad mode passed to partial unsync: %+v", syncConfig.Mode)
	} else if len(syncConfig.Paths) == 0 {
		return nil
	}

	rootNode, _, _, err := fbo.getRootNode(ctx)
	if err != nil {
		return err
	}
	tag := ctx.Value(CtxFBOIDKey).(string)
	lState := makeFBOLockState()
	cacheType := DiskBlockSyncCache
	err = fbo.blocks.MarkNode(
		ctx, lState, rootNode, latestMerged, tag, cacheType)
	if err != nil {
		return err
	}

pathLoop:
	for _, p := range syncConfig.Paths {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Marking %s", p)

		// Mark the parent directories.
		parentPath, syncedElem := stdpath.Split(p)
		parents := strings.Split(strings.TrimSuffix(parentPath, "/"), "/")
		currNode := rootNode
		for _, parent := range parents {
			if len(parent) == 0 {
				continue
			}
			// TODO: parallelize the parent fetches and lookups.
			currNode, _, err = fbo.Lookup(
				ctx, currNode, currNode.ChildName(parent))
			switch errors.Cause(err).(type) {
			case idutil.NoSuchNameError:
				fbo.vlog.CLogf(
					ctx, libkb.VLog1, "Synced path %s doesn't exist yet", p)
				continue pathLoop
			case nil:
			default:
				return err
			}

			err = fbo.blocks.MarkNode(
				ctx, lState, currNode, latestMerged, tag, cacheType)
			if err != nil {
				return err
			}
		}

		// Now mark everything rooted at this path.
		currNode, _, err = fbo.Lookup(
			ctx, currNode, currNode.ChildName(syncedElem))
		switch errors.Cause(err).(type) {
		case idutil.NoSuchNameError:
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Synced element %s doesn't exist yet", p)
			continue pathLoop
		case nil:
		default:
			return err
		}

		err = fbo.markRecursive(
			ctx, lState, currNode, latestMerged, tag, cacheType)
		if err != nil {
			return err
		}
	}

	return fbo.config.DiskBlockCache().DeleteUnmarked(
		ctx, fbo.id(), tag, cacheType)
}

func (fbo *folderBranchOps) kickOffPartialMarkAndSweep(
	ctx context.Context, lState *kbfssync.LockState,
	syncConfig keybase1.FolderSyncConfig, rmd ImmutableRootMetadata) (
	<-chan struct{}, context.CancelFunc) {
	// Kick off a background mark-and-sweep.
	partialMSCtx, cancel := context.WithCancel(
		fbo.ctxWithFBOID(context.Background()))
	fbo.log.CDebugf(
		ctx, "Partial mark-and-sweep with a new context: FBOID=%s",
		partialMSCtx.Value(CtxFBOIDKey))
	fbo.partialSyncs.Add(1)
	fbo.goTracked(func() {
		defer cancel()
		defer fbo.partialSyncs.Done()
		_ = fbo.doPartialMarkAndSweep(partialMSCtx, syncConfig, rmd)
	})

	// Cancel the partial sync if the latest merged revision is updated.
	updatedCh := func() <-chan struct{} {
		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)
		if rmd.Revision() != fbo.latestMergedRevision {
			fbo.vlog.CLogf(
				partialMSCtx, libkb.VLog1,
				"Latest merged changed is now %d, not %d; "+
					"aborting partial mark-and-sweep", fbo.latestMergedRevision,
				rmd.Revision())
			return nil
		}
		return fbo.latestMergedUpdated
	}()
	if updatedCh == nil {
		cancel()
	} else {
		fbo.goTracked(func() {
			select {
			case <-updatedCh:
				cancel()
			case <-partialMSCtx.Done():
			}
		})
	}
	return partialMSCtx.Done(), cancel
}

func (fbo *folderBranchOps) kickOffPartialMarkAndSweepIfNeeded(
	ctx context.Context, lState *kbfssync.LockState, triggered bool,
	lastMDRev kbfsmd.Revision) (
	<-chan struct{}, context.CancelFunc, kbfsmd.Revision, error) {
	if triggered {
		defer fbo.partialSyncs.Done()
	}

	md, err := fbo.getLatestMergedMD(ctx, lState)
	if err != nil {
		fbo.log.CDebugf(ctx, "Couldn't get latest merged MD: %+v", err)
		return nil, nil, 0, nil
	}
	if md == (ImmutableRootMetadata{}) ||
		md.Revision() == kbfsmd.RevisionUninitialized {
		return nil, nil, 0, errors.New("Unexpectedly no merged revision")
	}

	// Skip mark-and-sweep if we were woken up by the timer and
	// the revision hasn't changed since last time.
	if !triggered && md.Revision() == lastMDRev {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1,
			"Revision hasn't changed since last mark-and-sweep")
		return nil, nil, 0, nil
	}

	syncConfig, _, err := fbo.getProtocolSyncConfigUnlocked(ctx, lState, md)
	if err != nil {
		return nil, nil, 0, err
	}
	if syncConfig.Mode != keybase1.FolderSyncMode_PARTIAL {
		return nil, nil, 0, errors.New("No partial sync config")
	}

	// Kick off the mark-and-sweep, and wait for it to finish or
	// be pre-empted.
	currMarkAndSweepCtxDone, currMarkAndSweepCancel :=
		fbo.kickOffPartialMarkAndSweep(ctx, lState, syncConfig, md)
	return currMarkAndSweepCtxDone, currMarkAndSweepCancel, md.Revision(), nil
}

func (fbo *folderBranchOps) partialMarkAndSweepLoop(trigger <-chan struct{}) {
	// For partially-synced TLFs, run this:
	// * Once an hour-ish, only if the latest merged revision has changed.
	// * When a path is removed from the config.
	//
	// Cancel the running mark-and-sweep when:
	// * The latest merged revision changes.
	// * The config changes.
	//
	// Exit this loop:
	// * On shutdown.
	// * When no longer configured to be partially syncing.
	ctx, cancel := context.WithCancel(fbo.ctxWithFBOID(context.Background()))
	defer cancel()
	fbo.log.CDebugf(ctx, "Starting mark-and-sweep loop")

	// Set the first timer to be some random duration less than the
	// period, to spread out the work of different TLFs.
	d := time.Duration(rand.Int63n(int64(markAndSweepPeriod)))
	timer := time.NewTimer(d)

	var currMarkAndSweepCtxDone <-chan struct{}
	var currMarkAndSweepCancel context.CancelFunc
	defer func() {
		if currMarkAndSweepCancel != nil {
			currMarkAndSweepCancel()
		}
		timer.Stop()
	}()

	lastMDRev := kbfsmd.RevisionUninitialized

	fbo.log.CDebugf(ctx, "Scheduling first timer for %s", d)
	lState := makeFBOLockState()
	for {
		triggered := false
		select {
		case <-currMarkAndSweepCtxDone:
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Mark-and-sweep finished; resetting timer")
			timer = time.NewTimer(markAndSweepPeriod)
			currMarkAndSweepCtxDone = nil
			continue
		case _, ok := <-trigger:
			if !ok {
				fbo.log.CDebugf(ctx, "Mark-and-sweep is shutting down")
				return
			}
			fbo.vlog.CLogf(ctx, libkb.VLog1, "New mark-and-sweep triggered")
			triggered = true
		case <-timer.C:
			fbo.vlog.CLogf(ctx, libkb.VLog1, "Mark-and-sweep timer fired")
		case <-fbo.shutdownChan:
			fbo.vlog.CLogf(ctx, libkb.VLog1, "Shutdown")
			return
		}

		if currMarkAndSweepCancel != nil {
			currMarkAndSweepCancel()
		}
		timer.Stop()

		// Kick off the mark-and-sweep, and wait for it to finish or
		// be pre-empted.
		done, cancel, rev, err := fbo.kickOffPartialMarkAndSweepIfNeeded(
			ctx, lState, triggered, lastMDRev)
		if err != nil {
			return
		}
		if rev == 0 {
			fbo.vlog.CLogf(
				ctx, libkb.VLog1,
				"No mark-and-sweep was launched; resetting timer")
			timer = time.NewTimer(markAndSweepPeriod)
			continue
		}
		currMarkAndSweepCtxDone, currMarkAndSweepCancel = done, cancel
		lastMDRev = rev
	}
}

func (fbo *folderBranchOps) kickOffRootBlockFetch(
	ctx context.Context, rmd ImmutableRootMetadata) <-chan error {
	ptr := rmd.Data().Dir.BlockPointer
	return fbo.config.BlockOps().BlockRetriever().Request(
		ctx, defaultOnDemandRequestPriority-1, rmd, ptr, data.NewDirBlock(),
		data.TransientEntry, fbo.config.Mode().DefaultBlockRequestAction())
}

func (fbo *folderBranchOps) logIfErr(
	ctx context.Context, err error, fs string, args ...interface{}) {
	if err != nil {
		fbo.deferLog.CDebugf(ctx, fs, args...)
	} else {
		fbo.deferVlog.CLogf(ctx, libkb.VLog1, fs, args...)
	}
}

func (fbo *folderBranchOps) waitForRootBlockFetch(
	ctx context.Context, rmd ImmutableRootMetadata,
	fetchChan <-chan error) error {
	fbo.vlog.CLogf(ctx, libkb.VLog1, "Ensuring that the latest root directory "+
		"block for revision %d is available", rmd.Revision())
	select {
	case err := <-fetchChan:
		fbo.logIfErr(ctx, err, "Root block fetch complete: +%v", err)
		return err
	case <-ctx.Done():
		return errors.WithStack(ctx.Err())
	}
}

func (fbo *folderBranchOps) commitFlushedMD(
	rmd ImmutableRootMetadata, updatedCh <-chan struct{}) {
	diskMDCache := fbo.config.DiskMDCache()
	if diskMDCache == nil {
		return
	}

	// Bail out if the latest merged revision has already been updated.
	select {
	case <-updatedCh:
		return
	default:
	}

	ctx := fbo.ctxWithFBOID(context.Background())
	rev := rmd.Revision()
	syncConfig := fbo.config.GetTlfSyncState(fbo.id())
	switch syncConfig.Mode {
	case keybase1.FolderSyncMode_ENABLED:
		// For synced TLFs, wait for prefetching to complete for
		// `rootPtr`. When it's successfully done, commit the
		// corresponding MD.
		rootPtr := rmd.Data().Dir.BlockPointer
		fbo.vlog.CLogf(
			ctx, libkb.VLog1,
			"Fetching root block of revision %d, ptr %v", rev, rootPtr)
		rootCh := fbo.kickOffRootBlockFetch(ctx, rmd)
		select {
		case err := <-rootCh:
			if err != nil {
				fbo.log.CDebugf(ctx, "Error getting root block: %+v", err)
				return
			}
		case <-updatedCh:
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "The latest merged rev has been updated")
			return
		case <-fbo.shutdownChan:
			fbo.log.CDebugf(ctx, "Shutdown, canceling root block wait")
			return
		}

		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Waiting for prefetch of revision %d, ptr %v",
			rev, rootPtr)
		waitCh, err := fbo.config.BlockOps().Prefetcher().
			WaitChannelForBlockPrefetch(ctx, rootPtr)
		if err != nil {
			fbo.log.CDebugf(ctx,
				"Error getting wait channel for prefetch: %+v", err)
			return
		}

		select {
		case <-waitCh:
		case <-updatedCh:
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "The latest merged rev has been updated")
			fbo.config.BlockOps().Prefetcher().CancelPrefetch(rootPtr)
			return
		case <-fbo.shutdownChan:
			fbo.log.CDebugf(ctx, "Shutdown, canceling prefetch wait")
			return
		}

		prefetchStatus := fbo.config.PrefetchStatus(ctx, fbo.id(), rootPtr)
		if prefetchStatus != FinishedPrefetch {
			fbo.vlog.CLogf(
				ctx, libkb.VLog1,
				"Revision was not fully prefetched: status=%s", prefetchStatus)
			return
		}

		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Prefetch for revision %d complete; commiting",
			rev)
	case keybase1.FolderSyncMode_PARTIAL:
		// For partially-synced TLFs, wait for the partial sync to
		// complete, or for an update to happen.
		lState := makeFBOLockState()
		fbo.kickOffPartialSyncIfNeeded(ctx, lState, rmd)
		ctx, cancel := context.WithCancel(ctx)
		defer cancel()
		fbo.goTracked(func() {
			select {
			case <-updatedCh:
				cancel()
			case <-fbo.shutdownChan:
				cancel()
			case <-ctx.Done():
			}
		})
		err := fbo.partialSyncs.Wait(ctx)
		if err != nil {
			fbo.log.CDebugf(ctx, "Error waiting for partial sync: %+v", err)
		}
	}

	err := diskMDCache.Commit(ctx, fbo.id(), rev)
	if err != nil {
		fbo.log.CDebugf(ctx, "Error commiting revision %d: %+v", rev, err)
	}
}

func (fbo *folderBranchOps) setObfuscatorSecret(
	ctx context.Context, kmd libkey.KeyMetadata) error {
	if !fbo.config.Mode().DoLogObfuscation() {
		return nil
	}

	fbo.obLock.Lock()
	defer fbo.obLock.Unlock()

	if fbo.obSecret != nil {
		panic("Obfuscator secret is being set more than once")
	}

	fbo.log.CDebugf(ctx, "Making the log obfuscator secret")
	secret, err := getMDObfuscationSecret(ctx, fbo.config.KeyManager(), kmd)
	if err != nil {
		return err
	}
	fbo.obSecret = secret
	return nil
}

func (fbo *folderBranchOps) makeObfuscator() data.Obfuscator {
	fbo.obLock.RLock()
	defer fbo.obLock.RUnlock()
	return makeMDObfuscatorFromSecret(fbo.obSecret, fbo.config.Mode())
}

func (fbo *folderBranchOps) setHeadLocked(
	ctx context.Context, lState *kbfssync.LockState,
	md ImmutableRootMetadata, headStatus headTrustStatus,
	ct mdCommitType) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)

	isFirstHead := fbo.head == ImmutableRootMetadata{}
	wasReadable := false
	if isFirstHead {
		err := fbo.setObfuscatorSecret(ctx, md.ReadOnly())
		if err != nil {
			return err
		}
	} else {
		if headStatus == headUntrusted {
			panic("setHeadLocked: Trying to set an untrusted head over an existing head")
		}

		wasReadable = fbo.head.IsReadable()

		if fbo.headStatus == headUntrusted {
			err := fbo.validateHeadLocked(ctx, lState, md)
			if err != nil {
				return err
			}
			if fbo.head.mdID == md.mdID {
				return nil
			}
		}

		if fbo.head.mdID == md.mdID {
			panic(errors.Errorf("Re-putting the same MD: %s", md.mdID))
		}
	}

	fbo.log.CDebugf(ctx, "Setting head revision to %d", md.Revision())

	// If this is the first time the MD is being set, and we are
	// operating on unmerged data, initialize the state properly and
	// kick off conflict resolution.
	if isFirstHead && md.MergedStatus() == kbfsmd.Unmerged {
		fbo.setBranchIDLocked(lState, md.BID())

		// Set the unflushed edit history.
		_, unmergedMDs, err := getUnmergedMDUpdates(
			ctx, fbo.config, fbo.id(), md.BID(), md.Revision())
		if err != nil {
			fbo.log.CDebugf(ctx, "Couldn't get unmerged MDs: %+v", err)
			return err
		}
		for _, unmergedMD := range unmergedMDs {
			err = fbo.handleUnflushedEditNotifications(ctx, unmergedMD)
			if err != nil {
				fbo.log.CDebugf(ctx,
					"Couldn't get unflushed edits for %d: %+v",
					unmergedMD.Revision(), err)
				return err
			}
		}

		// Use uninitialized for the merged branch; the unmerged
		// revision is enough to trigger conflict resolution.
		fbo.cr.Resolve(ctx, md.Revision(), kbfsmd.RevisionUninitialized)
	} else if md.MergedStatus() == kbfsmd.Merged {
		journalEnabled := TLFJournalEnabled(fbo.config, fbo.id())
		if journalEnabled {
			if isFirstHead {
				// If journaling is on, and this is the first head
				// we're setting, we have to make sure we use the
				// server's notion of the latest MD, not the one
				// potentially coming from our journal.  If there are
				// no flushed revisions, it's not a hard error, and we
				// just leave the latest merged revision
				// uninitialized.
				journalPred, err := fbo.getJournalPredecessorRevision(ctx)
				switch err {
				case nil:
					// journalPred will be
					// kbfsmd.RevisionUninitialized when the journal
					// is empty.
					if journalPred >= kbfsmd.RevisionInitial {
						fbo.setLatestMergedRevisionLocked(
							ctx, lState, journalPred, false)

						// Set the unflushed edit history.
						mds, err := getMergedMDUpdates(
							ctx, fbo.config, fbo.id(), journalPred+1, nil)
						if err != nil {
							fbo.log.CDebugf(ctx,
								"Couldn't get journal MDs: %+v", err)
							return err
						}
						for _, mergedMD := range mds {
							err = fbo.handleUnflushedEditNotifications(
								ctx, mergedMD)
							if err != nil {
								fbo.log.CDebugf(ctx,
									"Couldn't get unflushed edits for %d: %+v",
									mergedMD.Revision(), err)
								return err
							}
						}
					} else {
						fbo.setLatestMergedRevisionLocked(ctx, lState,
							md.Revision(), false)
					}
				case errNoFlushedRevisions:
					// The server has no revisions, so leave the
					// latest merged revision uninitialized.
				default:
					return err
				}
			} else if md.putToServer {
				// If this isn't the first head, then this is either
				// an update from the server, or an update just
				// written by the client.  But since journaling is on,
				// then latter case will be handled by onMDFlush when
				// the update is properly flushed to the server.  So
				// ignore updates that haven't yet been put to the
				// server.
				fbo.setLatestMergedRevisionLocked(
					ctx, lState, md.Revision(), false)
			}
		} else {
			// This is a merged revision, and journaling is disabled,
			// so it's definitely the latest revision on the server as
			// well.
			fbo.setLatestMergedRevisionLocked(ctx, lState, md.Revision(), false)
		}
	}

	if ct == mdCommit {
		latestMergedUpdated := fbo.latestMergedUpdated
		fbo.goTracked(func() { fbo.commitFlushedMD(md, latestMergedUpdated) })
	}

	// Make sure that any unembedded block changes have been swapped
	// back in.
	if fbo.config.Mode().BlockManagementEnabled() &&
		md.data.Changes.Info.BlockPointer != data.ZeroPtr &&
		len(md.data.Changes.Ops) == 0 {
		return errors.New("Must swap in block changes before setting head")
	}

	fbo.head = md
	if isFirstHead && headStatus == headTrusted {
		fbo.headStatus = headTrusted
	}
	fbo.status.setRootMetadata(md)
	if isFirstHead {
		// Start registering for updates right away, using this MD
		// as a starting point. Only standard FBOs get updates.
		if fbo.bType == standard {
			if fbo.config.Mode().TLFUpdatesEnabled() {
				fbo.updateDoneChan = make(chan struct{})
				fbo.goTracked(fbo.registerAndWaitForUpdates)
			}
			fbo.startMonitorChat(md.GetTlfHandle().GetCanonicalName())
		}

		// If journaling is enabled, we should make sure to enable it
		// for this TLF.  That's because we may have received the TLF
		// ID from the service, rather than via a GetIDForHandle call,
		// and so we might have skipped the journal.
		if jManager, err := GetJournalManager(fbo.config); err == nil {
			_, _ = jManager.getTLFJournal(fbo.id(), md.GetTlfHandle())
		}
	}
	if !wasReadable && md.IsReadable() {
		// Let any listeners know that this folder is now readable,
		// which may indicate that a rekey successfully took place.
		fbo.config.Reporter().Notify(ctx, mdReadSuccessNotification(
			md.GetTlfHandle(), md.TlfID().Type() == tlf.Public))
	}
	return nil
}

func mdToCommitType(md ImmutableRootMetadata) mdCommitType {
	if md.putToServer {
		return mdCommit
	}
	return mdNoCommit
}

// setNewInitialHeadLocked is for when we're creating a brand-new TLF.
// This is trusted.
func (fbo *folderBranchOps) setNewInitialHeadLocked(ctx context.Context,
	lState *kbfssync.LockState, md ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head != (ImmutableRootMetadata{}) {
		return errors.New("Unexpected non-nil head in setNewInitialHeadLocked")
	}
	if md.Revision() != kbfsmd.RevisionInitial {
		return errors.Errorf("setNewInitialHeadLocked unexpectedly called with revision %d", md.Revision())
	}
	return fbo.setHeadLocked(ctx, lState, md, headTrusted, mdToCommitType(md))
}

// setInitialHeadTrustedLocked is for when the given RootMetadata
// was fetched due to a user action, and will be checked against the
// TLF name.
func (fbo *folderBranchOps) setInitialHeadTrustedLocked(ctx context.Context,
	lState *kbfssync.LockState, md ImmutableRootMetadata,
	ct mdCommitType) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head != (ImmutableRootMetadata{}) {
		return errors.New("Unexpected non-nil head in setInitialHeadTrustedLocked")
	}
	return fbo.setHeadLocked(ctx, lState, md, headTrusted, ct)
}

// setHeadSuccessorLocked is for when we're applying updates from the
// server or when we're applying new updates we created ourselves.
func (fbo *folderBranchOps) setHeadSuccessorLocked(ctx context.Context,
	lState *kbfssync.LockState, md ImmutableRootMetadata, rebased bool) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head == (ImmutableRootMetadata{}) {
		// This can happen in tests via SyncFromServer().
		return fbo.setInitialHeadTrustedLocked(
			ctx, lState, md, mdToCommitType(md))
	}

	if !rebased {
		err := fbo.head.CheckValidSuccessor(fbo.head.mdID, md.ReadOnly())
		if err != nil {
			return err
		}
	}

	oldHandle := fbo.head.GetTlfHandle()
	newHandle := md.GetTlfHandle()

	// Newer handles should be equal or more resolved over time.
	//
	// TODO: In some cases, they shouldn't, e.g. if we're on an
	// unmerged branch. Add checks for this.
	resolvesTo, partialResolvedOldHandle, err :=
		oldHandle.ResolvesTo(
			ctx, fbo.config.Codec(), fbo.config.KBPKI(),
			tlfhandle.ConstIDGetter{ID: fbo.id()}, fbo.config, *newHandle)
	if err != nil {
		fbo.log.CDebugf(ctx, "oldHandle=%+v, newHandle=%+v: err=%+v", oldHandle, newHandle, err)
		return err
	}

	oldName := oldHandle.GetCanonicalName()
	newName := newHandle.GetCanonicalName()

	if !resolvesTo {
		fbo.log.CDebugf(ctx, "Incompatible handle error, "+
			"oldHandle: %#v, partialResolvedOldHandle: %#v, newHandle: %#v",
			oldHandle, partialResolvedOldHandle, newHandle)
		return IncompatibleHandleError{
			oldName,
			partialResolvedOldHandle.GetCanonicalName(),
			newName,
		}
	}

	err = fbo.setHeadLocked(ctx, lState, md, headTrusted, mdToCommitType(md))
	if err != nil {
		return err
	}

	if oldName != newName {
		fbo.log.CDebugf(ctx, "Handle changed (%s -> %s)",
			oldName, newName)

		fbo.config.MDCache().ChangeHandleForID(oldHandle, newHandle)
		// If the handle has changed, send out a notification.
		fbo.observers.tlfHandleChange(ctx, fbo.head.GetTlfHandle())
		// Also the folder should be re-identified given the
		// newly-resolved assertions.
		func() {
			fbo.identifyLock.Lock()
			defer fbo.identifyLock.Unlock()
			fbo.identifyDone = false
		}()
	}

	return nil
}

// setHeadPredecessorLocked is for when we're unstaging updates.
func (fbo *folderBranchOps) setHeadPredecessorLocked(ctx context.Context,
	lState *kbfssync.LockState, md ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head == (ImmutableRootMetadata{}) {
		return errors.New("Unexpected nil head in setHeadPredecessorLocked")
	}
	if fbo.head.Revision() <= kbfsmd.RevisionInitial {
		return errors.Errorf("setHeadPredecessorLocked unexpectedly called with revision %d", fbo.head.Revision())
	}

	if fbo.head.MergedStatus() != kbfsmd.Unmerged {
		return errors.New("Unexpected merged head in setHeadPredecessorLocked")
	}

	err := md.CheckValidSuccessor(md.mdID, fbo.head.ReadOnly())
	if err != nil {
		return err
	}

	oldHandle := fbo.head.GetTlfHandle()
	newHandle := md.GetTlfHandle()

	// The two handles must be the same, since no rekeying is done
	// while unmerged.

	eq, err := oldHandle.Equals(fbo.config.Codec(), *newHandle)
	if err != nil {
		return err
	}
	if !eq {
		return errors.Errorf(
			"head handle %v unexpectedly not equal to new handle = %v",
			oldHandle, newHandle)
	}

	return fbo.setHeadLocked(ctx, lState, md, headTrusted, mdToCommitType(md))
}

// setHeadConflictResolvedLocked is for when we're setting the merged
// update with resolved conflicts.
func (fbo *folderBranchOps) setHeadConflictResolvedLocked(ctx context.Context,
	lState *kbfssync.LockState, md ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head.MergedStatus() != kbfsmd.Unmerged {
		return errors.New("Unexpected merged head in setHeadConflictResolvedLocked")
	}
	if md.MergedStatus() != kbfsmd.Merged {
		return errors.New("Unexpected unmerged update in setHeadConflictResolvedLocked")
	}

	return fbo.setHeadLocked(ctx, lState, md, headTrusted, mdToCommitType(md))
}

func (fbo *folderBranchOps) identifyOnce(
	ctx context.Context, md ReadOnlyRootMetadata) error {
	fbo.identifyLock.Lock()
	defer fbo.identifyLock.Unlock()

	ei := tlfhandle.GetExtendedIdentify(ctx)
	if !ei.Behavior.AlwaysRunIdentify() {
		if fbo.identifyDone ||
			(fbo.identifyDoneWithWarning &&
				ei.Behavior.WarningInsteadOfErrorOnBrokenTracks()) {
			// TODO: provide a way for the service to break this cache
			// when identify state changes on a TLF. For now, we do it
			// this way to make chat work.
			return nil
		}
	}

	h := md.GetTlfHandle()
	fbo.log.CDebugf(ctx, "Running identifies on %s", h.GetCanonicalPath())
	kbpki := fbo.config.KBPKI()
	err := tlfhandle.IdentifyHandle(ctx, kbpki, kbpki, fbo.config, h)
	if err != nil {
		fbo.log.CDebugf(ctx, "Identify finished with error: %v", err)
		// For now, if the identify fails, let the
		// next function to hit this code path retry.
		return err
	}

	switch {
	case ei.Behavior.WarningInsteadOfErrorOnBrokenTracks() &&
		len(ei.GetTlfBreakAndClose().Breaks) > 0:
		// In the (currently unused) condition that we get here when
		// `ei.Behavior.AlwaysRunIdentify()` is true, avoid setting
		// multiple timers.
		if fbo.identifyDoneWithWarning {
			break
		}

		// In this case, the caller has explicitly requested that we
		// treat proof failures as warnings, instead of errors.  For
		// example, the GUI does this and shows a warning banner but
		// still allows access to the files.  Identifies are
		// expensive, so in this case we skip future identifies that
		// also have this behavior for a short time period.
		fbo.log.CDebugf(ctx,
			"Identify finished with no error but broken proof warnings; "+
				"caching result for %d", cacheBrokenProofIdentifiesDuration)
		fbo.identifyDoneWithWarning = true
		timer := time.NewTimer(cacheBrokenProofIdentifiesDuration)
		fbo.goTracked(func() {
			select {
			case <-timer.C:
				fbo.identifyLock.Lock()
				defer fbo.identifyLock.Unlock()
				fbo.vlog.CLogf(
					context.TODO(), libkb.VLog1,
					"Expiring cached identify with broken proofs")
				fbo.identifyDoneWithWarning = false
			case <-fbo.shutdownChan:
				timer.Stop()
			}
		})

	case ei.Behavior == keybase1.TLFIdentifyBehavior_CHAT_SKIP:
		fbo.log.CDebugf(ctx, "Identify skipped")
	default:
		fbo.log.CDebugf(ctx, "Identify finished successfully")
		fbo.identifyDone = true
		fbo.identifyTime = fbo.config.Clock().Now()
	}
	return nil
}

// getMDForRead returns an existing md for a read operation. Note that
// mds will not be fetched here.
func (fbo *folderBranchOps) getMDForRead(
	ctx context.Context, lState *kbfssync.LockState, rtype mdReadType) (
	md ImmutableRootMetadata, err error) {
	if rtype != mdReadNeedIdentify && rtype != mdReadNoIdentify {
		panic("Invalid rtype in getMDLockedForRead")
	}

	md = fbo.getTrustedHead(ctx, lState, mdCommit)
	if md != (ImmutableRootMetadata{}) {
		if rtype != mdReadNoIdentify {
			err = fbo.identifyOnce(ctx, md.ReadOnly())
		}
		return md, err
	}

	return ImmutableRootMetadata{}, MDWriteNeededInRequest{}
}

// GetTLFHandle implements the KBFSOps interface for folderBranchOps.
func (fbo *folderBranchOps) GetTLFHandle(ctx context.Context, _ Node) (
	*tlfhandle.Handle, error) {
	lState := makeFBOLockState()
	md, _ := fbo.getHead(ctx, lState, mdNoCommit)
	return md.GetTlfHandle(), nil
}

// getMDForWriteOrRekeyLocked can fetch MDs, identify them and
// contains the fancy logic. For reading use getMDLockedForRead.
// Here we actually can fetch things from the server.
// rekeys are untrusted.
func (fbo *folderBranchOps) getMDForWriteOrRekeyLocked(
	ctx context.Context, lState *kbfssync.LockState, mdType mdUpdateType) (
	md ImmutableRootMetadata, err error) {
	defer func() {
		if err != nil || mdType == mdRekey {
			return
		}
		err = fbo.identifyOnce(ctx, md.ReadOnly())
	}()

	md = fbo.getTrustedHead(ctx, lState, mdNoCommit)
	if md != (ImmutableRootMetadata{}) {
		return md, nil
	}

	// MDs coming from from rekey notifications are marked untrusted.
	//
	// TODO: Make tests not take this code path.
	fbo.mdWriterLock.AssertLocked(lState)

	// Not in cache, fetch from server and add to cache.  First, see
	// if this device has any unmerged commits -- take the latest one.
	mdops := fbo.config.MDOps()

	if fbo.config.Mode().UnmergedTLFsEnabled() {
		// get the head of the unmerged branch for this device (if any)
		md, err = mdops.GetUnmergedForTLF(ctx, fbo.id(), kbfsmd.NullBranchID)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
	}

	mergedMD, err := mdops.GetForTLF(ctx, fbo.id(), nil)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	if mergedMD == (ImmutableRootMetadata{}) {
		return ImmutableRootMetadata{},
			errors.WithStack(NoMergedMDError{fbo.id()})
	}

	if md == (ImmutableRootMetadata{}) {
		// There are no unmerged MDs for this device, so just use the current head.
		md = mergedMD
	} else {
		func() {
			fbo.headLock.Lock(lState)
			defer fbo.headLock.Unlock(lState)
			// We don't need to do this for merged head
			// because the setHeadLocked() already does
			// that anyway.
			fbo.setLatestMergedRevisionLocked(ctx, lState, mergedMD.Revision(), false)
		}()
	}

	if md.data.Dir.Type != data.Dir && (!md.IsInitialized() || md.IsReadable()) {
		return ImmutableRootMetadata{}, errors.Errorf("Got undecryptable RMD for %s: initialized=%t, readable=%t", fbo.id(), md.IsInitialized(), md.IsReadable())
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	headStatus := headTrusted
	if mdType == mdRekey {
		// If we already have a head (that has been filled after the initial
		// check, but before we acquired the lock), then just return it.
		if fbo.head != (ImmutableRootMetadata{}) {
			return fbo.head, nil
		}
		headStatus = headUntrusted
	}

	err = fbo.setHeadLocked(ctx, lState, md, headStatus, mdToCommitType(md))
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	return md, nil
}

func (fbo *folderBranchOps) getMDForReadHelper(
	ctx context.Context, lState *kbfssync.LockState, rtype mdReadType) (
	ImmutableRootMetadata, error) {
	md, err := fbo.getMDForRead(ctx, lState, rtype)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if md.TlfID().Type() != tlf.Public {
		session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
		isReader, err := md.IsReader(
			ctx, fbo.config.KBPKI(), fbo.config, session.UID)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
		if !isReader {
			return ImmutableRootMetadata{}, tlfhandle.NewReadAccessError(
				md.GetTlfHandle(), session.Name, md.GetTlfHandle().GetCanonicalPath())
		}
	}
	return md, nil
}

// getMostRecentFullyMergedMD is a helper method that returns the most
// recent merged MD that has been flushed to the server.  This could
// be different from the current local head if journaling is on.  If
// the journal is on a branch, it returns an error.
func (fbo *folderBranchOps) getMostRecentFullyMergedMD(ctx context.Context) (
	ImmutableRootMetadata, error) {
	mergedRev, err := fbo.getJournalPredecessorRevision(ctx)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	if mergedRev == kbfsmd.RevisionUninitialized {
		// No unflushed journal entries, so use the local head.
		lState := makeFBOLockState()
		return fbo.getMDForReadHelper(ctx, lState, mdReadNoIdentify)
	}

	// Otherwise, use the specified revision.
	rmd, err := getSingleMD(ctx, fbo.config, fbo.id(), kbfsmd.NullBranchID,
		mergedRev, kbfsmd.Merged, nil)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	fbo.vlog.CLogf(
		ctx, libkb.VLog1, "Most recent fully merged revision is %d", mergedRev)
	return rmd, nil
}

func (fbo *folderBranchOps) getMDForReadNoIdentify(
	ctx context.Context, lState *kbfssync.LockState) (
	ImmutableRootMetadata, error) {
	return fbo.getMDForReadHelper(ctx, lState, mdReadNoIdentify)
}

func (fbo *folderBranchOps) getMDForReadNeedIdentify(
	ctx context.Context, lState *kbfssync.LockState) (
	ImmutableRootMetadata, error) {
	return fbo.getMDForReadHelper(ctx, lState, mdReadNeedIdentify)
}

// getMDForReadNeedIdentifyOnMaybeFirstAccess should be called by a
// code path (like chat) that might be accessing this folder for the
// first time.  Other folderBranchOps methods like Lookup which know
// the folder has already been accessed at least once (to get the root
// node, for example) do not need to call this.  Unlike other getMD
// calls, this one may return a nil ImmutableRootMetadata along with a
// nil error, to indicate that there isn't any MD for this TLF yet and
// one must be created by the caller.
func (fbo *folderBranchOps) getMDForReadNeedIdentifyOnMaybeFirstAccess(
	ctx context.Context, lState *kbfssync.LockState) (
	ImmutableRootMetadata, error) {
	md, err := fbo.getMDForRead(ctx, lState, mdReadNeedIdentify)

	if _, ok := err.(MDWriteNeededInRequest); ok {
		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)
		md, err = fbo.getMDForWriteOrRekeyLocked(ctx, lState, mdWrite)
	}

	if _, noMD := errors.Cause(err).(NoMergedMDError); noMD {
		return ImmutableRootMetadata{}, nil
	}

	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	if md.TlfID().Type() != tlf.Public {
		session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
		isReader, err := md.IsReader(
			ctx, fbo.config.KBPKI(), fbo.config, session.UID)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
		if !isReader {
			return ImmutableRootMetadata{}, tlfhandle.NewReadAccessError(
				md.GetTlfHandle(), session.Name, md.GetTlfHandle().GetCanonicalPath())
		}
	}

	return md, nil
}

func (fbo *folderBranchOps) getMDForWriteLockedForFilename(
	ctx context.Context, lState *kbfssync.LockState, filename string) (
	ImmutableRootMetadata, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	md, err := fbo.getMDForWriteOrRekeyLocked(ctx, lState, mdWrite)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	isWriter, err := md.IsWriter(
		ctx, fbo.config.KBPKI(), fbo.config, session.UID, session.VerifyingKey)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if !isWriter {
		return ImmutableRootMetadata{}, tlfhandle.NewWriteAccessError(
			md.GetTlfHandle(), session.Name, filename)
	}

	return md, nil
}

func (fbo *folderBranchOps) getSuccessorMDForWriteLockedForFilename(
	ctx context.Context, lState *kbfssync.LockState, filename string) (
	*RootMetadata, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	md, err := fbo.getMDForWriteLockedForFilename(ctx, lState, filename)
	if err != nil {
		return nil, err
	}

	// Make a new successor of the current MD to hold the coming
	// writes.  The caller must pass this into `finalizeMDWriteLocked`
	// or the changes will be lost.
	return md.MakeSuccessor(ctx, fbo.config.MetadataVersion(),
		fbo.config.Codec(),
		fbo.config.KeyManager(), fbo.config.KBPKI(), fbo.config.KBPKI(),
		fbo.config, md.mdID, true)
}

// getSuccessorMDForWriteLocked returns a new RootMetadata object with
// an incremented version number for modification. If the returned
// object is put to the MDServer (via MDOps), mdWriterLock must be
// held until then. (See comments for mdWriterLock above.)
func (fbo *folderBranchOps) getSuccessorMDForWriteLocked(
	ctx context.Context, lState *kbfssync.LockState) (*RootMetadata, error) {
	return fbo.getSuccessorMDForWriteLockedForFilename(ctx, lState, "")
}

// getMDForRekeyWriteLocked returns a nil `rmd` if it is a team TLF,
// since that can't be rekeyed by KBFS.
func (fbo *folderBranchOps) getMDForRekeyWriteLocked(
	ctx context.Context, lState *kbfssync.LockState) (
	rmd *RootMetadata, lastWriterVerifyingKey kbfscrypto.VerifyingKey,
	wasRekeySet bool, err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	md, err := fbo.getMDForWriteOrRekeyLocked(ctx, lState, mdRekey)
	if err != nil {
		return nil, kbfscrypto.VerifyingKey{}, false, err
	}

	if md.TypeForKeying() == tlf.TeamKeying {
		return nil, kbfscrypto.VerifyingKey{}, false, nil
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return nil, kbfscrypto.VerifyingKey{}, false, err
	}

	handle := md.GetTlfHandle()

	// must be a reader or writer (it checks both.)
	if !handle.IsReader(session.UID) {
		return nil, kbfscrypto.VerifyingKey{}, false,
			NewRekeyPermissionError(md.GetTlfHandle(), session.Name)
	}

	newMd, err := md.MakeSuccessor(ctx, fbo.config.MetadataVersion(),
		fbo.config.Codec(),
		fbo.config.KeyManager(), fbo.config.KBPKI(), fbo.config.KBPKI(),
		fbo.config, md.mdID, handle.IsWriter(session.UID))
	if err != nil {
		return nil, kbfscrypto.VerifyingKey{}, false, err
	}

	// readers shouldn't modify writer metadata
	if !handle.IsWriter(session.UID) && !newMd.IsWriterMetadataCopiedSet() {
		return nil, kbfscrypto.VerifyingKey{}, false,
			NewRekeyPermissionError(handle, session.Name)
	}

	return newMd, md.LastModifyingWriterVerifyingKey(), md.IsRekeySet(), nil
}

func (fbo *folderBranchOps) nowUnixNano() int64 {
	return fbo.config.Clock().Now().UnixNano()
}

func (fbo *folderBranchOps) maybeUnembedAndPutBlocks(ctx context.Context,
	md *RootMetadata) (blockPutState, error) {
	if fbo.config.BlockSplitter().ShouldEmbedData(
		md.data.Changes.SizeEstimate()) {
		return nil, nil
	}

	chargedTo, err := chargedToForTLF(
		ctx, fbo.config.KBPKI(), fbo.config.KBPKI(), fbo.config,
		md.GetTlfHandle())
	if err != nil {
		return nil, err
	}

	bps := newBlockPutStateMemory(1)
	err = fbo.prepper.unembedBlockChanges(
		ctx, bps, md, &md.data.Changes, chargedTo)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err != nil {
			fbo.fbm.cleanUpBlockState(md.ReadOnly(), bps, blockDeleteOnMDFail)
		}
	}()
	cacheType := DiskBlockAnyCache
	if fbo.config.IsSyncedTlf(fbo.id()) {
		cacheType = DiskBlockSyncCache
	}
	ptrsToDelete, err := doBlockPuts(
		ctx, fbo.config.BlockServer(), fbo.config.BlockCache(),
		fbo.config.Reporter(), fbo.log, fbo.deferLog, md.TlfID(),
		md.GetTlfHandle().GetCanonicalName(), bps, cacheType)
	if err != nil {
		return nil, err
	}
	if len(ptrsToDelete) > 0 {
		return nil, errors.Errorf("Unexpected pointers to delete after "+
			"unembedding block changes in gc op: %v", ptrsToDelete)
	}
	return bps, nil
}

// ResetRootBlock creates a new empty dir block and sets the given
// metadata's root block to it.
func ResetRootBlock(ctx context.Context, config Config,
	rmd *RootMetadata) (data.Block, data.BlockInfo, data.ReadyBlockData, error) {
	newDblock := data.NewDirBlock()
	chargedTo, err := chargedToForTLF(
		ctx, config.KBPKI(), config.KBPKI(), config, rmd.GetTlfHandle())
	if err != nil {
		return nil, data.BlockInfo{}, data.ReadyBlockData{}, err
	}

	info, plainSize, readyBlockData, err :=
		data.ReadyBlock(ctx, config.BlockCache(), config.BlockOps(),
			rmd.ReadOnly(), newDblock, chargedTo, config.DefaultBlockType())
	if err != nil {
		return nil, data.BlockInfo{}, data.ReadyBlockData{}, err
	}

	now := config.Clock().Now().UnixNano()
	rmd.data.Dir = data.DirEntry{
		BlockInfo: info,
		EntryInfo: data.EntryInfo{
			Type:  data.Dir,
			Size:  uint64(plainSize),
			Mtime: now,
			Ctime: now,
		},
	}
	prevDiskUsage := rmd.DiskUsage()
	rmd.SetDiskUsage(0)
	// Redundant, since this is called only for brand-new or
	// successor RMDs, but leave in to be defensive.
	rmd.ClearBlockChanges()
	co := newCreateOpForRootDir()
	rmd.AddOp(co)
	rmd.AddRefBlock(rmd.data.Dir.BlockInfo)
	// Set unref bytes to the previous disk usage, so that the
	// accounting works out.
	rmd.AddUnrefBytes(prevDiskUsage)
	return newDblock, info, readyBlockData, nil
}

func (fbo *folderBranchOps) cacheHashBehavior() data.BlockCacheHashBehavior {
	if TLFJournalEnabled(fbo.config, fbo.id()) {
		return data.SkipCacheHash
	}
	return data.DoCacheHash
}

func (fbo *folderBranchOps) initMDLocked(
	ctx context.Context, lState *kbfssync.LockState, md *RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	handle := md.GetTlfHandle()

	// make sure we're a writer before rekeying or putting any blocks.
	isWriter, err := md.IsWriter(
		ctx, fbo.config.KBPKI(), fbo.config, session.UID, session.VerifyingKey)
	if err != nil {
		return err
	}
	if !isWriter {
		return tlfhandle.NewWriteAccessError(
			handle, session.Name, handle.GetCanonicalPath())
	}

	var expectedKeyGen kbfsmd.KeyGen
	var tlfCryptKey *kbfscrypto.TLFCryptKey
	switch md.TypeForKeying() {
	case tlf.PublicKeying:
		expectedKeyGen = kbfsmd.PublicKeyGen
	case tlf.PrivateKeying:
		var rekeyDone bool
		// create a new set of keys for this metadata
		rekeyDone, tlfCryptKey, err = fbo.config.KeyManager().Rekey(ctx, md, false)
		if err != nil {
			return err
		}
		if !rekeyDone {
			return errors.Errorf("Initial rekey unexpectedly not done for "+
				"private TLF %v", md.TlfID())
		}
		expectedKeyGen = kbfsmd.FirstValidKeyGen
	case tlf.TeamKeying:
		// Teams get their crypt key from the service, no need to
		// rekey in KBFS.
		tid, err := handle.FirstResolvedWriter().AsTeam()
		if err != nil {
			return err
		}
		keys, keyGen, err := fbo.config.KBPKI().GetTeamTLFCryptKeys(
			ctx, tid, kbfsmd.UnspecifiedKeyGen, fbo.oa())
		if err != nil {
			return err
		}
		if keyGen < kbfsmd.FirstValidKeyGen {
			return errors.WithStack(
				kbfsmd.InvalidKeyGenerationError{TlfID: md.TlfID(), KeyGen: keyGen})
		}
		expectedKeyGen = keyGen
		md.bareMd.SetLatestKeyGenerationForTeamTLF(keyGen)
		key, ok := keys[keyGen]
		if !ok {
			return errors.WithStack(
				kbfsmd.InvalidKeyGenerationError{TlfID: md.TlfID(), KeyGen: keyGen})
		}
		tlfCryptKey = &key
	}
	keyGen := md.LatestKeyGeneration()
	if keyGen != expectedKeyGen {
		return kbfsmd.InvalidKeyGenerationError{TlfID: md.TlfID(), KeyGen: keyGen}
	}

	// create a dblock since one doesn't exist yet
	newDblock, info, readyBlockData, err := ResetRootBlock(ctx, fbo.config, md)
	if err != nil {
		return err
	}

	// Some other thread got here first, so give up and let it go
	// before we push anything to the servers.
	if h, _ := fbo.getHead(
		ctx, lState, mdNoCommit); h != (ImmutableRootMetadata{}) {
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Head was already set, aborting")
		return nil
	}

	cacheType := DiskBlockAnyCache
	if fbo.config.IsSyncedTlf(fbo.id()) {
		cacheType = DiskBlockSyncCache
	}
	if err = PutBlockCheckLimitErrs(
		ctx, fbo.config.BlockServer(), fbo.config.Reporter(), md.TlfID(),
		info.BlockPointer, readyBlockData,
		md.GetTlfHandle().GetCanonicalName(), cacheType); err != nil {
		return err
	}
	err = fbo.config.BlockCache().Put(
		info.BlockPointer, fbo.id(), newDblock, data.TransientEntry,
		fbo.cacheHashBehavior())
	if err != nil {
		fbo.log.CDebugf(
			ctx, "Error caching new block %v: %+v", info.BlockPointer, err)
	}

	bps, err := fbo.maybeUnembedAndPutBlocks(ctx, md)
	if err != nil {
		return err
	}

	err = fbo.finalizeBlocks(ctx, bps)
	if err != nil {
		return err
	}

	// Write out the new metadata.  If journaling is enabled, we don't
	// want the rekey to hit the journal and possibly end up on a
	// conflict branch, so push straight to the server.
	mdOps := fbo.config.MDOps()
	if jManager, err := GetJournalManager(fbo.config); err == nil {
		mdOps = jManager.delegateMDOps
	}
	irmd, err := mdOps.Put(
		ctx, md, session.VerifyingKey, nil, keybase1.MDPriorityNormal, bps)
	isConflict := isRevisionConflict(err)
	if err != nil && !isConflict {
		return err
	} else if isConflict {
		return RekeyConflictError{err}
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	if fbo.head != (ImmutableRootMetadata{}) {
		return errors.Errorf(
			"%v: Unexpected MD ID during new MD initialization: %v",
			md.TlfID(), fbo.head.mdID)
	}

	err = fbo.setNewInitialHeadLocked(ctx, lState, irmd)
	if err != nil {
		return err
	}

	// cache any new TLF crypt key
	if tlfCryptKey != nil {
		err = fbo.config.KeyCache().PutTLFCryptKey(
			md.TlfID(), keyGen, *tlfCryptKey)
		if err != nil {
			return err
		}
	}

	return nil
}

func (fbo *folderBranchOps) checkNode(node Node) error {
	fb := node.GetFolderBranch()
	if fb != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, fb}
	}
	return nil
}

func (fbo *folderBranchOps) checkNodeForRead(
	ctx context.Context, node Node) error {
	err := fbo.checkNode(node)
	if err != nil {
		return err
	}

	// If we're offline, only synced, non-archived data should be
	// available.  TODO(KBFS-3585): add checks for unsynced TLFs.
	if !fbo.branch().IsArchived() {
		return nil
	}

	services, _ := fbo.serviceStatus.CurrentStatus()
	if len(services) > 0 {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Failing read of archived data while offline; "+
				"failing services=%v", services)
		h, err := fbo.GetTLFHandle(ctx, nil)
		if err != nil {
			return err
		}
		return OfflineArchivedError{h}
	}
	return nil
}

func (fbo *folderBranchOps) checkNodeForWrite(
	ctx context.Context, node Node) error {
	err := fbo.checkNode(node)
	if err != nil {
		return err
	}
	if !node.Readonly(ctx) {
		return nil
	}

	// This is a read-only node, so reject the write.
	p, err := fbo.pathFromNodeForRead(node)
	if err != nil {
		return err
	}
	return WriteToReadonlyNodeError{p.String()}
}

// SetInitialHeadFromServer sets the head to the given
// ImmutableRootMetadata, which must be retrieved from the MD server.
func (fbo *folderBranchOps) SetInitialHeadFromServer(
	ctx context.Context, md ImmutableRootMetadata) (err error) {
	startTime, timer := fbo.startOp(
		ctx, "SetInitialHeadFromServer, revision=%d (%s)",
		md.Revision(), md.MergedStatus())
	defer func() {
		fbo.endOp(
			ctx, startTime, timer,
			"SetInitialHeadFromServer, revision=%d (%s) done: %+v",
			md.Revision(), md.MergedStatus(), err)
	}()

	var latestRootBlockFetch <-chan error
	partialSyncMD := md
	lState := makeFBOLockState()
	var setHead bool
	if md.IsReadable() && fbo.config.Mode().PrefetchWorkers() > 0 {
		// We `Get` the root block to ensure downstream prefetches
		// occur.  Use a fresh context, in case `ctx` is canceled by
		// the caller before we complete.
		prefetchCtx := fbo.ctxWithFBOID(context.Background())
		fbo.vlog.CLogf(
			ctx, libkb.VLog1,
			"Prefetching root block with a new context: FBOID=%s",
			prefetchCtx.Value(CtxFBOIDKey))
		latestRootBlockFetch = fbo.kickOffRootBlockFetch(ctx, md)

		// Kick off partial prefetching once the latest merged
		// revision is set.
		defer func() {
			if setHead && err == nil {
				fbo.kickOffPartialSyncIfNeeded(ctx, lState, partialSyncMD)
			}
		}()
	} else {
		fbo.log.CDebugf(ctx,
			"Setting an unreadable head with revision=%d", md.Revision())
	}

	// Return early if the head is already set.  This avoids taking
	// mdWriterLock for no reason, and it also avoids any side effects
	// (e.g., calling `identifyOnce` and downloading the merged
	// head) if head is already set.
	head, headStatus := fbo.getHead(ctx, lState, mdNoCommit)
	if headStatus == headTrusted && head != (ImmutableRootMetadata{}) && head.mdID == md.mdID {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Head MD already set to revision %d (%s), no "+
				"need to set initial head again",
			md.Revision(), md.MergedStatus())
		return nil
	}

	return runUnlessCanceled(ctx, func() error {
		if md.TlfID() != fbo.id() {
			return WrongOpsError{
				fbo.folderBranch, data.FolderBranch{
					Tlf:    md.TlfID(),
					Branch: data.MasterBranch,
				}}
		}

		// Always identify first when trying to initialize the folder,
		// even if we turn out not to be a writer.  (We can't rely on
		// the identifyOnce call in getMDLocked, because that isn't
		// called from the initialization code path when the local
		// user is not a valid writer.)  Also, we want to make sure we
		// fail before we set the head, otherwise future calls will
		// succeed incorrectly.
		err = fbo.identifyOnce(ctx, md.ReadOnly())
		if err != nil {
			return err
		}

		lState := makeFBOLockState()

		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)

		if md.MergedStatus() == kbfsmd.Unmerged && fbo.bType != conflict {
			mdops := fbo.config.MDOps()
			mergedMD, err := mdops.GetForTLF(ctx, fbo.id(), nil)
			if err != nil {
				return err
			}
			partialSyncMD = mergedMD

			func() {
				fbo.headLock.Lock(lState)
				defer fbo.headLock.Unlock(lState)
				fbo.setLatestMergedRevisionLocked(ctx, lState,
					mergedMD.Revision(), false)
			}()
		}

		ct := mdToCommitType(md)
		if latestRootBlockFetch != nil {
			err := fbo.waitForRootBlockFetch(ctx, md, latestRootBlockFetch)
			if err != nil {
				fbo.log.CDebugf(ctx,
					"Couldn't fetch root block, so not commiting MD: %+v", err)
				ct = mdNoCommit
			}
		}

		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)

		// Only update the head the first time; later it will be
		// updated either directly via writes or through the
		// background update processor.
		if fbo.head == (ImmutableRootMetadata{}) {
			setHead = true
			err = fbo.setInitialHeadTrustedLocked(ctx, lState, md, ct)
			if err != nil {
				return err
			}
		} else if headStatus == headUntrusted {
			err = fbo.validateHeadLocked(ctx, lState, md)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

// SetInitialHeadToNew creates a brand-new ImmutableRootMetadata
// object and sets the head to that. This is trusted.
func (fbo *folderBranchOps) SetInitialHeadToNew(
	ctx context.Context, id tlf.ID, handle *tlfhandle.Handle) (err error) {
	startTime, timer := fbo.startOp(ctx, "SetInitialHeadToNew %s", id)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "SetInitialHeadToNew %s done: %+v", id, err)
	}()

	rmd, err := makeInitialRootMetadata(
		fbo.config.MetadataVersion(), id, handle)
	if err != nil {
		return err
	}

	return runUnlessCanceled(ctx, func() error {
		// New heads can only be set for the MasterBranch.
		fb := data.FolderBranch{Tlf: rmd.TlfID(), Branch: data.MasterBranch}
		if fb != fbo.folderBranch {
			return WrongOpsError{fbo.folderBranch, fb}
		}

		// Always identify first when trying to initialize the folder,
		// even if we turn out not to be a writer.  (We can't rely on
		// the identifyOnce call in getMDLocked, because that isn't
		// called from the initialization code path when the local
		// user is not a valid writer.)  Also, we want to make sure we
		// fail before we set the head, otherwise future calls will
		// succeed incorrectly.
		err = fbo.identifyOnce(ctx, rmd.ReadOnly())
		if err != nil {
			return err
		}

		lState := makeFBOLockState()

		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)
		return fbo.initMDLocked(ctx, lState, rmd)
	})
}

func getNodeIDStr(n Node) string {
	if n == nil {
		return "NodeID(nil)"
	}
	return fmt.Sprintf("NodeID(%v)", n.GetID())
}

func (fbo *folderBranchOps) getRootNode(ctx context.Context) (
	node Node, ei data.EntryInfo, handle *tlfhandle.Handle, err error) {
	startTime, timer := fbo.startOp(ctx, "getRootNode")
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "getRootNode done: %s %+v",
			getNodeIDStr(node), err)
	}()

	lState := makeFBOLockState()

	var md ImmutableRootMetadata
	md, err = fbo.getMDForRead(ctx, lState, mdReadNoIdentify)
	if _, ok := err.(MDWriteNeededInRequest); ok {
		func() {
			fbo.mdWriterLock.Lock(lState)
			defer fbo.mdWriterLock.Unlock(lState)
			md, err = fbo.getMDForWriteOrRekeyLocked(ctx, lState, mdWrite)
		}()
	}
	if err != nil {
		return nil, data.EntryInfo{}, nil, err
	}

	// we may be an unkeyed client
	err = isReadableOrError(ctx, fbo.config.KBPKI(), fbo.config, md.ReadOnly())
	if err != nil {
		return nil, data.EntryInfo{}, nil, err
	}

	handle = md.GetTlfHandle()
	node, err = fbo.nodeCache.GetOrCreate(md.data.Dir.BlockPointer,
		data.NewPathPartString(string(handle.GetCanonicalName()), nil),
		nil, data.Dir)
	if err != nil {
		return nil, data.EntryInfo{}, nil, err
	}

	return node, md.Data().Dir.EntryInfo, handle, nil
}

type makeNewBlock func() data.Block

// pathFromNodeHelper() shouldn't be called except by the helper
// functions below.
func (fbo *folderBranchOps) pathFromNodeHelper(n Node) (data.Path, error) {
	p := fbo.nodeCache.PathFromNode(n)
	if !p.IsValid() {
		return data.Path{}, errors.WithStack(InvalidPathError{p})
	}
	return p, nil
}

// Helper functions to clarify uses of pathFromNodeHelper() (see
// nodeCache comments).

func (fbo *folderBranchOps) pathFromNodeForRead(n Node) (data.Path, error) {
	return fbo.pathFromNodeHelper(n)
}

func (fbo *folderBranchOps) pathFromNodeForMDWriteLocked(
	lState *kbfssync.LockState, n Node) (data.Path, error) {
	fbo.mdWriterLock.AssertLocked(lState)
	return fbo.pathFromNodeHelper(n)
}

func (fbo *folderBranchOps) getDirChildren(ctx context.Context, dir Node) (
	children map[data.PathPartString]data.EntryInfo, err error) {
	fs := dir.GetFS(ctx)
	if fs != nil {
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Getting children using an FS")
		fis, err := fs.ReadDir("")
		if err != nil {
			return nil, err
		}
		children = make(map[data.PathPartString]data.EntryInfo, len(fis))
		for _, fi := range fis {
			name := fi.Name()
			ei := data.EntryInfoFromFileInfo(fi)
			if ei.Type == data.Sym {
				target, err := fs.Readlink(name)
				if err != nil {
					return nil, err
				}
				ei.SymPath = target
			}
			children[dir.ChildName(name)] = ei
		}
		return children, nil
	}

	lState := makeFBOLockState()

	dirPath, err := fbo.pathFromNodeForRead(dir)
	if err != nil {
		return nil, err
	}

	if fbo.nodeCache.IsUnlinked(dir) {
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Returning an empty children set for "+
			"unlinked directory %v", dirPath.TailPointer())
		return nil, nil
	}

	md, err := fbo.getMDForReadNeedIdentify(ctx, lState)
	if err != nil {
		return nil, err
	}

	return fbo.blocks.GetChildren(ctx, lState, md.ReadOnly(), dirPath)
}

func (fbo *folderBranchOps) transformReadError(
	ctx context.Context, node Node, err error) error {
	_, isBlockNonExistent :=
		errors.Cause(err).(kbfsblock.ServerErrorBlockNonExistent)
	if errors.Cause(err) != context.DeadlineExceeded && !isBlockNonExistent {
		return err
	}

	if fbo.config.IsSyncedTlf(fbo.id()) {
		fbo.log.CWarningf(ctx,
			"Got unexpected read error on a synced TLF: %+v", err)
		return err
	}

	if isBlockNonExistent {
		p := fbo.nodeCache.PathFromNode(node)
		if p.HasValidParent() {
			// Surface the block error for everything but the root
			// block, so we don't hide serious unexpected errors.
			return err
		}
		// Hopefully, this just means that we're using an out-of-date,
		// cached MD that's pointing us to GC'd blocks.
		fbo.log.CWarningf(ctx,
			"Transforming missing root block error for an unsynced TLF: %+v",
			err)
	}

	// For unsynced TLFs, return a specific error to let the system
	// know to show a sync recommendation.
	h, hErr := fbo.GetTLFHandle(ctx, nil)
	if hErr != nil {
		fbo.log.CDebugf(
			ctx, "Couldn't get handle while transforming error: %+v", hErr)
		return err
	}
	return errors.WithStack(OfflineUnsyncedError{h})
}

func (fbo *folderBranchOps) GetDirChildren(ctx context.Context, dir Node) (
	children map[data.PathPartString]data.EntryInfo, err error) {
	startTime, timer := fbo.startOp(ctx, "GetDirChildren %s", getNodeIDStr(dir))
	defer func() {
		err = fbo.transformReadError(ctx, dir, err)
		fbo.endOp(
			ctx, startTime, timer, "GetDirChildren %s done, %d entries: %+v",
			getNodeIDStr(dir), len(children), err)
	}()

	err = fbo.checkNodeForRead(ctx, dir)
	if err != nil {
		return nil, err
	}

	var retChildren map[data.PathPartString]data.EntryInfo
	err = runUnlessCanceled(ctx, func() error {
		retChildren, err = fbo.getDirChildren(ctx, dir)
		return err
	})
	if err != nil {
		return nil, err
	}

	if dir.ShouldRetryOnDirRead(ctx) {
		err2 := fbo.SyncFromServer(ctx, fbo.folderBranch, nil)
		if err2 != nil {
			fbo.log.CDebugf(ctx, "Error syncing before retry: %+v", err2)
			return nil, nil
		}

		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Retrying GetDirChildren of an empty directory")
		err = runUnlessCanceled(ctx, func() error {
			retChildren, err = fbo.getDirChildren(ctx, dir)
			return err
		})
		if err != nil {
			return nil, err
		}
	}

	return retChildren, nil
}

func (fbo *folderBranchOps) makeFakeEntryID(
	ctx context.Context, dir Node, name data.PathPartString) (
	id kbfsblock.ID, err error) {
	// Use the path of the node to generate the node ID, which will be
	// unique and deterministic within `fbo.nodeCache`.
	dirPath := fbo.nodeCache.PathFromNode(dir)
	return kbfsblock.MakePermanentID(
		[]byte(dirPath.ChildPathNoPtr(name, fbo.makeObfuscator()).String()),
		fbo.config.BlockCryptVersion())
}

func (fbo *folderBranchOps) makeFakeDirEntry(
	ctx context.Context, dir Node, name data.PathPartString) (
	de data.DirEntry, err error) {
	fbo.vlog.CLogf(ctx, libkb.VLog1, "Faking directory entry for %s", name)
	id, err := fbo.makeFakeEntryID(ctx, dir, name)
	if err != nil {
		return data.DirEntry{}, err
	}

	now := fbo.nowUnixNano()
	de = data.DirEntry{
		BlockInfo: data.BlockInfo{
			BlockPointer: data.BlockPointer{
				ID:      id,
				DataVer: data.FirstValidVer,
			},
		},
		EntryInfo: data.EntryInfo{
			Type:  data.Dir,
			Size:  0,
			Mtime: now,
			Ctime: now,
		},
	}
	return de, nil
}

func (fbo *folderBranchOps) makeFakeFileEntry(
	ctx context.Context, dir Node, name data.PathPartString, fi os.FileInfo,
	sympath data.PathPartString) (de data.DirEntry, err error) {
	fbo.vlog.CLogf(ctx, libkb.VLog1, "Faking file entry for %s", name)
	id, err := fbo.makeFakeEntryID(ctx, dir, name)
	if err != nil {
		return data.DirEntry{}, err
	}

	de = data.DirEntry{
		BlockInfo: data.BlockInfo{
			BlockPointer: data.BlockPointer{
				ID:      id,
				DataVer: data.FirstValidVer,
			},
		},
		EntryInfo: data.EntryInfoFromFileInfo(fi),
	}
	if de.Type == data.Sym {
		de.SymPath = sympath.Plaintext()
	}
	return de, nil
}

func (fbo *folderBranchOps) processMissedLookup(
	ctx context.Context, lState *kbfssync.LockState, dir Node,
	name data.PathPartString, missErr error) (
	node Node, ei data.EntryInfo, err error) {
	// Check if the directory node wants to autocreate this.
	autocreate, ctx, et, fi, sympath := dir.ShouldCreateMissedLookup(ctx, name)
	if !autocreate {
		return nil, data.EntryInfo{}, missErr
	}

	if et == data.FakeDir {
		de, err := fbo.makeFakeDirEntry(ctx, dir, name)
		if err != nil {
			return nil, data.EntryInfo{}, missErr
		}
		node, err := fbo.blocks.GetChildNode(lState, dir, name, de)
		if err != nil {
			return nil, data.EntryInfo{}, err
		}
		return node, de.EntryInfo, nil
	} else if et == data.FakeFile {
		de, err := fbo.makeFakeFileEntry(ctx, dir, name, fi, sympath)
		if err != nil {
			return nil, data.EntryInfo{}, missErr
		}
		node, err := fbo.blocks.GetChildNode(lState, dir, name, de)
		if err != nil {
			return nil, data.EntryInfo{}, err
		}
		return node, de.EntryInfo, nil
	}

	if (sympath.Plaintext() != "" && et != data.Sym) ||
		(sympath.Plaintext() == "" && et == data.Sym) {
		return nil, data.EntryInfo{}, errors.Errorf(
			"Invalid sympath %s for entry type %s", sympath, et)
	}

	fbo.vlog.CLogf(
		ctx, libkb.VLog1,
		"Auto-creating %s of type %s after a missed lookup", name, et)
	switch et {
	case data.File:
		return fbo.CreateFile(ctx, dir, name, false, NoExcl)
	case data.Exec:
		return fbo.CreateFile(ctx, dir, name, true, NoExcl)
	case data.Dir:
		return fbo.CreateDir(ctx, dir, name)
	case data.Sym:
		ei, err := fbo.CreateLink(ctx, dir, name, sympath)
		return nil, ei, err
	default:
		return nil, data.EntryInfo{}, errors.Errorf("Unknown entry type %s", et)
	}
}

func (fbo *folderBranchOps) statUsingFS(
	ctx context.Context, lState *kbfssync.LockState, node Node,
	name data.PathPartString) (de data.DirEntry, ok bool, err error) {
	if node == nil {
		return data.DirEntry{}, false, nil
	}

	// First check if this is needs to be a faked-out node.
	autocreate, _, et, fi, sympath := node.ShouldCreateMissedLookup(ctx, name)
	if autocreate {
		if et == data.FakeDir {
			de, err := fbo.makeFakeDirEntry(ctx, node, name)
			if err != nil {
				return data.DirEntry{}, false, err
			}
			return de, true, nil
		} else if et == data.FakeFile {
			de, err = fbo.makeFakeFileEntry(ctx, node, name, fi, sympath)
			if err != nil {
				return data.DirEntry{}, false, err
			}
			return de, true, nil
		}
	}

	fs := node.GetFS(ctx)
	if fs == nil {
		return data.DirEntry{}, false, nil
	}

	fbo.vlog.CLogf(ctx, libkb.VLog1, "Using an FS to satisfy stat of %s", name)

	fi, err = fs.Lstat(name.Plaintext())
	if err != nil {
		return data.DirEntry{}, false, err
	}

	if fi.Mode()&os.ModeSymlink != 0 {
		sympathPlain, err := fs.Readlink(name.Plaintext())
		if err != nil {
			return data.DirEntry{}, false, err
		}
		sympath = node.ChildName(sympathPlain)
	}

	de, err = fbo.makeFakeFileEntry(ctx, node, name, fi, sympath)
	if err != nil {
		return data.DirEntry{}, false, err
	}
	return de, true, nil
}

func (fbo *folderBranchOps) lookup(
	ctx context.Context, dir Node, name data.PathPartString) (
	node Node, de data.DirEntry, err error) {
	lState := makeFBOLockState()

	de, ok, err := fbo.statUsingFS(ctx, lState, dir, name)
	if err != nil {
		return nil, data.DirEntry{}, err
	}
	if ok {
		node, err := fbo.blocks.GetChildNode(lState, dir, name, de)
		if err != nil {
			return nil, data.DirEntry{}, err
		}
		return node, de, nil
	}

	if fbo.nodeCache.IsUnlinked(dir) {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Refusing a lookup for unlinked directory %v",
			fbo.nodeCache.PathFromNode(dir).TailPointer())
		return nil, data.DirEntry{}, idutil.NoSuchNameError{Name: name.String()}
	}

	md, err := fbo.getMDForReadNeedIdentify(ctx, lState)
	if err != nil {
		return nil, data.DirEntry{}, err
	}

	node, de, err = fbo.blocks.Lookup(ctx, lState, md.ReadOnly(), dir, name)
	if _, isMiss := errors.Cause(err).(idutil.NoSuchNameError); isMiss {
		node, de.EntryInfo, err = fbo.processMissedLookup(
			ctx, lState, dir, name, err)
		if _, exists := errors.Cause(err).(data.NameExistsError); exists {
			// Someone raced us to create the entry, so return the
			// new entry.
			node, de, err = fbo.blocks.Lookup(
				ctx, lState, md.ReadOnly(), dir, name)
		}
	}
	return node, de, err
}

func (fbo *folderBranchOps) Lookup(
	ctx context.Context, dir Node, name data.PathPartString) (
	node Node, ei data.EntryInfo, err error) {
	startTime, timer := fbo.startOp(
		ctx, "Lookup %s %s", getNodeIDStr(dir), name)
	defer func() {
		err = fbo.transformReadError(ctx, dir, err)
		fbo.endOp(
			ctx, startTime, timer, "Lookup %s %s done: %v %+v",
			getNodeIDStr(dir), name, getNodeIDStr(node), err)
	}()

	err = fbo.checkNodeForRead(ctx, dir)
	if err != nil {
		return nil, data.EntryInfo{}, err
	}

	// It's racy for the goroutine to write directly to return param
	// `node`, so use a new param for that.
	var n Node
	var de data.DirEntry
	err = runUnlessCanceled(ctx, func() error {
		var err error
		n, de, err = fbo.lookup(ctx, dir, name)
		return err
	})
	// Only retry the lookup potentially if the lookup missed.
	if err != nil {
		if _, isMiss := errors.Cause(err).(idutil.NoSuchNameError); !isMiss {
			return nil, data.EntryInfo{}, err
		}
	}

	if dir.ShouldRetryOnDirRead(ctx) {
		err2 := fbo.SyncFromServer(ctx, fbo.folderBranch, nil)
		if err2 != nil {
			fbo.log.CDebugf(ctx, "Error syncing before retry: %+v", err2)
			return n, de.EntryInfo, err
		}

		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Retrying lookup of an empty directory")
		err = runUnlessCanceled(ctx, func() error {
			var err error
			n, de, err = fbo.lookup(ctx, dir, name)
			return err
		})
	}
	if err != nil {
		return nil, data.EntryInfo{}, err
	}
	return n, de.EntryInfo, nil
}

// statEntry is like Stat, but it returns a DirEntry. This is used by
// tests.
func (fbo *folderBranchOps) statEntry(ctx context.Context, node Node) (
	de data.DirEntry, err error) {
	defer func() {
		err = fbo.transformReadError(ctx, node, err)
	}()
	err = fbo.checkNodeForRead(ctx, node)
	if err != nil {
		return data.DirEntry{}, err
	}

	nodePath, err := fbo.pathFromNodeForRead(node)
	if err != nil {
		return data.DirEntry{}, err
	}

	lState := makeFBOLockState()
	var md ImmutableRootMetadata
	if nodePath.HasValidParent() {
		// Look up the node for the parent, and see if it has an FS
		// that can be used to stat `node`.
		parentPath := nodePath.ParentPath()
		parentNode := fbo.nodeCache.Get(parentPath.TailPointer().Ref())
		de, ok, err := fbo.statUsingFS(
			ctx, lState, parentNode, node.GetBasename())
		if err != nil {
			return data.DirEntry{}, err
		}
		if ok {
			return de, nil
		}

		// Otherwise, proceed with the usual way.
		md, err = fbo.getMDForReadNeedIdentify(ctx, lState)
		// And handle the error, err is local to this block
		// shadowing the err in the surrounding block.
		if err != nil {
			return data.DirEntry{}, err
		}
	} else {
		// If nodePath has no valid parent, it's just the TLF root, so
		// we don't need an identify in this case.  Note: we don't
		// support FS-based stats for the root directory.
		md, err = fbo.getMDForReadNoIdentify(ctx, lState)
	}
	if err != nil {
		return data.DirEntry{}, err
	}

	return fbo.blocks.GetEntryEvenIfDeleted(
		ctx, lState, md.ReadOnly(), nodePath)
}

func (fbo *folderBranchOps) deferLogIfErr(
	ctx context.Context, err error, fs string, args ...interface{}) {
	if err != nil {
		fbo.defer2Log.CDebugf(ctx, fs, args...)
	} else {
		fbo.defer2Vlog.CLogf(ctx, libkb.VLog1, fs, args...)
	}
}

func (fbo *folderBranchOps) Stat(ctx context.Context, node Node) (
	ei data.EntryInfo, err error) {
	// Stats are common and clog up the logs, so only print to vlog.
	fbo.vlog.CLogf(ctx, libkb.VLog1, "Stat %s", getNodeIDStr(node))
	defer func() {
		fbo.deferLogIfErr(ctx, err, "Stat %s (%d bytes) done: %+v",
			getNodeIDStr(node), ei.Size, err)
	}()

	var de data.DirEntry
	err = runUnlessCanceled(ctx, func() error {
		de, err = fbo.statEntry(ctx, node)
		return err
	})
	if err != nil {
		return data.EntryInfo{}, err
	}
	return de.EntryInfo, nil
}

func (fbo *folderBranchOps) GetNodeMetadata(ctx context.Context, node Node) (
	res NodeMetadata, err error) {
	startTime, timer := fbo.startOp(
		ctx, "GetNodeMetadata %s", getNodeIDStr(node))
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "GetNodeMetadata %s done: %+v",
			getNodeIDStr(node), err)
	}()

	var de data.DirEntry
	err = runUnlessCanceled(ctx, func() error {
		de, err = fbo.statEntry(ctx, node)
		return err
	})
	if err != nil {
		return res, err
	}
	res.BlockInfo = de.BlockInfo

	id := de.TeamWriter.AsUserOrTeam()
	if id.IsNil() {
		id = de.Writer
	}
	if id.IsNil() {
		id = de.Creator
	}
	// Only set the last resolved writer if it's really a user ID.
	// This works around an old teams bug where the TeamWriter isn't
	// set.  See KBFS-2939.
	if id.IsUser() {
		res.LastWriterUnverified, err =
			fbo.config.KBPKI().GetNormalizedUsername(ctx, id, fbo.oa())
		if err != nil {
			return res, err
		}
	}
	res.PrefetchStatus = fbo.config.PrefetchStatus(ctx, fbo.id(),
		res.BlockInfo.BlockPointer)
	if res.PrefetchStatus == TriggeredPrefetch {
		byteStatus, err := fbo.config.BlockOps().Prefetcher().Status(
			ctx, res.BlockInfo.BlockPointer)
		if err != nil {
			return res, err
		}
		res.PrefetchProgress = &byteStatus
	}
	return res, nil
}

// Returns whether the given error is one that shouldn't block the
// removal of a file or directory.
//
// TODO: Consider other errors recoverable, e.g. ones that arise from
// present but corrupted blocks?
func isRecoverableBlockErrorForRemoval(err error) bool {
	return isRecoverableBlockError(err)
}

func isRetriableError(err error, retries int) bool {
	_, isExclOnUnmergedError := err.(ExclOnUnmergedError)
	_, isUnmergedSelfConflictError := err.(UnmergedSelfConflictError)
	recoverable := isExclOnUnmergedError || isUnmergedSelfConflictError ||
		isRecoverableBlockError(err)
	return recoverable && retries < maxRetriesOnRecoverableErrors
}

func (fbo *folderBranchOps) finalizeBlocks(
	ctx context.Context, bps blockPutState) error {
	if bps == nil {
		return nil
	}
	bcache := fbo.config.BlockCache()
	for _, newPtr := range bps.Ptrs() {
		// only cache this block if we made a brand new block, not if
		// we just incref'd some other block.
		if !newPtr.IsFirstRef() {
			continue
		}
		block, err := bps.GetBlock(ctx, newPtr)
		if err != nil {
			fbo.log.CDebugf(ctx, "Error getting block for %v: %+v", newPtr, err)
		}
		if err := bcache.Put(
			newPtr, fbo.id(), block, data.TransientEntry,
			fbo.cacheHashBehavior()); err != nil {
			fbo.log.CDebugf(
				ctx, "Error caching new block %v: %+v", newPtr, err)
		}
	}
	return nil
}

// Returns true if the passed error indicates a revision conflict.
func isRevisionConflict(err error) bool {
	if err == nil {
		return false
	}
	_, isConflictRevision := err.(kbfsmd.ServerErrorConflictRevision)
	_, isConflictPrevRoot := err.(kbfsmd.ServerErrorConflictPrevRoot)
	_, isConflictDiskUsage := err.(kbfsmd.ServerErrorConflictDiskUsage)
	_, isConditionFailed := err.(kbfsmd.ServerErrorConditionFailed)
	_, isConflictFolderMapping := err.(kbfsmd.ServerErrorConflictFolderMapping)
	_, isJournal := err.(MDJournalConflictError)
	return isConflictRevision || isConflictPrevRoot ||
		isConflictDiskUsage || isConditionFailed ||
		isConflictFolderMapping || isJournal
}

func (fbo *folderBranchOps) getConvID(
	ctx context.Context, handle *tlfhandle.Handle) (
	chat1.ConversationID, error) {
	fbo.convLock.Lock()
	defer fbo.convLock.Unlock()
	if len(fbo.convID) == 0 {
		session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return nil, err
		}
		channelName := string(session.Name)

		id, err := fbo.config.Chat().GetConversationID(
			ctx, handle.GetCanonicalName(), fbo.id().Type(),
			channelName, chat1.TopicType_KBFSFILEEDIT)
		if err != nil {
			return nil, err
		}
		fbo.log.CDebugf(ctx, "Conversation ID is %s for this writer (%s)",
			id, channelName)
		fbo.convID = id
	}
	return fbo.convID, nil
}

func (fbo *folderBranchOps) sendEditNotifications(
	ctx context.Context, rmd ImmutableRootMetadata, body string) error {
	handle := rmd.GetTlfHandle()
	convID, err := fbo.getConvID(ctx, handle)
	if err != nil {
		return err
	}
	return fbo.config.Chat().SendTextMessage(
		ctx, handle.GetCanonicalName(), fbo.id().Type(), convID, body)
}

func (fbo *folderBranchOps) makeEditNotifications(
	ctx context.Context, rmd ImmutableRootMetadata) (
	edits []kbfsedits.NotificationMessage, err error) {
	if rmd.IsWriterMetadataCopiedSet() {
		return nil, nil
	}

	if rmd.MergedStatus() != kbfsmd.Merged {
		return nil, nil
	}

	// If this MD is coming from the journal or from the conflict
	// resolver, the final paths will not be set on the ops.  Use
	// crChains to set them.
	ops := pathSortedOps(rmd.data.Changes.Ops)

	isResolution := false
	if len(ops) > 0 {
		_, isResolution = ops[0].(*resolutionOp)
	}
	if isResolution || TLFJournalEnabled(fbo.config, fbo.id()) {
		chains, err := newCRChainsForIRMDs(
			ctx, fbo.config.Codec(), fbo.config, []ImmutableRootMetadata{rmd},
			&fbo.blocks, true)
		if err != nil {
			return nil, err
		}
		err = fbo.blocks.populateChainPaths(ctx, fbo.log, chains, true)
		if err != nil {
			return nil, err
		}

		// The crChains creation process splits up a rename op into
		// a delete and a create.  Turn them back into a rename.
		chains.revertRenames(ops)

		ops = pathSortedOps(make([]op, 0, len(ops)))
		for _, chain := range chains.byMostRecent {
			ops = append(ops, chain.ops...)
		}
		// Make sure the ops are in increasing order by path length,
		// so e.g. file creates come before file modifies.
		sort.Sort(ops)
	}

	rev := rmd.Revision()
	// We want the server's view of the time.
	revTime := rmd.localTimestamp
	if offset, ok := fbo.config.MDServer().OffsetFromServerTime(); ok {
		revTime = revTime.Add(-offset)
	}

	for _, op := range ops {
		edit := op.ToEditNotification(
			rev, revTime, rmd.lastWriterVerifyingKey,
			rmd.LastModifyingWriter(), fbo.id())
		if edit != nil {
			edits = append(edits, *edit)
		}
	}
	return edits, nil
}

func (fbo *folderBranchOps) handleEditNotifications(
	ctx context.Context, rmd ImmutableRootMetadata) error {
	if !fbo.config.Mode().SendEditNotificationsEnabled() {
		return nil
	}

	edits, err := fbo.makeEditNotifications(ctx, rmd)
	if err != nil {
		return err
	}
	if len(edits) == 0 {
		return nil
	}

	body, err := kbfsedits.Prepare(edits)
	if err != nil {
		return err
	}
	return fbo.sendEditNotifications(ctx, rmd, body)
}

func (fbo *folderBranchOps) handleUnflushedEditNotifications(
	ctx context.Context, rmd ImmutableRootMetadata) error {
	if !fbo.config.Mode().SendEditNotificationsEnabled() {
		return nil
	}

	edits, err := fbo.makeEditNotifications(ctx, rmd)
	if err != nil {
		return err
	}
	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, fbo.config.KBPKI(), true)
	if err != nil {
		return err
	}
	fbo.editHistory.AddUnflushedNotifications(string(session.Name), edits)

	tlfName := rmd.GetTlfHandle().GetCanonicalName()
	fbo.config.UserHistory().UpdateHistory(
		tlfName, fbo.id().Type(), fbo.editHistory, string(session.Name))
	return nil
}

func (fbo *folderBranchOps) finalizeMDWriteLocked(ctx context.Context,
	lState *kbfssync.LockState, md *RootMetadata, bps blockPutState, excl Excl,
	notifyFn func(ImmutableRootMetadata) error) (
	err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// finally, write out the new metadata
	mdops := fbo.config.MDOps()

	doUnmergedPut := true
	mergedRev := kbfsmd.RevisionUninitialized

	oldPrevRoot := md.PrevRoot()

	var irmd ImmutableRootMetadata

	// This puts on a delay on any cancellations arriving to ctx. It is intended
	// to work sort of like a critical section, except that there isn't an
	// explicit call to exit the critical section. The cancellation, if any, is
	// triggered after a timeout (i.e.
	// fbo.config.DelayedCancellationGracePeriod()).
	//
	// The purpose of trying to avoid cancellation once we start MD write is to
	// avoid having an unpredictable perceived MD state. That is, when
	// runUnlessCanceled returns Canceled on cancellation, application receives
	// an EINTR, and would assume the operation didn't succeed. But the MD write
	// continues, and there's a chance the write will succeed, meaning the
	// operation succeeds. This contradicts with the application's perception
	// through error code and can lead to horrible situations. An easily caught
	// situation is when application calls Create with O_EXCL set, gets an EINTR
	// while MD write succeeds, retries and gets an EEXIST error. If users hit
	// Ctrl-C, this might not be a big deal. However, it also happens for other
	// interrupts.  For applications that use signals to communicate, e.g.
	// SIGALRM and SIGUSR1, this can happen pretty often, which renders broken.
	if err = libcontext.EnableDelayedCancellationWithGracePeriod(
		ctx, fbo.config.DelayedCancellationGracePeriod()); err != nil {
		return err
	}
	// we don't explicitly clean up (by using a defer) CancellationDelayer here
	// because sometimes fuse makes another call using the same ctx.  For example, in
	// fuse's Create call handler, a dir.Create is followed by an Attr call. If
	// we do a deferred cleanup here, if an interrupt has been received, it can
	// cause ctx to be canceled before Attr call finishes, which causes FUSE to
	// return EINTR for the Create request. But at this point, the request may
	// have already succeeded. Returning EINTR makes application thinks the file
	// is not created successfully.

	err = fbo.finalizeBlocks(ctx, bps)
	if err != nil {
		return err
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	isMerged := !fbo.isUnmergedLocked(lState)
	if isMerged {
		// only do a normal Put if we're not already staged.
		irmd, err = mdops.Put(
			ctx, md, session.VerifyingKey, nil, keybase1.MDPriorityNormal, bps)
		if doUnmergedPut = isRevisionConflict(err); doUnmergedPut {
			fbo.log.CDebugf(ctx, "Conflict: %v", err)
			mergedRev = md.Revision()

			if excl == WithExcl {
				// If this was caused by an exclusive create, we shouldn't do an
				// kbfsmd.UnmergedPut, but rather try to get newest update from server, and
				// retry afterwards.
				err = fbo.getAndApplyMDUpdates(ctx,
					lState, nil, fbo.applyMDUpdatesLocked)
				if err != nil {
					return err
				}
				return ExclOnUnmergedError{}
			}
		} else if err != nil {
			return err
		}
	} else if excl == WithExcl {
		return ExclOnUnmergedError{}
	}

	doResolve := false
	resolveMergedRev := mergedRev
	if doUnmergedPut {
		// We're out of date, and this is not an exclusive write, so put it as an
		// unmerged MD.
		irmd, err = mdops.PutUnmerged(ctx, md, session.VerifyingKey, bps)
		if isRevisionConflict(err) {
			// Self-conflicts are retried in `doMDWriteWithRetry`.
			return UnmergedSelfConflictError{err}
		} else if err != nil {
			// If a PutUnmerged fails, we are in a bad situation: if
			// we fail, but the put succeeded, then dirty data will
			// remain cached locally and will be re-tried
			// (non-idempotently) on the next sync call.  This should
			// be a very rare situation when journaling is enabled, so
			// instead let's pretend it succeeded so that the cached
			// data is cleared and the nodeCache is updated.  If we're
			// wrong, and the update didn't make it to the server,
			// then the next call will get an
			// kbfsmd.UnmergedSelfConflictError but fail to find any new
			// updates and fail the operation, but things will get
			// fixed up once conflict resolution finally completes.
			//
			// TODO: how confused will the kernel cache get if the
			// pointers are updated but the file system operation
			// still gets an error returned by the wrapper function
			// that calls us (in the event of a user cancellation)?
			fbo.log.CInfof(ctx, "Ignoring a PutUnmerged error: %+v", err)
			err = encryptMDPrivateData(
				ctx, fbo.config.Codec(), fbo.config.Crypto(),
				fbo.config.Crypto(), fbo.config.KeyManager(), session.UID, md)
			if err != nil {
				return err
			}
			mdID, err := kbfsmd.MakeID(fbo.config.Codec(), md.bareMd)
			if err != nil {
				return err
			}
			irmd = MakeImmutableRootMetadata(
				md, session.VerifyingKey, mdID, fbo.config.Clock().Now(), true)
			err = fbo.config.MDCache().Put(irmd)
			if err != nil {
				return err
			}
		}
		unmergedBID := md.BID()
		fbo.setBranchIDLocked(lState, unmergedBID)
		doResolve = true
	} else {
		fbo.setBranchIDLocked(lState, kbfsmd.NullBranchID)

		if md.IsRekeySet() && !md.IsWriterMetadataCopiedSet() {
			// Queue this folder for rekey if the bit was set and it's not a copy.
			// This is for the case where we're coming out of conflict resolution.
			// So why don't we do this in finalizeResolution? Well, we do but we don't
			// want to block on a rekey so we queue it. Because of that it may fail
			// due to a conflict with some subsequent write. By also handling it here
			// we'll always retry if we notice we haven't been successful in clearing
			// the bit yet. Note that I haven't actually seen this happen but it seems
			// theoretically possible.
			defer fbo.config.RekeyQueue().Enqueue(md.TlfID())
		}
	}

	rebased := (oldPrevRoot != md.PrevRoot())
	if rebased {
		unmergedBID := md.BID()
		fbo.setBranchIDLocked(lState, unmergedBID)
		doResolve = true
		resolveMergedRev = kbfsmd.RevisionUninitialized
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	err = fbo.setHeadSuccessorLocked(ctx, lState, irmd, rebased)
	if err != nil {
		return err
	}

	if TLFJournalEnabled(fbo.config, fbo.id()) {
		// Send unflushed notifications if journaling is on.
		err := fbo.handleUnflushedEditNotifications(ctx, irmd)
		if err != nil {
			fbo.log.CWarningf(ctx, "Couldn't send unflushed edit "+
				"notifications for revision %d: %+v", irmd.Revision(), err)
		}
	} else {
		// Send edit notifications and archive the old, unref'd blocks
		// if journaling is off.
		fbo.editActivity.Add(1)
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Sending notifications for %v",
			irmd.data.Changes.Ops)
		fbo.goTracked(func() {
			defer fbo.editActivity.Done()
			ctx, cancelFunc := fbo.newCtxWithFBOID()
			defer cancelFunc()
			err := fbo.handleEditNotifications(ctx, irmd)
			if err != nil {
				fbo.log.CWarningf(ctx, "Couldn't send edit notifications for "+
					"revision %d: %+v", irmd.Revision(), err)
			}
		})
		fbo.fbm.archiveUnrefBlocks(irmd.ReadOnly())
	}

	// Call Resolve() after the head is set, to make sure it fetches
	// the correct unmerged MD range during resolution.
	if doResolve {
		fbo.cr.Resolve(ctx, md.Revision(), resolveMergedRev)
	}

	if notifyFn != nil {
		err := notifyFn(irmd)
		if err != nil {
			return err
		}
	}
	return nil
}

func (fbo *folderBranchOps) waitForJournalLocked(ctx context.Context,
	lState *kbfssync.LockState, jManager *JournalManager) error {
	fbo.mdWriterLock.AssertLocked(lState)

	if !TLFJournalEnabled(fbo.config, fbo.id()) {
		// Nothing to do.
		return nil
	}

	if err := jManager.Wait(ctx, fbo.id()); err != nil {
		return err
	}

	// Make sure everything flushed successfully, since we're holding
	// the writer lock, no other revisions could have snuck in.
	jStatus, err := jManager.JournalStatus(fbo.id())
	if err != nil {
		return err
	}
	if jStatus.RevisionEnd != kbfsmd.RevisionUninitialized {
		return errors.Errorf("Couldn't flush all MD revisions; current "+
			"revision end for the journal is %d", jStatus.RevisionEnd)
	}
	if jStatus.LastFlushErr != "" {
		return errors.Errorf("Couldn't flush the journal: %s",
			jStatus.LastFlushErr)
	}

	return nil
}

func (fbo *folderBranchOps) finalizeMDRekeyWriteLocked(ctx context.Context,
	lState *kbfssync.LockState, md *RootMetadata,
	lastWriterVerifyingKey kbfscrypto.VerifyingKey) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	oldPrevRoot := md.PrevRoot()

	// Write out the new metadata.  If journaling is enabled, we don't
	// want the rekey to hit the journal and possibly end up on a
	// conflict branch, so wait for the journal to flush and then push
	// straight to the server.  TODO: we're holding the writer lock
	// while flushing the journal here (just like for exclusive
	// writes), which may end up blocking incoming writes for a long
	// time.  Rekeys are pretty rare, but if this becomes an issue
	// maybe we should consider letting these hit the journal and
	// scrubbing them when converting it to a branch.
	mdOps := fbo.config.MDOps()
	if jManager, err := GetJournalManager(fbo.config); err == nil {
		if err = fbo.waitForJournalLocked(ctx, lState, jManager); err != nil {
			return err
		}
		mdOps = jManager.delegateMDOps
	}

	var key kbfscrypto.VerifyingKey
	if md.IsWriterMetadataCopiedSet() {
		key = lastWriterVerifyingKey
	} else {
		var err error
		session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return err
		}
		key = session.VerifyingKey
	}

	irmd, err := mdOps.Put(ctx, md, key, nil, keybase1.MDPriorityNormal, nil)
	isConflict := isRevisionConflict(err)
	if err != nil && !isConflict {
		return err
	}

	if isConflict {
		// Drop this block. We've probably collided with someone also
		// trying to rekey the same folder but that's not necessarily
		// the case. We'll queue another rekey just in case. It should
		// be safe as it's idempotent. We don't want any rekeys present
		// in unmerged history or that will just make a mess.
		fbo.config.RekeyQueue().Enqueue(md.TlfID())
		return RekeyConflictError{err}
	}

	fbo.setBranchIDLocked(lState, kbfsmd.NullBranchID)

	rebased := (oldPrevRoot != md.PrevRoot())
	if rebased {
		unmergedBID := md.BID()
		fbo.setBranchIDLocked(lState, unmergedBID)
		fbo.cr.Resolve(ctx, md.Revision(), kbfsmd.RevisionUninitialized)
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	err = fbo.setHeadSuccessorLocked(ctx, lState, irmd, rebased)
	if err != nil {
		return err
	}

	// Explicitly set the latest merged revision, since if journaling
	// is on, `setHeadLocked` will not do it for us (even though
	// rekeys bypass the journal).
	fbo.setLatestMergedRevisionLocked(ctx, lState, md.Revision(), false)
	return nil
}

func (fbo *folderBranchOps) finalizeGCOpLocked(
	ctx context.Context, lState *kbfssync.LockState, gco *GCOp) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	md, err := fbo.getSuccessorMDForWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	if md.MergedStatus() == kbfsmd.Unmerged {
		return UnexpectedUnmergedPutError{}
	}

	md.AddOp(gco)
	// TODO: if the revision number of this new commit is sequential
	// with `LatestRev`, we can probably change this to
	// `gco.LatestRev+1`.
	md.SetLastGCRevision(gco.LatestRev)

	bps, err := fbo.maybeUnembedAndPutBlocks(ctx, md)
	if err != nil {
		return err
	}
	oldPrevRoot := md.PrevRoot()

	err = fbo.finalizeBlocks(ctx, bps)
	if err != nil {
		return err
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	// finally, write out the new metadata
	irmd, err := fbo.config.MDOps().Put(
		ctx, md, session.VerifyingKey, nil, keybase1.MDPriorityNormal, bps)
	if err != nil {
		// Don't allow garbage collection to put us into a conflicting
		// state; just wait for the next period.
		return err
	}

	fbo.setBranchIDLocked(lState, kbfsmd.NullBranchID)

	rebased := (oldPrevRoot != md.PrevRoot())
	if rebased {
		unmergedBID := md.BID()
		fbo.setBranchIDLocked(lState, unmergedBID)
		fbo.cr.Resolve(ctx, md.Revision(), kbfsmd.RevisionUninitialized)
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	err = fbo.setHeadSuccessorLocked(ctx, lState, irmd, rebased)
	if err != nil {
		return err
	}

	return fbo.notifyBatchLocked(ctx, lState, irmd)
}

func (fbo *folderBranchOps) finalizeGCOp(ctx context.Context, gco *GCOp) (
	err error) {
	lState := makeFBOLockState()
	// Lock the folder so we can get an internally-consistent MD
	// revision number.
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	return fbo.finalizeGCOpLocked(ctx, lState, gco)
}

// CtxAllowNameKeyType is the type for a context allowable name override key.
type CtxAllowNameKeyType int

const (
	// CtxAllowNameKey can be used to set a value in a context, and
	// that value will be treated as an allowable directory entry
	// name, even if it also matches a disallowed prefix.  The value
	// must be of type `string`, or it will panic.
	CtxAllowNameKey CtxAllowNameKeyType = iota
)

func checkDisallowedPrefixes(
	ctx context.Context, name data.PathPartString) error {
	for _, prefix := range disallowedPrefixes {
		if strings.HasPrefix(name.Plaintext(), prefix) {
			if allowedName := ctx.Value(CtxAllowNameKey); allowedName != nil {
				// Allow specialized KBFS programs (like the kbgit remote
				// helper) to bypass the disallowed prefix check.
				if name.Plaintext() == allowedName.(string) {
					return nil
				}
			}
			return DisallowedPrefixError{name, prefix}
		}
	}
	return nil
}

// PathType returns path type
func (fbo *folderBranchOps) PathType() tlfhandle.PathType {
	switch fbo.folderBranch.Tlf.Type() {
	case tlf.Public:
		return tlfhandle.PublicPathType
	case tlf.Private:
		return tlfhandle.PrivatePathType
	case tlf.SingleTeam:
		return tlfhandle.SingleTeamPathType
	default:
		panic(fmt.Sprintf("Unknown TLF type: %s", fbo.folderBranch.Tlf.Type()))
	}
}

// canonicalPath returns full canonical path for dir node and name.
func (fbo *folderBranchOps) canonicalPathPlaintext(
	ctx context.Context, dir Node, name data.PathPartString) (string, error) {
	dirPath, err := fbo.pathFromNodeForRead(dir)
	if err != nil {
		return "", err
	}
	return tlfhandle.BuildCanonicalPath(
		fbo.PathType(), dirPath.Plaintext(), name.Plaintext()), nil
}

func (fbo *folderBranchOps) signalWrite() {
	select {
	case fbo.syncNeededChan <- struct{}{}:
	default:
	}
	// A local write always means any ongoing CR should be canceled,
	// because the set of unmerged writes has changed.
	fbo.cr.ForceCancel()
}

func (fbo *folderBranchOps) syncDirUpdateOrSignal(
	ctx context.Context, lState *kbfssync.LockState) error {
	if fbo.bType != standard {
		panic("Cannot write to a non-standard FBO")
	}
	if fbo.config.BGFlushDirOpBatchSize() == 1 {
		return fbo.syncAllLocked(ctx, lState, NoExcl)
	}
	fbo.signalWrite()
	return nil
}

func (fbo *folderBranchOps) checkForUnlinkedDir(dir Node) error {
	// Disallow directory operations within an unlinked directory.
	// Shells don't seem to allow it, and it will just pollute the dir
	// entry cache with unsyncable entries.
	if fbo.nodeCache.IsUnlinked(dir) {
		dirPath := fbo.nodeCache.PathFromNode(dir).String()
		return errors.WithStack(UnsupportedOpInUnlinkedDirError{dirPath})
	}
	return nil
}

// entryType must not by Sym.
func (fbo *folderBranchOps) createEntryLocked(
	ctx context.Context, lState *kbfssync.LockState, dir Node,
	name data.PathPartString, entryType data.EntryType, excl Excl) (
	childNode Node, de data.DirEntry, err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	if err := checkDisallowedPrefixes(ctx, name); err != nil {
		return nil, data.DirEntry{}, err
	}

	if uint32(len(name.Plaintext())) > fbo.config.MaxNameBytes() {
		return nil, data.DirEntry{},
			NameTooLongError{name.String(), fbo.config.MaxNameBytes()}
	}

	if err := fbo.checkForUnlinkedDir(dir); err != nil {
		return nil, data.DirEntry{}, err
	}

	// Plaintext for notifications to the service.
	filename, err := fbo.canonicalPathPlaintext(ctx, dir, name)
	if err != nil {
		return nil, data.DirEntry{}, err
	}

	// Verify we have permission to write (but don't make a successor yet).
	md, err := fbo.getMDForWriteLockedForFilename(ctx, lState, filename)
	if err != nil {
		return nil, data.DirEntry{}, err
	}

	dirPath, err := fbo.pathFromNodeForMDWriteLocked(lState, dir)
	if err != nil {
		return nil, data.DirEntry{}, err
	}

	// does name already exist?
	_, err = fbo.blocks.GetEntry(
		ctx, lState, md.ReadOnly(), dirPath.ChildPathNoPtr(
			name, fbo.makeObfuscator()))
	if err == nil {
		return nil, data.DirEntry{}, data.NameExistsError{Name: name.String()}
	} else if _, notExists := errors.Cause(err).(idutil.NoSuchNameError); !notExists {
		return nil, data.DirEntry{}, err
	}

	parentPtr := dirPath.TailPointer()
	co, err := newCreateOp(name.Plaintext(), parentPtr, entryType)
	if err != nil {
		return nil, data.DirEntry{}, err
	}
	co.setFinalPath(dirPath)
	// create new data block
	var newBlock data.Block
	if entryType == data.Dir {
		newBlock = &data.DirBlock{
			Children: make(map[string]data.DirEntry),
		}
	} else {
		newBlock = &data.FileBlock{}
	}

	// Cache update and operations until batch happens.  Make a new
	// temporary ID and directory entry.
	newID, err := fbo.config.cryptoPure().MakeTemporaryBlockID()
	if err != nil {
		return nil, data.DirEntry{}, err
	}

	chargedTo, err := chargedToForTLF(
		ctx, fbo.config.KBPKI(), fbo.config.KBPKI(), fbo.config,
		md.GetTlfHandle())
	if err != nil {
		return nil, data.DirEntry{}, err
	}

	newPtr := data.BlockPointer{
		ID:         newID,
		KeyGen:     md.LatestKeyGeneration(),
		DataVer:    fbo.config.DataVersion(),
		DirectType: data.DirectBlock,
		Context: kbfsblock.MakeFirstContext(
			chargedTo, fbo.config.DefaultBlockType()),
	}
	co.AddRefBlock(newPtr)
	co.AddSelfUpdate(parentPtr)

	node, err := fbo.nodeCache.GetOrCreate(newPtr, name, dir, entryType)
	if err != nil {
		return nil, data.DirEntry{}, err
	}

	err = fbo.config.DirtyBlockCache().Put(
		ctx, fbo.id(), newPtr, fbo.branch(), newBlock)
	if err != nil {
		return nil, data.DirEntry{}, err
	}

	now := fbo.nowUnixNano()
	de = data.DirEntry{
		BlockInfo: data.BlockInfo{
			BlockPointer: newPtr,
			EncodedSize:  0,
		},
		EntryInfo: data.EntryInfo{
			Type:  entryType,
			Size:  0,
			Mtime: now,
			Ctime: now,
		},
	}

	// Set the TeamWriter for team TLFs, so we can return the
	// LastWriterUnverified before the writes are flushed from memory.
	if fbo.id().Type() == tlf.SingleTeam {
		session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return nil, data.DirEntry{}, err
		}
		de.TeamWriter = session.UID
	}

	dirCacheUndoFn, err := fbo.blocks.AddDirEntryInCache(
		ctx, lState, md.ReadOnly(), dirPath, name, de)
	if err != nil {
		return nil, data.DirEntry{}, err
	}
	fbo.dirOps = append(fbo.dirOps, cachedDirOp{co, []Node{dir, node}})
	added := fbo.status.addDirtyNode(dir)

	cleanupFn := func() {
		if added {
			fbo.status.rmDirtyNode(dir)
		}
		fbo.dirOps = fbo.dirOps[:len(fbo.dirOps)-1]
		if dirCacheUndoFn != nil {
			dirCacheUndoFn(lState)
		}
		// Delete should never fail.
		_ = fbo.config.DirtyBlockCache().Delete(fbo.id(), newPtr, fbo.branch())
	}
	defer func() {
		if err != nil && cleanupFn != nil {
			cleanupFn()
		}
	}()

	if entryType != data.Dir {
		// Dirty the file with a zero-byte write, to ensure the new
		// block is synced in SyncAll.  TODO: remove this if we ever
		// embed 0-byte files in the directory entry itself.
		err = fbo.blocks.Write(
			ctx, lState, md.ReadOnly(), node, []byte{}, 0)
		if err != nil {
			return nil, data.DirEntry{}, err
		}
		oldCleanupFn := cleanupFn
		cleanupFn = func() {
			_ = fbo.blocks.ClearCacheInfo(
				lState, fbo.nodeCache.PathFromNode(node))
			oldCleanupFn()
		}
	}

	// It's safe to notify before we've synced, since it is only
	// sending invalidation notifications.  At worst the upper layer
	// will just have to refresh its cache needlessly.
	err = fbo.notifyOneOp(ctx, lState, co, md.ReadOnly(), false)
	if err != nil {
		return nil, data.DirEntry{}, err
	}

	if excl == WithExcl {
		// Sync this change to the server.
		err := fbo.syncAllLocked(ctx, lState, WithExcl)
		_, isNoUpdatesWhileDirty := errors.Cause(err).(NoUpdatesWhileDirtyError)
		if isNoUpdatesWhileDirty {
			// If an exclusive write hits a conflict, it will try to
			// update, but won't be able to because of the dirty
			// directory entries.  We need to clean up the dirty
			// entries here first before trying to apply the updates
			// again.  By returning `ExclOnUnmergedError` below, we
			// force the caller to retry the whole operation again.
			fbo.log.CDebugf(ctx, "Clearing dirty entry before applying new "+
				"updates for exclusive write")
			cleanupFn()
			cleanupFn = nil

			// Sync anything else that might be buffered (non-exclusively).
			err = fbo.syncAllLocked(ctx, lState, NoExcl)
			if err != nil {
				return nil, data.DirEntry{}, err
			}

			// Now we should be in a clean state, so this should work.
			err = fbo.getAndApplyMDUpdates(
				ctx, lState, nil, fbo.applyMDUpdatesLocked)
			if err != nil {
				return nil, data.DirEntry{}, err
			}
			return nil, data.DirEntry{}, ExclOnUnmergedError{}
		} else if err != nil {
			return nil, data.DirEntry{}, err
		}
	} else {
		err = fbo.syncDirUpdateOrSignal(ctx, lState)
		if err != nil {
			return nil, data.DirEntry{}, err
		}
	}

	return node, de, nil
}

func (fbo *folderBranchOps) maybeWaitForSquash(
	ctx context.Context, unmergedBID kbfsmd.BranchID) {
	if unmergedBID != kbfsmd.PendingLocalSquashBranchID {
		return
	}

	fbo.vlog.CLogf(ctx, libkb.VLog1, "Blocking until squash finishes")
	// Limit the time we wait to just under the ctx deadline if there
	// is one, or 10s if there isn't.
	deadline, ok := ctx.Deadline()
	if ok {
		deadline = deadline.Add(-1 * time.Second)
	} else {
		// Can't use config.Clock() since context doesn't respect it.
		deadline = time.Now().Add(10 * time.Second)
	}
	ctx, cancel := context.WithDeadline(ctx, deadline)
	defer cancel()
	// Wait for CR to finish.  Note that if the user is issuing
	// concurrent writes, the current CR could be canceled, and when
	// the call belows returns, the branch still won't be squashed.
	// That's ok, this is just an optimization.
	err := fbo.cr.Wait(ctx)
	if err != nil {
		fbo.log.CDebugf(ctx, "Error while waiting for CR: %+v", err)
	}
}

func (fbo *folderBranchOps) doMDWriteWithRetry(ctx context.Context,
	lState *kbfssync.LockState,
	fn func(lState *kbfssync.LockState) error) error {
	doUnlock := false
	defer func() {
		if doUnlock {
			unmergedBID := fbo.unmergedBID
			fbo.mdWriterLock.Unlock(lState)
			// Don't let a pending squash get too big.
			fbo.maybeWaitForSquash(ctx, unmergedBID)
		}
	}()

	for i := 0; ; i++ {
		fbo.mdWriterLock.Lock(lState)
		doUnlock = true

		// Make sure we haven't been canceled before doing anything
		// too serious.
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		err := fn(lState)
		if isRetriableError(err, i) {
			fbo.log.CDebugf(ctx, "Trying again after retriable error: %v", err)
			// Release the lock to give someone else a chance
			doUnlock = false
			fbo.mdWriterLock.Unlock(lState)
			if _, ok := err.(ExclOnUnmergedError); ok {
				if err = fbo.cr.Wait(ctx); err != nil {
					return err
				}
			} else if _, ok := err.(UnmergedSelfConflictError); ok {
				// We can only get here if we are already on an
				// unmerged branch and an errored PutUnmerged did make
				// it to the mdserver.  Let's force sync, with a fresh
				// context so the observer doesn't ignore the updates
				// (but tie the cancels together).
				newCtx := fbo.ctxWithFBOID(context.Background())
				newCtx, cancel := context.WithCancel(newCtx)
				defer cancel()
				fbo.goTracked(func() {
					select {
					case <-ctx.Done():
						cancel()
					case <-newCtx.Done():
					}
				})
				fbo.vlog.CLogf(
					ctx, libkb.VLog1, "Got a revision conflict while unmerged "+
						"(%v); forcing a sync", err)
				err = fbo.getAndApplyNewestUnmergedHead(newCtx, lState)
				if err != nil {
					// TODO: we might be stuck at this point if we're
					// ahead of the unmerged branch on the server, in
					// which case we might want to just abandon any
					// cached updates and force a sync to the head.
					return err
				}
				cancel()
			}
			continue
		} else if err != nil {
			return err
		}
		return nil
	}
}

func (fbo *folderBranchOps) doMDWriteWithRetryUnlessCanceled(
	ctx context.Context, fn func(lState *kbfssync.LockState) error) error {
	return runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()
		return fbo.doMDWriteWithRetry(ctx, lState, fn)
	})
}

func (fbo *folderBranchOps) CreateDir(
	ctx context.Context, dir Node, path data.PathPartString) (
	n Node, ei data.EntryInfo, err error) {
	startTime, timer := fbo.startOp(
		ctx, "CreateDir %s %s", getNodeIDStr(dir), path)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "CreateDir %s %s done: %v %+v",
			getNodeIDStr(dir), path, getNodeIDStr(n), err)
	}()

	err = fbo.checkNodeForWrite(ctx, dir)
	if err != nil {
		return nil, data.EntryInfo{}, err
	}

	var retNode Node
	var retEntryInfo data.EntryInfo
	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *kbfssync.LockState) error {
			node, de, err :=
				fbo.createEntryLocked(ctx, lState, dir, path, data.Dir, NoExcl)
			// Don't set node and ei directly, as that can cause a
			// race when the Create is canceled.
			retNode = node
			retEntryInfo = de.EntryInfo
			return err
		})
	if err != nil {
		return nil, data.EntryInfo{}, err
	}
	return retNode, retEntryInfo, nil
}

func (fbo *folderBranchOps) CreateFile(
	ctx context.Context, dir Node, path data.PathPartString, isExec bool,
	excl Excl) (n Node, ei data.EntryInfo, err error) {
	startTime, timer := fbo.startOp(
		ctx, "CreateFile %s %s isExec=%v Excl=%s", getNodeIDStr(dir),
		path, isExec, excl)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer,
			"CreateFile %s %s isExec=%v Excl=%s done: %v %+v",
			getNodeIDStr(dir), path, isExec, excl,
			getNodeIDStr(n), err)
	}()

	err = fbo.checkNodeForWrite(ctx, dir)
	if err != nil {
		return nil, data.EntryInfo{}, err
	}

	var entryType data.EntryType
	if isExec {
		entryType = data.Exec
	} else {
		entryType = data.File
	}

	// If journaling is turned on, an exclusive create may end up on a
	// conflict branch.
	if excl == WithExcl && TLFJournalEnabled(fbo.config, fbo.id()) {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Exclusive create status is being discarded.")
		excl = NoExcl
	}

	if excl == WithExcl {
		if err = fbo.cr.Wait(ctx); err != nil {
			return nil, data.EntryInfo{}, err
		}
	}

	var retNode Node
	var retEntryInfo data.EntryInfo
	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *kbfssync.LockState) error {
			// Don't set node and ei directly, as that can cause a
			// race when the Create is canceled.
			node, de, err :=
				fbo.createEntryLocked(ctx, lState, dir, path, entryType, excl)
			retNode = node
			retEntryInfo = de.EntryInfo
			return err
		})
	if err != nil {
		return nil, data.EntryInfo{}, err
	}
	return retNode, retEntryInfo, nil
}

// notifyAndSyncOrSignal caches an op in memory and dirties the
// relevant node, and then sends a notification for it.  If batching
// is on, it signals the write; otherwise it syncs the change.  It
// should only be called as the final instruction that can fail in a
// method.
func (fbo *folderBranchOps) notifyAndSyncOrSignal(
	ctx context.Context, lState *kbfssync.LockState, undoFn dirCacheUndoFn,
	nodesToDirty []Node, op op, md ReadOnlyRootMetadata) (err error) {
	fbo.dirOps = append(fbo.dirOps, cachedDirOp{op, nodesToDirty})
	var addedNodes []Node
	for _, n := range nodesToDirty {
		added := fbo.status.addDirtyNode(n)
		if added {
			addedNodes = append(addedNodes, n)
		}
	}

	defer func() {
		if err != nil {
			for _, n := range addedNodes {
				fbo.status.rmDirtyNode(n)
			}
			fbo.dirOps = fbo.dirOps[:len(fbo.dirOps)-1]
			if undoFn != nil {
				undoFn(lState)
			}
		}
	}()

	// It's safe to notify before we've synced, since it is only
	// sending invalidation notifications.  At worst the upper layer
	// will just have to refresh its cache needlessly.
	err = fbo.notifyOneOp(ctx, lState, op, md, false)
	if err != nil {
		return err
	}

	return fbo.syncDirUpdateOrSignal(ctx, lState)
}

func (fbo *folderBranchOps) createLinkLocked(
	ctx context.Context, lState *kbfssync.LockState, dir Node,
	fromName, toPath data.PathPartString) (data.DirEntry, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	if err := checkDisallowedPrefixes(ctx, fromName); err != nil {
		return data.DirEntry{}, err
	}

	if uint32(len(fromName.Plaintext())) > fbo.config.MaxNameBytes() {
		return data.DirEntry{},
			NameTooLongError{fromName.Plaintext(), fbo.config.MaxNameBytes()}
	}

	if err := fbo.checkForUnlinkedDir(dir); err != nil {
		return data.DirEntry{}, err
	}

	// Verify we have permission to write (but don't make a successor yet).
	md, err := fbo.getMDForWriteLockedForFilename(ctx, lState, "")
	if err != nil {
		return data.DirEntry{}, err
	}

	dirPath, err := fbo.pathFromNodeForMDWriteLocked(lState, dir)
	if err != nil {
		return data.DirEntry{}, err
	}

	// TODO: validate inputs

	// does name already exist?
	_, err = fbo.blocks.GetEntry(
		ctx, lState, md.ReadOnly(), dirPath.ChildPathNoPtr(
			fromName, fbo.makeObfuscator()))
	if err == nil {
		return data.DirEntry{}, data.NameExistsError{Name: fromName.String()}
	} else if _, notExists := errors.Cause(err).(idutil.NoSuchNameError); !notExists {
		return data.DirEntry{}, err
	}

	parentPtr := dirPath.TailPointer()
	co, err := newCreateOp(fromName.Plaintext(), parentPtr, data.Sym)
	if err != nil {
		return data.DirEntry{}, err
	}
	co.setFinalPath(dirPath)
	co.AddSelfUpdate(parentPtr)

	// Nothing below here can fail, so no need to clean up the dir
	// entry cache on a failure.  If this ever panics, we need to add
	// cleanup code.

	// Create a direntry for the link, and then sync
	now := fbo.nowUnixNano()
	toPathPlain := toPath.Plaintext()
	de := data.DirEntry{
		EntryInfo: data.EntryInfo{
			Type:    data.Sym,
			Size:    uint64(len(toPathPlain)),
			SymPath: toPathPlain,
			Mtime:   now,
			Ctime:   now,
		},
	}

	dirCacheUndoFn, err := fbo.blocks.AddDirEntryInCache(
		ctx, lState, md.ReadOnly(), dirPath, fromName, de)
	if err != nil {
		return data.DirEntry{}, err
	}

	err = fbo.notifyAndSyncOrSignal(
		ctx, lState, dirCacheUndoFn, []Node{dir}, co, md.ReadOnly())
	if err != nil {
		return data.DirEntry{}, err
	}
	return de, nil
}

func (fbo *folderBranchOps) CreateLink(
	ctx context.Context, dir Node, fromName, toPath data.PathPartString) (
	ei data.EntryInfo, err error) {
	startTime, timer := fbo.startOp(ctx, "CreateLink %s %s -> %s",
		getNodeIDStr(dir), fromName, toPath)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "CreateLink %s %s -> %s done: %+v",
			getNodeIDStr(dir), fromName, toPath, err)
	}()

	err = fbo.checkNodeForWrite(ctx, dir)
	if err != nil {
		return data.EntryInfo{}, err
	}

	var retEntryInfo data.EntryInfo
	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *kbfssync.LockState) error {
			// Don't set ei directly, as that can cause a race when
			// the Create is canceled.
			de, err := fbo.createLinkLocked(ctx, lState, dir, fromName, toPath)
			retEntryInfo = de.EntryInfo
			return err
		})
	if err != nil {
		return data.EntryInfo{}, err
	}
	return retEntryInfo, nil
}

// unrefEntry modifies md to unreference all relevant blocks for the
// given entry.
func (fbo *folderBranchOps) unrefEntryLocked(ctx context.Context,
	lState *kbfssync.LockState, kmd libkey.KeyMetadata, ro op, dir data.Path,
	de data.DirEntry, name data.PathPartString) error {
	fbo.mdWriterLock.AssertLocked(lState)
	if de.Type == data.Sym {
		return nil
	}

	unrefsToAdd := make(map[data.BlockPointer]bool)
	fbo.prepper.cacheBlockInfos([]data.BlockInfo{de.BlockInfo})
	unrefsToAdd[de.BlockPointer] = true
	// construct a path for the child so we can unlink with it.
	childPath := dir.ChildPath(
		name, de.BlockPointer, fbo.makeObfuscator())

	// If this is an indirect block, we need to delete all of its
	// children as well. NOTE: non-empty directories can't be
	// removed, so no need to check for indirect directory blocks
	// here.
	if de.Type == data.File || de.Type == data.Exec {
		blockInfos, err := fbo.blocks.GetIndirectFileBlockInfos(
			ctx, lState, kmd, childPath)
		if isRecoverableBlockErrorForRemoval(err) {
			msg := fmt.Sprintf("Recoverable block error encountered for unrefEntry(%v); continuing", childPath)
			fbo.log.CWarningf(ctx, "%s", msg)
			fbo.log.CDebugf(ctx, "%s (err=%v)", msg, err)
		} else if err != nil {
			return err
		}
		fbo.prepper.cacheBlockInfos(blockInfos)
		for _, blockInfo := range blockInfos {
			unrefsToAdd[blockInfo.BlockPointer] = true
		}
	}

	// Any referenced blocks that were unreferenced since the last
	// sync can just be forgotten about.  Note that any updated
	// pointers that are unreferenced will be fixed up during syncing.
	for _, dirOp := range fbo.dirOps {
		for i := len(dirOp.dirOp.Refs()) - 1; i >= 0; i-- {
			ref := dirOp.dirOp.Refs()[i]
			if _, ok := unrefsToAdd[ref]; ok {
				dirOp.dirOp.DelRefBlock(ref)
				delete(unrefsToAdd, ref)
			}
		}
	}
	for unref := range unrefsToAdd {
		ro.AddUnrefBlock(unref)
	}

	return nil
}

func (fbo *folderBranchOps) removeEntryLocked(ctx context.Context,
	lState *kbfssync.LockState, md ReadOnlyRootMetadata, dir Node,
	dirPath data.Path, name data.PathPartString) error {
	fbo.mdWriterLock.AssertLocked(lState)

	if err := fbo.checkForUnlinkedDir(dir); err != nil {
		return err
	}

	// make sure the entry exists
	de, err := fbo.blocks.GetEntry(
		ctx, lState, md, dirPath.ChildPathNoPtr(
			name, fbo.makeObfuscator()))
	if _, notExists := errors.Cause(err).(idutil.NoSuchNameError); notExists {
		return idutil.NoSuchNameError{Name: name.String()}
	} else if err != nil {
		return err
	}

	parentPtr := dirPath.TailPointer()
	ro, err := newRmOp(name.Plaintext(), parentPtr, de.Type)
	if err != nil {
		return err
	}
	ro.setFinalPath(dirPath)
	ro.AddSelfUpdate(parentPtr)
	err = fbo.unrefEntryLocked(ctx, lState, md, ro, dirPath, de, name)
	if err != nil {
		return err
	}

	dirCacheUndoFn, err := fbo.blocks.RemoveDirEntryInCache(
		ctx, lState, md.ReadOnly(), dirPath, name, de)
	if err != nil {
		return err
	}
	if de.Type == data.Dir {
		removedNode := fbo.nodeCache.Get(de.BlockPointer.Ref())
		if removedNode != nil {
			// If it was a dirty directory, the removed node no longer
			// counts as dirty (it will never be sync'd). Note that
			// removed files will still be synced since any data
			// written to them via a handle stays in memory until the
			// sync actually happens.
			removed := fbo.status.rmDirtyNode(removedNode)
			if removed {
				oldUndoFn := dirCacheUndoFn
				dirCacheUndoFn = func(lState *kbfssync.LockState) {
					oldUndoFn(lState)
					fbo.status.addDirtyNode(removedNode)
				}
			}
		}
	}
	return fbo.notifyAndSyncOrSignal(
		ctx, lState, dirCacheUndoFn, []Node{dir}, ro, md.ReadOnly())
}

func (fbo *folderBranchOps) removeDirLocked(ctx context.Context,
	lState *kbfssync.LockState, dir Node, dirName data.PathPartString) (
	err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// Verify we have permission to write (but don't make a successor yet).
	md, err := fbo.getMDForWriteLockedForFilename(ctx, lState, "")
	if err != nil {
		return err
	}

	dirPath, err := fbo.pathFromNodeForMDWriteLocked(lState, dir)
	if err != nil {
		return err
	}

	ob := fbo.makeObfuscator()
	de, err := fbo.blocks.GetEntry(
		ctx, lState, md.ReadOnly(), dirPath.ChildPathNoPtr(dirName, ob))
	if _, notExists := errors.Cause(err).(idutil.NoSuchNameError); notExists {
		return idutil.NoSuchNameError{Name: dirName.String()}
	} else if err != nil {
		return err
	}

	// construct a path for the child so we can check for an empty dir
	childPath := dirPath.ChildPath(dirName, de.BlockPointer, ob)

	// Note this fetches all the blocks associated with this
	// directory, even though technically we just need to find one
	// entry and it might be wasteful to fetch all the blocks.
	// However, since removals don't reduce levels of indirection at
	// the moment, we're forced to do this for now.
	entries, err := fbo.blocks.GetEntries(ctx, lState, md.ReadOnly(), childPath)
	switch {
	case isRecoverableBlockErrorForRemoval(err):
		msg := fmt.Sprintf("Recoverable block error encountered for removeDirLocked(%v); continuing", childPath)
		fbo.log.CWarningf(ctx, "%s", msg)
		fbo.log.CDebugf(ctx, "%s (err=%v)", msg, err)
	case err != nil:
		return err
	case len(entries) > 0:
		return DirNotEmptyError{dirName}
	}

	return fbo.removeEntryLocked(
		ctx, lState, md.ReadOnly(), dir, dirPath, dirName)
}

func (fbo *folderBranchOps) RemoveDir(
	ctx context.Context, dir Node, dirName data.PathPartString) (err error) {
	startTime, timer := fbo.startOp(
		ctx, "RemoveDir %s %s", getNodeIDStr(dir), dirName)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "RemoveDir %s %s done: %+v",
			getNodeIDStr(dir), dirName, err)
	}()

	removeDone, err := dir.RemoveDir(ctx, dirName)
	if err != nil {
		return err
	}
	if removeDone {
		return nil
	}

	err = fbo.checkNodeForWrite(ctx, dir)
	if err != nil {
		return err
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *kbfssync.LockState) error {
			return fbo.removeDirLocked(ctx, lState, dir, dirName)
		})
}

func (fbo *folderBranchOps) RemoveEntry(ctx context.Context, dir Node,
	name data.PathPartString) (err error) {
	startTime, timer := fbo.startOp(
		ctx, "RemoveEntry %s %s", getNodeIDStr(dir), name)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "RemoveEntry %s %s done: %+v",
			getNodeIDStr(dir), name, err)
	}()

	err = fbo.checkNodeForWrite(ctx, dir)
	if err != nil {
		return err
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *kbfssync.LockState) error {
			// Verify we have permission to write (but no need to make
			// a successor yet).
			md, err := fbo.getMDForWriteLockedForFilename(ctx, lState, "")
			if err != nil {
				return err
			}

			dirPath, err := fbo.pathFromNodeForMDWriteLocked(lState, dir)
			if err != nil {
				return err
			}

			return fbo.removeEntryLocked(
				ctx, lState, md.ReadOnly(), dir, dirPath, name)
		})
}

func (fbo *folderBranchOps) renameLocked(
	ctx context.Context, lState *kbfssync.LockState, oldParent Node,
	oldName data.PathPartString, newParent Node, newName data.PathPartString) (
	err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	if err := fbo.checkForUnlinkedDir(oldParent); err != nil {
		return err
	}
	if err := fbo.checkForUnlinkedDir(newParent); err != nil {
		return err
	}

	if err := checkDisallowedPrefixes(ctx, newName); err != nil {
		return err
	}

	oldParentPath, err := fbo.pathFromNodeForMDWriteLocked(lState, oldParent)
	if err != nil {
		return err
	}

	newParentPath, err := fbo.pathFromNodeForMDWriteLocked(lState, newParent)
	if err != nil {
		return err
	}

	// Verify we have permission to write (but no need to make a
	// successor yet).
	md, err := fbo.getMDForWriteLockedForFilename(ctx, lState, "")
	if err != nil {
		return err
	}

	newDe, replacedDe, ro, err := fbo.blocks.PrepRename(
		ctx, lState, md.ReadOnly(), oldParentPath, oldName, newParentPath,
		newName)
	if err != nil {
		return err
	}

	// does name exist?
	if replacedDe.IsInitialized() {
		// Usually higher-level programs check these, but just in case.
		ob := fbo.makeObfuscator()
		if replacedDe.Type == data.Dir && newDe.Type != data.Dir {
			return NotDirError{newParentPath.ChildPathNoPtr(newName, ob)}
		} else if replacedDe.Type != data.Dir && newDe.Type == data.Dir {
			return NotFileError{newParentPath.ChildPathNoPtr(newName, ob)}
		}

		if replacedDe.Type == data.Dir {
			// The directory must be empty.
			entries, err := fbo.blocks.GetEntries(
				ctx, lState, md.ReadOnly(),
				newParentPath.ChildPath(newName, replacedDe.BlockPointer, ob))
			if err != nil {
				return err
			}
			if len(entries) != 0 {
				fbo.log.CWarningf(ctx, "Renaming over a non-empty directory "+
					" (%s/%s) not allowed.", newParentPath, newName)
				return DirNotEmptyError{newName}
			}
		}

		// Delete the old block pointed to by this direntry.
		err := fbo.unrefEntryLocked(
			ctx, lState, md.ReadOnly(), ro, newParentPath, replacedDe, newName)
		if err != nil {
			return err
		}
	}

	// Only the ctime changes on the directory entry itself.
	newDe.Ctime = fbo.nowUnixNano()

	dirCacheUndoFn, err := fbo.blocks.RenameDirEntryInCache(
		ctx, lState, md.ReadOnly(), oldParentPath, oldName, newParentPath,
		newName, newDe, replacedDe)
	if err != nil {
		return err
	}

	nodesToDirty := []Node{oldParent}
	if oldParent.GetID() != newParent.GetID() {
		nodesToDirty = append(nodesToDirty, newParent)
	}
	return fbo.notifyAndSyncOrSignal(
		ctx, lState, dirCacheUndoFn, nodesToDirty, ro, md.ReadOnly())
}

func (fbo *folderBranchOps) Rename(
	ctx context.Context, oldParent Node, oldName data.PathPartString,
	newParent Node, newName data.PathPartString) (err error) {
	startTime, timer := fbo.startOp(
		ctx, "Rename %s/%s -> %s/%s", getNodeIDStr(oldParent),
		oldName, getNodeIDStr(newParent), newName)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "Rename %s/%s -> %s/%s done: %+v",
			getNodeIDStr(oldParent), oldName,
			getNodeIDStr(newParent), newName, err)
	}()

	err = fbo.checkNodeForWrite(ctx, oldParent)
	if err != nil {
		return err
	}
	err = fbo.checkNodeForWrite(ctx, newParent)
	if err != nil {
		return err
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *kbfssync.LockState) error {
			// only works for paths within the same topdir
			if oldParent.GetFolderBranch() != newParent.GetFolderBranch() {
				return RenameAcrossDirsError{}
			}

			return fbo.renameLocked(ctx, lState, oldParent, oldName,
				newParent, newName)
		})
}

func (fbo *folderBranchOps) Read(
	ctx context.Context, file Node, dest []byte, off int64) (
	n int64, err error) {
	startTime, timer := fbo.startOp(
		ctx, "Read %s %d %d", getNodeIDStr(file), len(dest), off)
	defer func() {
		err = fbo.transformReadError(ctx, file, err)
		fbo.endOp(
			ctx, startTime, timer, "Read %s %d %d (n=%d) done: %+v",
			getNodeIDStr(file), len(dest), off, n, err)
	}()

	err = fbo.checkNodeForRead(ctx, file)
	if err != nil {
		return 0, err
	}

	fsFile := file.GetFile(ctx)
	if fsFile != nil {
		defer fsFile.Close()
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Reading from an FS file")
		nInt, err := fsFile.ReadAt(dest, off)
		if nInt == 0 && errors.Cause(err) == io.EOF {
			// The billy interfaces requires an EOF when you start
			// reading past the end of a file, but the libkbfs
			// interface wants a nil error in that case.
			err = nil
		}
		return int64(nInt), err
	}

	{
		filePath, err := fbo.pathFromNodeForRead(file)
		if err != nil {
			return 0, err
		}

		// It seems git isn't handling EINTR from some of its read calls (likely
		// fread), which causes it to get corrupted data (which leads to coredumps
		// later) when a read system call on pack files gets interrupted. This
		// enables delayed cancellation for Read if the file path contains `.git`.
		//
		// TODO: get a patch in git, wait for sufficiently long time for people to
		// upgrade, and remove this.

		// allow turning this feature off by env var to make life easier when we
		// try to fix git.
		if _, isSet := os.LookupEnv("KBFS_DISABLE_GIT_SPECIAL_CASE"); !isSet {
			for _, n := range filePath.Path {
				if n.Name.Plaintext() == ".git" {
					_ = libcontext.EnableDelayedCancellationWithGracePeriod(
						ctx, fbo.config.DelayedCancellationGracePeriod())
					break
				}
			}
		}
	}

	// Don't let the goroutine below write directly to the return
	// variable, since if the context is canceled the goroutine might
	// outlast this function call, and end up in a read/write race
	// with the caller.
	var bytesRead int64
	err = runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()

		// verify we have permission to read
		md, err := fbo.getMDForReadNeedIdentify(ctx, lState)
		if err != nil {
			return err
		}

		// Read using the `file` Node, not `filePath`, since the path
		// could change until we take `blockLock` for reading.
		bytesRead, err = fbo.blocks.Read(
			ctx, lState, md.ReadOnly(), file, dest, off)
		return err
	})
	if err != nil {
		return 0, err
	}
	return bytesRead, nil
}

func (fbo *folderBranchOps) Write(
	ctx context.Context, file Node, data []byte, off int64) (err error) {
	startTime, timer := fbo.startOp(
		ctx, "Write %s %d %d", getNodeIDStr(file), len(data), off)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "Write %s %d %d done: %+v",
			getNodeIDStr(file), len(data), off, err)
	}()

	err = fbo.checkNodeForWrite(ctx, file)
	if err != nil {
		return err
	}

	return runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()

		// Get the MD for reading.  We won't modify it; we'll track the
		// unref changes on the side, and put them into the MD during the
		// sync.
		md, err := fbo.getMDForRead(ctx, lState, mdReadNeedIdentify)
		if err != nil {
			return err
		}

		err = fbo.blocks.Write(
			ctx, lState, md.ReadOnly(), file, data, off)
		if err != nil {
			return err
		}

		fbo.status.addDirtyNode(file)
		fbo.signalWrite()
		return nil
	})
}

func (fbo *folderBranchOps) Truncate(
	ctx context.Context, file Node, size uint64) (err error) {
	startTime, timer := fbo.startOp(
		ctx, "Truncate %s %d", getNodeIDStr(file), size)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "Truncate %s %d done: %+v",
			getNodeIDStr(file), size, err)
	}()

	err = fbo.checkNodeForWrite(ctx, file)
	if err != nil {
		return err
	}

	return runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()

		// Get the MD for reading.  We won't modify it; we'll track the
		// unref changes on the side, and put them into the MD during the
		// sync.
		md, err := fbo.getMDForRead(ctx, lState, mdReadNeedIdentify)
		if err != nil {
			return err
		}

		err = fbo.blocks.Truncate(
			ctx, lState, md.ReadOnly(), file, size)
		if err != nil {
			return err
		}

		fbo.status.addDirtyNode(file)
		fbo.signalWrite()
		return nil
	})
}

func (fbo *folderBranchOps) setExLocked(
	ctx context.Context, lState *kbfssync.LockState, file Node, ex bool) (
	err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	filePath, err := fbo.pathFromNodeForMDWriteLocked(lState, file)
	if err != nil {
		return err
	}

	if !filePath.HasValidParent() {
		return InvalidParentPathError{filePath}
	}

	// Verify we have permission to write (no need to make a successor yet).
	md, err := fbo.getMDForWriteLockedForFilename(ctx, lState, "")
	if err != nil {
		return
	}

	de, err := fbo.blocks.GetEntryEvenIfDeleted(
		ctx, lState, md.ReadOnly(), filePath)
	if err != nil {
		return err
	}

	// If the file is a symlink, do nothing (to match ext4
	// behavior).
	if de.Type == data.Sym || de.Type == data.Dir {
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Ignoring setex on type %s", de.Type)
		return nil
	}

	switch {
	case ex && (de.Type == data.File):
		de.Type = data.Exec
	case !ex && (de.Type == data.Exec):
		de.Type = data.File
	default:
		// Treating this as a no-op, without updating the ctime, is a
		// POSIX violation, but it's an important optimization to keep
		// permissions-preserving rsyncs fast.
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Ignoring no-op setex")
		return nil
	}

	de.Ctime = fbo.nowUnixNano()

	parentPtr := filePath.ParentPath().TailPointer()
	sao, err := newSetAttrOp(
		filePath.TailName().Plaintext(), parentPtr, exAttr,
		filePath.TailPointer())
	if err != nil {
		return err
	}
	sao.AddSelfUpdate(parentPtr)

	// If the node has been unlinked, we can safely ignore this setex.
	if fbo.nodeCache.IsUnlinked(file) {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Skipping setex for a removed file %v",
			filePath.TailPointer())
		_ = fbo.blocks.UpdateCachedEntryAttributesOnRemovedFile(
			ctx, lState, md.ReadOnly(), sao, filePath, de)
		return nil
	}

	sao.setFinalPath(filePath)

	dirCacheUndoFn, err := fbo.blocks.SetAttrInDirEntryInCache(
		ctx, lState, md, filePath, de, sao.Attr)
	if err != nil {
		return err
	}
	return fbo.notifyAndSyncOrSignal(
		ctx, lState, dirCacheUndoFn, []Node{file}, sao, md.ReadOnly())
}

func (fbo *folderBranchOps) SetEx(
	ctx context.Context, file Node, ex bool) (err error) {
	startTime, timer := fbo.startOp(
		ctx, "SetEx %s %t", getNodeIDStr(file), ex)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "SetEx %s %t done: %+v",
			getNodeIDStr(file), ex, err)
	}()

	err = fbo.checkNodeForWrite(ctx, file)
	if err != nil {
		return
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *kbfssync.LockState) error {
			return fbo.setExLocked(ctx, lState, file, ex)
		})
}

func (fbo *folderBranchOps) setMtimeLocked(
	ctx context.Context, lState *kbfssync.LockState, file Node,
	mtime *time.Time) error {
	fbo.mdWriterLock.AssertLocked(lState)

	filePath, err := fbo.pathFromNodeForMDWriteLocked(lState, file)
	if err != nil {
		return err
	}

	if !filePath.HasValidParent() {
		return InvalidParentPathError{filePath}
	}

	// Verify we have permission to write (no need to make a successor yet).
	md, err := fbo.getMDForWriteLockedForFilename(ctx, lState, "")
	if err != nil {
		return err
	}

	de, err := fbo.blocks.GetEntryEvenIfDeleted(
		ctx, lState, md.ReadOnly(), filePath)
	if err != nil {
		return err
	}
	de.Mtime = mtime.UnixNano()
	// setting the mtime counts as changing the file MD, so must set ctime too
	de.Ctime = fbo.nowUnixNano()

	parentPtr := filePath.ParentPath().TailPointer()
	sao, err := newSetAttrOp(
		filePath.TailName().Plaintext(), parentPtr, mtimeAttr,
		filePath.TailPointer())
	if err != nil {
		return err
	}
	sao.AddSelfUpdate(parentPtr)

	// If the node has been unlinked, we can safely ignore this
	// setmtime.
	if fbo.nodeCache.IsUnlinked(file) {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Skipping setmtime for a removed file %v",
			filePath.TailPointer())
		_ = fbo.blocks.UpdateCachedEntryAttributesOnRemovedFile(
			ctx, lState, md.ReadOnly(), sao, filePath, de)
		return nil
	}

	sao.setFinalPath(filePath)

	dirCacheUndoFn, err := fbo.blocks.SetAttrInDirEntryInCache(
		ctx, lState, md.ReadOnly(), filePath, de, sao.Attr)
	if err != nil {
		return err
	}
	return fbo.notifyAndSyncOrSignal(
		ctx, lState, dirCacheUndoFn, []Node{file}, sao, md.ReadOnly())
}

func (fbo *folderBranchOps) SetMtime(
	ctx context.Context, file Node, mtime *time.Time) (err error) {
	startTime, timer := fbo.startOp(
		ctx, "SetMtime %s %v", getNodeIDStr(file), mtime)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "SetMtime %s %v done: %+v",
			getNodeIDStr(file), mtime, err)
	}()

	if mtime == nil {
		// Can happen on some OSes (e.g. OSX) when trying to set the atime only
		return nil
	}

	err = fbo.checkNodeForWrite(ctx, file)
	if err != nil {
		return
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *kbfssync.LockState) error {
			return fbo.setMtimeLocked(ctx, lState, file, mtime)
		})
}

type cleanupFn func(context.Context, *kbfssync.LockState, []data.BlockPointer, error)

// startSyncLocked readies the blocks and other state needed to sync a
// single file.  It returns:
//
// * `doSync`: Whether or not the sync should actually happen.
// * `stillDirty`: Whether the file should still be considered dirty when
//   this function returns.  (That is, if `doSync` is false, and `stillDirty`
//   is true, then the file has outstanding changes but the sync was vetoed for
//   some other reason.)
// * `fblock`: the root file block for the file being sync'd.
// * `lbc`: A local block cache consisting of a dirtied version of the parent
//   directory for this file.
// * `bps`: All the blocks that need to be put to the server.
// * `syncState`: Must be passed to the `FinishSyncLocked` call after the
//   update completes.
// * `cleanupFn`: A function that, if non-nil, must be called after the sync
//   is done.  `cleanupFn` should be passed the set of bad blocks that couldn't
//   be sync'd (if any), and the error.
// * `err`: The best, greatest return value, everyone says it's absolutely
//   stunning.
func (fbo *folderBranchOps) startSyncLocked(ctx context.Context,
	lState *kbfssync.LockState, md *RootMetadata, node Node, file data.Path) (
	doSync, stillDirty bool, fblock *data.FileBlock, dirtyDe *data.DirEntry,
	bps blockPutStateCopiable, syncState fileSyncState,
	cleanup cleanupFn, err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// if the cache for this file isn't dirty, we're done
	if !fbo.blocks.IsDirty(lState, file) {
		return false, false, nil, nil, nil, fileSyncState{}, nil, nil
	}

	// If the MD doesn't match the MD expected by the path, that
	// implies we are using a cached path, which implies the node has
	// been unlinked.  In that case, we can safely ignore this sync.
	if fbo.nodeCache.IsUnlinked(node) {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Skipping sync for a removed file %v",
			file.TailPointer())
		// Removing the cached info here is a little sketchy,
		// since there's no guarantee that this sync comes
		// from closing the file, and we still want to serve
		// stat calls accurately if the user still has an open
		// handle to this file.
		//
		// Note in particular that if a file just had a dirty
		// directory entry cached (due to an attribute change on a
		// removed file, for example), this will clear that attribute
		// change.  If there's still an open file handle, the user
		// won't be able to see the change anymore.
		//
		// TODO: Hook this in with the node cache GC logic to be
		// perfectly accurate (but at the same time, we'd then have to
		// fix up the intentional panic in the background flusher to
		// be more tolerant of long-lived dirty, removed files).
		err := fbo.blocks.ClearCacheInfo(lState, file)
		if err != nil {
			return false, false, nil, nil, nil, fileSyncState{}, nil, err
		}
		fbo.status.rmDirtyNode(node)
		return false, true, nil, nil, nil, fileSyncState{}, nil, nil
	}

	if file.IsValidForNotification() {
		// notify the daemon that a write is being performed
		fbo.config.Reporter().Notify(ctx, writeNotification(file, false))
		defer fbo.config.Reporter().Notify(ctx, writeNotification(file, true))
	}

	fblock, bps, dirtyDe, syncState, err =
		fbo.blocks.StartSync(ctx, lState, md, file)
	cleanup = func(ctx context.Context, lState *kbfssync.LockState,
		blocksToRemove []data.BlockPointer, err error) {
		fbo.blocks.CleanupSyncState(
			ctx, lState, md.ReadOnly(), file, blocksToRemove, syncState, err)
	}
	if err != nil {
		return false, true, nil, nil, nil, fileSyncState{}, cleanup, err
	}

	return true, true, fblock, dirtyDe, bps, syncState, cleanup, nil
}

func addSelfUpdatesAndParent(
	p data.Path, op op, parentsToAddChainsFor map[data.BlockPointer]bool) {
	for i, pn := range p.Path {
		if i == len(p.Path)-1 {
			op.AddSelfUpdate(pn.BlockPointer)
		} else {
			parentsToAddChainsFor[pn.BlockPointer] = true
		}
	}
}

func (fbo *folderBranchOps) syncAllLocked(
	ctx context.Context, lState *kbfssync.LockState, excl Excl) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	dirtyFiles := fbo.blocks.GetDirtyFileBlockRefs(lState)
	dirtyDirs := fbo.blocks.GetDirtyDirBlockRefs(lState)
	defer fbo.blocks.GetDirtyDirBlockRefsDone(lState)
	if len(dirtyFiles) == 0 && len(dirtyDirs) == 0 {
		return nil
	}

	startTime, timer := fbo.startOp(ctx, "syncAllLocked")
	defer func() {
		fbo.endOp(ctx, startTime, timer,
			"syncAllLocked (%d files, %d dirs) done: %+v",
			len(dirtyFiles), len(dirtyDirs), err)
	}()

	ctx = fbo.config.MaybeStartTrace(ctx, "FBO.SyncAll",
		fmt.Sprintf("%d files, %d dirs", len(dirtyFiles), len(dirtyDirs)))
	defer func() { fbo.config.MaybeFinishTrace(ctx, err) }()

	// Verify we have permission to write.  We do this after the dirty
	// check because otherwise readers who call syncAll would get an
	// error.
	md, err := fbo.getSuccessorMDForWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	bps := newBlockPutStateMemory(0)
	resolvedPaths := make(map[data.BlockPointer]data.Path)
	dbm := newDirBlockMapMemory()

	var cleanups []func(context.Context, *kbfssync.LockState, error)
	defer func() {
		for _, cf := range cleanups {
			cf(ctx, lState, err)
		}
	}()

	fbo.log.LazyTrace(ctx, "Syncing %d dir(s)", len(dirtyDirs))

	// Get the most up-to-date mtime and ctime in the root block.
	rootDe, err := fbo.blocks.GetEntry(ctx, lState, md.ReadOnly(), data.Path{})
	if err != nil {
		return err
	}

	// First prep all the directories.
	fbo.vlog.CLogf(ctx, libkb.VLog1, "Syncing %d dir(s)", len(dirtyDirs))
	for _, ref := range dirtyDirs {
		node := fbo.nodeCache.Get(ref)
		if node == nil {
			continue
		}

		dir := fbo.nodeCache.PathFromNode(node)
		dblock, err := fbo.blocks.GetDirtyDirCopy(
			ctx, lState, md, dir, data.BlockWrite)
		if err != nil {
			return err
		}

		err = dbm.putBlock(ctx, dir.TailPointer(), dblock)
		if err != nil {
			return err
		}
		if !fbo.nodeCache.IsUnlinked(node) {
			resolvedPaths[dir.TailPointer()] = dir
		}

		// Add the parent directory of this dirty directory to the
		// `dbm`, to reflect the updated mtime/ctimes of the dirty
		// directory.
		if dir.HasValidParent() {
			parentPath := dir.ParentPath()
			hasBlock, err := dbm.hasBlock(ctx, parentPath.TailPointer())
			if err != nil {
				return err
			}
			if !hasBlock {
				parentBlock, err := fbo.blocks.GetDirtyDirCopy(
					ctx, lState, md, *parentPath, data.BlockWrite)
				if err != nil {
					return err
				}
				err = dbm.putBlock(ctx, parentPath.TailPointer(), parentBlock)
				if err != nil {
					return err
				}
			}
		}

		// On a successful sync, clean up the cached entries and the
		// dirty blocks.  TODO: avoid closures by saving `dir` and
		// `node` in a list for deferred processing.
		cleanups = append(cleanups,
			func(ctx context.Context, lState *kbfssync.LockState, err error) {
				if err != nil {
					return
				}
				fbo.status.rmDirtyNode(node)
			})
	}
	defer func() {
		// If the sync is successful, we can clear out all buffered
		// directory operations.
		if err == nil {
			fbo.dirOps = nil
		}
	}()

	fbo.log.LazyTrace(ctx, "Processing %d op(s)", len(fbo.dirOps))

	newBlocks := make(map[data.BlockPointer]bool)
	fileBlocks := newFileBlockMapMemory()
	parentsToAddChainsFor := make(map[data.BlockPointer]bool)
	for _, dop := range fbo.dirOps {
		// Copy the op before modifying it, in case there's an error
		// and we have to retry with the original ops.
		newOp := dop.dirOp.deepCopy()
		md.AddOp(newOp)

		// Add "updates" for all the op updates, and make chains for
		// the rest of the parent directories, so they're treated like
		// updates during the prepping.
		for _, n := range dop.nodes {
			p := fbo.nodeCache.PathFromNode(n)
			if _, ok := newOp.(*setAttrOp); ok {
				// For a setattr, the node is the file, but that
				// doesn't get updated, so use the current parent
				// node.
				p = *p.ParentPath()
			}

			addSelfUpdatesAndParent(p, newOp, parentsToAddChainsFor)
		}

		var ref data.BlockRef
		switch realOp := newOp.(type) {
		case *createOp:
			if realOp.Type == data.Sym {
				continue
			}

			// New files and directories explicitly need
			// pointer-updating, because the sync process will turn
			// them into simple refs and will forget about the local,
			// temporary ID.
			newNode := dop.nodes[1]
			newPath := fbo.nodeCache.PathFromNode(newNode)
			newPointer := newPath.TailPointer()
			newBlocks[newPointer] = true

			if realOp.Type != data.Dir {
				continue
			}

			hasBlock, err := dbm.hasBlock(ctx, newPointer)
			if err != nil {
				return err
			}
			var dblock *data.DirBlock
			if hasBlock {
				dblock, err = dbm.getBlock(ctx, newPointer)
				if err != nil {
					return err
				}
			} else {
				// New directories that aren't otherwise dirty need to
				// be added to both the `dbm` and `resolvedPaths` so
				// they are properly synced, and removed from the
				// dirty block list.
				dblock, err = fbo.blocks.GetDirtyDirCopy(
					ctx, lState, md, newPath, data.BlockWrite)
				if err != nil {
					return err
				}
				err = dbm.putBlock(ctx, newPointer, dblock)
				if err != nil {
					return err
				}
				if !fbo.nodeCache.IsUnlinked(newNode) {
					resolvedPaths[newPointer] = newPath
				}
				// TODO: avoid closures by saving `newPath` and
				// `newNode` in a list for deferred processing.
				cleanups = append(cleanups,
					func(ctx context.Context, lState *kbfssync.LockState,
						err error) {
						if err != nil {
							return
						}
						_ = fbo.status.rmDirtyNode(newNode)
						_ = fbo.config.DirtyBlockCache().Delete(
							fbo.id(), newPointer, fbo.branch())
					})
			}

			if len(dblock.Children) > 0 || len(dblock.IPtrs) > 0 {
				continue
			}

			// If the directory is empty, we need to explicitly clean
			// up its entry after syncing.
			ref = newPath.TailRef()
		case *renameOp:
			ref = realOp.Renamed.Ref()
		case *setAttrOp:
			ref = realOp.File.Ref()
		default:
			continue
		}

		// For create, rename and setattr ops, the target will have a
		// dirty entry, but may not have any outstanding operations on
		// it, so it needs to be cleaned up manually.
		defer func() {
			if err != nil {
				return
			}
			node := fbo.nodeCache.Get(ref)
			if node != nil {
				fbo.status.rmDirtyNode(node)
			}
		}()
	}

	var blocksToRemove []data.BlockPointer
	// TODO: find a way to avoid so many dynamic closure dispatches.
	var afterUpdateFns []func() error

	afterUpdateFns = append(afterUpdateFns, func() error {
		// Any new files or directories need their pointers explicitly
		// updated, because the sync will be treating them as a new
		// ref, and not an update.
		for ptr, bs := range bps.blockStates {
			if newBlocks[bs.oldPtr] {
				fbo.blocks.updatePointer(md.ReadOnly(), bs.oldPtr, ptr, false)
			}
		}
		return nil
	})

	fbo.log.LazyTrace(ctx, "Syncing %d file(s)", len(dirtyFiles))

	fbo.vlog.CLogf(ctx, libkb.VLog1, "Syncing %d file(s)", len(dirtyFiles))
	fileSyncBlocks := newBlockPutStateMemory(1)
	for _, ref := range dirtyFiles {
		node := fbo.nodeCache.Get(ref)
		if node == nil {
			continue
		}
		file := fbo.nodeCache.PathFromNode(node)
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Syncing file %v (%s)", ref, file)

		// Start the sync for this dirty file.
		doSync, stillDirty, fblock, dirtyDe, newBps, syncState, cleanup, err :=
			fbo.startSyncLocked(ctx, lState, md, node, file)
		if cleanup != nil {
			// Note: This passes the same `blocksToRemove` into each
			// cleanup function.  That's ok, as only the ones
			// pertaining to a particular syncing file will be acted
			// on.
			cleanups = append(cleanups,
				func(ctx context.Context, lState *kbfssync.LockState,
					err error) {
					cleanup(ctx, lState, blocksToRemove, err)
				})
		}
		if err != nil {
			return err
		}
		if !doSync {
			if !stillDirty {
				fbo.status.rmDirtyNode(node)
			}
			continue
		}

		// Merge the per-file sync info into the batch sync info.
		err = bps.mergeOtherBps(ctx, newBps)
		if err != nil {
			return err
		}
		err = fileSyncBlocks.mergeOtherBps(ctx, newBps)
		if err != nil {
			return err
		}
		resolvedPaths[file.TailPointer()] = file
		parent := file.ParentPath().TailPointer()
		err = fileBlocks.putTopBlock(
			ctx, parent, file.TailName().Plaintext(), fblock)
		if err != nil {
			return err
		}

		// Collect its `afterUpdateFn` along with all the others, so
		// they all get invoked under the same lock, to avoid any
		// weird races.
		afterUpdateFns = append(afterUpdateFns, func() error {
			// This will be called after the node cache is updated, so
			// this newPath will be correct.
			newPath := fbo.nodeCache.PathFromNode(node)
			stillDirty, err := fbo.blocks.FinishSyncLocked(
				ctx, lState, file, newPath, md.ReadOnly(), syncState, fbo.fbm)
			if !stillDirty {
				fbo.status.rmDirtyNode(node)
			}
			return err
		})

		// Add an "update" for all the parent directory updates, and
		// make a chain for the file itself, so they're treated like
		// updates during the prepping.
		lastOp := md.Data().Changes.Ops[len(md.Data().Changes.Ops)-1]
		addSelfUpdatesAndParent(file, lastOp, parentsToAddChainsFor)

		// Update the combined local block cache with this file's
		// dirty entry.
		if dirtyDe != nil {
			err := fbo.blocks.mergeDirtyEntryWithDBM(
				ctx, lState, file, md, dbm, *dirtyDe)
			if err != nil {
				return err
			}
		}
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	tempIRMD := ImmutableRootMetadata{
		ReadOnlyRootMetadata:   md.ReadOnly(),
		lastWriterVerifyingKey: session.VerifyingKey,
	}

	fbo.log.LazyTrace(ctx, "Prepping update")

	// Create a set of chains for this batch, a succinct summary of
	// the file and directory blocks that need to change during this
	// sync.
	syncChains, err := newCRChains(
		ctx, fbo.config.Codec(), fbo.config, []chainMetadata{tempIRMD},
		&fbo.blocks, false)
	if err != nil {
		return err
	}
	for ptr := range parentsToAddChainsFor {
		syncChains.addNoopChain(ptr)
	}

	// All originals never made it to the server, so don't unmerged
	// them.
	syncChains.doNotUnrefPointers = syncChains.createdOriginals
	head, _ := fbo.getHead(ctx, lState, mdNoCommit)
	dummyHeadChains := newCRChainsEmpty(fbo.makeObfuscator)
	dummyHeadChains.mostRecentChainMDInfo = head

	// Squash the batch of updates together into a set of blocks and
	// ready `md` for putting to the server.
	md.AddOp(newResolutionOp())
	_, blocksToDelete, err := fbo.prepper.prepUpdateForPaths(
		ctx, lState, md, syncChains, dummyHeadChains, tempIRMD, head,
		resolvedPaths, dbm, fileBlocks, fbo.config.DirtyBlockCache(), bps,
		prepFolderDontCopyIndirectFileBlocks)
	if err != nil {
		return err
	}
	if len(blocksToDelete) > 0 {
		return errors.Errorf("Unexpectedly found unflushed blocks to delete "+
			"during syncAllLocked: %v", blocksToDelete)
	}

	defer func() {
		if err != nil {
			// Remove any blocks that are covered by file syncs --
			// those might get reused upon sync retry.  All other
			// blocks are fair game for cleanup though.
			removeErr := bps.removeOtherBps(ctx, fileSyncBlocks)
			if removeErr != nil {
				fbo.log.CDebugf(ctx, "Error removing other bps: %+v", removeErr)
			}
			fbo.fbm.cleanUpBlockState(md.ReadOnly(), bps, blockDeleteOnMDFail)
		}
	}()

	// Put all the blocks.
	cacheType := DiskBlockAnyCache
	if fbo.config.IsSyncedTlf(fbo.id()) {
		cacheType = DiskBlockSyncCache
	}
	blocksToRemove, err = doBlockPuts(
		ctx, fbo.config.BlockServer(), fbo.config.BlockCache(),
		fbo.config.Reporter(), fbo.log, fbo.deferLog, md.TlfID(),
		md.GetTlfHandle().GetCanonicalName(), bps, cacheType)
	if err != nil {
		return err
	}

	// Call this under the same blockLock as when the pointers are
	// updated, so there's never any point in time where a read or
	// write might slip in after the pointers are updated, but before
	// the deferred writes are re-applied.
	afterUpdateFn := func() error {
		// Clear the dirty directories before the afterUpdateFns start
		// replaying deferred writes, so we don't lose the deferred
		// write state when we clear.
		fbo.blocks.clearAllDirtyDirsLocked(ctx, lState, md)
		var errs []error
		for _, auf := range afterUpdateFns {
			err := auf()
			if err != nil {
				errs = append(errs, err)
			}
		}
		if len(errs) == 1 {
			return errs[0]
		} else if len(errs) > 1 {
			return errors.Errorf("Got errors %+v", errs)
		}
		return nil
	}

	// Set the root directory entry times to their updated values,
	// since the prepper doesn't do it for blocks that aren't in the
	// `dbm`.
	md.data.Dir.Mtime = rootDe.Mtime
	md.data.Dir.Ctime = rootDe.Ctime

	return fbo.finalizeMDWriteLocked(ctx, lState, md, bps, excl,
		func(md ImmutableRootMetadata) error {
			// Just update the pointers using the resolutionOp, all
			// the ops have already been notified.
			affectedNodeIDs, err := fbo.blocks.UpdatePointers(
				md, lState, md.data.Changes.Ops[0], false, afterUpdateFn)
			if err != nil {
				return err
			}

			fbo.observers.batchChanges(ctx, nil, affectedNodeIDs)
			return nil
		})
}

func (fbo *folderBranchOps) syncAllUnlocked(
	ctx context.Context, lState *kbfssync.LockState) error {
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)

	select {
	case <-ctx.Done():
		// We've already been canceled, possibly because we're a CR
		// and a write just called cr.ForceCancel.  Don't allow the
		// SyncAll to complete, because if no other writes happen
		// we'll get stuck forever (see KBFS-2505).  Instead, wait for
		// the next `SyncAll` to trigger.
		return ctx.Err()
	default:
	}

	return fbo.syncAllLocked(ctx, lState, NoExcl)
}

// SyncAll implements the KBFSOps interface for folderBranchOps.
func (fbo *folderBranchOps) SyncAll(
	ctx context.Context, folderBranch data.FolderBranch) (err error) {
	startTime, timer := fbo.startOp(ctx, "SyncAll")
	defer func() {
		fbo.endOp(ctx, startTime, timer, "SyncAll done: %+v", err)
	}()

	if folderBranch != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, folderBranch}
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *kbfssync.LockState) error {
			return fbo.syncAllLocked(ctx, lState, NoExcl)
		})
}

func (fbo *folderBranchOps) FolderStatus(
	ctx context.Context, folderBranch data.FolderBranch) (
	fbs FolderBranchStatus, updateChan <-chan StatusUpdate, err error) {
	startTime, timer := fbo.startOp(ctx, "Status")
	defer func() {
		fbo.endOp(ctx, startTime, timer, "Status done: %+v", err)
	}()

	if folderBranch != fbo.folderBranch {
		return FolderBranchStatus{}, nil,
			WrongOpsError{fbo.folderBranch, folderBranch}
	}

	return fbo.status.getStatus(ctx, &fbo.blocks)
}

func (fbo *folderBranchOps) FolderConflictStatus(ctx context.Context) (
	keybase1.FolderConflictType, error) {
	isStuck, err := fbo.cr.isStuck()
	if err != nil {
		return keybase1.FolderConflictType_NONE, err
	}

	if isStuck {
		return keybase1.FolderConflictType_IN_CONFLICT_AND_STUCK, nil
	}

	lState := makeFBOLockState()
	if fbo.isUnmerged(lState) {
		return keybase1.FolderConflictType_IN_CONFLICT, nil
	}
	return keybase1.FolderConflictType_NONE, nil
}

func (fbo *folderBranchOps) Status(
	ctx context.Context) (
	fbs KBFSStatus, updateChan <-chan StatusUpdate, err error) {
	return KBFSStatus{}, nil, InvalidOpError{}
}

// RegisterForChanges registers a single Observer to receive
// notifications about this folder/branch.
func (fbo *folderBranchOps) RegisterForChanges(obs Observer) error {
	// It's the caller's responsibility to make sure
	// RegisterForChanges isn't called twice for the same Observer
	fbo.observers.add(obs)
	return nil
}

// UnregisterFromChanges stops an Observer from getting notifications
// about the folder/branch.
func (fbo *folderBranchOps) UnregisterFromChanges(obs Observer) error {
	fbo.observers.remove(obs)
	return nil
}

// notifyBatchLocked sends out a notification for all the ops in md.
func (fbo *folderBranchOps) notifyBatchLocked(
	ctx context.Context, lState *kbfssync.LockState,
	md ImmutableRootMetadata) error {
	fbo.headLock.AssertLocked(lState)

	for _, op := range md.data.Changes.Ops {
		err := fbo.notifyOneOpLocked(ctx, lState, op, md.ReadOnly(), false)
		if err != nil {
			return err
		}
	}
	return nil
}

// searchForNode tries to figure out the path to the given
// blockPointer, using only the block updates that happened as part of
// a given MD update operation.
func (fbo *folderBranchOps) searchForNode(ctx context.Context,
	ptr data.BlockPointer, md ReadOnlyRootMetadata) (Node, error) {
	// Record which pointers are new to this update, and thus worth
	// searching.
	newPtrs := make(map[data.BlockPointer]bool)
	for _, op := range md.data.Changes.Ops {
		for _, update := range op.allUpdates() {
			newPtrs[update.Ref] = true
		}
		for _, ref := range op.Refs() {
			newPtrs[ref] = true
		}
	}

	nodeMap, _, err := fbo.blocks.SearchForNodes(ctx, fbo.nodeCache,
		[]data.BlockPointer{ptr}, newPtrs, md, md.data.Dir.BlockPointer)
	if err != nil {
		return nil, err
	}

	n, ok := nodeMap[ptr]
	if !ok {
		return nil, NodeNotFoundError{ptr}
	}

	return n, nil
}

func (fbo *folderBranchOps) getUnlinkPathBeforeUpdatingPointers(
	ctx context.Context, lState *kbfssync.LockState, md ReadOnlyRootMetadata,
	op op) (unlinkPath data.Path, unlinkDe data.DirEntry, toUnlink bool, err error) {
	fbo.mdWriterLock.AssertLocked(lState)
	if len(md.data.Changes.Ops) == 0 {
		return data.Path{}, data.DirEntry{}, false, errors.New("md needs at least one op")
	}

	var node Node
	var childName data.PathPartString

	requireResFix := false
	switch realOp := op.(type) {
	case *rmOp:
		if realOp.Dir.Ref == realOp.Dir.Unref {
			requireResFix = true
		}
		node = fbo.nodeCache.Get(realOp.Dir.Unref.Ref())
		childName = realOp.obfuscatedOldName()
	case *renameOp:
		if realOp.NewDir.Unref != data.ZeroPtr {
			// moving to a new dir
			if realOp.NewDir.Ref == realOp.NewDir.Unref {
				requireResFix = true
			}
			node = fbo.nodeCache.Get(realOp.NewDir.Unref.Ref())
		} else {
			// moving to the same dir
			if realOp.OldDir.Ref == realOp.OldDir.Unref {
				requireResFix = true
			}
			node = fbo.nodeCache.Get(realOp.OldDir.Unref.Ref())
		}
		childName = realOp.obfuscatedNewName()
	}
	if node == nil {
		return data.Path{}, data.DirEntry{}, false, nil
	}

	p, err := fbo.pathFromNodeForRead(node)
	if err != nil {
		return data.Path{}, data.DirEntry{}, false, err
	}

	// If the first op in this MD update is a resolutionOp, we need to
	// inspect it to look for the *real* original pointer for this
	// node.  Though only do that if the op we're processing is
	// actually a part of this MD object; if it's the latest cached
	// dirOp, then the resOp we're looking at belongs to a previous
	// revision.
	if resOp, ok := md.data.Changes.Ops[0].(*resolutionOp); ok &&
		(len(fbo.dirOps) == 0 || op != fbo.dirOps[len(fbo.dirOps)-1].dirOp) {
		for _, update := range resOp.allUpdates() {
			if update.Ref == p.TailPointer() {
				fbo.vlog.CLogf(
					ctx, libkb.VLog1,
					"Backing up ptr %v in op %s to original pointer %v",
					p.TailPointer(), op, update.Unref)
				p.Path[len(p.Path)-1].BlockPointer = update.Unref
				requireResFix = false
				break
			}
		}
	}

	if requireResFix {
		// If we didn't fix up the pointer using a resolutionOp, the
		// directory was likely created during this md update, and so
		// no unlinking is needed.
		fbo.vlog.CLogf(
			ctx, libkb.VLog1,
			"Ignoring unlink when resolutionOp never fixed up %v",
			p.TailPointer())
		return data.Path{}, data.DirEntry{}, false, nil
	}

	// If the original (clean) parent block is already GC'd from the
	// server, this might not work, but hopefully we'd be
	// fast-forwarding in that case anyway.
	ob := fbo.makeObfuscator()
	childPath := p.ChildPathNoPtr(childName, ob)
	de, err := fbo.blocks.GetEntry(ctx, lState, md, childPath)
	if err != nil {
		fbo.log.CDebugf(ctx, "Couldn't get the dir entry for %s in %v: %+v",
			childName, p.TailPointer(), err)
		return data.Path{}, data.DirEntry{}, false, nil
	}
	childPath = p.ChildPath(childName, de.BlockPointer, ob)
	return childPath, de, true, nil
}

func (fbo *folderBranchOps) notifyOneOpLocked(ctx context.Context,
	lState *kbfssync.LockState, op op, md ReadOnlyRootMetadata,
	shouldPrefetch bool) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)

	if !fbo.config.Mode().NodeCacheEnabled() {
		// There is no node cache in minimal mode, so there's nothing
		// to update.
		return nil
	}

	// We need to get unlinkPath before calling UpdatePointers so that
	// nodeCache.Unlink can properly update cachedPath.
	unlinkPath, unlinkDe, toUnlink, err :=
		fbo.getUnlinkPathBeforeUpdatingPointers(ctx, lState, md, op)
	if err != nil {
		return err
	}

	affectedNodeIDs, err := fbo.blocks.UpdatePointers(
		md, lState, op, shouldPrefetch, nil)
	if err != nil {
		return err
	}

	// Cancel any block prefetches for unreferenced blocks.
	for _, ptr := range op.Unrefs() {
		fbo.config.BlockOps().Prefetcher().CancelPrefetch(ptr)
	}

	var changes []NodeChange
	switch realOp := op.(type) {
	default:
		fbo.log.CDebugf(ctx, "Unknown op: %s", op)
	case *createOp:
		node := fbo.nodeCache.Get(realOp.Dir.Ref.Ref())
		if node == nil {
			break
		}
		fbo.vlog.CLogf(ctx, libkb.VLog1, "notifyOneOp: create %s in node %s",
			realOp.NewName, getNodeIDStr(node))
		changes = append(changes, NodeChange{
			Node:       node,
			DirUpdated: []data.PathPartString{realOp.obfuscatedNewName()},
		})
	case *rmOp:
		node := fbo.nodeCache.Get(realOp.Dir.Ref.Ref())
		if node == nil {
			break
		}
		fbo.vlog.CLogf(ctx, libkb.VLog1, "notifyOneOp: remove %s in node %s",
			realOp.OldName, getNodeIDStr(node))
		changes = append(changes, NodeChange{
			Node:       node,
			DirUpdated: []data.PathPartString{realOp.obfuscatedOldName()},
		})

		// If this node exists, then the child node might exist too,
		// and we need to unlink it in the node cache.
		if toUnlink {
			_ = fbo.nodeCache.Unlink(unlinkDe.Ref(), unlinkPath, unlinkDe)
		}
	case *renameOp:
		oldNode := fbo.nodeCache.Get(realOp.OldDir.Ref.Ref())
		if oldNode != nil {
			changes = append(changes, NodeChange{
				Node:       oldNode,
				DirUpdated: []data.PathPartString{realOp.obfuscatedOldName()},
			})
		}
		var newNode Node
		if realOp.NewDir.Ref != data.ZeroPtr {
			newNode = fbo.nodeCache.Get(realOp.NewDir.Ref.Ref())
			if newNode != nil {
				changes = append(changes, NodeChange{
					Node: newNode,
					DirUpdated: []data.PathPartString{
						realOp.obfuscatedNewName()},
				})
			}
		} else {
			newNode = oldNode
			if oldNode != nil {
				// Add another name to the existing NodeChange.
				changes[len(changes)-1].DirUpdated =
					append(changes[len(changes)-1].DirUpdated,
						realOp.obfuscatedNewName())
			}
		}

		if oldNode != nil {
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "notifyOneOp: rename %v from %s/%s to %s/%s",
				realOp.Renamed, realOp.OldName, getNodeIDStr(oldNode),
				realOp.NewName, getNodeIDStr(newNode))

			if newNode == nil {
				if childNode :=
					fbo.nodeCache.Get(realOp.Renamed.Ref()); childNode != nil {
					// if the childNode exists, we still have to update
					// its path to go through the new node.  That means
					// creating nodes for all the intervening paths.
					// Unfortunately we don't have enough information to
					// know what the newPath is; we have to guess it from
					// the updates.
					var err error
					newNode, err =
						fbo.searchForNode(ctx, realOp.NewDir.Ref, md)
					if newNode == nil {
						fbo.log.CErrorf(ctx, "Couldn't find the new node: %v",
							err)
					}
				}
			}

			if newNode != nil {
				if toUnlink {
					_ = fbo.nodeCache.Unlink(
						unlinkDe.Ref(), unlinkPath, unlinkDe)
				}
				_, err := fbo.nodeCache.Move(
					realOp.Renamed.Ref(), newNode, realOp.obfuscatedNewName())
				if err != nil {
					return err
				}
			}
		}
	case *syncOp:
		node := fbo.nodeCache.Get(realOp.File.Ref.Ref())
		if node == nil {
			break
		}
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "notifyOneOp: sync %d writes in node %s",
			len(realOp.Writes), getNodeIDStr(node))

		changes = append(changes, NodeChange{
			Node:        node,
			FileUpdated: realOp.Writes,
		})
	case *setAttrOp:
		node := fbo.nodeCache.Get(realOp.Dir.Ref.Ref())
		if node == nil {
			break
		}
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "notifyOneOp: setAttr %s for file %s in node %s",
			realOp.Attr, realOp.Name, getNodeIDStr(node))

		childNode := fbo.nodeCache.Get(realOp.File.Ref())
		if childNode == nil {
			break
		}

		changes = append(changes, NodeChange{
			Node: childNode,
		})
	case *GCOp:
		// Unreferenced blocks in a GCOp mean that we shouldn't cache
		// them anymore
		fbo.vlog.CLogf(
			ctx, libkb.VLog1,
			"notifyOneOp: GCOp with latest rev %d and %d unref'd blocks",
			realOp.LatestRev, len(realOp.Unrefs()))
		bcache := fbo.config.BlockCache()
		for _, ptr := range realOp.Unrefs() {
			if err := bcache.DeleteTransient(ptr.ID, fbo.id()); err != nil {
				fbo.log.CDebugf(ctx,
					"Couldn't delete transient entry for %v: %v", ptr, err)
			}
		}
	case *resolutionOp:
		// If there are any unrefs of blocks that have a node, this is an
		// implied rmOp (see KBFS-1424).
		reverseUpdates := make(map[data.BlockPointer]data.BlockPointer)
		for _, unref := range op.Unrefs() {
			node := fbo.nodeCache.Get(unref.Ref())
			if node == nil {
				// TODO: even if we don't have the node that was
				// unreferenced, we might have its parent, and that
				// parent might need an invalidation.
				continue
			}

			// If there is a node, unlink and invalidate.
			p, err := fbo.pathFromNodeForRead(node)
			if err != nil {
				fbo.log.CErrorf(ctx, "Couldn't get path: %v", err)
				continue
			}
			if !p.HasValidParent() {
				fbo.log.CErrorf(ctx, "Removed node %s has no parent", p)
				continue
			}
			parentPath := p.ParentPath()
			parentNode := fbo.nodeCache.Get(parentPath.TailRef())
			if parentNode != nil {
				changes = append(changes, NodeChange{
					Node:       parentNode,
					DirUpdated: []data.PathPartString{p.TailName()},
				})
			}

			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "resolutionOp: remove %s, node %s",
				p.TailPointer(), getNodeIDStr(node))
			// Revert the path back to the original BlockPointers,
			// before the updates were applied.
			if len(reverseUpdates) == 0 {
				for _, update := range op.allUpdates() {
					reverseUpdates[update.Ref] = update.Unref
				}
			}
			for i, pNode := range p.Path {
				if oldPtr, ok := reverseUpdates[pNode.BlockPointer]; ok {
					p.Path[i].BlockPointer = oldPtr
				}
			}
			de, err := fbo.blocks.GetEntry(ctx, lState, md.ReadOnly(), p)
			if err != nil {
				fbo.log.CDebugf(ctx,
					"Couldn't get the dir entry for %s/%v: %+v",
					p, p.TailPointer(), err)
			}
			_ = fbo.nodeCache.Unlink(p.TailRef(), p, de)
		}
	}

	if len(changes) > 0 || len(affectedNodeIDs) > 0 {
		fbo.observers.batchChanges(ctx, changes, affectedNodeIDs)
	}
	return nil
}

func (fbo *folderBranchOps) notifyOneOp(ctx context.Context,
	lState *kbfssync.LockState, op op, md ReadOnlyRootMetadata,
	shouldPrefetch bool) error {
	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	return fbo.notifyOneOpLocked(ctx, lState, op, md, shouldPrefetch)
}

func (fbo *folderBranchOps) getCurrMDRevisionLocked(
	lState *kbfssync.LockState) kbfsmd.Revision {
	fbo.headLock.AssertAnyLocked(lState)

	if fbo.head != (ImmutableRootMetadata{}) {
		return fbo.head.Revision()
	}
	return kbfsmd.RevisionUninitialized
}

func (fbo *folderBranchOps) getCurrMDRevision(
	lState *kbfssync.LockState) kbfsmd.Revision {
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)
	return fbo.getCurrMDRevisionLocked(lState)
}

type applyMDUpdatesFunc func(
	context.Context, *kbfssync.LockState, []ImmutableRootMetadata) error

func (fbo *folderBranchOps) applyMDUpdatesLocked(ctx context.Context,
	lState *kbfssync.LockState, rmds []ImmutableRootMetadata) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	if len(rmds) == 0 {
		return nil
	}
	latestMerged := rmds[len(rmds)-1]

	// If there's anything in the journal, don't apply these MDs.
	// Wait for CR to happen.
	if !fbo.isUnmergedLocked(lState) {
		mergedRev, journalEnd, err := fbo.getJournalRevisions(ctx)
		if err == errNoFlushedRevisions {
			// If the journal is still on the initial revision, ignore
			// the error and fall through to ignore CR.
			mergedRev = kbfsmd.RevisionInitial
		} else if err != nil {
			return err
		}
		if mergedRev != kbfsmd.RevisionUninitialized {
			if latestMerged.Revision() > journalEnd {
				// If somehow we fetch more revisions than our journal
				// knows about, we should update our view of the
				// merged master, to avoid re-registering for the same
				// updates again.
				func() {
					fbo.headLock.Lock(lState)
					defer fbo.headLock.Unlock(lState)
					fbo.setLatestMergedRevisionLocked(
						ctx, lState, latestMerged.Revision(), false)
				}()
			}

			fbo.log.CDebugf(ctx,
				"Ignoring fetched revisions while MDs are in journal")
			return nil
		}
	}

	// Kick off partial prefetching once the latest merged revision is
	// set.
	oneApplied := false
	defer func() {
		if oneApplied && err == nil {
			fbo.kickOffPartialSyncIfNeeded(ctx, lState, latestMerged)
		}
	}()

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)

	// if we have staged changes, ignore all updates until conflict
	// resolution kicks in.  TODO: cache these for future use.
	if fbo.isUnmergedLocked(lState) {
		// Don't trust un-put updates here because they might have
		// come from our own journal before the conflict was
		// detected.  Assume we'll hear about the conflict via
		// callbacks from the journal.
		if !latestMerged.putToServer {
			return UnmergedError{}
		}

		// setHeadLocked takes care of merged case
		fbo.setLatestMergedRevisionLocked(
			ctx, lState, latestMerged.Revision(), false)

		unmergedRev := kbfsmd.RevisionUninitialized
		if fbo.head != (ImmutableRootMetadata{}) {
			unmergedRev = fbo.head.Revision()
		}
		fbo.cr.Resolve(ctx, unmergedRev, latestMerged.Revision())
		return UnmergedError{}
	}

	// Kick off a fetch of the latest root directory block, to make
	// sure we have it locally before we expose these changes to the
	// user.  That way, if we go offline we can be reasonably sure the
	// user can at least list the root directory.
	latestRootBlockFetch := fbo.kickOffRootBlockFetch(ctx, latestMerged)

	// Don't allow updates while we're in the dirty state; the next
	// sync will put us into an unmerged state anyway and we'll
	// require conflict resolution.
	if fbo.blocks.GetState(lState) != cleanState {
		return errors.WithStack(NoUpdatesWhileDirtyError{})
	}

	for i, rmd := range rmds {
		// check that we're applying the expected MD revision
		if rmd.Revision() <= fbo.getCurrMDRevisionLocked(lState) {
			// Already caught up!
			continue
		}
		err := isReadableOrError(
			ctx, fbo.config.KBPKI(), fbo.config, rmd.ReadOnly())
		if err != nil {
			return err
		}

		if i == len(rmds)-1 {
			err := fbo.waitForRootBlockFetch(
				ctx, latestMerged, latestRootBlockFetch)
			if err != nil {
				return err
			}
		}

		err = fbo.setHeadSuccessorLocked(ctx, lState, rmd, false)
		if err != nil {
			return err
		}
		oneApplied = true
		// No new operations in these.
		if rmd.IsWriterMetadataCopiedSet() {
			continue
		}
		for _, op := range rmd.data.Changes.Ops {
			err := fbo.notifyOneOpLocked(ctx, lState, op, rmd.ReadOnly(), true)
			if err != nil {
				return err
			}
		}
		if rmd.IsRekeySet() {
			// One might have concern that a MD update written by the device
			// itself can slip in here, for example during the rekey after
			// setting paper prompt, and the event may cause the paper prompt
			// to be unset. This is not a problem because 1) the revision check
			// above shouldn't allow MD update written by this device to reach
			// here; 2) the rekey FSM doesn't touch anything if it has the
			// paper prompt set and is in scheduled state.
			fbo.rekeyFSM.Event(NewRekeyRequestEvent())
		} else {
			fbo.rekeyFSM.Event(NewRekeyNotNeededEvent())
		}
	}
	return nil
}

func (fbo *folderBranchOps) undoMDUpdatesLocked(ctx context.Context,
	lState *kbfssync.LockState, rmds []ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)

	// Don't allow updates while we're in the dirty state; the next
	// sync will put us into an unmerged state anyway and we'll
	// require conflict resolution.
	if fbo.blocks.GetState(lState) != cleanState {
		return NotPermittedWhileDirtyError{}
	}

	// go backwards through the updates
	for i := len(rmds) - 1; i >= 0; i-- {
		rmd := rmds[i]
		// on undo, it's ok to re-apply the current revision since you
		// need to invert all of its ops.
		//
		// This duplicates a check in
		// fbo.setHeadPredecessorLocked. TODO: Remove this
		// duplication.
		if rmd.Revision() != fbo.getCurrMDRevisionLocked(lState) &&
			rmd.Revision() != fbo.getCurrMDRevisionLocked(lState)-1 {
			return MDUpdateInvertError{rmd.Revision(),
				fbo.getCurrMDRevisionLocked(lState)}
		}

		// TODO: Check that the revisions are equal only for
		// the first iteration.
		if rmd.Revision() < fbo.getCurrMDRevisionLocked(lState) {
			err := fbo.setHeadPredecessorLocked(ctx, lState, rmd)
			if err != nil {
				return err
			}
		}

		// iterate the ops in reverse and invert each one
		ops := rmd.data.Changes.Ops
		for j := len(ops) - 1; j >= 0; j-- {
			io, err := invertOpForLocalNotifications(ops[j])
			if err != nil {
				fbo.log.CWarningf(ctx,
					"got error %v when invert op %v; "+
						"skipping. Open file handles "+
						"may now be in an invalid "+
						"state, which can be fixed by "+
						"either closing them all or "+
						"restarting KBFS.",
					err, ops[j])
				continue
			}
			err = fbo.notifyOneOpLocked(ctx, lState, io, rmd.ReadOnly(), false)
			if err != nil {
				return err
			}
		}
	}
	// TODO: update the edit history?
	return nil
}

func (fbo *folderBranchOps) applyMDUpdates(ctx context.Context,
	lState *kbfssync.LockState, rmds []ImmutableRootMetadata) error {
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	return fbo.applyMDUpdatesLocked(ctx, lState, rmds)
}

func (fbo *folderBranchOps) getLatestMergedRevision(
	lState *kbfssync.LockState) kbfsmd.Revision {
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)
	return fbo.latestMergedRevision
}

func (fbo *folderBranchOps) getLatestMergedMD(
	ctx context.Context, lState *kbfssync.LockState) (
	ImmutableRootMetadata, error) {
	rev := fbo.getLatestMergedRevision(lState)
	if rev == kbfsmd.RevisionUninitialized {
		return ImmutableRootMetadata{}, nil
	}
	return getSingleMD(
		ctx, fbo.config, fbo.id(), kbfsmd.NullBranchID, rev, kbfsmd.Merged, nil)
}

// caller should have held fbo.headLock
func (fbo *folderBranchOps) setLatestMergedRevisionLocked(
	ctx context.Context, lState *kbfssync.LockState, rev kbfsmd.Revision,
	allowBackward bool) {
	fbo.headLock.AssertLocked(lState)
	if rev == kbfsmd.RevisionUninitialized {
		panic("Cannot set latest merged revision to an uninitialized value")
	}

	if fbo.latestMergedRevision < rev || allowBackward {
		fbo.latestMergedRevision = rev
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Updated latestMergedRevision to %d.", rev)
	} else {
		fbo.log.CDebugf(ctx, "Local latestMergedRevision (%d) is higher than "+
			"the new revision (%d); won't update.", fbo.latestMergedRevision, rev)
	}

	if fbo.latestMergedUpdated != nil {
		close(fbo.latestMergedUpdated)
	}
	fbo.latestMergedUpdated = make(chan struct{})
	fbo.fbm.signalLatestMergedRevision()
}

// Assumes all necessary locking is either already done by caller, or
// is done by applyFunc.
func (fbo *folderBranchOps) getAndApplyMDUpdates(ctx context.Context,
	lState *kbfssync.LockState, lockBeforeGet *keybase1.LockID,
	applyFunc applyMDUpdatesFunc) error {
	// first look up all MD revisions newer than my current head
	start := fbo.getLatestMergedRevision(lState) + 1
	rmds, err := getMergedMDUpdates(ctx,
		fbo.config, fbo.id(), start, lockBeforeGet)
	if err != nil {
		return err
	}

	err = applyFunc(ctx, lState, rmds)
	if err != nil {
		return err
	}
	return nil
}

func (fbo *folderBranchOps) getAndApplyNewestUnmergedHead(ctx context.Context,
	lState *kbfssync.LockState) error {
	fbo.vlog.CLogf(ctx, libkb.VLog1, "Fetching the newest unmerged head")
	unmergedBID := func() kbfsmd.BranchID {
		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)
		return fbo.unmergedBID
	}()

	// We can only ever be at most one revision behind, so fetch the
	// latest unmerged revision and apply it as a successor.
	md, err := fbo.config.MDOps().GetUnmergedForTLF(ctx, fbo.id(), unmergedBID)
	if err != nil {
		return err
	}

	if md == (ImmutableRootMetadata{}) {
		// There is no unmerged revision, oops!
		return errors.New("Couldn't find an unmerged head")
	}

	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	if fbo.unmergedBID != unmergedBID {
		// The branches switched (apparently CR completed), so just
		// try again.
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Branches switched while fetching unmerged head")
		return nil
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	if err := fbo.setHeadSuccessorLocked(ctx, lState, md, false); err != nil {
		return err
	}
	if err := fbo.notifyBatchLocked(ctx, lState, md); err != nil {
		return err
	}
	return fbo.config.MDCache().Put(md)
}

// getUnmergedMDUpdates returns a slice of the unmerged MDs for this
// TLF's current unmerged branch and unmerged branch, between the
// merge point for the branch and the current head.  The returned MDs
// are the same instances that are stored in the MD cache, so they
// should be modified with care.
func (fbo *folderBranchOps) getUnmergedMDUpdates(
	ctx context.Context, lState *kbfssync.LockState) (
	kbfsmd.Revision, []ImmutableRootMetadata, error) {
	// acquire mdWriterLock to read the current branch ID.
	unmergedBID := func() kbfsmd.BranchID {
		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)
		return fbo.unmergedBID
	}()
	return getUnmergedMDUpdates(ctx, fbo.config, fbo.id(),
		unmergedBID, fbo.getCurrMDRevision(lState))
}

func (fbo *folderBranchOps) getUnmergedMDUpdatesLocked(
	ctx context.Context, lState *kbfssync.LockState) (
	kbfsmd.Revision, []ImmutableRootMetadata, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	return getUnmergedMDUpdates(ctx, fbo.config, fbo.id(),
		fbo.unmergedBID, fbo.getCurrMDRevision(lState))
}

// Returns a list of block pointers that were created during the
// staged era.
func (fbo *folderBranchOps) undoUnmergedMDUpdatesLocked(
	ctx context.Context, lState *kbfssync.LockState) ([]data.BlockPointer, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	currHead, unmergedRmds, err := fbo.getUnmergedMDUpdatesLocked(ctx, lState)
	if err != nil {
		return nil, err
	}

	err = fbo.undoMDUpdatesLocked(ctx, lState, unmergedRmds)
	if err != nil {
		return nil, err
	}

	// We have arrived at the branch point.  The new root is
	// the previous revision from the current head.  Find it
	// and apply.  TODO: somehow fake the current head into
	// being currHead-1, so that future calls to
	// applyMDUpdates will fetch this along with the rest of
	// the updates.
	fbo.setBranchIDLocked(lState, kbfsmd.NullBranchID)

	rmd, err := getSingleMD(ctx, fbo.config, fbo.id(), kbfsmd.NullBranchID,
		currHead, kbfsmd.Merged, nil)
	if err != nil {
		return nil, err
	}
	err = func() error {
		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)
		err = fbo.setHeadPredecessorLocked(ctx, lState, rmd)
		if err != nil {
			return err
		}
		fbo.setLatestMergedRevisionLocked(ctx, lState, rmd.Revision(), true)
		return nil
	}()
	if err != nil {
		return nil, err
	}

	// Return all new refs
	var unmergedPtrs []data.BlockPointer
	for _, rmd := range unmergedRmds {
		for _, op := range rmd.data.Changes.Ops {
			for _, ptr := range op.Refs() {
				if ptr != data.ZeroPtr {
					unflushed, err := fbo.config.BlockServer().IsUnflushed(
						ctx, fbo.id(), ptr.ID)
					if err != nil {
						return nil, err
					}
					if !unflushed {
						unmergedPtrs = append(unmergedPtrs, ptr)
					}
				}
			}
			for _, update := range op.allUpdates() {
				if update.Ref != data.ZeroPtr {
					unflushed, err := fbo.config.BlockServer().IsUnflushed(
						ctx, fbo.id(), update.Ref.ID)
					if err != nil {
						return nil, err
					}
					if !unflushed {
						unmergedPtrs = append(unmergedPtrs, update.Ref)
					}
				}
			}
		}
	}

	return unmergedPtrs, nil
}

type pruningBehavior int

const (
	doPruneBranches pruningBehavior = iota
	moveJournalsAway
)

func (fbo *folderBranchOps) unstageLocked(ctx context.Context,
	lState *kbfssync.LockState, pruningBehavior pruningBehavior) error {
	fbo.mdWriterLock.AssertLocked(lState)

	// fetch all of my unstaged updates, and undo them one at a time
	unmergedBID, wasUnmergedBranch :=
		fbo.unmergedBID, fbo.isUnmergedLocked(lState)
	unmergedPtrs, err := fbo.undoUnmergedMDUpdatesLocked(ctx, lState)
	if err != nil {
		return err
	}

	// let the server know we no longer have need
	if wasUnmergedBranch && pruningBehavior == doPruneBranches {
		err = fbo.config.MDOps().PruneBranch(ctx, fbo.id(), unmergedBID)
		if err != nil {
			return err
		}
	} else if pruningBehavior == moveJournalsAway {
		jManager, err := GetJournalManager(fbo.config)
		if err != nil {
			return err
		}

		err = jManager.MoveAway(ctx, fbo.id())
		if err != nil {
			return err
		}
	}

	// now go forward in time, if possible
	err = fbo.getAndApplyMDUpdates(ctx, lState, nil,
		fbo.applyMDUpdatesLocked)
	if err != nil {
		return err
	}

	md, err := fbo.getSuccessorMDForWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	// Finally, create a resolutionOp with the newly-unref'd pointers.
	resOp := newResolutionOp()
	for _, ptr := range unmergedPtrs {
		resOp.AddUnrefBlock(ptr)
	}
	md.AddOp(resOp)

	bps, err := fbo.maybeUnembedAndPutBlocks(ctx, md)
	if err != nil {
		return err
	}

	return fbo.finalizeMDWriteLocked(ctx, lState, md, bps, NoExcl,
		func(md ImmutableRootMetadata) error {
			return fbo.notifyBatchLocked(ctx, lState, md)
		})
}

// TODO: remove once we have automatic conflict resolution
func (fbo *folderBranchOps) UnstageForTesting(
	ctx context.Context, folderBranch data.FolderBranch) (err error) {
	startTime, timer := fbo.startOp(ctx, "UnstageForTesting")
	defer func() {
		fbo.endOp(ctx, startTime, timer, "UnstageForTesting done: %+v", err)
	}()

	if folderBranch != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, folderBranch}
	}

	return runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()

		if !fbo.isUnmerged(lState) {
			// no-op
			return nil
		}

		if fbo.blocks.GetState(lState) != cleanState {
			return NotPermittedWhileDirtyError{}
		}

		// launch unstaging in a new goroutine, because we don't want to
		// use the provided context because upper layers might ignore our
		// notifications if we do.  But we still want to wait for the
		// context to cancel.
		c := make(chan error, 1)
		freshCtx, cancel := fbo.newCtxWithFBOID()
		defer cancel()
		fbo.log.CDebugf(freshCtx, "Launching new context for UnstageForTesting")
		fbo.goTracked(func() {
			lState := makeFBOLockState()
			c <- fbo.doMDWriteWithRetry(ctx, lState,
				func(lState *kbfssync.LockState) error {
					return fbo.unstageLocked(freshCtx, lState, doPruneBranches)
				})
		})

		select {
		case err := <-c:
			return err
		case <-ctx.Done():
			return ctx.Err()
		}
	})
}

// mdWriterLock must be taken by the caller.
func (fbo *folderBranchOps) rekeyLocked(ctx context.Context,
	lState *kbfssync.LockState, promptPaper bool) (res RekeyResult, err error) {
	startTime, timer := fbo.startOp(ctx, "rekeyLocked")
	defer func() {
		fbo.endOp(ctx, startTime, timer, "rekeyLocked done: %+v %+v", res, err)
	}()

	fbo.mdWriterLock.AssertLocked(lState)

	if fbo.isUnmergedLocked(lState) {
		return RekeyResult{}, errors.New("can't rekey while staged")
	}

	// untrusted head is ok here.
	head, _ := fbo.getHead(ctx, lState, mdNoCommit)
	if head != (ImmutableRootMetadata{}) {
		// If we already have a cached revision, make sure we're
		// up-to-date with the latest revision before inspecting the
		// metadata, since Rekey doesn't let us go into CR mode, and
		// we don't actually get folder update notifications when the
		// rekey bit is set, just a "folder needs rekey" update.
		if err := fbo.getAndApplyMDUpdates(
			ctx, lState, nil, fbo.applyMDUpdatesLocked); err != nil {
			if applyErr, ok := err.(kbfsmd.MDRevisionMismatch); !ok ||
				applyErr.Rev != applyErr.Curr {
				return RekeyResult{}, err
			}
		}

		head, _ = fbo.getHead(ctx, lState, mdNoCommit)
		if head.TypeForKeying() == tlf.TeamKeying {
			fbo.vlog.CLogf(ctx, libkb.VLog1, "A team TLF doesn't need a rekey")
			return RekeyResult{}, nil
		}
	}

	md, lastWriterVerifyingKey, rekeyWasSet, err :=
		fbo.getMDForRekeyWriteLocked(ctx, lState)
	if err != nil {
		return RekeyResult{}, err
	}
	if md == nil {
		fbo.log.CDebugf(ctx, "A team TLF doesn't need a rekey")
		return RekeyResult{}, nil
	}

	currKeyGen := md.LatestKeyGeneration()
	rekeyDone, tlfCryptKey, err := fbo.config.KeyManager().
		Rekey(ctx, md, promptPaper)

	stillNeedsRekey := false
	switch err.(type) {
	case nil:
		// TODO: implement a "forced" option that rekeys even when the
		// devices haven't changed?
		if !rekeyDone {
			fbo.log.CDebugf(ctx, "No rekey necessary")
			return RekeyResult{
				DidRekey:      false,
				NeedsPaperKey: false,
			}, nil
		}
		// Clear the rekey bit if any.
		md.clearRekeyBit()
		session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return RekeyResult{}, err
		}
		// Readers can't clear the last revision, because:
		// 1) They don't have access to the writer metadata, so can't clear the
		//    block changes.
		// 2) Readers need the kbfsmd.MetadataFlagWriterMetadataCopied bit set for
		//	  MDServer to authorize the write.
		// Without this check, MDServer returns an Unauthorized error.
		if md.GetTlfHandle().IsWriter(session.UID) {
			md.clearLastRevision()
		}

	case RekeyIncompleteError:
		if !rekeyDone && rekeyWasSet {
			// The rekey bit was already set, and there's nothing else
			// we can to do, so don't put any new revisions.
			fbo.log.CDebugf(ctx, "No further rekey possible by this user.")
			return RekeyResult{
				DidRekey:      false,
				NeedsPaperKey: false,
			}, nil
		}

		// Rekey incomplete, fallthrough without early exit, to ensure
		// we write the metadata with any potential changes
		fbo.log.CDebugf(ctx,
			"Rekeyed reader devices, but still need writer rekey")

	case NeedOtherRekeyError, NeedSelfRekeyError:
		stillNeedsRekey = true

	default:
		_, isInputCanceled := err.(libkb.InputCanceledError)
		if isInputCanceled || err == context.DeadlineExceeded {
			fbo.log.CDebugf(ctx, "Paper key prompt timed out")
			// Reschedule the prompt in the timeout case.
			stillNeedsRekey = true
		} else {
			return RekeyResult{}, err
		}
	}

	if stillNeedsRekey {
		fbo.log.CDebugf(ctx, "Device doesn't have access to rekey")
		// If we didn't have read access, then we don't have any
		// unlocked paper keys.  Wait for some time, and then if we
		// still aren't rekeyed, try again but this time prompt the
		// user for any known paper keys.  We do this even if the
		// rekey bit is already set, since we may have restarted since
		// the previous rekey attempt, before prompting for the paper
		// key.  Only schedule this as a one-time event, since direct
		// folder accesses from the user will also cause a
		// rekeyWithPrompt.

		if rekeyWasSet {
			// Devices not yet keyed shouldn't set the rekey bit again
			fbo.log.CDebugf(ctx, "Rekey bit already set")
			return RekeyResult{
				DidRekey:      rekeyDone,
				NeedsPaperKey: true,
			}, nil
		}
		// This device hasn't been keyed yet, fall through to set the rekey bit
	}

	// add an empty operation to satisfy assumptions elsewhere
	md.AddOp(newRekeyOp())

	// we still let readers push a new md block that we validate against reader
	// permissions
	err = fbo.finalizeMDRekeyWriteLocked(
		ctx, lState, md, lastWriterVerifyingKey)
	if err != nil {
		return RekeyResult{
			DidRekey:      rekeyDone,
			NeedsPaperKey: stillNeedsRekey,
		}, err
	}

	// cache any new TLF crypt key
	if tlfCryptKey != nil {
		keyGen := md.LatestKeyGeneration()
		err = fbo.config.KeyCache().PutTLFCryptKey(md.TlfID(), keyGen, *tlfCryptKey)
		if err != nil {
			return RekeyResult{
				DidRekey:      rekeyDone,
				NeedsPaperKey: stillNeedsRekey,
			}, err
		}
	}

	// send rekey finish notification
	handle := md.GetTlfHandle()
	if currKeyGen >= kbfsmd.FirstValidKeyGen && rekeyDone {
		fbo.config.Reporter().Notify(ctx,
			rekeyNotification(ctx, fbo.config, handle, true))
	}

	return RekeyResult{
		DidRekey:      rekeyDone,
		NeedsPaperKey: stillNeedsRekey,
	}, nil
}

func (fbo *folderBranchOps) RequestRekey(_ context.Context, tlf tlf.ID) {
	// Only the MasterBranch can be rekeyed.
	fb := data.FolderBranch{Tlf: tlf, Branch: data.MasterBranch}
	if fb != fbo.folderBranch {
		// TODO: log instead of panic?
		panic(WrongOpsError{fbo.folderBranch, fb})
	}
	fbo.rekeyFSM.Event(NewRekeyRequestEvent())
}

func (fbo *folderBranchOps) SyncFromServer(ctx context.Context,
	folderBranch data.FolderBranch, lockBeforeGet *keybase1.LockID) (err error) {
	startTime, timer := fbo.startOp(ctx, "SyncFromServer")
	defer func() {
		fbo.endOp(ctx, startTime, timer, "SyncFromServer done: %+v", err)
	}()

	if folderBranch != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, folderBranch}
	}

	lState := makeFBOLockState()

	// Make sure everything outstanding syncs to disk at least.
	if err := fbo.syncAllUnlocked(ctx, lState); err != nil {
		return err
	}

	// A journal flush before CR, if needed.
	if err := WaitForTLFJournal(ctx, fbo.config, fbo.id(),
		fbo.log); err != nil {
		return err
	}

	if err := fbo.mdFlushes.Wait(ctx); err != nil {
		return err
	}

	if err := fbo.branchChanges.Wait(ctx); err != nil {
		return err
	}

	// MDServer.IsConnected() takes some time to work when you get
	// disconnected from inside the network (as we do in a test).  To
	// get a quick result, force a reachability check with a short
	// timeout, and if it times out, assume we're disconnected.
	mdserver := fbo.config.MDServer()
	timeoutCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()
	mdserver.CheckReachability(timeoutCtx)
	timedOut := false
	select {
	case <-timeoutCtx.Done():
		timedOut = true
	default:
	}
	if lockBeforeGet == nil && (timedOut || !mdserver.IsConnected()) {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Not fetching new updates while offline")
		return nil
	}

	// Loop until we're fully updated on the master branch.
	for {
		if fbo.isUnmerged(lState) {
			if err := fbo.cr.Wait(ctx); err != nil {
				return err
			}
			// If we are still staged after the wait, then we have a problem.
			if fbo.isUnmerged(lState) {
				return &ErrStillStagedAfterCR{}
			}
		}

		dirtyFiles := fbo.blocks.GetDirtyFileBlockRefs(lState)
		if len(dirtyFiles) > 0 {
			for _, ref := range dirtyFiles {
				fbo.vlog.CLogf(ctx, libkb.VLog1, "DeCache entry left: %v", ref)
			}
			return errors.New("can't sync from server while dirty")
		}

		// A journal flush after CR, if needed.
		if err := WaitForTLFJournal(ctx, fbo.config, fbo.id(),
			fbo.log); err != nil {
			return err
		}

		if err := fbo.mdFlushes.Wait(ctx); err != nil {
			return err
		}

		if err := fbo.branchChanges.Wait(ctx); err != nil {
			return err
		}

		if err := fbo.getAndApplyMDUpdates(
			ctx, lState, lockBeforeGet, fbo.applyMDUpdates); err != nil {
			if applyErr, ok := err.(kbfsmd.MDRevisionMismatch); ok {
				if applyErr.Rev == applyErr.Curr {
					fbo.vlog.CLogf(
						ctx, libkb.VLog1, "Already up-to-date with server")
					return nil
				}
			}
			if _, isUnmerged := err.(UnmergedError); isUnmerged {
				continue
			} else if err == errNoMergedRevWhileStaged {
				continue
			}
			return err
		}
		break
	}

	// Wait for all the asynchronous block archiving and quota
	// reclamation to hit the block server.
	if err := fbo.fbm.waitForArchives(ctx); err != nil {
		return err
	}
	if err := fbo.fbm.waitForDeletingBlocks(ctx); err != nil {
		return err
	}

	// For tests where the service is offline, we can't wait forever
	// for the edit activity to complete.
	editCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()
	if err := fbo.editActivity.Wait(editCtx); err != nil {
		if err == context.DeadlineExceeded {
			fbo.log.CDebugf(ctx, "Couldn't wait for edit activity")
		} else {
			return err
		}
	}

	// Same with block-related activity, when the bserver might be offline.
	qrCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()
	if err := fbo.fbm.waitForQuotaReclamations(qrCtx); err != nil {
		if err == context.DeadlineExceeded {
			fbo.log.CDebugf(ctx, "Couldn't wait for qr activity")
		} else {
			return err
		}
	}
	cleanCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()
	if err := fbo.fbm.waitForDiskCacheCleans(cleanCtx); err != nil {
		if err == context.DeadlineExceeded {
			fbo.log.CDebugf(ctx, "Couldn't wait for disk clean activity")
		} else {
			return err
		}
	}
	if err := fbo.partialSyncs.Wait(ctx); err != nil {
		return err
	}

	// A second journal flush if needed, to clear out any
	// archive/remove calls caused by the above operations.
	return WaitForTLFJournal(ctx, fbo.config, fbo.id(), fbo.log)
}

// CtxFBOTagKey is the type used for unique context tags within folderBranchOps
type CtxFBOTagKey int

const (
	// CtxFBOIDKey is the type of the tag for unique operation IDs
	// within folderBranchOps.
	CtxFBOIDKey CtxFBOTagKey = iota
)

// CtxFBOOpID is the display name for the unique operation
// folderBranchOps ID tag.
const CtxFBOOpID = "FBOID"

func (fbo *folderBranchOps) ctxWithFBOID(ctx context.Context) context.Context {
	return CtxWithRandomIDReplayable(ctx, CtxFBOIDKey, CtxFBOOpID, fbo.log)
}

func (fbo *folderBranchOps) newCtxWithFBOIDWithCtx(ctx context.Context) (
	context.Context, context.CancelFunc) {
	// No need to call NewContextReplayable since ctxWithFBOID calls
	// ctxWithRandomIDReplayable, which attaches replayably.
	ctx = fbo.ctxWithFBOID(ctx)
	ctx, cancelFunc := context.WithCancel(ctx)
	ctx, err := libcontext.NewContextWithCancellationDelayer(ctx)
	if err != nil {
		panic(err)
	}
	return ctx, cancelFunc
}

func (fbo *folderBranchOps) newCtxWithFBOID() (
	context.Context, context.CancelFunc) {
	return fbo.newCtxWithFBOIDWithCtx(context.Background())
}

// Run the passed function with a context that's canceled on shutdown.
func (fbo *folderBranchOps) runUnlessShutdown(fn func(ctx context.Context) error) error {
	ctx, cancelFunc := fbo.newCtxWithFBOID()
	defer cancelFunc()
	errChan := make(chan error, 1)
	fbo.goTracked(func() {
		errChan <- fn(ctx)
	})

	select {
	case err := <-errChan:
		return err
	case <-fbo.shutdownChan:
		return data.ShutdownHappenedError{}
	}
}

func (fbo *folderBranchOps) doFastForwardLocked(ctx context.Context,
	lState *kbfssync.LockState, currHead ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)

	fbo.log.CDebugf(ctx, "Fast-forwarding from rev %d to rev %d",
		fbo.latestMergedRevision, currHead.Revision())
	changes, affectedNodeIDs, err := fbo.blocks.FastForwardAllNodes(
		ctx, lState, currHead.ReadOnly())
	if err != nil {
		return err
	}

	latestRootBlockFetch := fbo.kickOffRootBlockFetch(ctx, currHead)
	err = fbo.waitForRootBlockFetch(ctx, currHead, latestRootBlockFetch)
	if err != nil {
		return err
	}

	err = fbo.setHeadSuccessorLocked(ctx, lState, currHead, true /*rebase*/)
	if err != nil {
		return err
	}

	// Invalidate all the affected nodes.
	if len(changes) > 0 {
		fbo.observers.batchChanges(ctx, changes, affectedNodeIDs)
	}

	return nil
}

func (fbo *folderBranchOps) maybeFastForward(ctx context.Context,
	lState *kbfssync.LockState, lastUpdate time.Time, currUpdate time.Time) (
	fastForwardDone bool, err error) {
	// Has it been long enough to try fast-forwarding?
	if currUpdate.Before(lastUpdate.Add(fastForwardTimeThresh)) ||
		fbo.isUnmerged(lState) {
		return false, nil
	}

	fbo.vlog.CLogf(
		ctx, libkb.VLog1, "Checking head for possible "+
			"fast-forwarding (last update time=%s)", lastUpdate)
	currHead, err := fbo.config.MDOps().GetForTLF(ctx, fbo.id(), nil)
	if err != nil {
		return false, err
	}
	fbo.vlog.CLogf(
		ctx, libkb.VLog1, "Current head is revision %d", currHead.Revision())

	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	// Don't update while the in-memory state is dirty.
	if fbo.blocks.GetState(lState) != cleanState {
		return false, nil
	}

	// If the journal has anything in it, don't fast-forward since we
	// haven't finished flushing yet.  If there was really a remote
	// update on the server, we'll end up in CR eventually.
	mergedRev, err := fbo.getJournalPredecessorRevision(ctx)
	if err != nil {
		return false, err
	}
	if mergedRev != kbfsmd.RevisionUninitialized {
		return false, nil
	}

	if fbo.isUnmergedLocked(lState) {
		// Don't update if we're staged.
		return false, nil
	}

	// Kick off partial prefetching once the latest merged
	// revision is set.
	defer func() {
		if err == nil {
			fbo.kickOffPartialSyncIfNeeded(ctx, lState, currHead)
		}
	}()

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)

	if currHead.Revision() < fbo.latestMergedRevision+fastForwardRevThresh {
		// Might as well fetch all the revisions.
		return false, nil
	}

	err = fbo.doFastForwardLocked(ctx, lState, currHead)
	if err != nil {
		return false, err
	}
	return true, nil
}

func (fbo *folderBranchOps) locallyFinalizeTLF(ctx context.Context) {
	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)

	if fbo.head == (ImmutableRootMetadata{}) {
		return
	}

	// It's safe to give this a finalized number of 1 and a fake user
	// name.  The whole point here is to move the old finalized TLF
	// name away to a new name, where the user won't be able to access
	// it anymore, and if there's a conflict with a previously-moved
	// TLF that shouldn't matter.
	now := fbo.config.Clock().Now()
	finalizedInfo, err := tlf.NewHandleExtension(
		tlf.HandleExtensionFinalized, 1, kbname.NormalizedUsername("<unknown>"),
		now)
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't make finalized info: %+v", err)
		return
	}

	fakeSignedHead := &RootMetadataSigned{RootMetadataSigned: kbfsmd.RootMetadataSigned{MD: fbo.head.bareMd}}
	finalRmd, err := fakeSignedHead.MakeFinalCopy(
		fbo.config.Codec(), now, finalizedInfo)
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't finalize MD: %+v", err)
		return
	}

	// Construct the data needed to fake a new head.
	mdID, err := kbfsmd.MakeID(fbo.config.Codec(), finalRmd.MD)
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't get finalized MD ID: %+v", err)
		return
	}
	bareHandle, err := finalRmd.MD.MakeBareTlfHandle(fbo.head.Extra())
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't get finalized bare handle: %+v", err)
		return
	}
	handle, err := tlfhandle.MakeHandle(
		ctx, bareHandle, fbo.id().Type(), fbo.config.KBPKI(),
		fbo.config.KBPKI(), fbo.config.MDOps(), fbo.oa())
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't get finalized handle: %+v", err)
		return
	}
	finalBrmd, ok := finalRmd.MD.(kbfsmd.MutableRootMetadata)
	if !ok {
		fbo.log.CErrorf(ctx, "Couldn't get finalized mutable bare MD: %+v", err)
		return
	}

	// We don't have a way to sign this with a valid key (and we might
	// be logged out anyway), so just directly make the md immutable.
	finalIrmd := ImmutableRootMetadata{
		ReadOnlyRootMetadata: makeRootMetadata(
			finalBrmd, fbo.head.Extra(), handle).ReadOnly(),
		mdID: mdID,
	}

	// This will trigger the handle change notification to observers.
	err = fbo.setHeadSuccessorLocked(ctx, lState, finalIrmd, false)
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't set finalized MD: %+v", err)
		return
	}
}

func (fbo *folderBranchOps) registerAndWaitForUpdates() {
	defer close(fbo.updateDoneChan)
	childDone := make(chan struct{})
	var lastUpdate time.Time
	err := fbo.runUnlessShutdown(func(ctx context.Context) error {
		defer close(childDone)
		// If we fail to register for or process updates, try again
		// with an exponential backoff, so we don't overwhelm the
		// server or ourselves with too many attempts in a hopeless
		// situation.
		expBackoff := backoff.NewExponentialBackOff()
		// Never give up hope until we shut down
		expBackoff.MaxElapsedTime = 0
		// Register and wait in a loop unless we hit an unrecoverable error
		fbo.cancelUpdatesLock.Lock()
		if fbo.cancelUpdates != nil {
			// It should be impossible to get here without having
			// already called the cancel function, but just in case
			// call it here again.
			fbo.cancelUpdates()
		}
		ctx, fbo.cancelUpdates = context.WithCancel(ctx)
		fbo.cancelUpdatesLock.Unlock()
		for {
			err := backoff.RetryNotifyWithContext(ctx, func() error {
				// Replace the FBOID one with a fresh id for every attempt
				newCtx := fbo.ctxWithFBOID(ctx)
				updateChan, err := fbo.registerForUpdates(newCtx)
				if err != nil {
					select {
					case <-ctx.Done():
						// Shortcut the retry, we're done.
						return nil
					default:
						return err
					}
				}

				currUpdate, err := fbo.waitForAndProcessUpdates(
					newCtx, lastUpdate, updateChan)
				switch errors.Cause(err).(type) {
				case UnmergedError:
					// skip the back-off timer and continue directly to next
					// registerForUpdates
					return nil
				case kbfsmd.NewMetadataVersionError:
					fbo.log.CDebugf(ctx, "Abandoning updates since we can't "+
						"read the newest metadata: %+v", err)
					fbo.status.setPermErr(err)
					// No need to lock here, since `cancelUpdates` is
					// only set within this same goroutine.
					fbo.cancelUpdates()
					return context.Canceled
				case kbfsmd.ServerErrorCannotReadFinalizedTLF:
					fbo.log.CDebugf(ctx, "Abandoning updates since we can't "+
						"read the finalized metadata for this TLF: %+v", err)
					fbo.status.setPermErr(err)

					// Locally finalize the TLF so new accesses
					// through to the old folder name will find the
					// new folder.
					fbo.locallyFinalizeTLF(newCtx)

					// No need to lock here, since `cancelUpdates` is
					// only set within this same goroutine.
					fbo.cancelUpdates()
					return context.Canceled
				}
				select {
				case <-ctx.Done():
					// Shortcut the retry, we're done.
					return nil
				default:
					if err == nil {
						lastUpdate = currUpdate
					}
					return err
				}
			},
				expBackoff,
				func(err error, nextTime time.Duration) {
					fbo.log.CDebugf(ctx,
						"Retrying registerForUpdates in %s due to err: %v",
						nextTime, err)
				})
			if err != nil {
				return err
			}
		}
	})

	if err != nil && err != context.Canceled {
		fbo.log.CWarningf(context.Background(),
			"registerAndWaitForUpdates failed unexpectedly with an error: %v",
			err)
	}
	<-childDone
}

func (fbo *folderBranchOps) registerForUpdatesShouldFireNow() bool {
	fbo.muLastGetHead.Lock()
	defer fbo.muLastGetHead.Unlock()
	return fbo.config.Clock().Now().Sub(fbo.lastGetHead) < registerForUpdatesFireNowThreshold
}

func (fbo *folderBranchOps) registerForUpdates(ctx context.Context) (
	updateChan <-chan error, err error) {
	lState := makeFBOLockState()
	currRev := fbo.getLatestMergedRevision(lState)

	fireNow := false
	if fbo.registerForUpdatesShouldFireNow() {
		ctx = rpc.WithFireNow(ctx)
		fireNow = true
	}

	startTime, timer := fbo.startOp(
		ctx, "Registering for updates (curr rev = %d, fire now = %v)",
		currRev, fireNow)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer,
			"Registering for updates (curr rev = %d, fire now = %v) done: %+v",
			currRev, fireNow, err)
	}()
	// RegisterForUpdate will itself retry on connectivity issues
	return fbo.config.MDServer().RegisterForUpdate(ctx, fbo.id(), currRev)
}

func (fbo *folderBranchOps) waitForAndProcessUpdates(
	ctx context.Context, lastUpdate time.Time,
	updateChan <-chan error) (currUpdate time.Time, err error) {
	// successful registration; now, wait for an update or a shutdown
	fbo.vlog.CLogf(ctx, libkb.VLog1, "Waiting for updates")
	defer func() {
		fbo.deferLogIfErr(ctx, err, "Waiting for updates done: %+v", err)
	}()

	lState := makeFBOLockState()

	for {
		select {
		case err := <-updateChan:
			fbo.vlog.CLogf(ctx, libkb.VLog1, "Got an update: %v", err)
			if err != nil {
				return time.Time{}, err
			}
			// Getting and applying the updates requires holding
			// locks, so make sure it doesn't take too long.
			ctx, cancel := context.WithTimeout(ctx, data.BackgroundTaskTimeout)
			defer cancel()

			currUpdate := fbo.config.Clock().Now()
			ffDone, err :=
				fbo.maybeFastForward(ctx, lState, lastUpdate, currUpdate)
			if err != nil {
				return time.Time{}, err
			}
			if ffDone {
				return currUpdate, nil
			}

			err = fbo.getAndApplyMDUpdates(ctx, lState, nil, fbo.applyMDUpdates)
			if err != nil {
				fbo.log.CDebugf(ctx, "Got an error while applying "+
					"updates: %v", err)
				return time.Time{}, err
			}
			return currUpdate, nil
		case unpause := <-fbo.updatePauseChan:
			fbo.log.CInfof(ctx, "Updates paused")
			// wait to be unpaused
			select {
			case <-unpause:
				fbo.log.CInfof(ctx, "Updates unpaused")
			case <-ctx.Done():
				return time.Time{}, ctx.Err()
			}
		case <-ctx.Done():
			return time.Time{}, ctx.Err()
		}
	}
}

func (fbo *folderBranchOps) getCachedDirOpsCount(
	lState *kbfssync.LockState) int {
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	return len(fbo.dirOps)
}

func (fbo *folderBranchOps) backgroundFlusher() {
	lState := makeFBOLockState()
	var prevDirtyFileMap map[data.BlockRef]bool
	sameDirtyFileCount := 0
	for {
		doSelect := true
		if fbo.blocks.GetState(lState) == dirtyState &&
			fbo.config.DirtyBlockCache().ShouldForceSync(fbo.id()) &&
			sameDirtyFileCount < 10 {
			// We have dirty files, and the system has a full buffer,
			// so don't bother waiting for a signal, just get right to
			// the main attraction.
			doSelect = false
		} else if fbo.getCachedDirOpsCount(lState) >=
			fbo.config.BGFlushDirOpBatchSize() {
			doSelect = false
		}

		if doSelect {
			// Wait until we really have a write waiting.
			doWait := true
			select {
			case <-fbo.syncNeededChan:
				if fbo.getCachedDirOpsCount(lState) >=
					fbo.config.BGFlushDirOpBatchSize() {
					doWait = false
				}
			case <-fbo.forceSyncChan:
				doWait = false
			case <-fbo.shutdownChan:
				return
			}

			if doWait {
				timer := time.NewTimer(fbo.config.BGFlushPeriod())
				// Loop until either a tick's worth of time passes,
				// the batch size of directory ops is full, a sync is
				// forced, or a shutdown happens.
			loop:
				for {
					select {
					case <-timer.C:
						break loop
					case <-fbo.syncNeededChan:
						if fbo.getCachedDirOpsCount(lState) >=
							fbo.config.BGFlushDirOpBatchSize() {
							break loop
						}
					case <-fbo.forceSyncChan:
						break loop
					case <-fbo.shutdownChan:
						return
					}
				}
			}
		}

		dirtyFiles := fbo.blocks.GetDirtyFileBlockRefs(lState)
		dirOpsCount := fbo.getCachedDirOpsCount(lState)
		if len(dirtyFiles) == 0 && dirOpsCount == 0 {
			sameDirtyFileCount = 0
			continue
		}

		// Make sure we are making some progress
		currDirtyFileMap := make(map[data.BlockRef]bool)
		for _, ref := range dirtyFiles {
			currDirtyFileMap[ref] = true
		}
		if reflect.DeepEqual(currDirtyFileMap, prevDirtyFileMap) {
			sameDirtyFileCount++
		} else {
			sameDirtyFileCount = 0
		}
		prevDirtyFileMap = currDirtyFileMap

		_ = fbo.runUnlessShutdown(func(ctx context.Context) (err error) {
			// Denote that these are coming from a background
			// goroutine, not directly from any user.
			ctx = libcontext.NewContextReplayable(ctx,
				func(ctx context.Context) context.Context {
					return context.WithValue(ctx, CtxBackgroundSyncKey, "1")
				})

			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Background sync triggered: %d dirty files, "+
					"%d dir ops in batch", len(dirtyFiles), dirOpsCount)

			if sameDirtyFileCount >= 100 {
				// If the local journal is full, we might not be able to
				// make progress until more data is flushed to the
				// servers, so just warn here rather than just an outright
				// panic.
				fbo.log.CWarningf(ctx, "Making no Sync progress on dirty "+
					"files after %d attempts: %v", sameDirtyFileCount,
					dirtyFiles)
			}

			// Just in case network access or a bug gets stuck for a
			// long time, time out the sync eventually.
			longCtx, longCancel :=
				context.WithTimeout(ctx, data.BackgroundTaskTimeout)
			defer longCancel()
			err = fbo.SyncAll(longCtx, fbo.folderBranch)
			if err != nil {
				// Just log the warning and keep trying to
				// sync the rest of the dirty files.
				fbo.log.CWarningf(ctx, "Couldn't sync all: %+v", err)
			}
			return nil
		})
	}
}

func (fbo *folderBranchOps) blockUnmergedWrites(lState *kbfssync.LockState) {
	fbo.mdWriterLock.Lock(lState)
}

func (fbo *folderBranchOps) unblockUnmergedWrites(lState *kbfssync.LockState) {
	fbo.mdWriterLock.Unlock(lState)
}

func (fbo *folderBranchOps) finalizeResolutionLocked(ctx context.Context,
	lState *kbfssync.LockState, md *RootMetadata, bps blockPutState,
	newOps []op, blocksToDelete []kbfsblock.ID) error {
	fbo.mdWriterLock.AssertLocked(lState)

	// Put the blocks into the cache so that, even if we fail below,
	// future attempts may reuse the blocks.
	err := fbo.finalizeBlocks(ctx, bps)
	if err != nil {
		return err
	}

	// Last chance to get pre-empted.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}
	irmd, err := fbo.config.MDOps().ResolveBranch(
		ctx, fbo.id(), fbo.unmergedBID, blocksToDelete, md,
		session.VerifyingKey, bps)
	md = irmd.ReadOnlyRootMetadata.RootMetadata // un-read-onlyify
	doUnmergedPut := isRevisionConflict(err)
	if doUnmergedPut {
		fbo.log.CDebugf(ctx, "Got a conflict after resolution; aborting CR")
		return err
	}
	if err != nil {
		return err
	}

	// Queue a rekey if the bit was set.
	if md.IsRekeySet() {
		defer fbo.config.RekeyQueue().Enqueue(md.TlfID())
	}

	// Set the head to the new MD.
	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	err = fbo.setHeadConflictResolvedLocked(ctx, lState, irmd)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't set local MD head after a "+
			"successful put: %v", err)
		return err
	}
	fbo.setBranchIDLocked(lState, kbfsmd.NullBranchID)

	if TLFJournalEnabled(fbo.config, fbo.id()) {
		// Send unflushed notifications if journaling is on.
		err := fbo.handleUnflushedEditNotifications(ctx, irmd)
		if err != nil {
			fbo.log.CWarningf(ctx, "Couldn't send unflushed edit "+
				"notifications for revision %d: %+v", irmd.Revision(), err)
		}
	} else {
		// Send edit notifications and archive the old, unref'd blocks
		// if journaling is off.
		fbo.editActivity.Add(1)
		fbo.goTracked(func() {
			defer fbo.editActivity.Done()
			ctx, cancelFunc := fbo.newCtxWithFBOID()
			defer cancelFunc()
			err := fbo.handleEditNotifications(ctx, irmd)
			if err != nil {
				fbo.log.CWarningf(ctx, "Couldn't send edit notifications for "+
					"revision %d: %+v", irmd.Revision(), err)
			}
		})
		fbo.fbm.archiveUnrefBlocks(irmd.ReadOnly())
	}

	mdCopyWithLocalOps, err := md.deepCopy(fbo.config.Codec())
	if err != nil {
		return err
	}
	mdCopyWithLocalOps.data.Changes.Ops = newOps

	// notifyOneOp for every fixed-up merged op.
	for _, op := range newOps {
		err := fbo.notifyOneOpLocked(
			ctx, lState, op, mdCopyWithLocalOps.ReadOnly(), false)
		if err != nil {
			return err
		}
	}
	return nil
}

// finalizeResolution caches all the blocks, and writes the new MD to
// the merged branch, failing if there is a conflict.  It also sends
// out the given newOps notifications locally.  This is used for
// completing conflict resolution.
func (fbo *folderBranchOps) finalizeResolution(ctx context.Context,
	lState *kbfssync.LockState, md *RootMetadata, bps blockPutState,
	newOps []op, blocksToDelete []kbfsblock.ID) error {
	// Take the writer lock.
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	return fbo.finalizeResolutionLocked(
		ctx, lState, md, bps, newOps, blocksToDelete)
}

func (fbo *folderBranchOps) handleTLFBranchChange(ctx context.Context,
	newBID kbfsmd.BranchID) {
	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)

	fbo.log.CDebugf(ctx, "Journal branch change: %s", newBID)

	if fbo.isUnmergedLocked(lState) {
		if fbo.unmergedBID == newBID {
			fbo.vlog.CLogf(ctx, libkb.VLog1, "Already on branch %s", newBID)
			return
		}
		panic(fmt.Sprintf("Cannot switch to branch %s while on branch %s",
			newBID, fbo.unmergedBID))
	}

	md, err := fbo.config.MDOps().GetUnmergedForTLF(ctx, fbo.id(), newBID)
	if err != nil {
		fbo.log.CWarningf(ctx,
			"No unmerged head on journal branch change (bid=%s)", newBID)
		return
	}

	if md == (ImmutableRootMetadata{}) || md.MergedStatus() != kbfsmd.Unmerged ||
		md.BID() != newBID {
		// This can happen if CR got kicked off in some other way and
		// completed before we took the lock to process this
		// notification.
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Ignoring stale branch change: md=%v, newBID=%d",
			md, newBID)
		return
	}

	// Everything we thought we knew about quota reclamation is now
	// called into question.
	fbo.fbm.clearLastQRData()

	// Kick off conflict resolution and set the head to the correct branch.
	fbo.setBranchIDLocked(lState, newBID)
	fbo.cr.Resolve(ctx, md.Revision(), kbfsmd.RevisionUninitialized)

	// Fixup the edit history unflushed state.
	fbo.editHistory.ClearAllUnflushed()
	err = fbo.handleUnflushedEditNotifications(ctx, md)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't send unflushed edit "+
			"notifications for revision %d: %+v", md.Revision(), err)
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	err = fbo.setHeadSuccessorLocked(ctx, lState, md, true /*rebased*/)
	if err != nil {
		fbo.log.CWarningf(ctx,
			"Could not set head on journal branch change: %v", err)
		return
	}
}

func (fbo *folderBranchOps) onTLFBranchChange(newBID kbfsmd.BranchID) {
	fbo.branchChanges.Add(1)

	fbo.goTracked(func() {
		defer fbo.branchChanges.Done()
		ctx, cancelFunc := fbo.newCtxWithFBOID()
		defer cancelFunc()

		// This only happens on a `PruneBranch` call, in which case we
		// would have already updated fbo's local view of the branch/head.
		if newBID == kbfsmd.NullBranchID {
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Ignoring branch change back to master")
			return
		}

		fbo.handleTLFBranchChange(ctx, newBID)
	})
}

func (fbo *folderBranchOps) handleMDFlush(
	ctx context.Context, rev kbfsmd.Revision) {
	fbo.vlog.CLogf(
		ctx, libkb.VLog1,
		"Considering archiving references for flushed MD revision %d", rev)

	lState := makeFBOLockState()
	var latestMergedUpdated <-chan struct{}
	func() {
		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)
		fbo.setLatestMergedRevisionLocked(ctx, lState, rev, false)
		latestMergedUpdated = fbo.latestMergedUpdated
	}()

	// Get that revision.
	rmd, err := getSingleMD(ctx, fbo.config, fbo.id(), kbfsmd.NullBranchID,
		rev, kbfsmd.Merged, nil)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't get revision %d for archiving: %v",
			rev, err)
		return
	}

	rmd, err = reembedBlockChangesIntoCopyIfNeeded(
		ctx, fbo.config.Codec(), fbo.config.BlockCache(),
		fbo.config.BlockOps(), fbo.config.Mode(), rmd, fbo.log)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't reembed revision %d: %v",
			rev, err)
		return
	}

	err = fbo.handleEditNotifications(ctx, rmd)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't send edit notifications for "+
			"revision %d: %+v", rev, err)
	}

	fbo.editHistory.FlushRevision(rev)
	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, fbo.config.KBPKI(), true)
	if err != nil {
		fbo.log.CWarningf(ctx, "Error getting session: %+v", err)
	}
	tlfName := rmd.GetTlfHandle().GetCanonicalName()
	fbo.config.UserHistory().UpdateHistory(
		tlfName, fbo.id().Type(), fbo.editHistory, string(session.Name))

	if err := isArchivableMDOrError(rmd.ReadOnly()); err != nil {
		fbo.log.CDebugf(
			ctx, "Skipping archiving references for flushed MD revision %d: %s", rev, err)
		return
	}
	fbo.fbm.archiveUnrefBlocks(rmd.ReadOnly())

	fbo.goTracked(func() { fbo.commitFlushedMD(rmd, latestMergedUpdated) })
}

func (fbo *folderBranchOps) onMDFlush(
	unmergedBID kbfsmd.BranchID, rev kbfsmd.Revision) {
	fbo.mdFlushes.Add(1)

	fbo.goTracked(func() {
		defer fbo.mdFlushes.Done()
		ctx, cancelFunc := fbo.newCtxWithFBOID()
		defer cancelFunc()

		if unmergedBID != kbfsmd.NullBranchID {
			fbo.vlog.CLogf(
				ctx, libkb.VLog1, "Ignoring MD flush on branch %v for "+
					"revision %d", unmergedBID, rev)
			return
		}

		fbo.handleMDFlush(ctx, rev)
	})
}

// TeamNameChanged implements the KBFSOps interface for folderBranchOps
func (fbo *folderBranchOps) TeamNameChanged(
	ctx context.Context, tid keybase1.TeamID) {
	ctx, cancelFunc := fbo.newCtxWithFBOIDWithCtx(ctx)
	defer cancelFunc()

	fbo.vlog.CLogf(ctx, libkb.VLog1, "Starting name change for team %s", tid)

	// First check if this is an implicit team.
	var newName kbname.NormalizedUsername
	if fbo.id().Type() != tlf.SingleTeam {
		iteamInfo, err := fbo.config.KBPKI().ResolveImplicitTeamByID(
			ctx, tid, fbo.id().Type(), fbo.oa())
		if err == nil {
			newName = iteamInfo.Name
		}
	}

	if newName == "" {
		var err error
		newName, err = fbo.config.KBPKI().GetNormalizedUsername(
			ctx, tid.AsUserOrTeam(), fbo.oa())
		if err != nil {
			fbo.log.CWarningf(ctx, "Error getting new team name: %+v", err)
			return
		}
	}

	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)

	if fbo.head == (ImmutableRootMetadata{}) {
		fbo.log.CWarningf(ctx, "No head to update")
		return
	}

	oldHandle := fbo.head.GetTlfHandle()

	if string(oldHandle.GetCanonicalName()) == string(newName) {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1, "Name didn't change: %s", newName)
		return
	}

	if oldHandle.FirstResolvedWriter() != tid.AsUserOrTeam() {
		fbo.log.CWarningf(ctx,
			"Old handle doesn't include changed team ID: %s",
			oldHandle.FirstResolvedWriter())
		return
	}

	// Make a copy of `head` with the new handle.
	newHandle := oldHandle.DeepCopy()
	newHandle.SetName(tlf.CanonicalName(newName))
	newHandle.SetResolvedWriter(tid.AsUserOrTeam(), newName)
	newHead, err := fbo.head.deepCopy(fbo.config.Codec())
	if err != nil {
		fbo.log.CWarningf(ctx, "Error copying head: %+v", err)
		return
	}
	newHead.tlfHandle = newHandle

	fbo.log.CDebugf(ctx, "Team name changed from %s to %s",
		oldHandle.GetCanonicalName(), newHandle.GetCanonicalName())
	fbo.head = MakeImmutableRootMetadata(
		newHead, fbo.head.lastWriterVerifyingKey, fbo.head.mdID,
		fbo.head.localTimestamp, fbo.head.putToServer)

	fbo.config.MDCache().ChangeHandleForID(oldHandle, newHandle)
	fbo.observers.tlfHandleChange(ctx, newHandle)
}

// TeamAbandoned implements the KBFSOps interface for folderBranchOps.
func (fbo *folderBranchOps) TeamAbandoned(
	ctx context.Context, tid keybase1.TeamID) {
	ctx, cancelFunc := fbo.newCtxWithFBOIDWithCtx(ctx)
	defer cancelFunc()
	fbo.log.CDebugf(ctx, "Abandoning team %s", tid)
	fbo.locallyFinalizeTLF(ctx)
}

func (fbo *folderBranchOps) getMDForMigrationLocked(
	ctx context.Context, lState *kbfssync.LockState) (
	ImmutableRootMetadata, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	md, err := fbo.getMDForWriteOrRekeyLocked(ctx, lState, mdRekey)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	// Only writers may migrate TLFs.
	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	isWriter, err := md.IsWriter(
		ctx, fbo.config.KBPKI(), fbo.config, session.UID, session.VerifyingKey)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if !isWriter {
		return ImmutableRootMetadata{}, tlfhandle.NewWriteAccessError(
			md.GetTlfHandle(), session.Name, "")
	}

	return md, nil
}

// MigrateToImplicitTeam implements the KBFSOps interface for folderBranchOps.
func (fbo *folderBranchOps) MigrateToImplicitTeam(
	ctx context.Context, id tlf.ID) (err error) {
	// Only MasterBranch FBOs may be migrated.
	fb := data.FolderBranch{Tlf: id, Branch: data.MasterBranch}
	if fb != fbo.folderBranch {
		// TODO: log instead of panic?
		panic(WrongOpsError{fbo.folderBranch, fb})
	}

	fbo.log.CDebugf(ctx, "Starting migration of TLF %s", id)
	defer func() {
		fbo.deferLog.CDebugf(
			ctx, "Finished migration of TLF %s, err=%+v", id, err)
	}()

	if id.Type() != tlf.Private && id.Type() != tlf.Public {
		return errors.Errorf("Cannot migrate a TLF of type: %s", id.Type())
	}

	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)

	md, err := fbo.getMDForMigrationLocked(ctx, lState)
	if err != nil {
		return err
	}

	if md == (ImmutableRootMetadata{}) {
		fbo.log.CDebugf(ctx, "Nothing to upgrade")
		return nil
	}

	if md.IsFinal() {
		fbo.log.CDebugf(ctx, "No need to upgrade a finalized TLF")
		return nil
	}

	if md.TypeForKeying() == tlf.TeamKeying {
		fbo.log.CDebugf(ctx, "Already migrated")
		return nil
	}

	name := string(md.GetTlfHandle().GetCanonicalName())
	fbo.log.CDebugf(ctx, "Looking up implicit team for %s", name)
	newHandle, err := tlfhandle.ParseHandle(
		ctx, fbo.config.KBPKI(), fbo.config.MDOps(), fbo.config,
		name, id.Type())
	if err != nil {
		return err
	}

	// Make sure the new handle contains just a team.
	if newHandle.TypeForKeying() != tlf.TeamKeying {
		return errors.New("No corresponding implicit team yet")
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	isWriter := true // getMDForMigrationLocked already checked this.
	newMD, err := md.MakeSuccessorWithNewHandle(
		ctx, newHandle, fbo.config.MetadataVersion(), fbo.config.Codec(),
		fbo.config.KeyManager(), fbo.config.KBPKI(), fbo.config.KBPKI(),
		fbo.config, md.mdID, isWriter)
	if err != nil {
		return err
	}

	if newMD.TypeForKeying() != tlf.TeamKeying {
		return errors.New("Migration failed")
	}

	// Add an empty operation to satisfy assumptions elsewhere.
	newMD.AddOp(newRekeyOp())

	return fbo.finalizeMDRekeyWriteLocked(
		ctx, lState, newMD, session.VerifyingKey)
}

// GetUpdateHistory implements the KBFSOps interface for folderBranchOps
func (fbo *folderBranchOps) GetUpdateHistory(ctx context.Context,
	folderBranch data.FolderBranch) (history TLFUpdateHistory, err error) {
	startTime, timer := fbo.startOp(ctx, "GetUpdateHistory")
	defer func() {
		fbo.endOp(ctx, startTime, timer, "GetUpdateHistory done: %+v", err)
	}()

	if folderBranch != fbo.folderBranch {
		return TLFUpdateHistory{}, WrongOpsError{fbo.folderBranch, folderBranch}
	}

	rmds, err := getMergedMDUpdates(ctx, fbo.config, fbo.id(),
		kbfsmd.RevisionInitial, nil)
	if err != nil {
		return TLFUpdateHistory{}, err
	}

	if len(rmds) > 0 {
		rmd := rmds[len(rmds)-1]
		history.ID = rmd.TlfID().String()
		history.Name = rmd.GetTlfHandle().GetCanonicalPath()
	}
	history.Updates = make([]UpdateSummary, 0, len(rmds))
	writerNames := make(map[keybase1.UID]string)
	for _, rmd := range rmds {
		writer, ok := writerNames[rmd.LastModifyingWriter()]
		if !ok {
			name, err := fbo.config.KBPKI().GetNormalizedUsername(
				ctx, rmd.LastModifyingWriter().AsUserOrTeam(), fbo.oa())
			if err != nil {
				return TLFUpdateHistory{}, err
			}
			writer = string(name)
			writerNames[rmd.LastModifyingWriter()] = writer
		}
		updateSummary := UpdateSummary{
			Revision:  rmd.Revision(),
			Date:      rmd.localTimestamp,
			Writer:    writer,
			LiveBytes: rmd.DiskUsage(),
			Ops:       make([]OpSummary, 0, len(rmd.data.Changes.Ops)),
		}
		for _, op := range rmd.data.Changes.Ops {
			opSummary := OpSummary{
				Op:      op.String(),
				Refs:    make([]string, 0, len(op.Refs())),
				Unrefs:  make([]string, 0, len(op.Unrefs())),
				Updates: make(map[string]string),
			}
			for _, ptr := range op.Refs() {
				opSummary.Refs = append(opSummary.Refs, ptr.String())
			}
			for _, ptr := range op.Unrefs() {
				opSummary.Unrefs = append(opSummary.Unrefs, ptr.String())
			}
			for _, update := range op.allUpdates() {
				opSummary.Updates[update.Unref.String()] = update.Ref.String()
			}
			updateSummary.Ops = append(updateSummary.Ops, opSummary)
		}
		history.Updates = append(history.Updates, updateSummary)
	}
	return history, nil
}

// GetEditHistory implements the KBFSOps interface for folderBranchOps
func (fbo *folderBranchOps) GetEditHistory(
	ctx context.Context, _ data.FolderBranch) (
	tlfHistory keybase1.FSFolderEditHistory, err error) {
	// Wait for any outstanding edit requests.
	if err := fbo.editActivity.Wait(ctx); err != nil {
		return keybase1.FSFolderEditHistory{}, err
	}

	lState := makeFBOLockState()
	md, _ := fbo.getHead(ctx, lState, mdNoCommit)
	name := md.GetTlfHandle().GetCanonicalName()
	return fbo.config.UserHistory().GetTlfHistory(name, fbo.id().Type()), nil
}

// PushStatusChange forces a new status be fetched by status listeners.
func (fbo *folderBranchOps) PushStatusChange() {
	fbo.config.KBFSOps().PushStatusChange()
}

// ClearPrivateFolderMD implements the KBFSOps interface for
// folderBranchOps.
func (fbo *folderBranchOps) ClearPrivateFolderMD(ctx context.Context) {
	func() {
		// Cancel the edits goroutine and forget the old history, even
		// for public folders, since some of the state in the history
		// is dependent on your login state.
		fbo.editsLock.Lock()
		defer fbo.editsLock.Unlock()
		if fbo.cancelEdits != nil {
			fbo.cancelEdits()
			fbo.cancelEdits = nil
		}
		fbo.editHistory = kbfsedits.NewTlfHistory()
		// Allow the edit monitor to be re-launched later whenever the
		// MD is set again.
		fbo.launchEditMonitor = sync.Once{}
		fbo.convLock.Lock()
		defer fbo.convLock.Unlock()
		fbo.convID = nil
	}()

	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)

	fbo.blocks.ClearChargedTo(lState)

	if fbo.folderBranch.Tlf.Type() == tlf.Public {
		return
	}

	if fbo.head == (ImmutableRootMetadata{}) {
		// Nothing to clear.
		return
	}

	fbo.log.CDebugf(ctx, "Clearing folder MD")

	// First cancel the background goroutine that's registered for
	// updates, because the next time we set the head in this FBO
	// we'll launch another one.
	fbo.cancelUpdatesLock.Lock()
	defer fbo.cancelUpdatesLock.Unlock()
	if fbo.cancelUpdates != nil {
		fbo.cancelUpdates()
		select {
		case <-fbo.updateDoneChan:
		case <-ctx.Done():
			fbo.log.CDebugf(
				ctx, "Context canceled before updater was canceled")
			return
		}
		fbo.config.MDServer().CancelRegistration(ctx, fbo.id())
	}

	fbo.head = ImmutableRootMetadata{}
	fbo.headStatus = headUntrusted
	fbo.latestMergedRevision = kbfsmd.RevisionUninitialized
	fbo.hasBeenCleared = true

	// Clear the log obfuscation secret as well, so it can be re-set
	// when the head is re-established.
	fbo.obLock.Lock()
	defer fbo.obLock.Unlock()
	fbo.obSecret = nil
}

// ForceFastForward implements the KBFSOps interface for
// folderBranchOps.
func (fbo *folderBranchOps) ForceFastForward(ctx context.Context) {
	lState := makeFBOLockState()
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)
	if fbo.head != (ImmutableRootMetadata{}) {
		// We're already up to date.
		return
	}
	if !fbo.hasBeenCleared {
		// No reason to fast-forward here if it hasn't ever been
		// cleared.
		return
	}
	fbo.hasBeenCleared = false

	fbo.forcedFastForwards.Add(1)
	fbo.goTracked(func() {
		defer fbo.forcedFastForwards.Done()
		ctx, cancelFunc := fbo.newCtxWithFBOID()
		defer cancelFunc()

		fbo.log.CDebugf(ctx, "Forcing a fast-forward")
		var currHead ImmutableRootMetadata
		var err error
	getMD:
		for i := 0; ; i++ {
			currHead, err = fbo.config.MDOps().GetForTLF(ctx, fbo.id(), nil)
			switch errors.Cause(err).(type) {
			case nil:
				break getMD
			case kbfsmd.ServerErrorUnauthorized:
				// The MD server connection might not be authorized
				// yet, so give it a few chances to go through.
				if i > 5 {
					fbo.log.CDebugf(ctx,
						"Still unauthorized for TLF %s; giving up fast-forward",
						fbo.id())
					return
				}
				if i == 0 {
					fbo.log.CDebugf(
						ctx, "Got unauthorized error when fast-forwarding %s; "+
							"trying again after a delay", fbo.id())
				}
				time.Sleep(1 * time.Second)
			default:
				fbo.log.CDebugf(ctx, "Fast-forward failed: %+v", err)
				return
			}
		}
		if currHead == (ImmutableRootMetadata{}) {
			fbo.log.CDebugf(ctx, "No MD yet")
			return
		}
		fbo.log.CDebugf(ctx, "Current head is revision %d", currHead.Revision())

		lState := makeFBOLockState()
		// Kick off partial prefetching once the latest merged
		// revision is set.
		defer func() {
			if err == nil {
				fbo.kickOffPartialSyncIfNeeded(ctx, lState, currHead)
			}
		}()

		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)
		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)
		if fbo.head != (ImmutableRootMetadata{}) {
			// We're already up to date.
			fbo.log.CDebugf(ctx, "Already up-to-date: %v", err)
			return
		}

		err = fbo.doFastForwardLocked(ctx, lState, currHead)
		if err != nil {
			fbo.log.CDebugf(ctx, "Fast-forward failed: %v", err)
		}
	})
}

func (fbo *folderBranchOps) invalidateAllNodesLocked(
	ctx context.Context, lState *kbfssync.LockState) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)

	changes, affectedNodeIDs, err := fbo.blocks.GetInvalidationChangesForAll(
		ctx, lState)
	if err != nil {
		return err
	}

	// Invalidate all the affected nodes.
	if len(changes) > 0 {
		fbo.observers.batchChanges(ctx, changes, affectedNodeIDs)
	}
	return nil
}

func (fbo *folderBranchOps) invalidateAllNodes(ctx context.Context) error {
	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)

	fbo.log.CDebugf(ctx, "Invalidating all nodes")
	return fbo.invalidateAllNodesLocked(ctx, lState)
}

// Reset implements the KBFSOps interface for folderBranchOps.
func (fbo *folderBranchOps) Reset(
	ctx context.Context, handle *tlfhandle.Handle) error {
	currHandle, err := fbo.GetTLFHandle(ctx, nil)
	if err != nil {
		return err
	}
	equal, err := currHandle.Equals(fbo.config.Codec(), *handle)
	if err != nil {
		return err
	}
	if !equal {
		return errors.Errorf("Can't reset %#v given bad handle %#v",
			currHandle, handle)
	}

	oldHandle := handle.DeepCopy()

	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)

	fbo.log.CDebugf(ctx, "Resetting")
	err = fbo.invalidateAllNodesLocked(ctx, lState)
	if err != nil {
		return err
	}

	// Make up a finalized name for the old handle, and broadcast it
	// to all observers.  This is to move it out of the way of the
	// next iteration of the folder.
	now := fbo.config.Clock().Now()
	finalizedInfo, err := tlf.NewHandleExtension(
		tlf.HandleExtensionFinalized, 1, kbname.NormalizedUsername("<unknown>"),
		now)
	if err != nil {
		return err
	}
	oldHandle.SetFinalizedInfo(finalizedInfo)
	// FIXME: This can't be subject to the WaitGroup due to a potential
	// deadlock, so we use a raw goroutine here instead of `goTracked`.
	go fbo.observers.tlfHandleChange(ctx, oldHandle)
	return nil
}

// GetSyncConfig implements the KBFSOps interface for folderBranchOps.
func (fbo *folderBranchOps) GetSyncConfig(
	ctx context.Context, tlfID tlf.ID) (keybase1.FolderSyncConfig, error) {
	if tlfID != fbo.id() || fbo.branch() != data.MasterBranch {
		return keybase1.FolderSyncConfig{}, WrongOpsError{
			fbo.folderBranch, data.FolderBranch{
				Tlf:    tlfID,
				Branch: data.MasterBranch,
			}}
	}

	lState := makeFBOLockState()
	md, _ := fbo.getHead(ctx, lState, mdNoCommit)
	config, tlfPath, err := fbo.getProtocolSyncConfigUnlocked(ctx, lState, md)
	if errors.Cause(err) == errNeedMDForPartialSyncConfig {
		// This is a partially-synced TLF, so it should be initialized
		// automatically by KBFSOps; we just need to wait for the MD.
		var once sync.Once
		for md == (ImmutableRootMetadata{}) {
			once.Do(func() {
				fbo.log.CDebugf(
					ctx, "Waiting for head to be populated while getting "+
						"sync config")
			})
			t := time.After(100 * time.Millisecond)
			select {
			case <-t:
			case <-ctx.Done():
				return keybase1.FolderSyncConfig{}, errors.WithStack(ctx.Err())
			}
			md, _ = fbo.getHead(ctx, lState, mdNoCommit)
		}
		config, tlfPath, err = fbo.getProtocolSyncConfigUnlocked(
			ctx, lState, md)
	}
	if err != nil {
		return keybase1.FolderSyncConfig{}, err
	}

	if config.Mode == keybase1.FolderSyncMode_DISABLED ||
		md == (ImmutableRootMetadata{}) ||
		md.GetTlfHandle().GetCanonicalPath() == tlfPath {
		return config, nil
	}

	// This means either the config was originally written before we
	// started saving TLF paths, or the TLF paths has changed due to
	// an SBS resolution or a subteam rename.  Calling `SetSyncConfig`
	// will use the newest path from the MD's TlfHandle.
	fbo.log.CDebugf(ctx, "Updating sync config TLF path from \"%s\" to \"%s\"",
		tlfPath, md.GetTlfHandle().GetCanonicalPath())
	_, err = fbo.SetSyncConfig(ctx, tlfID, config)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't update TLF path: %+v", err)
	}
	return config, nil
}

func (fbo *folderBranchOps) makeEncryptedPartialPathsLocked(
	ctx context.Context, lState *kbfssync.LockState, kmd libkey.KeyMetadata,
	paths []string) (FolderSyncEncryptedPartialPaths, error) {
	fbo.syncLock.AssertLocked(lState)

	oldConfig, _, err := fbo.getProtocolSyncConfig(ctx, lState, kmd)
	if err != nil {
		return FolderSyncEncryptedPartialPaths{}, err
	}
	if oldConfig.Mode == keybase1.FolderSyncMode_ENABLED {
		return FolderSyncEncryptedPartialPaths{},
			errors.Errorf("TLF %s is already fully synced", fbo.id())
	}

	// Make sure the new path list doesn't contain duplicates,
	// contains no absolute paths, and each path is cleaned.
	seenPaths := make(map[string]bool, len(paths))
	var pathList syncPathList
	pathList.Paths = make([]string, len(paths))
	for i, p := range paths {
		p = stdpath.Clean(filepath.ToSlash(p))
		if seenPaths[p] {
			return FolderSyncEncryptedPartialPaths{}, errors.Errorf(
				"%s is in the paths list more than once", p)
		}
		if stdpath.IsAbs(p) {
			return FolderSyncEncryptedPartialPaths{}, errors.Errorf(
				"Absolute paths like %s are not allowed", p)
		}
		if strings.HasPrefix(p, "..") {
			return FolderSyncEncryptedPartialPaths{}, errors.Errorf(
				"Relative paths out of the TLF like %s are not allowed", p)
		}
		seenPaths[p] = true
		pathList.Paths[i] = p
	}

	fbo.log.CDebugf(ctx,
		"Setting partial sync config for %s; paths=%v",
		fbo.id(), pathList.Paths)

	// Place the config data in a block that will be stored locally on
	// this device. It is not subject to the usual block size
	// limitations, and will not be sent to the bserver.
	b, err := pathList.makeBlock(fbo.config.Codec())
	if err != nil {
		return FolderSyncEncryptedPartialPaths{}, err
	}

	chargedTo, err := chargedToForTLF(
		ctx, fbo.config.KBPKI(), fbo.config.KBPKI(), fbo.config,
		kmd.GetTlfHandle())
	if err != nil {
		return FolderSyncEncryptedPartialPaths{}, err
	}

	info, _, readyBlockData, err :=
		data.ReadyBlock(ctx, fbo.config.BlockCache(), fbo.config.BlockOps(),
			kmd, b, chargedTo, fbo.config.DefaultBlockType())
	if err != nil {
		return FolderSyncEncryptedPartialPaths{}, err
	}

	// Put the unencrypted block in the cache.
	err = fbo.config.BlockCache().Put(
		info.BlockPointer, fbo.id(), b, data.TransientEntry,
		fbo.cacheHashBehavior())
	if err != nil {
		fbo.log.CDebugf(ctx,
			"Error caching new block %v: %+v", info.BlockPointer, err)
	}

	return FolderSyncEncryptedPartialPaths{
		Ptr:        info.BlockPointer,
		Buf:        readyBlockData.Buf,
		ServerHalf: readyBlockData.ServerHalf,
	}, nil
}

func (fbo *folderBranchOps) triggerMarkAndSweepLocked() {
	fbo.partialSyncs.Add(1)
	select {
	case fbo.markAndSweepTrigger <- struct{}{}:
	default:
		fbo.partialSyncs.Done()
	}
}

func (fbo *folderBranchOps) reResolveAndIdentify(
	ctx context.Context, oldHandle *tlfhandle.Handle, rev kbfsmd.Revision) {
	fbo.log.CDebugf(ctx, "Re-resolving handle")
	defer func() { fbo.log.CDebugf(ctx, "Done") }()

	fbo.config.KeybaseService().ClearCaches(ctx)

	// Once with the iteam-resolver (to cause all the iteam data to be
	// cached in the service), and once without it (to cause all the
	// individual users of the folder to be cached in the service).
	tlfName := string(oldHandle.GetCanonicalName())
	h, err := tlfhandle.ParseHandle(
		ctx, fbo.config.KBPKI(), fbo.config.MDOps(), fbo.config,
		tlfName, fbo.id().Type())
	if err != nil {
		fbo.log.CDebugf(ctx, "Couldn't parse handle: %+v", err)
		return
	}

outer:
	for {
		_, err := tlfhandle.ParseHandlePreferredQuick(
			ctx, fbo.config.KBPKI(), fbo.config, tlfName, fbo.id().Type())
		switch e := errors.Cause(err).(type) {
		case idutil.TlfNameNotCanonical:
			tlfName = e.NameToTry
		case nil:
			break outer
		default:
			fbo.log.CDebugf(ctx, "Couldn't parse handle: %+v", err)
			return
		}
	}

	// Also re-download the MD, to make sure the team info is cached,
	// as well as the writer's keys.
	_, err = fbo.config.MDOps().GetRange(ctx, fbo.id(), rev, rev, nil)
	if err != nil {
		fbo.log.CDebugf(ctx, "Couldn't fetch MD revision %d: %+v", rev, err)
		return
	}

	// Suppress tracker popups.
	ctx, err = tlfhandle.MakeExtendedIdentify(
		ctx, keybase1.TLFIdentifyBehavior_KBFS_INIT)
	if err != nil {
		fbo.log.CDebugf(
			ctx, "Couldn't make extended identify: %+v", err)
		return
	}

	err = tlfhandle.IdentifyHandle(
		ctx, fbo.config.KBPKI(), fbo.config.KBPKI(), fbo.config, h)
	if err != nil {
		fbo.log.CDebugf(ctx, "Couldn't identify handle: %+v", err)
	}

	// The popups and errors were suppressed, but any errors would
	// have been logged.  So just close out the extended identify.  If
	// the user accesses the TLF directly, another proper identify
	// should happen that shows errors.
	_ = tlfhandle.GetExtendedIdentify(ctx).GetTlfBreakAndClose()
}

// SetSyncConfig implements the KBFSOps interface for KBFSOpsStandard.
func (fbo *folderBranchOps) SetSyncConfig(
	ctx context.Context, tlfID tlf.ID, config keybase1.FolderSyncConfig) (
	ch <-chan error, err error) {
	if tlfID != fbo.id() || fbo.branch() != data.MasterBranch {
		return nil, WrongOpsError{
			fbo.folderBranch, data.FolderBranch{
				Tlf:    tlfID,
				Branch: data.MasterBranch,
			}}
	}

	defer func() {
		if err == nil {
			fbo.config.Reporter().NotifyFavoritesChanged(ctx)
		}
	}()

	lState := makeFBOLockState()
	md, err := fbo.getLatestMergedMD(ctx, lState)
	if err != nil {
		return nil, err
	}
	if md == (ImmutableRootMetadata{}) ||
		md.Revision() == kbfsmd.RevisionUninitialized {
		return nil, errors.New(
			"Cannot set partial sync config on an uninitialized TLF")
	}

	// Cancel any existing working set prefetches.
	if config.Mode != keybase1.FolderSyncMode_DISABLED {
		func() {
			fbo.headLock.Lock(lState)
			defer fbo.headLock.Unlock(lState)
			if fbo.latestMergedUpdated != nil {
				close(fbo.latestMergedUpdated)
			}
			fbo.latestMergedUpdated = make(chan struct{})
		}()
		err = fbo.partialSyncs.Wait(ctx)
		if err != nil {
			return nil, err
		}
	}

	// On the way back out (after the syncLock is released), kick off
	// the partial sync.
	defer func() {
		if err == nil && config.Mode == keybase1.FolderSyncMode_PARTIAL {
			fbo.kickOffPartialSync(ctx, lState, config, md)
		}
	}()

	fbo.syncLock.Lock(lState)
	defer fbo.syncLock.Unlock(lState)

	startTime, timer := fbo.startOp(
		ctx, "Setting sync config for %s, mode=%s", tlfID, config.Mode)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer,
			"Done setting sync config for %s, mode=%s: %+v",
			tlfID, config.Mode, err)
	}()

	if config.Mode == keybase1.FolderSyncMode_PARTIAL &&
		len(config.Paths) == 0 {
		fbo.log.CDebugf(ctx,
			"Converting partial config with no paths into a disabled config")
		config.Mode = keybase1.FolderSyncMode_DISABLED
	}

	newConfig := FolderSyncConfig{
		Mode:    config.Mode,
		TlfPath: md.GetTlfHandle().GetCanonicalPath(),
	}

	if config.Mode == keybase1.FolderSyncMode_PARTIAL {
		paths, err := fbo.makeEncryptedPartialPathsLocked(
			ctx, lState, md, config.Paths)
		if err != nil {
			return nil, err
		}
		newConfig.Paths = paths
	}

	oldConfig, _, err := fbo.getProtocolSyncConfig(ctx, lState, md)
	if err != nil {
		return nil, err
	}

	oldPartial := oldConfig.Mode == keybase1.FolderSyncMode_PARTIAL
	newPartial := newConfig.Mode == keybase1.FolderSyncMode_PARTIAL
	switch {
	case oldPartial && !newPartial:
		if fbo.markAndSweepTrigger == nil {
			return nil, errors.New(
				"Unexpected sync config; mark-and-sweep already started")
		}

		fbo.log.CDebugf(ctx, "Exiting partial mode, stopping mark-and-sweep")
		close(fbo.markAndSweepTrigger)
		fbo.markAndSweepTrigger = nil
	case !oldPartial && newPartial:
		if fbo.markAndSweepTrigger != nil {
			return nil, errors.New(
				"Unexpected sync config; mark-and-sweep already started")
		}
		if oldConfig.Mode == keybase1.FolderSyncMode_ENABLED {
			return nil, errors.New(
				"Cannot enable partial syncing while fully-synced")
		}

		fbo.log.CDebugf(ctx, "Entering partial mode, starting mark-and-sweep")
		// `kickOffPartialSync` call above will start the mark and sweep.
	case oldPartial && newPartial:
		if fbo.markAndSweepTrigger == nil {
			return nil, errors.New(
				"Unexpected sync config; mark-and-sweep already started")
		}

		// See if there are any missing paths from the new config.
		oldPaths := make(map[string]bool, len(oldConfig.Paths))
		for _, p := range oldConfig.Paths {
			oldPaths[p] = true
		}
		for _, p := range config.Paths {
			delete(oldPaths, p)
		}
		if len(oldPaths) > 0 {
			for _, p := range oldPaths {
				fbo.log.CDebugf(
					ctx, "Path %s removed from partial config", p)
			}
			fbo.triggerMarkAndSweepLocked()
		}
	}

	ch, err = fbo.config.SetTlfSyncState(ctx, tlfID, newConfig)
	if err != nil {
		return nil, err
	}

	if oldConfig.Mode == keybase1.FolderSyncMode_DISABLED &&
		newConfig.Mode != keybase1.FolderSyncMode_DISABLED {
		// Explicitly re-resolve and re-identify the handle, to make
		// sure the service caches everything it's supposed to.
		fbo.goTracked(func() {
			ctx, cancel := fbo.newCtxWithFBOID()
			defer cancel()
			fbo.reResolveAndIdentify(ctx, md.GetTlfHandle(), md.Revision())
		})
	}

	if config.Mode == keybase1.FolderSyncMode_ENABLED {
		// Make a new ctx for the root block fetch, since it will
		// continue after this function returns.
		rootBlockCtx := fbo.ctxWithFBOID(context.Background())
		fbo.log.CDebugf(
			ctx, "Starting full deep sync with a new context: FBOID=%s",
			rootBlockCtx.Value(CtxFBOIDKey))
		_ = fbo.kickOffRootBlockFetch(rootBlockCtx, md)
	}

	// Issue notifications to client when sync mode changes (or is partial).
	if oldConfig.Mode != config.Mode || config.Mode == keybase1.FolderSyncMode_PARTIAL {
		fbo.config.Reporter().Notify(ctx, syncConfigChangeNotification(
			md.GetTlfHandle(), config))
	}

	return ch, nil
}

// InvalidateNodeAndChildren implements the KBFSOps interface for
// folderBranchOps.
func (fbo *folderBranchOps) InvalidateNodeAndChildren(
	ctx context.Context, node Node) (err error) {
	startTime, timer := fbo.startOp(ctx, "InvalidateNodeAndChildren %p", node)
	defer func() {
		fbo.endOp(
			ctx, startTime, timer, "InvalidateNodeAndChildren %p done: %+v",
			node, err)
	}()

	lState := makeFBOLockState()
	changes, affectedNodeIDs, err := fbo.blocks.GetInvalidationChangesForNode(
		ctx, lState, node)
	if err != nil {
		return err
	}

	if len(changes) > 0 {
		fbo.observers.batchChanges(ctx, changes, affectedNodeIDs)
	}
	return nil
}

func (fbo *folderBranchOps) getEditMonitoringChannel() <-chan struct{} {
	fbo.editsLock.Lock()
	defer fbo.editsLock.Unlock()
	return fbo.editMonitoringInProgress
}

// NewNotificationChannel implements the KBFSOps interface for
// folderBranchOps.
func (fbo *folderBranchOps) NewNotificationChannel(
	ctx context.Context, handle *tlfhandle.Handle, convID chat1.ConversationID,
	channelName string) {
	monitoringCh := fbo.getEditMonitoringChannel()
	if monitoringCh == nil {
		fbo.vlog.CLogf(
			ctx, libkb.VLog1,
			"Ignoring new notification channel while edits are unmonitored")
		return
	}

	fbo.vlog.CLogf(
		ctx, libkb.VLog1, "New notification channel: %s %s",
		convID, channelName)
	fbo.editActivity.Add(1)
	select {
	case fbo.editChannels <- editChannelActivity{convID, channelName, ""}:
	case <-monitoringCh:
		fbo.editActivity.Done()
		fbo.log.CDebugf(ctx, "Edit monitoring stopped while trying to "+
			"send new notification channel")
	}
}

// PushConnectionStatusChange pushes human readable connection status changes.
func (fbo *folderBranchOps) PushConnectionStatusChange(service string, newStatus error) {
	switch service {
	case KeybaseServiceName, GregorServiceName:
	default:
		return
	}

	if newStatus != nil {
		return
	}

	monitoringCh := fbo.getEditMonitoringChannel()
	if monitoringCh == nil {
		return
	}

	fbo.vlog.CLogf(
		context.TODO(), libkb.VLog1,
		"Asking for an edit re-init after reconnection")
	fbo.editActivity.Add(1)
	select {
	case fbo.editChannels <- editChannelActivity{nil, "", ""}:
	case <-monitoringCh:
		fbo.editActivity.Done()
		fbo.log.CDebugf(
			context.TODO(),
			"Edit monitoring stopped while trying to ask for a re-init")
	}
}

func (fbo *folderBranchOps) receiveNewEditChat(
	convID chat1.ConversationID, message string) {
	monitoringCh := fbo.getEditMonitoringChannel()
	if monitoringCh == nil {
		return
	}

	fbo.editActivity.Add(1)
	select {
	case fbo.editChannels <- editChannelActivity{convID, "", message}:
	case <-monitoringCh:
		fbo.editActivity.Done()
	}
}

func (fbo *folderBranchOps) initEditChatChannels(
	ctx context.Context, name tlf.CanonicalName) (
	idToName map[string]string,
	nameToID map[string]chat1.ConversationID,
	nameToNextPage map[string][]byte, err error) {
	convIDs, channelNames, err := fbo.config.Chat().GetChannels(
		ctx, name, fbo.id().Type(), chat1.TopicType_KBFSFILEEDIT)
	if err != nil {
		return nil, nil, nil, err
	}

	idToName = make(map[string]string, len(convIDs))
	nameToID = make(map[string]chat1.ConversationID, len(convIDs))
	nameToNextPage = make(map[string][]byte, len(convIDs))
	for i, id := range convIDs {
		fbo.config.Chat().RegisterForMessages(id, fbo.receiveNewEditChat)
		name := channelNames[i]
		idToName[id.String()] = name
		nameToID[name] = id
		nextPage := fbo.getEditMessages(ctx, id, name, nil)
		if nextPage != nil {
			nameToNextPage[name] = nextPage
		}
	}
	return idToName, nameToID, nameToNextPage, nil
}

func (fbo *folderBranchOps) getEditMessages(
	ctx context.Context, id chat1.ConversationID, channelName string,
	startPage []byte) (nextPage []byte) {
	// TODO: be smarter about not fetching messages we've already
	// seen?  `AddNotifications` below will filter out any duplicates,
	// so it's not strictly needed for correctness.
	messages, nextPage, err := fbo.config.Chat().ReadChannel(ctx, id, startPage)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't get messages for conv %s: %+v",
			id, err)
		return nil
	}
	_, err = fbo.editHistory.AddNotifications(channelName, messages)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't add messages for conv %s: %+v",
			id, err)
		return nil
	}
	return nextPage
}

func (fbo *folderBranchOps) recomputeEditHistory(
	ctx context.Context,
	tlfName tlf.CanonicalName,
	nameToID map[string]chat1.ConversationID,
	nameToNextPage map[string][]byte) {
	gotMore := true

	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, fbo.config.KBPKI(), true)
	if err != nil {
		fbo.log.CWarningf(ctx, "Error getting session: %+v", err)
		return
	}

	for gotMore {
		// Recompute the history, and fetch more messages for any
		// writers who need them.
		writersWhoNeedMore := fbo.editHistory.Recompute(string(session.Name))
		gotMore = false
		for w, needsMore := range writersWhoNeedMore {
			if !needsMore {
				continue
			}
			if startPage, ok := nameToNextPage[w]; ok && startPage != nil {
				id, ok := nameToID[w]
				if !ok {
					fbo.vlog.CLogf(
						ctx, libkb.VLog1, "No channel found for %s", w)
					continue
				}
				fbo.vlog.CLogf(
					ctx, libkb.VLog1,
					"Going to fetch more messages for writer %s", w)
				gotMore = true
				nextPage := fbo.getEditMessages(ctx, id, w, startPage)
				if nextPage == nil {
					delete(nameToNextPage, w)
				} else {
					nameToNextPage[w] = nextPage
				}
			}
		}
	}
	// Update the overall user history.  TODO: if the TLF name
	// changed, we should clean up the old user history.
	fbo.config.UserHistory().UpdateHistory(
		tlfName, fbo.id().Type(), fbo.editHistory, string(session.Name))
}

func (fbo *folderBranchOps) kickOffEditActivityPartialSync(
	ctx context.Context, lState *kbfssync.LockState,
	rmd ImmutableRootMetadata) (err error) {
	defer func() {
		if err != nil {
			fbo.log.CDebugf(
				ctx, "Couldn't kick off partial sync for edit activity: %+v",
				err)
		}
	}()

	syncConfig, _, err := fbo.getProtocolSyncConfigUnlocked(ctx, lState, rmd)
	if err != nil {
		return err
	}
	if syncConfig.Mode != keybase1.FolderSyncMode_DISABLED {
		return nil
	}

	fbo.vlog.CLogf(
		ctx, libkb.VLog1, "Kicking off partial sync for revision %d "+
			"due to new edit message", rmd.Revision())

	syncConfig, err = fbo.makeRecentFilesSyncConfig(ctx, rmd)
	if err != nil {
		return err
	}
	fbo.kickOffPartialSync(ctx, lState, syncConfig, rmd)
	return nil
}

func (fbo *folderBranchOps) handleEditActivity(
	ctx context.Context,
	a editChannelActivity,
	tlfName tlf.CanonicalName,
	idToName map[string]string,
	nameToID map[string]chat1.ConversationID,
	nameToNextPage map[string][]byte) (
	idToNameRet map[string]string,
	nameToIDRet map[string]chat1.ConversationID,
	nameToNextPageRet map[string][]byte, err error) {
	var rmd ImmutableRootMetadata
	lState := makeFBOLockState()
	defer func() {
		fbo.recomputeEditHistory(ctx, tlfName, nameToIDRet, nameToNextPageRet)
		if rmd != (ImmutableRootMetadata{}) {
			_ = fbo.kickOffEditActivityPartialSync(ctx, lState, rmd)
		}
		fbo.favs.RefreshCacheWhenMTimeChanged(ctx)
		fbo.editActivity.Done()
	}()

	if a.convID == nil {
		fbo.vlog.CLogf(ctx, libkb.VLog1, "Re-initializing chat channels")
		return fbo.initEditChatChannels(ctx, tlfName)
	}

	idStr := a.convID.String()
	name, ok := idToName[idStr]
	if !ok {
		// This is a new channel that we need to monitor.
		fbo.config.Chat().RegisterForMessages(
			a.convID, fbo.receiveNewEditChat)
		idToName[idStr] = a.name
		nameToID[a.name] = a.convID
		name = a.name
	}
	if a.message != "" {
		fbo.vlog.CLogf(ctx, libkb.VLog1, "New edit message for %s", name)
		maxRev, err := fbo.editHistory.AddNotifications(
			name, []string{a.message})
		if err != nil {
			return nil, nil, nil, err
		}
		// If the new edits reference the latest merged revision, then
		// the MD has already kicked off a partial sync.  Since this
		// edit might trigger a different partial sync, we should
		// start another one as well by setting `rmd` and letting the
		// `defer` above kick one off.
		latestMergedRev := fbo.getLatestMergedRevision(lState)
		if maxRev == latestMergedRev {
			rmd, err = getSingleMD(
				ctx, fbo.config, fbo.id(), kbfsmd.NullBranchID, maxRev,
				kbfsmd.Merged, nil)
			if err != nil {
				return nil, nil, nil, err
			}
		}
	} else {
		fbo.vlog.CLogf(ctx, libkb.VLog1, "New edit channel for %s", name)
		nextPage := fbo.getEditMessages(ctx, a.convID, name, nil)
		if nextPage != nil {
			nameToNextPage[name] = nextPage
		}
	}

	return idToName, nameToID, nameToNextPage, nil
}

func (fbo *folderBranchOps) refreshEditHistory() {
	// If we can't send something to the channel,
	// then there is already a refresh pending.
	select {
	case fbo.refreshEditHistoryChannel <- struct{}{}:
	default:
	}
}

func (fbo *folderBranchOps) monitorEditsChat(tlfName tlf.CanonicalName) {
	ctx, cancelFunc := fbo.newCtxWithFBOID()
	defer cancelFunc()
	fbo.log.CDebugf(ctx, "Starting kbfs-edits chat monitoring")

	monitoringCh := make(chan struct{})
	fbo.editsLock.Lock()
	fbo.cancelEdits = cancelFunc
	fbo.editMonitoringInProgress = monitoringCh
	fbo.editsLock.Unlock()

	defer func() {
		fbo.editsLock.Lock()
		fbo.editMonitoringInProgress = nil
		fbo.editsLock.Unlock()
		close(monitoringCh)
	}()

	idToName := make(map[string]string)
	nameToID := make(map[string]chat1.ConversationID)
	nameToNextPage := make(map[string][]byte)

	for {
		select {
		case <-fbo.shutdownChan:
			fbo.log.CDebugf(ctx, "Shutting down chat monitoring")
			return
		case <-fbo.refreshEditHistoryChannel:
			fbo.recomputeEditHistory(ctx, tlfName, nameToID, nameToNextPage)
		case a := <-fbo.editChannels:
			var err error
			idToName, nameToID, nameToNextPage, err = fbo.handleEditActivity(
				ctx, a, tlfName, idToName, nameToID, nameToNextPage)
			if err != nil {
				fbo.log.CWarningf(
					ctx, "Couldn't handle activity %#v: %+v", a, err)
				return
			}
		case <-ctx.Done():
			fbo.log.CDebugf(ctx, "Chat monitoring was canceled")
			return
		}
	}
}

func (fbo *folderBranchOps) addRootNodeWrapper(f func(Node) Node) {
	fbo.nodeCache.AddRootWrapper(f)
}
