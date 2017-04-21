// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"os"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfssync"
	"github.com/keybase/kbfs/tlf"
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
	standard       branchType = iota // an online, read-write branch
	archive                          // an online, read-only branch
	offline                          // an offline, read-write branch
	archiveOffline                   // an offline, read-only branch
)

// Constants used in this file.  TODO: Make these configurable?
const (
	// MaxBlockSizeBytesDefault is the default maximum block size for KBFS.
	// 512K blocks by default, block changes embedded max == 8K.
	// Block size was chosen somewhat arbitrarily by trying to
	// minimize the overall size of the history written by a user when
	// appending 1KB writes to a file, up to a 1GB total file.  Here
	// is the output of a simple script that approximates that
	// calculation:
	//
	// Total history size for 0065536-byte blocks: 1134341128192 bytes
	// Total history size for 0131072-byte blocks: 618945052672 bytes
	// Total history size for 0262144-byte blocks: 412786622464 bytes
	// Total history size for 0524288-byte blocks: 412786622464 bytes
	// Total history size for 1048576-byte blocks: 618945052672 bytes
	// Total history size for 2097152-byte blocks: 1134341128192 bytes
	// Total history size for 4194304-byte blocks: 2216672886784 bytes
	MaxBlockSizeBytesDefault = 512 << 10
	// Maximum number of blocks that can be sent in parallel
	maxParallelBlockPuts = 100
	// Maximum number of blocks that can be fetched in parallel
	maxParallelBlockGets = 10
	// Max response size for a single DynamoDB query is 1MB.
	maxMDsAtATime = 10
	// Time between checks for dirty files to flush, in case Sync is
	// never called.
	secondsBetweenBackgroundFlushes = 1
	// Cap the number of times we retry after a recoverable error
	maxRetriesOnRecoverableErrors = 10
	// When the number of dirty bytes exceeds this level, force a sync.
	dirtyBytesThreshold = maxParallelBlockPuts * MaxBlockSizeBytesDefault
	// The timeout for any background task.
	backgroundTaskTimeout = 1 * time.Minute
	// If it's been more than this long since our last update, check
	// the current head before downloading all of the new revisions.
	fastForwardTimeThresh = 15 * time.Minute
	// If there are more than this many new revisions, fast forward
	// rather than downloading them all.
	fastForwardRevThresh = 50
)

type fboMutexLevel mutexLevel

const (
	fboMDWriter fboMutexLevel = 1
	fboHead     fboMutexLevel = 2
	fboBlock    fboMutexLevel = 3
)

func (o fboMutexLevel) String() string {
	switch o {
	case fboMDWriter:
		return "mdWriterLock"
	case fboHead:
		return "headLock"
	case fboBlock:
		return "blockLock"
	default:
		return fmt.Sprintf("Invalid fboMutexLevel %d", int(o))
	}
}

func fboMutexLevelToString(o mutexLevel) string {
	return (fboMutexLevel(o)).String()
}

// Rules for working with lockState in FBO:
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

func makeFBOLockState() *lockState {
	return makeLevelState(fboMutexLevelToString)
}

// blockLock is just like a sync.RWMutex, but with an extra operation
// (DoRUnlockedIfPossible).
type blockLock struct {
	leveledRWMutex
	locked bool
}

func (bl *blockLock) Lock(lState *lockState) {
	bl.leveledRWMutex.Lock(lState)
	bl.locked = true
}

func (bl *blockLock) Unlock(lState *lockState) {
	bl.locked = false
	bl.leveledRWMutex.Unlock(lState)
}

// DoRUnlockedIfPossible must be called when r- or w-locked. If
// r-locked, r-unlocks, runs the given function, and r-locks after
// it's done. Otherwise, just runs the given function.
func (bl *blockLock) DoRUnlockedIfPossible(lState *lockState, f func(*lockState)) {
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
	config       Config
	folderBranch FolderBranch
	bid          BranchID // protected by mdWriterLock
	bType        branchType
	observers    *observerList

	// these locks, when locked concurrently by the same goroutine,
	// should only be taken in the following order to avoid deadlock:
	mdWriterLock leveledMutex // taken by any method making MD modifications
	dirOps       []cachedDirOp

	// protects access to head, headStatus, latestMergedRevision,
	// and hasBeenCleared.
	headLock   leveledRWMutex
	head       ImmutableRootMetadata
	headStatus headTrustStatus
	// latestMergedRevision tracks the latest heard merged revision on server
	latestMergedRevision MetadataRevision
	// Has this folder ever been cleared?
	hasBeenCleared bool

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
	identifyLock sync.Mutex
	identifyDone bool
	identifyTime time.Time

	// The current status summary for this folder
	status *folderBranchStatusKeeper

	// How to log
	log      logger.Logger
	deferLog logger.Logger

	// Closed on shutdown
	shutdownChan chan struct{}

	// Can be used to turn off notifications for a while (e.g., for testing)
	updatePauseChan chan (<-chan struct{})

	cancelUpdatesLock sync.Mutex
	// Cancels the goroutine currently waiting on TLF MD updates.
	cancelUpdates context.CancelFunc

	// After a shutdown, this channel will be closed when the register
	// goroutine completes.
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

	editHistory *TlfEditHistory

	branchChanges      kbfssync.RepeatedWaitGroup
	mdFlushes          kbfssync.RepeatedWaitGroup
	forcedFastForwards kbfssync.RepeatedWaitGroup
}

var _ KBFSOps = (*folderBranchOps)(nil)

var _ fbmHelper = (*folderBranchOps)(nil)

// newFolderBranchOps constructs a new folderBranchOps object.
func newFolderBranchOps(config Config, fb FolderBranch,
	bType branchType) *folderBranchOps {
	var nodeCache NodeCache
	if config.Mode() == InitMinimal {
		// If we're in minimal mode, let the node cache remain nil to
		// ensure that the user doesn't try any data reads or writes.
	} else {
		nodeCache = newNodeCacheStandard(fb)
	}

	// make logger
	branchSuffix := ""
	if fb.Branch != MasterBranch {
		branchSuffix = " " + string(fb.Branch)
	}
	tlfStringFull := fb.Tlf.String()
	// Shorten the TLF ID for the module name.  8 characters should be
	// unique enough for a local node.
	log := config.MakeLogger(fmt.Sprintf("FBO %s%s", tlfStringFull[:8],
		branchSuffix))
	// But print it out once in full, just in case.
	log.CInfof(nil, "Created new folder-branch for %s", tlfStringFull)

	observers := newObserverList()

	mdWriterLock := makeLeveledMutex(mutexLevel(fboMDWriter), &sync.Mutex{})
	headLock := makeLeveledRWMutex(mutexLevel(fboHead), &sync.RWMutex{})
	blockLockMu := makeLeveledRWMutex(mutexLevel(fboBlock), &sync.RWMutex{})

	forceSyncChan := make(chan struct{})

	fbo := &folderBranchOps{
		config:       config,
		folderBranch: fb,
		bid:          BranchID{},
		bType:        bType,
		observers:    observers,
		status:       newFolderBranchStatusKeeper(config, nodeCache),
		mdWriterLock: mdWriterLock,
		headLock:     headLock,
		blocks: folderBlockOps{
			config:        config,
			log:           log,
			folderBranch:  fb,
			observers:     observers,
			forceSyncChan: forceSyncChan,
			blockLock: blockLock{
				leveledRWMutex: blockLockMu,
			},
			dirtyFiles: make(map[BlockPointer]*dirtyFile),
			deferred:   make(map[BlockRef]deferredState),
			unrefCache: make(map[BlockRef]*syncInfo),
			deCache:    make(map[BlockRef]deCacheEntry),
			nodeCache:  nodeCache,
		},
		nodeCache:       nodeCache,
		log:             log,
		deferLog:        log.CloneWithAddedDepth(1),
		shutdownChan:    make(chan struct{}),
		updatePauseChan: make(chan (<-chan struct{})),
		forceSyncChan:   forceSyncChan,
		syncNeededChan:  make(chan struct{}, 1),
	}
	fbo.prepper = folderUpdatePrepper{
		config:       config,
		folderBranch: fb,
		blocks:       &fbo.blocks,
		log:          log,
	}
	fbo.cr = NewConflictResolver(config, fbo)
	fbo.fbm = newFolderBlockManager(config, fb, fbo)
	fbo.editHistory = NewTlfEditHistory(config, fbo, log)
	fbo.rekeyFSM = NewRekeyFSM(fbo)
	if config.DoBackgroundFlushes() {
		go fbo.backgroundFlusher(secondsBetweenBackgroundFlushes * time.Second)
	}

	return fbo
}

// markForReIdentifyIfNeeded checks whether this tlf is identified and mark
// it for lazy reidentification if it exceeds time limits.
func (fbo *folderBranchOps) markForReIdentifyIfNeeded(now time.Time, maxValid time.Duration) {
	fbo.identifyLock.Lock()
	defer fbo.identifyLock.Unlock()
	if fbo.identifyDone && (now.Before(fbo.identifyTime) || fbo.identifyTime.Add(maxValid).Before(now)) {
		fbo.log.CDebugf(nil, "Expiring identify from %v", fbo.identifyTime)
		fbo.identifyDone = false
	}
}

// Shutdown safely shuts down any background goroutines that may have
// been launched by folderBranchOps.
func (fbo *folderBranchOps) Shutdown(ctx context.Context) error {
	if fbo.config.CheckStateOnShutdown() {
		lState := makeFBOLockState()

		if fbo.blocks.GetState(lState) == dirtyState {
			fbo.log.CDebugf(ctx, "Skipping state-checking due to dirty state")
		} else if !fbo.isMasterBranch(lState) {
			fbo.log.CDebugf(ctx, "Skipping state-checking due to being staged")
		} else {
			// Make sure we're up to date first
			if err := fbo.SyncFromServerForTesting(ctx, fbo.folderBranch); err != nil {
				return err
			}

			// Check the state for consistency before shutting down.
			sc := NewStateChecker(fbo.config)
			if err := sc.CheckMergedState(ctx, fbo.id()); err != nil {
				return err
			}
		}
	}

	close(fbo.shutdownChan)
	fbo.cr.Shutdown()
	fbo.fbm.shutdown()
	fbo.editHistory.Shutdown()
	fbo.rekeyFSM.Shutdown()
	// Wait for the update goroutine to finish, so that we don't have
	// any races with logging during test reporting.
	if fbo.updateDoneChan != nil {
		<-fbo.updateDoneChan
	}
	return nil
}

func (fbo *folderBranchOps) id() tlf.ID {
	return fbo.folderBranch.Tlf
}

func (fbo *folderBranchOps) branch() BranchName {
	return fbo.folderBranch.Branch
}

func (fbo *folderBranchOps) GetFavorites(ctx context.Context) (
	[]Favorite, error) {
	return nil, errors.New("GetFavorites is not supported by folderBranchOps")
}

func (fbo *folderBranchOps) RefreshCachedFavorites(ctx context.Context) {
	// no-op
}

func (fbo *folderBranchOps) DeleteFavorite(ctx context.Context,
	fav Favorite) error {
	return errors.New("DeleteFavorite is not supported by folderBranchOps")
}

func (fbo *folderBranchOps) AddFavorite(ctx context.Context,
	fav Favorite) error {
	return errors.New("AddFavorite is not supported by folderBranchOps")
}

func (fbo *folderBranchOps) addToFavorites(ctx context.Context,
	favorites *Favorites, created bool) (err error) {
	lState := makeFBOLockState()
	head := fbo.getTrustedHead(lState)
	if head == (ImmutableRootMetadata{}) {
		return OpsCantHandleFavorite{"Can't add a favorite without a handle"}
	}

	return fbo.addToFavoritesByHandle(ctx, favorites, head.GetTlfHandle(), created)
}

func (fbo *folderBranchOps) addToFavoritesByHandle(ctx context.Context,
	favorites *Favorites, handle *TlfHandle, created bool) (err error) {
	if _, err := fbo.config.KBPKI().GetCurrentSession(ctx); err != nil {
		// Can't favorite while not logged in
		return nil
	}

	favorites.AddAsync(ctx, handle.toFavToAdd(created))
	return nil
}

func (fbo *folderBranchOps) deleteFromFavorites(ctx context.Context,
	favorites *Favorites) error {
	if _, err := fbo.config.KBPKI().GetCurrentSession(ctx); err != nil {
		// Can't unfavorite while not logged in
		return nil
	}

	lState := makeFBOLockState()
	head := fbo.getTrustedHead(lState)
	if head == (ImmutableRootMetadata{}) {
		// This can happen when identifies fail and the head is never set.
		return OpsCantHandleFavorite{"Can't delete a favorite without a handle"}
	}

	h := head.GetTlfHandle()
	return favorites.Delete(ctx, h.ToFavorite())
}

func (fbo *folderBranchOps) doFavoritesOp(ctx context.Context,
	favs *Favorites, fop FavoritesOp, handle *TlfHandle) error {
	switch fop {
	case FavoritesOpNoChange:
		return nil
	case FavoritesOpAdd:
		if handle != nil {
			return fbo.addToFavoritesByHandle(ctx, favs, handle, false)
		}
		return fbo.addToFavorites(ctx, favs, false)
	case FavoritesOpAddNewlyCreated:
		if handle != nil {
			return fbo.addToFavoritesByHandle(ctx, favs, handle, true)
		}
		return fbo.addToFavorites(ctx, favs, true)
	case FavoritesOpRemove:
		return fbo.deleteFromFavorites(ctx, favs)
	default:
		return InvalidFavoritesOpError{}
	}
}

// getTrustedHead should not be called outside of folder_branch_ops.go.
// Returns ImmutableRootMetadata{} when the head is not trusted.
// See the comment on headTrustedStatus for more information.
func (fbo *folderBranchOps) getTrustedHead(lState *lockState) ImmutableRootMetadata {
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)
	if fbo.headStatus == headUntrusted {
		return ImmutableRootMetadata{}
	}
	return fbo.head
}

// getHead should not be called outside of folder_branch_ops.go.
func (fbo *folderBranchOps) getHead(lState *lockState) (
	ImmutableRootMetadata, headTrustStatus) {
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)
	return fbo.head, fbo.headStatus
}

// isMasterBranch should not be called if mdWriterLock is already taken.
func (fbo *folderBranchOps) isMasterBranch(lState *lockState) bool {
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	return fbo.bid == NullBranchID
}

func (fbo *folderBranchOps) isMasterBranchLocked(lState *lockState) bool {
	fbo.mdWriterLock.AssertLocked(lState)

	return fbo.bid == NullBranchID
}

func (fbo *folderBranchOps) setBranchIDLocked(lState *lockState, bid BranchID) {
	fbo.mdWriterLock.AssertLocked(lState)

	if fbo.bid != bid {
		fbo.cr.BeginNewBranch()
	}

	fbo.bid = bid
	if bid == NullBranchID {
		fbo.status.setCRSummary(nil, nil)
	}
}

var errNoFlushedRevisions = errors.New("No flushed MDs yet")
var errNoMergedRevWhileStaged = errors.New(
	"Cannot find most recent merged revision while staged")

// getJournalPredecessorRevision returns the revision that precedes
// the current journal head if journaling enabled and there are
// unflushed MD updates; otherwise it returns
// MetadataRevisionUninitialized.  If there aren't any flushed MD
// revisions, it returns errNoFlushedRevisions.
func (fbo *folderBranchOps) getJournalPredecessorRevision(ctx context.Context) (
	MetadataRevision, error) {
	jServer, err := GetJournalServer(fbo.config)
	if err != nil {
		// Journaling is disabled entirely.
		return MetadataRevisionUninitialized, nil
	}

	jStatus, err := jServer.JournalStatus(fbo.id())
	if err != nil {
		// Journaling is disabled for this TLF, so use the local head.
		// TODO: JournalStatus could return other errors (likely
		// file/disk corruption) that indicate a real problem, so it
		// might be nice to type those errors so we can distinguish
		// them.
		return MetadataRevisionUninitialized, nil
	}

	if jStatus.BranchID != NullBranchID.String() {
		return MetadataRevisionUninitialized, errNoMergedRevWhileStaged
	}

	if jStatus.RevisionStart == MetadataRevisionUninitialized {
		// The journal is empty, so the local head must be the most recent.
		return MetadataRevisionUninitialized, nil
	} else if jStatus.RevisionStart == MetadataRevisionInitial {
		// Nothing has been flushed to the servers yet, so don't
		// return anything.
		return MetadataRevisionUninitialized, errNoFlushedRevisions
	}

	return jStatus.RevisionStart - 1, nil
}

// validateHeadLocked validates an untrusted head and sets it as trusted.
// see headTrustedState comment for more information.
func (fbo *folderBranchOps) validateHeadLocked(
	ctx context.Context, lState *lockState, md ImmutableRootMetadata) error {
	fbo.headLock.AssertLocked(lState)

	// Validate fbo against fetched md and discard the fetched one.
	if fbo.head.TlfID() != md.TlfID() {
		fbo.log.CCriticalf(ctx, "Fake untrusted TLF encountered %v %v %v %v", fbo.head.TlfID(), md.TlfID(), fbo.head.mdID, md.mdID)
		return MDTlfIDMismatch{fbo.head.TlfID(), md.TlfID()}
	}
	fbo.headStatus = headTrusted
	return nil
}

func (fbo *folderBranchOps) setHeadLocked(
	ctx context.Context, lState *lockState,
	md ImmutableRootMetadata, headStatus headTrustStatus) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)

	isFirstHead := fbo.head == ImmutableRootMetadata{}
	wasReadable := false
	if !isFirstHead {
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
	err := fbo.config.MDCache().Put(md)
	if err != nil {
		return err
	}

	// If this is the first time the MD is being set, and we are
	// operating on unmerged data, initialize the state properly and
	// kick off conflict resolution.
	if isFirstHead && md.MergedStatus() == Unmerged {
		fbo.setBranchIDLocked(lState, md.BID())
		// Use uninitialized for the merged branch; the unmerged
		// revision is enough to trigger conflict resolution.
		fbo.cr.Resolve(md.Revision(), MetadataRevisionUninitialized)
	} else if md.MergedStatus() == Merged {
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
					// MetadataRevisionUninitialized when the journal
					// is empty.
					if journalPred >= MetadataRevisionInitial {
						fbo.setLatestMergedRevisionLocked(
							ctx, lState, journalPred, false)
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
			} else {
				// If this isn't the first head, then this is either
				// an update from the server, or an update just
				// written by the client.  But since journaling is on,
				// then latter case will be handled by onMDFlush when
				// the update is properly flushed to the server.  So
				// ignore updates written by this device.
				session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
				if err != nil {
					return err
				}
				if session.VerifyingKey != md.LastModifyingWriterVerifyingKey() {
					fbo.setLatestMergedRevisionLocked(
						ctx, lState, md.Revision(), false)
				}
			}
		} else {
			// This is a merged revision, and journaling is disabled,
			// so it's definitely the latest revision on the server as
			// well.
			fbo.setLatestMergedRevisionLocked(ctx, lState, md.Revision(), false)
		}
	}

	// Make sure that any unembedded block changes have been swapped
	// back in.
	if fbo.config.Mode() == InitDefault &&
		md.data.Changes.Info.BlockPointer != zeroPtr &&
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
		// as a starting point. For now only the master branch can
		// get updates
		if fbo.branch() == MasterBranch {
			fbo.updateDoneChan = make(chan struct{})
			go fbo.registerAndWaitForUpdates()
		}
	}
	if !wasReadable && md.IsReadable() {
		// Let any listeners know that this folder is now readable,
		// which may indicate that a rekey successfully took place.
		fbo.config.Reporter().Notify(ctx, mdReadSuccessNotification(
			md.GetTlfHandle(), md.TlfID().IsPublic()))
	}
	return nil
}

// setInitialHeadUntrustedLocked is for when the given RootMetadata
// was fetched not due to a user action, i.e. via a Rekey
// notification, and we don't have a TLF name to check against.
func (fbo *folderBranchOps) setInitialHeadUntrustedLocked(ctx context.Context,
	lState *lockState, md ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head != (ImmutableRootMetadata{}) {
		return errors.New("Unexpected non-nil head in setInitialHeadUntrustedLocked")
	}
	return fbo.setHeadLocked(ctx, lState, md, headUntrusted)
}

// setNewInitialHeadLocked is for when we're creating a brand-new TLF.
// This is trusted.
func (fbo *folderBranchOps) setNewInitialHeadLocked(ctx context.Context,
	lState *lockState, md ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head != (ImmutableRootMetadata{}) {
		return errors.New("Unexpected non-nil head in setNewInitialHeadLocked")
	}
	if md.Revision() != MetadataRevisionInitial {
		return errors.Errorf("setNewInitialHeadLocked unexpectedly called with revision %d", md.Revision())
	}
	return fbo.setHeadLocked(ctx, lState, md, headTrusted)
}

// setInitialHeadTrustedLocked is for when the given RootMetadata
// was fetched due to a user action, and will be checked against the
// TLF name.
func (fbo *folderBranchOps) setInitialHeadTrustedLocked(ctx context.Context,
	lState *lockState, md ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head != (ImmutableRootMetadata{}) {
		return errors.New("Unexpected non-nil head in setInitialHeadUntrustedLocked")
	}
	return fbo.setHeadLocked(ctx, lState, md, headTrusted)
}

// setHeadSuccessorLocked is for when we're applying updates from the
// server or when we're applying new updates we created ourselves.
func (fbo *folderBranchOps) setHeadSuccessorLocked(ctx context.Context,
	lState *lockState, md ImmutableRootMetadata, rebased bool) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head == (ImmutableRootMetadata{}) {
		// This can happen in tests via SyncFromServerForTesting().
		return fbo.setInitialHeadTrustedLocked(ctx, lState, md)
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
			*newHandle)
	if err != nil {
		return err
	}

	oldName := oldHandle.GetCanonicalName()
	newName := newHandle.GetCanonicalName()

	if !resolvesTo {
		return IncompatibleHandleError{
			oldName,
			partialResolvedOldHandle.GetCanonicalName(),
			newName,
		}
	}

	err = fbo.setHeadLocked(ctx, lState, md, headTrusted)
	if err != nil {
		return err
	}

	if oldName != newName {
		fbo.log.CDebugf(ctx, "Handle changed (%s -> %s)",
			oldName, newName)

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
	lState *lockState, md ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head == (ImmutableRootMetadata{}) {
		return errors.New("Unexpected nil head in setHeadPredecessorLocked")
	}
	if fbo.head.Revision() <= MetadataRevisionInitial {
		return errors.Errorf("setHeadPredecessorLocked unexpectedly called with revision %d", fbo.head.Revision())
	}

	if fbo.head.MergedStatus() != Unmerged {
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

	return fbo.setHeadLocked(ctx, lState, md, headTrusted)
}

// setHeadConflictResolvedLocked is for when we're setting the merged
// update with resolved conflicts.
func (fbo *folderBranchOps) setHeadConflictResolvedLocked(ctx context.Context,
	lState *lockState, md ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head.MergedStatus() != Unmerged {
		return errors.New("Unexpected merged head in setHeadConflictResolvedLocked")
	}
	if md.MergedStatus() != Merged {
		return errors.New("Unexpected unmerged update in setHeadConflictResolvedLocked")
	}

	return fbo.setHeadLocked(ctx, lState, md, headTrusted)
}

func (fbo *folderBranchOps) identifyOnce(
	ctx context.Context, md ReadOnlyRootMetadata) error {
	fbo.identifyLock.Lock()
	defer fbo.identifyLock.Unlock()

	ei := getExtendedIdentify(ctx)
	if fbo.identifyDone && !ei.behavior.AlwaysRunIdentify() {
		// TODO: provide a way for the service to break this cache when identify
		// state changes on a TLF. For now, we do it this way to make chat work.
		return nil
	}

	h := md.GetTlfHandle()
	fbo.log.CDebugf(ctx, "Running identifies on %s", h.GetCanonicalPath())
	kbpki := fbo.config.KBPKI()
	err := identifyHandle(ctx, kbpki, kbpki, h)
	if err != nil {
		fbo.log.CDebugf(ctx, "Identify finished with error: %v", err)
		// For now, if the identify fails, let the
		// next function to hit this code path retry.
		return err
	}

	if ei.behavior.WarningInsteadOfErrorOnBrokenTracks() &&
		len(ei.getTlfBreakAndClose().Breaks) > 0 {
		fbo.log.CDebugf(ctx,
			"Identify finished with no error but broken proof warnings")
	} else if ei.behavior == keybase1.TLFIdentifyBehavior_CHAT_SKIP {
		fbo.log.CDebugf(ctx, "Identify skipped")
	} else {
		fbo.log.CDebugf(ctx, "Identify finished successfully")
		fbo.identifyDone = true
		fbo.identifyTime = fbo.config.Clock().Now()
	}
	return nil
}

// getMDForReadLocked returns an existing md for a read
// operation. Note that mds will not be fetched here.
func (fbo *folderBranchOps) getMDForReadLocked(
	ctx context.Context, lState *lockState, rtype mdReadType) (
	md ImmutableRootMetadata, err error) {
	if rtype != mdReadNeedIdentify && rtype != mdReadNoIdentify {
		panic("Invalid rtype in getMDLockedForRead")
	}

	md = fbo.getTrustedHead(lState)
	if md != (ImmutableRootMetadata{}) {
		if rtype != mdReadNoIdentify {
			err = fbo.identifyOnce(ctx, md.ReadOnly())
		}
		return md, err
	}

	return ImmutableRootMetadata{}, MDWriteNeededInRequest{}
}

// getMDForWriteOrRekeyLocked can fetch MDs, identify them and
// contains the fancy logic. For reading use getMDLockedForRead.
// Here we actually can fetch things from the server.
// rekeys are untrusted.
func (fbo *folderBranchOps) getMDForWriteOrRekeyLocked(
	ctx context.Context, lState *lockState, mdType mdUpdateType) (
	md ImmutableRootMetadata, err error) {
	defer func() {
		if err != nil || mdType == mdRekey {
			return
		}
		err = fbo.identifyOnce(ctx, md.ReadOnly())
	}()

	md = fbo.getTrustedHead(lState)
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

	// get the head of the unmerged branch for this device (if any)
	md, err = mdops.GetUnmergedForTLF(ctx, fbo.id(), NullBranchID)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	mergedMD, err := mdops.GetForTLF(ctx, fbo.id())
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

	if md.data.Dir.Type != Dir && (!md.IsInitialized() || md.IsReadable()) {
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
	err = fbo.setHeadLocked(ctx, lState, md, headStatus)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	return md, nil
}

func (fbo *folderBranchOps) getMDForReadHelper(
	ctx context.Context, lState *lockState, rtype mdReadType) (ImmutableRootMetadata, error) {
	md, err := fbo.getMDForReadLocked(ctx, lState, rtype)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}
	if !md.TlfID().IsPublic() {
		session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
		if !md.GetTlfHandle().IsReader(session.UID) {
			return ImmutableRootMetadata{}, NewReadAccessError(
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

	if mergedRev == MetadataRevisionUninitialized {
		// No unflushed journal entries, so use the local head.
		lState := makeFBOLockState()
		return fbo.getMDForReadHelper(ctx, lState, mdReadNoIdentify)
	}

	// Otherwise, use the specified revision.
	rmd, err := getSingleMD(ctx, fbo.config, fbo.id(), NullBranchID,
		mergedRev, Merged)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	fbo.log.CDebugf(ctx, "Most recent fully merged revision is %d", mergedRev)
	return rmd, nil
}

func (fbo *folderBranchOps) getMDForReadNoIdentify(
	ctx context.Context, lState *lockState) (ImmutableRootMetadata, error) {
	return fbo.getMDForReadHelper(ctx, lState, mdReadNoIdentify)
}

func (fbo *folderBranchOps) getMDForReadNeedIdentify(
	ctx context.Context, lState *lockState) (ImmutableRootMetadata, error) {
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
	ctx context.Context, lState *lockState) (ImmutableRootMetadata, error) {
	md, err := fbo.getMDForReadLocked(ctx, lState, mdReadNeedIdentify)

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

	if !md.TlfID().IsPublic() {
		session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
		if !md.GetTlfHandle().IsReader(session.UID) {
			return ImmutableRootMetadata{}, NewReadAccessError(
				md.GetTlfHandle(), session.Name, md.GetTlfHandle().GetCanonicalPath())
		}
	}

	return md, nil
}

// getMDForWriteLocked returns a new RootMetadata object with an
// incremented version number for modification. If the returned object
// is put to the MDServer (via MDOps), mdWriterLock must be held until
// then. (See comments for mdWriterLock above.)
func (fbo *folderBranchOps) getMDForWriteLocked(
	ctx context.Context, lState *lockState) (*RootMetadata, error) {
	return fbo.getMDForWriteLockedForFilename(ctx, lState, "")
}

func (fbo *folderBranchOps) getMDForWriteLockedForFilename(
	ctx context.Context, lState *lockState, filename string) (*RootMetadata, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	md, err := fbo.getMDForWriteOrRekeyLocked(ctx, lState, mdWrite)
	if err != nil {
		return nil, err
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return nil, err
	}
	if !md.GetTlfHandle().IsWriter(session.UID) {
		return nil, NewWriteAccessError(
			md.GetTlfHandle(), session.Name, filename)
	}

	// Make a new successor of the current MD to hold the coming
	// writes.  The caller must pass this into
	// syncBlockAndCheckEmbedLocked or the changes will be lost.
	newMd, err := md.MakeSuccessor(ctx, fbo.config.MetadataVersion(),
		fbo.config.Codec(), fbo.config.Crypto(),
		fbo.config.KeyManager(), md.mdID, true)
	if err != nil {
		return nil, err
	}

	return newMd, nil
}

func (fbo *folderBranchOps) getMDForRekeyWriteLocked(
	ctx context.Context, lState *lockState) (
	rmd *RootMetadata, lastWriterVerifyingKey kbfscrypto.VerifyingKey,
	wasRekeySet bool, err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	md, err := fbo.getMDForWriteOrRekeyLocked(ctx, lState, mdRekey)
	if err != nil {
		return nil, kbfscrypto.VerifyingKey{}, false, err
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
		fbo.config.Codec(), fbo.config.Crypto(),
		fbo.config.KeyManager(), md.mdID, handle.IsWriter(session.UID))
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
	md *RootMetadata) (*blockPutState, error) {
	if fbo.config.BlockSplitter().ShouldEmbedBlockChanges(&md.data.Changes) {
		return nil, nil
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return nil, err
	}

	bps := newBlockPutState(1)
	err = fbo.prepper.unembedBlockChanges(
		ctx, bps, md, &md.data.Changes, session.UID)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err != nil {
			fbo.fbm.cleanUpBlockState(md.ReadOnly(), bps, blockDeleteOnMDFail)
		}
	}()

	ptrsToDelete, err := doBlockPuts(ctx, fbo.config.BlockServer(),
		fbo.config.BlockCache(), fbo.config.Reporter(), fbo.log, md.TlfID(),
		md.GetTlfHandle().GetCanonicalName(), *bps)
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
	currentUID keybase1.UID, rmd *RootMetadata) (
	Block, BlockInfo, ReadyBlockData, error) {
	newDblock := NewDirBlock()
	info, plainSize, readyBlockData, err :=
		ReadyBlock(ctx, config.BlockCache(), config.BlockOps(),
			config.Crypto(), rmd.ReadOnly(), newDblock, currentUID,
			keybase1.BlockType_DATA)
	if err != nil {
		return nil, BlockInfo{}, ReadyBlockData{}, err
	}

	now := config.Clock().Now().UnixNano()
	rmd.data.Dir = DirEntry{
		BlockInfo: info,
		EntryInfo: EntryInfo{
			Type:  Dir,
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

func (fbo *folderBranchOps) initMDLocked(
	ctx context.Context, lState *lockState, md *RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	handle := md.GetTlfHandle()

	// make sure we're a writer before rekeying or putting any blocks.
	if !handle.IsWriter(session.UID) {
		return NewWriteAccessError(
			handle, session.Name, handle.GetCanonicalPath())
	}

	var expectedKeyGen KeyGen
	var tlfCryptKey *kbfscrypto.TLFCryptKey
	if md.TlfID().IsPublic() {
		expectedKeyGen = PublicKeyGen
	} else {
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
		expectedKeyGen = FirstValidKeyGen
	}
	keyGen := md.LatestKeyGeneration()
	if keyGen != expectedKeyGen {
		return InvalidKeyGenerationError{md.TlfID(), keyGen}
	}

	// create a dblock since one doesn't exist yet
	newDblock, info, readyBlockData, err :=
		ResetRootBlock(ctx, fbo.config, session.UID, md)
	if err != nil {
		return err
	}

	// Some other thread got here first, so give up and let it go
	// before we push anything to the servers.
	if h, _ := fbo.getHead(lState); h != (ImmutableRootMetadata{}) {
		fbo.log.CDebugf(ctx, "Head was already set, aborting")
		return nil
	}

	if err = PutBlockCheckQuota(ctx, fbo.config.BlockServer(),
		fbo.config.Reporter(), md.TlfID(), info.BlockPointer, readyBlockData,
		md.GetTlfHandle().GetCanonicalName()); err != nil {
		return err
	}
	if err = fbo.config.BlockCache().Put(
		info.BlockPointer, fbo.id(), newDblock, TransientEntry); err != nil {
		return err
	}

	bps, err := fbo.maybeUnembedAndPutBlocks(ctx, md)
	if err != nil {
		return err
	}

	err = fbo.finalizeBlocks(bps)
	if err != nil {
		return err
	}

	// Finally, write out the new metadata.  TODO: if journaling is
	// enabled, we should bypass it here, so we don't have to worry
	// about delayed conflicts (since this is essentially a rekey, and
	// we always bypass the journal for rekeys).  The caller will have
	// to intelligently deal with a conflict.
	mdID, err := fbo.config.MDOps().Put(ctx, md)
	if err != nil {
		return err
	}

	md.loadCachedBlockChanges(ctx, bps, fbo.log)

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	if fbo.head != (ImmutableRootMetadata{}) {
		return errors.Errorf(
			"%v: Unexpected MD ID during new MD initialization: %v",
			md.TlfID(), fbo.head.mdID)
	}

	fbo.setNewInitialHeadLocked(ctx, lState, MakeImmutableRootMetadata(
		md, session.VerifyingKey, mdID, fbo.config.Clock().Now()))
	if err != nil {
		return err
	}

	// cache any new TLF crypt key
	if tlfCryptKey != nil {
		err = fbo.config.KeyCache().PutTLFCryptKey(md.TlfID(), keyGen, *tlfCryptKey)
		if err != nil {
			return err
		}
	}

	return nil
}

func (fbo *folderBranchOps) GetTLFCryptKeys(ctx context.Context,
	h *TlfHandle) (keys []kbfscrypto.TLFCryptKey, id tlf.ID, err error) {
	return nil, tlf.ID{}, errors.New("GetTLFCryptKeys is not supported by folderBranchOps")
}

func (fbo *folderBranchOps) GetTLFID(ctx context.Context, h *TlfHandle) (tlf.ID, error) {
	return tlf.ID{}, errors.New("GetTLFID is not supported by folderBranchOps")
}

func (fbo *folderBranchOps) GetOrCreateRootNode(
	ctx context.Context, h *TlfHandle, branch BranchName) (
	node Node, ei EntryInfo, err error) {
	return nil, EntryInfo{}, errors.New("GetOrCreateRootNode is not supported by folderBranchOps")
}

func (fbo *folderBranchOps) GetRootNode(
	ctx context.Context, h *TlfHandle, branch BranchName) (
	node Node, ei EntryInfo, err error) {
	return nil, EntryInfo{}, errors.New("GetRootNode is not supported by folderBranchOps")
}

func (fbo *folderBranchOps) checkNode(node Node) error {
	fb := node.GetFolderBranch()
	if fb != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, fb}
	}
	return nil
}

// SetInitialHeadFromServer sets the head to the given
// ImmutableRootMetadata, which must be retrieved from the MD server.
func (fbo *folderBranchOps) SetInitialHeadFromServer(
	ctx context.Context, md ImmutableRootMetadata) (err error) {
	fbo.log.CDebugf(ctx, "SetInitialHeadFromServer, revision=%d (%s)",
		md.Revision(), md.MergedStatus())
	defer func() {
		fbo.deferLog.CDebugf(ctx,
			"SetInitialHeadFromServer, revision=%d (%s) done: %+v",
			md.Revision(), md.MergedStatus(), err)
	}()

	if md.IsReadable() && fbo.config.Mode() != InitMinimal {
		// We will prefetch this as on-demand so that it triggers downstream
		// prefetches.
		fbo.config.BlockOps().Prefetcher().PrefetchBlock(
			&DirBlock{}, md.data.Dir.BlockPointer, md,
			defaultOnDemandRequestPriority)
	} else {
		fbo.log.CDebugf(ctx,
			"Setting an unreadable head with revision=%d", md.Revision())
	}

	// Return early if the head is already set.  This avoids taking
	// mdWriterLock for no reason, and it also avoids any side effects
	// (e.g., calling `identifyOnce` and downloading the merged
	// head) if head is already set.
	lState := makeFBOLockState()
	head, headStatus := fbo.getHead(lState)
	if headStatus == headTrusted && head != (ImmutableRootMetadata{}) && head.mdID == md.mdID {
		fbo.log.CDebugf(ctx, "Head MD already set to revision %d (%s), no "+
			"need to set initial head again", md.Revision(), md.MergedStatus())
		return nil
	}

	return runUnlessCanceled(ctx, func() error {
		fb := FolderBranch{md.TlfID(), MasterBranch}
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
		err = fbo.identifyOnce(ctx, md.ReadOnly())
		if err != nil {
			return err
		}

		lState := makeFBOLockState()

		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)

		if md.MergedStatus() == Unmerged {
			mdops := fbo.config.MDOps()
			mergedMD, err := mdops.GetForTLF(ctx, fbo.id())
			if err != nil {
				return err
			}

			func() {
				fbo.headLock.Lock(lState)
				defer fbo.headLock.Unlock(lState)
				fbo.setLatestMergedRevisionLocked(ctx, lState,
					mergedMD.Revision(), false)
			}()
		}

		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)

		// Only update the head the first time; later it will be
		// updated either directly via writes or through the
		// background update processor.
		if fbo.head == (ImmutableRootMetadata{}) {
			err = fbo.setInitialHeadTrustedLocked(ctx, lState, md)
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
	ctx context.Context, id tlf.ID, handle *TlfHandle) (err error) {
	fbo.log.CDebugf(ctx, "SetInitialHeadToNew %s", id)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "SetInitialHeadToNew %s done: %+v",
			id, err)
	}()

	rmd, err := makeInitialRootMetadata(
		fbo.config.MetadataVersion(), id, handle)
	if err != nil {
		return err
	}

	return runUnlessCanceled(ctx, func() error {
		fb := FolderBranch{rmd.TlfID(), MasterBranch}
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
	node Node, ei EntryInfo, handle *TlfHandle, err error) {
	fbo.log.CDebugf(ctx, "getRootNode")
	defer func() {
		fbo.deferLog.CDebugf(ctx, "getRootNode done: %s %+v",
			getNodeIDStr(node), err)
	}()

	lState := makeFBOLockState()

	var md ImmutableRootMetadata
	md, err = fbo.getMDForReadLocked(ctx, lState, mdReadNoIdentify)
	if _, ok := err.(MDWriteNeededInRequest); ok {
		func() {
			fbo.mdWriterLock.Lock(lState)
			defer fbo.mdWriterLock.Unlock(lState)
			md, err = fbo.getMDForWriteOrRekeyLocked(ctx, lState, mdWrite)
		}()
	}
	if err != nil {
		return nil, EntryInfo{}, nil, err
	}

	// we may be an unkeyed client
	if err := isReadableOrError(ctx, fbo.config.KBPKI(), md.ReadOnly()); err != nil {
		return nil, EntryInfo{}, nil, err
	}

	handle = md.GetTlfHandle()
	node, err = fbo.nodeCache.GetOrCreate(md.data.Dir.BlockPointer,
		string(handle.GetCanonicalName()), nil)
	if err != nil {
		return nil, EntryInfo{}, nil, err
	}

	return node, md.Data().Dir.EntryInfo, handle, nil
}

type makeNewBlock func() Block

// pathFromNodeHelper() shouldn't be called except by the helper
// functions below.
func (fbo *folderBranchOps) pathFromNodeHelper(n Node) (path, error) {
	p := fbo.nodeCache.PathFromNode(n)
	if !p.isValid() {
		return path{}, InvalidPathError{p}
	}
	return p, nil
}

// Helper functions to clarify uses of pathFromNodeHelper() (see
// nodeCache comments).

func (fbo *folderBranchOps) pathFromNodeForRead(n Node) (path, error) {
	return fbo.pathFromNodeHelper(n)
}

func (fbo *folderBranchOps) pathFromNodeForMDWriteLocked(
	lState *lockState, n Node) (path, error) {
	fbo.mdWriterLock.AssertLocked(lState)
	return fbo.pathFromNodeHelper(n)
}

func (fbo *folderBranchOps) GetDirChildren(ctx context.Context, dir Node) (
	children map[string]EntryInfo, err error) {
	fbo.log.CDebugf(ctx, "GetDirChildren %s", getNodeIDStr(dir))
	defer func() {
		fbo.deferLog.CDebugf(ctx, "GetDirChildren %s done: %+v",
			getNodeIDStr(dir), err)
	}()

	err = fbo.checkNode(dir)
	if err != nil {
		return nil, err
	}

	err = runUnlessCanceled(ctx, func() error {
		var err error
		lState := makeFBOLockState()

		md, err := fbo.getMDForReadNeedIdentify(ctx, lState)
		if err != nil {
			return err
		}

		dirPath, err := fbo.pathFromNodeForRead(dir)
		if err != nil {
			return err
		}

		// If the MD doesn't match the MD expected by the path, that
		// implies we are using a cached path, which implies the node
		// has been unlinked.  Probably we have fast-forwarded, and
		// missed all the updates deleting the children in this
		// directory.  In that case, just return an empty set of
		// children so we don't return an incorrect set from the
		// cache.
		if md.data.Dir.BlockPointer.ID != dirPath.path[0].BlockPointer.ID {
			fbo.log.CDebugf(ctx, "Returning an empty children set for "+
				"unlinked directory %v", dirPath.tailPointer())
			return nil
		}

		children, err = fbo.blocks.GetDirtyDirChildren(
			ctx, lState, md.ReadOnly(), dirPath)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return children, nil
}

func (fbo *folderBranchOps) Lookup(ctx context.Context, dir Node, name string) (
	node Node, ei EntryInfo, err error) {
	fbo.log.CDebugf(ctx, "Lookup %s %s", getNodeIDStr(dir), name)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Lookup %s %s done: %v %+v",
			getNodeIDStr(dir), name, getNodeIDStr(node), err)
	}()

	err = fbo.checkNode(dir)
	if err != nil {
		return nil, EntryInfo{}, err
	}

	var de DirEntry
	err = runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()

		md, err := fbo.getMDForReadNeedIdentify(ctx, lState)
		if err != nil {
			return err
		}

		node, de, err = fbo.blocks.Lookup(ctx, lState, md.ReadOnly(), dir, name)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, EntryInfo{}, err
	}
	return node, de.EntryInfo, nil
}

// statEntry is like Stat, but it returns a DirEntry. This is used by
// tests.
func (fbo *folderBranchOps) statEntry(ctx context.Context, node Node) (
	de DirEntry, err error) {
	err = fbo.checkNode(node)
	if err != nil {
		return DirEntry{}, err
	}

	lState := makeFBOLockState()

	nodePath, err := fbo.pathFromNodeForRead(node)
	if err != nil {
		return DirEntry{}, err
	}

	var md ImmutableRootMetadata
	if nodePath.hasValidParent() {
		md, err = fbo.getMDForReadNeedIdentify(ctx, lState)
	} else {
		// If nodePath has no valid parent, it's just the TLF
		// root, so we don't need an identify in this case.
		md, err = fbo.getMDForReadNoIdentify(ctx, lState)
	}
	if err != nil {
		return DirEntry{}, err
	}

	if nodePath.hasValidParent() {
		de, err = fbo.blocks.GetDirtyEntry(
			ctx, lState, md.ReadOnly(), nodePath)
		if err != nil {
			return DirEntry{}, err
		}

	} else {
		// nodePath is just the root.
		de = md.data.Dir
	}

	return de, nil
}

var zeroPtr BlockPointer

type blockState struct {
	blockPtr       BlockPointer
	block          Block
	readyBlockData ReadyBlockData
	syncedCb       func() error
}

func (fbo *folderBranchOps) Stat(ctx context.Context, node Node) (
	ei EntryInfo, err error) {
	fbo.log.CDebugf(ctx, "Stat %s", getNodeIDStr(node))
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Stat %s done: %+v",
			getNodeIDStr(node), err)
	}()

	var de DirEntry
	err = runUnlessCanceled(ctx, func() error {
		de, err = fbo.statEntry(ctx, node)
		return err
	})
	if err != nil {
		return EntryInfo{}, err
	}
	return de.EntryInfo, nil
}

func (fbo *folderBranchOps) GetNodeMetadata(ctx context.Context, node Node) (
	ei NodeMetadata, err error) {
	fbo.log.CDebugf(ctx, "GetNodeMetadata %s", getNodeIDStr(node))
	defer func() {
		fbo.deferLog.CDebugf(ctx, "GetNodeMetadata %s done: %+v",
			getNodeIDStr(node), err)
	}()

	var de DirEntry
	err = runUnlessCanceled(ctx, func() error {
		de, err = fbo.statEntry(ctx, node)
		return err
	})
	var res NodeMetadata
	if err != nil {
		return res, err
	}
	res.BlockInfo = de.BlockInfo
	uid := de.Writer
	if uid == keybase1.UID("") {
		uid = de.Creator
	}
	res.LastWriterUnverified, err =
		fbo.config.KBPKI().GetNormalizedUsername(ctx, uid)
	if err != nil {
		return res, err
	}
	return res, nil
}

// blockPutState is an internal structure to track data when putting blocks
type blockPutState struct {
	blockStates []blockState
}

func newBlockPutState(length int) *blockPutState {
	bps := &blockPutState{}
	bps.blockStates = make([]blockState, 0, length)
	return bps
}

// addNewBlock tracks a new block that will be put.  If syncedCb is
// non-nil, it will be called whenever the put for that block is
// complete (whether or not the put resulted in an error).  Currently
// it will not be called if the block is never put (due to an earlier
// error).
func (bps *blockPutState) addNewBlock(blockPtr BlockPointer, block Block,
	readyBlockData ReadyBlockData, syncedCb func() error) {
	bps.blockStates = append(bps.blockStates,
		blockState{blockPtr, block, readyBlockData, syncedCb})
}

func (bps *blockPutState) mergeOtherBps(other *blockPutState) {
	bps.blockStates = append(bps.blockStates, other.blockStates...)
}

func (bps *blockPutState) DeepCopy() *blockPutState {
	newBps := &blockPutState{}
	newBps.blockStates = make([]blockState, len(bps.blockStates))
	copy(newBps.blockStates, bps.blockStates)
	return newBps
}

type localBcache map[BlockPointer]*DirBlock

// syncBlockLock calls syncBlock under mdWriterLock.
func (fbo *folderBranchOps) syncBlockLocked(
	ctx context.Context, lState *lockState, uid keybase1.UID,
	md *RootMetadata, newBlock Block, dir path, name string,
	entryType EntryType, mtime bool, ctime bool, stopAt BlockPointer,
	lbc localBcache) (path, DirEntry, *blockPutState, error) {
	fbo.mdWriterLock.AssertLocked(lState)
	return fbo.prepper.prepUpdateForPath(
		ctx, lState, uid, md, newBlock, dir, name,
		entryType, mtime, ctime, stopAt, lbc)
}

// syncBlockForConflictResolution calls syncBlock unlocked, since
// conflict resolution can handle MD revision number conflicts
// correctly.
func (fbo *folderBranchOps) syncBlockForConflictResolution(
	ctx context.Context, lState *lockState, uid keybase1.UID,
	md *RootMetadata, newBlock Block, dir path, name string,
	entryType EntryType, mtime bool, ctime bool, stopAt BlockPointer,
	lbc localBcache) (path, DirEntry, *blockPutState, error) {
	return fbo.prepper.prepUpdateForPath(
		ctx, lState, uid, md, newBlock, dir,
		name, entryType, mtime, ctime, stopAt, lbc)
}

// entryType must not be Sym.
func (fbo *folderBranchOps) syncBlockAndCheckEmbedLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, newBlock Block, dir path,
	name string, entryType EntryType, mtime bool, ctime bool,
	stopAt BlockPointer, lbc localBcache) (
	path, DirEntry, *blockPutState, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return path{}, DirEntry{}, nil, err
	}

	newPath, newDe, bps, err := fbo.syncBlockLocked(
		ctx, lState, session.UID, md, newBlock, dir, name, entryType,
		mtime, ctime, stopAt, lbc)
	if err != nil {
		return path{}, DirEntry{}, nil, err
	}

	// Do the block changes need their own blocks?  Unembed only if
	// this is the final call to this function with this MD.
	if stopAt == zeroPtr {
		bsplit := fbo.config.BlockSplitter()
		if !bsplit.ShouldEmbedBlockChanges(&md.data.Changes) {
			err = fbo.prepper.unembedBlockChanges(
				ctx, bps, md, &md.data.Changes, session.UID)
			if err != nil {
				return path{}, DirEntry{}, nil, err
			}
		}
	}

	return newPath, newDe, bps, nil
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

func (fbo *folderBranchOps) finalizeBlocks(bps *blockPutState) error {
	if bps == nil {
		return nil
	}
	bcache := fbo.config.BlockCache()
	for _, blockState := range bps.blockStates {
		newPtr := blockState.blockPtr
		// only cache this block if we made a brand new block, not if
		// we just incref'd some other block.
		if !newPtr.IsFirstRef() {
			continue
		}
		if err := bcache.Put(newPtr, fbo.id(), blockState.block,
			TransientEntry); err != nil {
			return err
		}
	}
	return nil
}

// Returns true if the passed error indicates a revision conflict.
func isRevisionConflict(err error) bool {
	if err == nil {
		return false
	}
	_, isConflictRevision := err.(MDServerErrorConflictRevision)
	_, isConflictPrevRoot := err.(MDServerErrorConflictPrevRoot)
	_, isConflictDiskUsage := err.(MDServerErrorConflictDiskUsage)
	_, isConditionFailed := err.(MDServerErrorConditionFailed)
	_, isConflictFolderMapping := err.(MDServerErrorConflictFolderMapping)
	_, isJournal := err.(MDJournalConflictError)
	return isConflictRevision || isConflictPrevRoot ||
		isConflictDiskUsage || isConditionFailed ||
		isConflictFolderMapping || isJournal
}

func (fbo *folderBranchOps) finalizeMDWriteLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, bps *blockPutState, excl Excl,
	afterUpdateFn func() error) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// finally, write out the new metadata
	mdops := fbo.config.MDOps()

	doUnmergedPut := true
	mergedRev := MetadataRevisionUninitialized

	oldPrevRoot := md.PrevRoot()

	var mdID MdID

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
	if err = EnableDelayedCancellationWithGracePeriod(
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

	err = fbo.finalizeBlocks(bps)
	if err != nil {
		return err
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	if fbo.isMasterBranchLocked(lState) {
		// only do a normal Put if we're not already staged.
		mdID, err = mdops.Put(ctx, md)
		if doUnmergedPut = isRevisionConflict(err); doUnmergedPut {
			fbo.log.CDebugf(ctx, "Conflict: %v", err)
			mergedRev = md.Revision()

			if excl == WithExcl {
				// If this was caused by an exclusive create, we shouldn't do an
				// UnmergedPut, but rather try to get newest update from server, and
				// retry afterwards.
				err = fbo.getAndApplyMDUpdates(ctx, lState, fbo.applyMDUpdatesLocked)
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
		mdID, err = mdops.PutUnmerged(ctx, md)
		if isRevisionConflict(err) {
			// Self-conflicts are retried in `doMDWriteWithRetry`.
			err = UnmergedSelfConflictError{err}
		}
		if err != nil {
			return err
		}
		bid := md.BID()
		fbo.setBranchIDLocked(lState, bid)
		doResolve = true
	} else {
		fbo.setBranchIDLocked(lState, NullBranchID)

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

	md.loadCachedBlockChanges(ctx, bps, fbo.log)

	rebased := (oldPrevRoot != md.PrevRoot())
	if rebased {
		bid := md.BID()
		fbo.setBranchIDLocked(lState, bid)
		doResolve = true
		resolveMergedRev = MetadataRevisionUninitialized
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	irmd := MakeImmutableRootMetadata(
		md, session.VerifyingKey, mdID, fbo.config.Clock().Now())
	err = fbo.setHeadSuccessorLocked(ctx, lState, irmd, rebased)
	if err != nil {
		return err
	}

	// Archive the old, unref'd blocks if journaling is off.
	if !TLFJournalEnabled(fbo.config, fbo.id()) {
		fbo.fbm.archiveUnrefBlocks(irmd.ReadOnly())
	}

	err = fbo.notifyBatchLocked(ctx, lState, irmd, afterUpdateFn)
	if err != nil {
		return err
	}

	// Call Resolve() after the head is set, to make sure it fetches
	// the correct unmerged MD range during resolution.
	if doResolve {
		fbo.cr.Resolve(md.Revision(), resolveMergedRev)
	}
	return nil
}

func (fbo *folderBranchOps) waitForJournalLocked(ctx context.Context,
	lState *lockState, jServer *JournalServer) error {
	fbo.mdWriterLock.AssertLocked(lState)

	if !TLFJournalEnabled(fbo.config, fbo.id()) {
		// Nothing to do.
		return nil
	}

	if err := jServer.Wait(ctx, fbo.id()); err != nil {
		return err
	}

	// Make sure everything flushed successfully, since we're holding
	// the writer lock, no other revisions could have snuck in.
	jStatus, err := jServer.JournalStatus(fbo.id())
	if err != nil {
		return err
	}
	if jStatus.RevisionEnd != MetadataRevisionUninitialized {
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
	lState *lockState, md *RootMetadata,
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
	if jServer, err := GetJournalServer(fbo.config); err == nil {
		if err = fbo.waitForJournalLocked(ctx, lState, jServer); err != nil {
			return err
		}
		mdOps = jServer.delegateMDOps
	}
	mdID, err := mdOps.Put(ctx, md)
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

	fbo.setBranchIDLocked(lState, NullBranchID)

	rebased := (oldPrevRoot != md.PrevRoot())
	if rebased {
		bid := md.BID()
		fbo.setBranchIDLocked(lState, bid)
		fbo.cr.Resolve(md.Revision(), MetadataRevisionUninitialized)
	}

	md.loadCachedBlockChanges(ctx, nil, fbo.log)

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

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	err = fbo.setHeadSuccessorLocked(ctx, lState,
		MakeImmutableRootMetadata(md, key, mdID, fbo.config.Clock().Now()),
		rebased)
	if err != nil {
		return err
	}

	// Explicitly set the latest merged revision, since if journaling
	// is on, `setHeadLocked` will not do it for us (even though
	// rekeys bypass the journal).
	fbo.setLatestMergedRevisionLocked(ctx, lState, md.Revision(), false)
	return nil
}

func (fbo *folderBranchOps) finalizeGCOp(ctx context.Context, gco *GCOp) (
	err error) {
	lState := makeFBOLockState()
	// Lock the folder so we can get an internally-consistent MD
	// revision number.
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)

	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	if md.MergedStatus() == Unmerged {
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

	err = fbo.finalizeBlocks(bps)
	if err != nil {
		return err
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	// finally, write out the new metadata
	mdID, err := fbo.config.MDOps().Put(ctx, md)
	if err != nil {
		// Don't allow garbage collection to put us into a conflicting
		// state; just wait for the next period.
		return err
	}

	fbo.setBranchIDLocked(lState, NullBranchID)
	md.loadCachedBlockChanges(ctx, bps, fbo.log)

	rebased := (oldPrevRoot != md.PrevRoot())
	if rebased {
		bid := md.BID()
		fbo.setBranchIDLocked(lState, bid)
		fbo.cr.Resolve(md.Revision(), MetadataRevisionUninitialized)
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	irmd := MakeImmutableRootMetadata(
		md, session.VerifyingKey, mdID, fbo.config.Clock().Now())
	err = fbo.setHeadSuccessorLocked(ctx, lState, irmd, rebased)
	if err != nil {
		return err
	}

	return fbo.notifyBatchLocked(ctx, lState, irmd, nil)
}

func (fbo *folderBranchOps) syncBlockAndFinalizeLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, newBlock Block, dir path,
	name string, entryType EntryType, mtime bool, ctime bool,
	stopAt BlockPointer, excl Excl) (de DirEntry, err error) {
	fbo.mdWriterLock.AssertLocked(lState)
	_, de, bps, err := fbo.syncBlockAndCheckEmbedLocked(
		ctx, lState, md, newBlock, dir, name, entryType, mtime,
		ctime, zeroPtr, nil)
	if err != nil {
		return DirEntry{}, err
	}

	defer func() {
		if err != nil {
			fbo.fbm.cleanUpBlockState(
				md.ReadOnly(), bps, blockDeleteOnMDFail)
		}
	}()

	_, err = doBlockPuts(ctx, fbo.config.BlockServer(),
		fbo.config.BlockCache(), fbo.config.Reporter(), fbo.log, md.TlfID(),
		md.GetTlfHandle().GetCanonicalName(), *bps)
	if err != nil {
		return DirEntry{}, err
	}
	err = fbo.finalizeMDWriteLocked(ctx, lState, md, bps, excl, nil)
	if err != nil {
		return DirEntry{}, err
	}
	return de, nil
}

func checkDisallowedPrefixes(name string) error {
	for _, prefix := range disallowedPrefixes {
		if strings.HasPrefix(name, prefix) {
			return DisallowedPrefixError{name, prefix}
		}
	}
	return nil
}

func (fbo *folderBranchOps) checkNewDirSize(ctx context.Context,
	lState *lockState, md ReadOnlyRootMetadata,
	dirPath path, newName string) error {
	// Check that the directory isn't past capacity already.
	var currSize uint64
	if dirPath.hasValidParent() {
		de, err := fbo.blocks.GetDirtyEntry(ctx, lState, md, dirPath)
		if err != nil {
			return err
		}
		currSize = de.Size
	} else {
		// dirPath is just the root.
		currSize = md.data.Dir.Size
	}
	// Just an approximation since it doesn't include the size of the
	// directory entry itself, but that's ok -- at worst it'll be an
	// off-by-one-entry error, and since there's a maximum name length
	// we can't get in too much trouble.
	if currSize+uint64(len(newName)) > fbo.config.MaxDirBytes() {
		return DirTooBigError{dirPath, currSize + uint64(len(newName)),
			fbo.config.MaxDirBytes()}
	}
	return nil
}

// PathType returns path type
func (fbo *folderBranchOps) PathType() PathType {
	if fbo.folderBranch.Tlf.IsPublic() {
		return PublicPathType
	}
	return PrivatePathType
}

// canonicalPath returns full canonical path for dir node and name.
func (fbo *folderBranchOps) canonicalPath(ctx context.Context, dir Node, name string) (string, error) {
	dirPath, err := fbo.pathFromNodeForRead(dir)
	if err != nil {
		return "", err
	}
	return BuildCanonicalPath(fbo.PathType(), dirPath.String(), name), nil
}

// entryType must not by Sym.
func (fbo *folderBranchOps) createEntryLocked(
	ctx context.Context, lState *lockState, dir Node, name string,
	entryType EntryType, excl Excl) (Node, DirEntry, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	if err := checkDisallowedPrefixes(name); err != nil {
		return nil, DirEntry{}, err
	}

	if uint32(len(name)) > fbo.config.MaxNameBytes() {
		return nil, DirEntry{},
			NameTooLongError{name, fbo.config.MaxNameBytes()}
	}

	filename, err := fbo.canonicalPath(ctx, dir, name)
	if err != nil {
		return nil, DirEntry{}, err
	}

	// verify we have permission to write
	md, err := fbo.getMDForWriteLockedForFilename(ctx, lState, filename)
	if err != nil {
		return nil, DirEntry{}, err
	}

	dirPath, err := fbo.pathFromNodeForMDWriteLocked(lState, dir)
	if err != nil {
		return nil, DirEntry{}, err
	}

	dblock, err := fbo.blocks.GetDir(
		ctx, lState, md.ReadOnly(), dirPath, blockWrite)
	if err != nil {
		return nil, DirEntry{}, err
	}

	// does name already exist?
	if _, ok := dblock.Children[name]; ok {
		return nil, DirEntry{}, NameExistsError{name}
	}

	if err := fbo.checkNewDirSize(
		ctx, lState, md.ReadOnly(), dirPath, name); err != nil {
		return nil, DirEntry{}, err
	}

	co, err := newCreateOp(name, dirPath.tailPointer(), entryType)
	if err != nil {
		return nil, DirEntry{}, err
	}
	co.setFinalPath(dirPath)
	md.AddOp(co)
	// create new data block
	var newBlock Block
	if entryType == Dir {
		newBlock = &DirBlock{
			Children: make(map[string]DirEntry),
		}
	} else {
		newBlock = &FileBlock{}
	}

	// Cache update and operations until batch happens.  Make a new
	// temporary ID and directory entry.
	newID, err := fbo.config.cryptoPure().MakeTemporaryBlockID()
	if err != nil {
		return nil, DirEntry{}, err
	}
	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return nil, DirEntry{}, err
	}

	newPtr := BlockPointer{
		ID:         newID,
		KeyGen:     md.LatestKeyGeneration(),
		DataVer:    fbo.config.DataVersion(),
		DirectType: DirectBlock,
		Context: kbfsblock.MakeFirstContext(
			session.UID, keybase1.BlockType_DATA),
	}
	node, err := fbo.nodeCache.GetOrCreate(newPtr, name, dir)
	if err != nil {
		return nil, DirEntry{}, err
	}
	de := DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: newPtr,
			EncodedSize:  0,
		},
		EntryInfo: EntryInfo{
			Type: entryType,
			Size: 0,
		},
	}
	fbo.blocks.AddDirEntryInCache(lState, dirPath, name, de)
	fbo.dirOps = append(fbo.dirOps, cachedDirOp{co, []Node{dir, node}})

	cleanupFn := func() {
		// Until KBFS-2076 is done, clear out the cached dir data manually.
		fbo.dirOps = nil
		fbo.blocks.ClearCachedAddsAndRemoves(lState, dirPath)
		fbo.blocks.ClearCacheInfo(lState, dirPath.ChildPath(name, newPtr))
	}
	defer cleanupFn()

	de, err = fbo.syncBlockAndFinalizeLocked(
		ctx, lState, md, newBlock, dirPath, name, entryType,
		true, true, zeroPtr, excl)
	_, isNoUpdatesWhileDirty := errors.Cause(err).(NoUpdatesWhileDirtyError)
	if excl == WithExcl && isNoUpdatesWhileDirty {
		// If an exclusive write hits a conflict, it will try to
		// update, but won't be able to because of the dirty directory
		// entries.  We need to clean up the dirty entries here first
		// before trying to apply the updates again.  By returning
		// `ExclOnUnmergedError` below, we force the caller to retry
		// the whole operation again.
		fbo.log.CDebugf(ctx, "Clearing dirty entries before applying new "+
			"updates for exclusive write")
		cleanupFn()
		err = fbo.getAndApplyMDUpdates(ctx, lState, fbo.applyMDUpdatesLocked)
		if err != nil {
			return nil, DirEntry{}, err
		}
		return nil, DirEntry{}, ExclOnUnmergedError{}
	} else if err != nil {
		return nil, DirEntry{}, err
	}

	{
		// Until KBFS-2076 is done, update the node cache for the
		// newly created node manually.
		updated := fbo.nodeCache.UpdatePointer(newPtr.Ref(), de.BlockPointer)
		if !updated {
			return nil, DirEntry{},
				errors.Errorf("Couldn't update pointer for new node %s, %v",
					name, newPtr)
		}
	}
	return node, de, nil
}

func (fbo *folderBranchOps) maybeWaitForSquash(
	ctx context.Context, bid BranchID) {
	if bid != PendingLocalSquashBranchID {
		return
	}

	fbo.log.CDebugf(ctx, "Blocking until squash finishes")
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
	lState *lockState, fn func(lState *lockState) error) error {
	doUnlock := false
	defer func() {
		if doUnlock {
			bid := fbo.bid
			fbo.mdWriterLock.Unlock(lState)
			// Don't let a pending squash get too big.
			fbo.maybeWaitForSquash(ctx, bid)
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
				go func() {
					select {
					case <-ctx.Done():
						cancel()
					case <-newCtx.Done():
					}
				}()
				fbo.log.CDebugf(ctx, "Got a revision conflict while unmerged "+
					"(%v); forcing a sync", err)
				err = fbo.getAndApplyNewestUnmergedHead(newCtx, lState)
				if err != nil {
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
	ctx context.Context, fn func(lState *lockState) error) error {
	return runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()
		return fbo.doMDWriteWithRetry(ctx, lState, fn)
	})
}

func (fbo *folderBranchOps) CreateDir(
	ctx context.Context, dir Node, path string) (
	n Node, ei EntryInfo, err error) {
	fbo.log.CDebugf(ctx, "CreateDir %s %s", getNodeIDStr(dir), path)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "CreateDir %s %s done: %v %+v",
			getNodeIDStr(dir), path, getNodeIDStr(n), err)
	}()

	err = fbo.checkNode(dir)
	if err != nil {
		return nil, EntryInfo{}, err
	}

	var retNode Node
	var retEntryInfo EntryInfo
	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			node, de, err :=
				fbo.createEntryLocked(ctx, lState, dir, path, Dir, NoExcl)
			// Don't set node and ei directly, as that can cause a
			// race when the Create is canceled.
			retNode = node
			retEntryInfo = de.EntryInfo
			return err
		})
	if err != nil {
		return nil, EntryInfo{}, err
	}
	return retNode, retEntryInfo, nil
}

func (fbo *folderBranchOps) CreateFile(
	ctx context.Context, dir Node, path string, isExec bool, excl Excl) (
	n Node, ei EntryInfo, err error) {
	fbo.log.CDebugf(ctx, "CreateFile %s %s isExec=%v Excl=%s",
		getNodeIDStr(dir), path, isExec, excl)
	defer func() {
		fbo.deferLog.CDebugf(ctx,
			"CreateFile %s %s isExec=%v Excl=%s done: %v %+v",
			getNodeIDStr(dir), path, isExec, excl,
			getNodeIDStr(n), err)
	}()

	err = fbo.checkNode(dir)
	if err != nil {
		return nil, EntryInfo{}, err
	}

	var entryType EntryType
	if isExec {
		entryType = Exec
	} else {
		entryType = File
	}

	// If journaling is turned on, an exclusive create may end up on a
	// conflict branch.
	if excl == WithExcl && TLFJournalEnabled(fbo.config, fbo.id()) {
		fbo.log.CDebugf(ctx, "Exclusive create status is being discarded.")
		excl = NoExcl
	}

	if excl == WithExcl {
		if err = fbo.cr.Wait(ctx); err != nil {
			return nil, EntryInfo{}, err
		}
	}

	var retNode Node
	var retEntryInfo EntryInfo
	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			// Don't set node and ei directly, as that can cause a
			// race when the Create is canceled.
			node, de, err :=
				fbo.createEntryLocked(ctx, lState, dir, path, entryType, excl)
			retNode = node
			retEntryInfo = de.EntryInfo
			return err
		})
	if err != nil {
		return nil, EntryInfo{}, err
	}
	return retNode, retEntryInfo, nil
}

func (fbo *folderBranchOps) createLinkLocked(
	ctx context.Context, lState *lockState, dir Node, fromName string,
	toPath string) (DirEntry, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	if err := checkDisallowedPrefixes(fromName); err != nil {
		return DirEntry{}, err
	}

	if uint32(len(fromName)) > fbo.config.MaxNameBytes() {
		return DirEntry{},
			NameTooLongError{fromName, fbo.config.MaxNameBytes()}
	}

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return DirEntry{}, err
	}

	dirPath, err := fbo.pathFromNodeForMDWriteLocked(lState, dir)
	if err != nil {
		return DirEntry{}, err
	}

	dblock, err := fbo.blocks.GetDir(
		ctx, lState, md.ReadOnly(), dirPath, blockWrite)
	if err != nil {
		return DirEntry{}, err
	}

	// TODO: validate inputs

	// does name already exist?
	if _, ok := dblock.Children[fromName]; ok {
		return DirEntry{}, NameExistsError{fromName}
	}

	if err := fbo.checkNewDirSize(ctx, lState, md.ReadOnly(),
		dirPath, fromName); err != nil {
		return DirEntry{}, err
	}

	co, err := newCreateOp(fromName, dirPath.tailPointer(), Sym)
	if err != nil {
		return DirEntry{}, err
	}
	co.setFinalPath(dirPath)
	md.AddOp(co)

	// Create a direntry for the link, and then sync
	now := fbo.nowUnixNano()
	de := DirEntry{
		EntryInfo: EntryInfo{
			Type:    Sym,
			Size:    uint64(len(toPath)),
			SymPath: toPath,
			Mtime:   now,
			Ctime:   now,
		},
	}
	dblock.Children[fromName] = de

	fbo.blocks.AddDirEntryInCache(lState, dirPath, fromName, de)
	fbo.dirOps = append(fbo.dirOps, cachedDirOp{co, []Node{dir}})

	defer func() {
		// Until KBFS-2076 is done, clear out the cached dir data manually.
		fbo.dirOps = nil
		fbo.blocks.ClearCachedAddsAndRemoves(lState, dirPath)
	}()

	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, lState, md, dblock, *dirPath.parentPath(),
		dirPath.tailName(), Dir, true, true, zeroPtr, NoExcl)
	if err != nil {
		return DirEntry{}, err
	}
	return dblock.Children[fromName], nil
}

func (fbo *folderBranchOps) CreateLink(
	ctx context.Context, dir Node, fromName string, toPath string) (
	ei EntryInfo, err error) {
	fbo.log.CDebugf(ctx, "CreateLink %s %s -> %s",
		getNodeIDStr(dir), fromName, toPath)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "CreateLink %s %s -> %s done: %+v",
			getNodeIDStr(dir), fromName, toPath, err)
	}()

	err = fbo.checkNode(dir)
	if err != nil {
		return EntryInfo{}, err
	}

	var retEntryInfo EntryInfo
	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			// Don't set ei directly, as that can cause a race when
			// the Create is canceled.
			de, err := fbo.createLinkLocked(ctx, lState, dir, fromName, toPath)
			retEntryInfo = de.EntryInfo
			return err
		})
	if err != nil {
		return EntryInfo{}, err
	}
	return retEntryInfo, nil
}

// unrefEntry modifies md to unreference all relevant blocks for the
// given entry.
func (fbo *folderBranchOps) unrefEntry(ctx context.Context,
	lState *lockState, md *RootMetadata, dir path, de DirEntry,
	name string) error {
	md.AddUnrefBlock(de.BlockInfo)
	// construct a path for the child so we can unlink with it.
	childPath := dir.ChildPath(name, de.BlockPointer)

	// If this is an indirect block, we need to delete all of its
	// children as well. NOTE: non-empty directories can't be
	// removed, so no need to check for indirect directory blocks
	// here.
	if de.Type == File || de.Type == Exec {
		blockInfos, err := fbo.blocks.GetIndirectFileBlockInfos(
			ctx, lState, md.ReadOnly(), childPath)
		if isRecoverableBlockErrorForRemoval(err) {
			msg := fmt.Sprintf("Recoverable block error encountered for unrefEntry(%v); continuing", childPath)
			fbo.log.CWarningf(ctx, "%s", msg)
			fbo.log.CDebugf(ctx, "%s (err=%v)", msg, err)
		} else if err != nil {
			return err
		}
		for _, blockInfo := range blockInfos {
			md.AddUnrefBlock(blockInfo)
		}
	}
	return nil
}

func (fbo *folderBranchOps) removeEntryLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, dir Node, dirPath path,
	name string) error {
	fbo.mdWriterLock.AssertLocked(lState)

	pblock, err := fbo.blocks.GetDir(
		ctx, lState, md.ReadOnly(), dirPath, blockWrite)
	if err != nil {
		return err
	}

	// make sure the entry exists
	de, ok := pblock.Children[name]
	if !ok {
		return NoSuchNameError{name}
	}

	ro, err := newRmOp(name, dirPath.tailPointer())
	if err != nil {
		return err
	}
	ro.setFinalPath(dirPath)
	md.AddOp(ro)
	err = fbo.unrefEntry(ctx, lState, md, dirPath, de, name)
	if err != nil {
		return err
	}

	// the actual unlink
	delete(pblock.Children, name)

	fbo.blocks.RemoveDirEntryInCache(lState, dirPath, name)
	fbo.dirOps = append(fbo.dirOps, cachedDirOp{ro, []Node{dir}})

	defer func() {
		// Until KBFS-2076 is done, clear out the cached dir data manually.
		fbo.dirOps = nil
		fbo.blocks.ClearCachedAddsAndRemoves(lState, dirPath)
	}()

	// sync the parent directory
	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, lState, md, pblock, *dirPath.parentPath(), dirPath.tailName(),
		Dir, true, true, zeroPtr, NoExcl)
	if err != nil {
		return err
	}
	return nil
}

func (fbo *folderBranchOps) removeDirLocked(ctx context.Context,
	lState *lockState, dir Node, dirName string) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	dirPath, err := fbo.pathFromNodeForMDWriteLocked(lState, dir)
	if err != nil {
		return err
	}

	pblock, err := fbo.blocks.GetDir(
		ctx, lState, md.ReadOnly(), dirPath, blockRead)
	de, ok := pblock.Children[dirName]
	if !ok {
		return NoSuchNameError{dirName}
	}

	// construct a path for the child so we can check for an empty dir
	childPath := dirPath.ChildPath(dirName, de.BlockPointer)

	childBlock, err := fbo.blocks.GetDir(
		ctx, lState, md.ReadOnly(), childPath, blockRead)
	if isRecoverableBlockErrorForRemoval(err) {
		msg := fmt.Sprintf("Recoverable block error encountered for removeDirLocked(%v); continuing", childPath)
		fbo.log.CWarningf(ctx, "%s", msg)
		fbo.log.CDebugf(ctx, "%s (err=%v)", msg, err)
	} else if err != nil {
		return err
	} else if len(childBlock.Children) > 0 {
		return DirNotEmptyError{dirName}
	}

	return fbo.removeEntryLocked(ctx, lState, md, dir, dirPath, dirName)
}

func (fbo *folderBranchOps) RemoveDir(
	ctx context.Context, dir Node, dirName string) (err error) {
	fbo.log.CDebugf(ctx, "RemoveDir %s %s", getNodeIDStr(dir), dirName)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "RemoveDir %s %s done: %+v",
			getNodeIDStr(dir), dirName, err)
	}()

	err = fbo.checkNode(dir)
	if err != nil {
		return
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			return fbo.removeDirLocked(ctx, lState, dir, dirName)
		})
}

func (fbo *folderBranchOps) RemoveEntry(ctx context.Context, dir Node,
	name string) (err error) {
	fbo.log.CDebugf(ctx, "RemoveEntry %s %s", getNodeIDStr(dir), name)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "RemoveEntry %s %s done: %+v",
			getNodeIDStr(dir), name, err)
	}()

	err = fbo.checkNode(dir)
	if err != nil {
		return err
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			// verify we have permission to write
			md, err := fbo.getMDForWriteLocked(ctx, lState)
			if err != nil {
				return err
			}

			dirPath, err := fbo.pathFromNodeForMDWriteLocked(lState, dir)
			if err != nil {
				return err
			}

			return fbo.removeEntryLocked(ctx, lState, md, dir, dirPath, name)
		})
}

func (fbo *folderBranchOps) renameLocked(
	ctx context.Context, lState *lockState, oldParent Node, oldName string,
	newParent Node, newName string) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	oldParentPath, err := fbo.pathFromNodeForMDWriteLocked(lState, oldParent)
	if err != nil {
		return err
	}

	newParentPath, err := fbo.pathFromNodeForMDWriteLocked(lState, newParent)
	if err != nil {
		return err
	}

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	oldPBlock, newPBlock, newDe, lbc, err := fbo.blocks.PrepRename(
		ctx, lState, md, oldParentPath, oldName, newParentPath, newName)
	if err != nil {
		return err
	}

	// does name exist?
	if de, ok := newPBlock.Children[newName]; ok {
		// Usually higher-level programs check these, but just in case.
		if de.Type == Dir && newDe.Type != Dir {
			return NotDirError{newParentPath.ChildPathNoPtr(newName)}
		} else if de.Type != Dir && newDe.Type == Dir {
			return NotFileError{newParentPath.ChildPathNoPtr(newName)}
		}

		if de.Type == Dir {
			// The directory must be empty.
			oldTargetDir, err := fbo.blocks.GetDirBlockForReading(ctx, lState,
				md.ReadOnly(), de.BlockPointer, newParentPath.Branch,
				newParentPath.ChildPathNoPtr(newName))
			if err != nil {
				return err
			}
			if len(oldTargetDir.Children) != 0 {
				fbo.log.CWarningf(ctx, "Renaming over a non-empty directory "+
					" (%s/%s) not allowed.", newParentPath, newName)
				return DirNotEmptyError{newName}
			}
		}

		// Delete the old block pointed to by this direntry.
		err := fbo.unrefEntry(ctx, lState, md, newParentPath, de, newName)
		if err != nil {
			return err
		}
	}

	// only the ctime changes
	newDe.Ctime = fbo.nowUnixNano()
	newPBlock.Children[newName] = newDe
	delete(oldPBlock.Children, oldName)

	deleteTargetDirEntry := fbo.blocks.RenameDirEntryInCache(
		lState, oldParentPath, oldName, newParentPath, newName, newDe)
	ro := md.data.Changes.Ops[len(md.data.Changes.Ops)-1]
	cdo := cachedDirOp{ro, []Node{oldParent}}
	if oldParent.GetID() != newParent.GetID() {
		cdo.nodes = append(cdo.nodes, newParent)
	}
	fbo.dirOps = append(fbo.dirOps, cdo)

	defer func() {
		// Until KBFS-2076 is done, clear out the cached dir data manually.
		fbo.dirOps = nil
		fbo.blocks.ClearCachedAddsAndRemoves(lState, newParentPath)
		fbo.blocks.ClearCachedAddsAndRemoves(lState, oldParentPath)
		if deleteTargetDirEntry {
			fbo.blocks.ClearCacheInfo(
				lState, newParentPath.ChildPath(newName, newDe.BlockPointer))
		}
	}()

	// find the common ancestor
	var i int
	found := false
	// the root block will always be the same, so start at number 1
	for i = 1; i < len(oldParentPath.path) && i < len(newParentPath.path); i++ {
		if oldParentPath.path[i].ID != newParentPath.path[i].ID {
			found = true
			i--
			break
		}
	}
	if !found {
		// if we couldn't find one, then the common ancestor is the
		// last node in the shorter path
		if len(oldParentPath.path) < len(newParentPath.path) {
			i = len(oldParentPath.path) - 1
		} else {
			i = len(newParentPath.path) - 1
		}
	}
	commonAncestor := oldParentPath.path[i].BlockPointer
	oldIsCommon := oldParentPath.tailPointer() == commonAncestor
	newIsCommon := newParentPath.tailPointer() == commonAncestor

	newOldPath := path{FolderBranch: oldParentPath.FolderBranch}
	var oldBps *blockPutState
	if oldIsCommon {
		if newIsCommon {
			// if old and new are both the common ancestor, there is
			// nothing to do (syncBlock will take care of everything)
		} else {
			// If the old one is common and the new one is
			// not, then the last
			// syncBlockAndCheckEmbedLocked call will need
			// to access the old one.
			lbc[oldParentPath.tailPointer()] = oldPBlock
		}
	} else {
		if newIsCommon {
			// If the new one is common, then the first
			// syncBlockAndCheckEmbedLocked call will need to access
			// it.
			lbc[newParentPath.tailPointer()] = newPBlock
		}

		// The old one is not the common ancestor, so we need to sync it.
		// TODO: optimize by pushing blocks from both paths in parallel
		newOldPath, _, oldBps, err = fbo.syncBlockAndCheckEmbedLocked(
			ctx, lState, md, oldPBlock, *oldParentPath.parentPath(),
			oldParentPath.tailName(), Dir, true, true, commonAncestor, lbc)
		if err != nil {
			return err
		}
	}

	newNewPath, _, newBps, err := fbo.syncBlockAndCheckEmbedLocked(
		ctx, lState, md, newPBlock, *newParentPath.parentPath(),
		newParentPath.tailName(), Dir, true, true, zeroPtr, lbc)
	if err != nil {
		return err
	}

	// newOldPath is really just a prefix now.  A copy is necessary as an
	// append could cause the new path to contain nodes from the old path.
	newOldPath.path = append(make([]pathNode, i+1, i+1), newOldPath.path...)
	copy(newOldPath.path[:i+1], newNewPath.path[:i+1])

	// merge and finalize the blockPutStates
	if oldBps != nil {
		newBps.mergeOtherBps(oldBps)
	}

	defer func() {
		if err != nil {
			fbo.fbm.cleanUpBlockState(
				md.ReadOnly(), newBps, blockDeleteOnMDFail)
		}
	}()

	_, err = doBlockPuts(ctx, fbo.config.BlockServer(), fbo.config.BlockCache(),
		fbo.config.Reporter(), fbo.log, md.TlfID(),
		md.GetTlfHandle().GetCanonicalName(), *newBps)
	if err != nil {
		return err
	}

	return fbo.finalizeMDWriteLocked(ctx, lState, md, newBps, NoExcl, nil)
}

func (fbo *folderBranchOps) Rename(
	ctx context.Context, oldParent Node, oldName string, newParent Node,
	newName string) (err error) {
	fbo.log.CDebugf(ctx, "Rename %s/%s -> %s/%s", getNodeIDStr(oldParent),
		oldName, getNodeIDStr(newParent), newName)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Rename %s/%s -> %s/%s done: %+v",
			getNodeIDStr(oldParent), oldName,
			getNodeIDStr(newParent), newName, err)
	}()

	err = fbo.checkNode(newParent)
	if err != nil {
		return err
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
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
	fbo.log.CDebugf(ctx, "Read %s %d %d", getNodeIDStr(file),
		len(dest), off)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Read %s %d %d done: %+v",
			getNodeIDStr(file), len(dest), off, err)
	}()

	err = fbo.checkNode(file)
	if err != nil {
		return 0, err
	}

	filePath, err := fbo.pathFromNodeForRead(file)
	if err != nil {
		return 0, err
	}

	{
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
			for _, n := range filePath.path {
				if n.Name == ".git" {
					EnableDelayedCancellationWithGracePeriod(ctx, fbo.config.DelayedCancellationGracePeriod())
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

		bytesRead, err = fbo.blocks.Read(
			ctx, lState, md.ReadOnly(), filePath, dest, off)
		return err
	})
	if err != nil {
		return 0, err
	}
	return bytesRead, nil
}

func (fbo *folderBranchOps) signalWrite() {
	select {
	case fbo.syncNeededChan <- struct{}{}:
	default:
	}
}

func (fbo *folderBranchOps) Write(
	ctx context.Context, file Node, data []byte, off int64) (err error) {
	fbo.log.CDebugf(ctx, "Write %s %d %d", getNodeIDStr(file),
		len(data), off)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Write %s %d %d done: %+v",
			getNodeIDStr(file), len(data), off, err)
	}()

	err = fbo.checkNode(file)
	if err != nil {
		return err
	}

	return runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()

		// Get the MD for reading.  We won't modify it; we'll track the
		// unref changes on the side, and put them into the MD during the
		// sync.
		md, err := fbo.getMDForReadLocked(ctx, lState, mdReadNeedIdentify)
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
	fbo.log.CDebugf(ctx, "Truncate %s %d", getNodeIDStr(file), size)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Truncate %s %d done: %+v",
			getNodeIDStr(file), size, err)
	}()

	err = fbo.checkNode(file)
	if err != nil {
		return err
	}

	return runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()

		// Get the MD for reading.  We won't modify it; we'll track the
		// unref changes on the side, and put them into the MD during the
		// sync.
		md, err := fbo.getMDForReadLocked(ctx, lState, mdReadNeedIdentify)
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
	ctx context.Context, lState *lockState, file Node, ex bool) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	filePath, err := fbo.pathFromNodeForMDWriteLocked(lState, file)
	if err != nil {
		return err
	}

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return
	}

	dblock, de, err := fbo.blocks.GetDirtyParentAndEntry(
		ctx, lState, md.ReadOnly(), filePath)
	if err != nil {
		return err
	}

	// If the file is a symlink, do nothing (to match ext4
	// behavior).
	if de.Type == Sym || de.Type == Dir {
		fbo.log.CDebugf(ctx, "Ignoring setex on type %s", de.Type)
		return nil
	}

	if ex && (de.Type == File) {
		de.Type = Exec
	} else if !ex && (de.Type == Exec) {
		de.Type = File
	} else {
		// Treating this as a no-op, without updating the ctime, is a
		// POSIX violation, but it's an important optimization to keep
		// permissions-preserving rsyncs fast.
		fbo.log.CDebugf(ctx, "Ignoring no-op setex")
		return nil
	}

	de.Ctime = fbo.nowUnixNano()

	parentPath := filePath.parentPath()
	sao, err := newSetAttrOp(filePath.tailName(), parentPath.tailPointer(),
		exAttr, filePath.tailPointer())
	if err != nil {
		return err
	}

	// If the MD doesn't match the MD expected by the path, that
	// implies we are using a cached path, which implies the node has
	// been unlinked.  In that case, we can safely ignore this setex.
	if md.data.Dir.BlockPointer.ID != filePath.path[0].BlockPointer.ID {
		fbo.log.CDebugf(ctx, "Skipping setex for a removed file %v",
			filePath.tailPointer())
		fbo.blocks.UpdateCachedEntryAttributesOnRemovedFile(
			ctx, lState, sao, de)
		return nil
	}

	sao.setFinalPath(filePath)
	md.AddOp(sao)

	deleteTargetDirEntry := fbo.blocks.SetAttrInDirEntryInCache(
		lState, de, sao.Attr)
	fbo.dirOps = append(fbo.dirOps, cachedDirOp{sao, []Node{file}})

	defer func() {
		// Until KBFS-2076 is done, clear out the cached dir data manually.
		fbo.dirOps = nil
		if deleteTargetDirEntry {
			fbo.blocks.ClearCacheInfo(lState, filePath)
		}
	}()

	dblock.Children[filePath.tailName()] = de
	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, lState, md, dblock, *parentPath.parentPath(), parentPath.tailName(),
		Dir, false, false, zeroPtr, NoExcl)
	return err
}

func (fbo *folderBranchOps) SetEx(
	ctx context.Context, file Node, ex bool) (err error) {
	fbo.log.CDebugf(ctx, "SetEx %s %t", getNodeIDStr(file), ex)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "SetEx %s %t done: %+v",
			getNodeIDStr(file), ex, err)
	}()

	err = fbo.checkNode(file)
	if err != nil {
		return
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			return fbo.setExLocked(ctx, lState, file, ex)
		})
}

func (fbo *folderBranchOps) setMtimeLocked(
	ctx context.Context, lState *lockState, file Node,
	mtime *time.Time) error {
	fbo.mdWriterLock.AssertLocked(lState)

	filePath, err := fbo.pathFromNodeForMDWriteLocked(lState, file)
	if err != nil {
		return err
	}

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	dblock, de, err := fbo.blocks.GetDirtyParentAndEntry(
		ctx, lState, md.ReadOnly(), filePath)
	if err != nil {
		return err
	}
	de.Mtime = mtime.UnixNano()
	// setting the mtime counts as changing the file MD, so must set ctime too
	de.Ctime = fbo.nowUnixNano()

	parentPath := filePath.parentPath()
	sao, err := newSetAttrOp(filePath.tailName(), parentPath.tailPointer(),
		mtimeAttr, filePath.tailPointer())
	if err != nil {
		return err
	}

	// If the MD doesn't match the MD expected by the path, that
	// implies we are using a cached path, which implies the node has
	// been unlinked.  In that case, we can safely ignore this
	// setmtime.
	if md.data.Dir.BlockPointer.ID != filePath.path[0].BlockPointer.ID {
		fbo.log.CDebugf(ctx, "Skipping setmtime for a removed file %v",
			filePath.tailPointer())
		fbo.blocks.UpdateCachedEntryAttributesOnRemovedFile(
			ctx, lState, sao, de)
		return nil
	}

	sao.setFinalPath(filePath)
	md.AddOp(sao)

	deleteTargetDirEntry := fbo.blocks.SetAttrInDirEntryInCache(
		lState, de, sao.Attr)
	fbo.dirOps = append(fbo.dirOps, cachedDirOp{sao, []Node{file}})

	defer func() {
		// Until KBFS-2076 is done, clear out the cached dir data manually.
		fbo.dirOps = nil
		if deleteTargetDirEntry {
			fbo.blocks.ClearCacheInfo(lState, filePath)
		}
	}()

	dblock.Children[filePath.tailName()] = de
	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, lState, md, dblock, *parentPath.parentPath(), parentPath.tailName(),
		Dir, false, false, zeroPtr, NoExcl)
	return err
}

func (fbo *folderBranchOps) SetMtime(
	ctx context.Context, file Node, mtime *time.Time) (err error) {
	fbo.log.CDebugf(ctx, "SetMtime %s %v", getNodeIDStr(file), mtime)
	defer func() {
		fbo.deferLog.CDebugf(ctx, "SetMtime %s %v done: %+v",
			getNodeIDStr(file), mtime, err)
	}()

	if mtime == nil {
		// Can happen on some OSes (e.g. OSX) when trying to set the atime only
		return nil
	}

	err = fbo.checkNode(file)
	if err != nil {
		return
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			return fbo.setMtimeLocked(ctx, lState, file, mtime)
		})
}

type cleanupFn func(context.Context, *lockState, []BlockPointer, error)

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
	lState *lockState, md *RootMetadata, file path) (
	doSync, stillDirty bool, fblock *FileBlock, lbc localBcache,
	bps *blockPutState, syncState fileSyncState,
	cleanup cleanupFn, err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// if the cache for this file isn't dirty, we're done
	if !fbo.blocks.IsDirty(lState, file) {
		return false, false, nil, nil, nil, fileSyncState{}, nil, nil
	}

	// If the MD doesn't match the MD expected by the path, that
	// implies we are using a cached path, which implies the node has
	// been unlinked.  In that case, we can safely ignore this sync.
	if md.data.Dir.BlockPointer.ID != file.path[0].BlockPointer.ID {
		fbo.log.CDebugf(ctx, "Skipping sync for a removed file %v",
			file.tailPointer())
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
		return false, true, nil, nil, nil, fileSyncState{}, nil,
			fbo.blocks.ClearCacheInfo(lState, file)
	}

	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return false, true, nil, nil, nil, fileSyncState{}, nil, err
	}

	if file.isValidForNotification() {
		// notify the daemon that a write is being performed
		fbo.config.Reporter().Notify(ctx, writeNotification(file, false))
		defer fbo.config.Reporter().Notify(ctx, writeNotification(file, true))
	}

	// Filled in by doBlockPuts below.
	fblock, bps, lbc, syncState, err =
		fbo.blocks.StartSync(ctx, lState, md, session.UID, file)
	cleanup = func(ctx context.Context, lState *lockState,
		blocksToRemove []BlockPointer, err error) {
		fbo.blocks.CleanupSyncState(
			ctx, lState, md.ReadOnly(), file, blocksToRemove, syncState, err)
	}
	if err != nil {
		return false, true, nil, nil, nil, fileSyncState{}, cleanup, err
	}

	return true, true, fblock, lbc, bps, syncState, cleanup, nil
}

func (fbo *folderBranchOps) syncLocked(ctx context.Context,
	lState *lockState, file path) (stillDirty bool, err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// Verify we have permission to write.
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return false, err
	}

	var blocksToRemove []BlockPointer
	doSync, stillDirty, fblock, lbc, bps, syncState, cleanup, err :=
		fbo.startSyncLocked(ctx, lState, md, file)
	if cleanup != nil {
		defer func() { cleanup(ctx, lState, blocksToRemove, err) }()
	}
	if err != nil {
		return stillDirty, err
	}
	if !doSync {
		return stillDirty, nil
	}

	newPath, _, newBps, err :=
		fbo.syncBlockAndCheckEmbedLocked(
			ctx, lState, md, fblock, *file.parentPath(),
			file.tailName(), File, true, true, zeroPtr, lbc)
	if err != nil {
		return true, err
	}

	bps.mergeOtherBps(newBps)

	// Note: We explicitly don't call fbo.fbm.cleanUpBlockState here
	// when there's an error, because it's possible some of the blocks
	// will be reused in a future attempt at this same sync, and we
	// don't want them cleaned up in that case.  Instead, the
	// FinishSync call below will take care of that.

	blocksToRemove, err = doBlockPuts(ctx, fbo.config.BlockServer(),
		fbo.config.BlockCache(), fbo.config.Reporter(), fbo.log, md.TlfID(),
		md.GetTlfHandle().GetCanonicalName(), *bps)
	if err != nil {
		return true, err
	}

	// Call this under the same blockLock as when the pointers are
	// updated, so there's never any point in time where a read or
	// write might slip in after the pointers are updated, but before
	// the deferred writes are re-applied.
	afterUpdateFn := func() error {
		stillDirty, err = fbo.blocks.FinishSyncLocked(
			ctx, lState, file, newPath, md.ReadOnly(), syncState, fbo.fbm)
		return err
	}

	err = fbo.finalizeMDWriteLocked(ctx, lState, md, bps, NoExcl, afterUpdateFn)
	if err != nil {
		return true, err
	}
	return stillDirty, err
}

func (fbo *folderBranchOps) Sync(ctx context.Context, file Node) (err error) {
	fbo.log.CDebugf(ctx, "Sync %s", getNodeIDStr(file))
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Sync %s done: %+v",
			getNodeIDStr(file), err)
	}()

	err = fbo.checkNode(file)
	if err != nil {
		return
	}

	var stillDirty bool
	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			filePath, err := fbo.pathFromNodeForMDWriteLocked(lState, file)
			if err != nil {
				return err
			}

			stillDirty, err = fbo.syncLocked(ctx, lState, filePath)
			return err
		})
	if err != nil {
		return err
	}

	if !stillDirty {
		fbo.status.rmDirtyNode(file)
	}

	return nil
}

func (fbo *folderBranchOps) syncAllLocked(
	ctx context.Context, lState *lockState) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	dirtyRefs := fbo.blocks.GetDirtyRefs(lState)
	if len(dirtyRefs) == 0 {
		return nil
	}

	// Verify we have permission to write.  We do this after the dirty
	// check because otherwise readers who call syncAll would get an
	// error.
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	var cleanups []func(context.Context, *lockState, error)
	defer func() {
		for _, cf := range cleanups {
			cf(ctx, lState, err)
		}
	}()

	fbo.log.CDebugf(ctx, "Syncing %d file(s)", len(dirtyRefs))
	bps := newBlockPutState(0)
	resolvedPaths := make(map[BlockPointer]path)
	fileBlocks := make(fileBlockMap)
	var blocksToRemove []BlockPointer
	var afterUpdateFns []func() error
	lbc := make(localBcache)
	for _, ref := range dirtyRefs {
		node := fbo.nodeCache.Get(ref)
		if node == nil {
			continue
		}
		file := fbo.nodeCache.PathFromNode(node)
		fbo.log.CDebugf(ctx, "Syncing file %v (%s)", ref, file)

		// Start the sync for this dirty file.
		doSync, stillDirty, fblock, newLbc, newBps, syncState, cleanup, err :=
			fbo.startSyncLocked(ctx, lState, md, file)
		if cleanup != nil {
			// Note: This passes the same `blocksToRemove` into each
			// cleanup function.  That's ok, as only the ones
			// pertaining to a particular syncing file will be acted
			// on.
			cleanups = append(cleanups,
				func(ctx context.Context, lState *lockState, err error) {
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
		bps.mergeOtherBps(newBps)
		resolvedPaths[file.tailPointer()] = file
		parent := file.parentPath().tailPointer()
		if _, ok := fileBlocks[parent]; !ok {
			fileBlocks[parent] = make(map[string]*FileBlock)
		}
		fileBlocks[parent][file.tailName()] = fblock

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

		// Make each of the ops "self-updates" before making chains
		// (they will be updated later to have the correct block
		// pointers).  Add an update for each element in the path, so
		// that the chains below are created correctly.
		lastOp := md.Data().Changes.Ops[len(md.Data().Changes.Ops)-1]
		for _, p := range file.path {
			lastOp.AddUpdate(p.BlockPointer, p.BlockPointer)
		}

		// Update the combined local block cache with this file's
		// dirty entry.
		parentPtr := file.parentPath().tailPointer()
		if _, ok := lbc[parentPtr]; ok {
			lbc[parentPtr].Children[file.tailName()] =
				newLbc[parentPtr].Children[file.tailName()]
		} else {
			lbc[parentPtr] = newLbc[parentPtr]
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

	// Create a set of chains for this batch, a succinct summary of
	// the file and directory blocks that need to change during this
	// sync.
	syncChains, err := newCRChains(
		ctx, fbo.config.Codec(), []chainMetadata{tempIRMD}, &fbo.blocks, false)
	if err != nil {
		return err
	}
	head, _ := fbo.getHead(lState)
	dummyHeadChains := newCRChainsEmpty()
	dummyHeadChains.mostRecentChainMDInfo = mostRecentChainMetadataInfo{
		head, head.Data().Dir.BlockInfo}

	// Squash the batch of updates together into a set of blocks and
	// ready `md` for putting to the server.
	md.AddOp(newResolutionOp())
	_, newBps, blocksToDelete, err := fbo.prepper.prepUpdateForPaths(
		ctx, lState, md, syncChains, dummyHeadChains, tempIRMD, head,
		resolvedPaths, lbc, fileBlocks, fbo.config.DirtyBlockCache(),
		prepFolderDontCopyIndirectFileBlocks)
	if err != nil {
		return err
	}
	if len(blocksToDelete) > 0 {
		return errors.Errorf("Unexpectedly found unflushed blocks to delete "+
			"during syncAllLocked: %v", blocksToDelete)
	}
	bps.mergeOtherBps(newBps)

	defer func() {
		if err != nil {
			fbo.fbm.cleanUpBlockState(md.ReadOnly(), bps, blockDeleteOnMDFail)
		}
	}()

	// Put all the blocks.
	blocksToRemove, err = doBlockPuts(ctx, fbo.config.BlockServer(),
		fbo.config.BlockCache(), fbo.config.Reporter(), fbo.log, md.TlfID(),
		md.GetTlfHandle().GetCanonicalName(), *bps)
	if err != nil {
		return err
	}

	// Call this under the same blockLock as when the pointers are
	// updated, so there's never any point in time where a read or
	// write might slip in after the pointers are updated, but before
	// the deferred writes are re-applied.
	afterUpdateFn := func() error {
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

	return fbo.finalizeMDWriteLocked(
		ctx, lState, md, bps, NoExcl, afterUpdateFn)
}

// SyncAll implements the KBFSOps interface for folderBranchOps.
func (fbo *folderBranchOps) SyncAll(
	ctx context.Context, folderBranch FolderBranch) (err error) {
	fbo.log.CDebugf(ctx, "SyncAll")
	defer func() { fbo.deferLog.CDebugf(ctx, "SyncAll done: %+v", err) }()

	if folderBranch != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, folderBranch}
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			return fbo.syncAllLocked(ctx, lState)
		})
}

func (fbo *folderBranchOps) FolderStatus(
	ctx context.Context, folderBranch FolderBranch) (
	fbs FolderBranchStatus, updateChan <-chan StatusUpdate, err error) {
	fbo.log.CDebugf(ctx, "Status")
	defer func() { fbo.deferLog.CDebugf(ctx, "Status done: %+v", err) }()

	if folderBranch != fbo.folderBranch {
		return FolderBranchStatus{}, nil,
			WrongOpsError{fbo.folderBranch, folderBranch}
	}

	return fbo.status.getStatus(ctx, &fbo.blocks)
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
	ctx context.Context, lState *lockState, md ImmutableRootMetadata,
	afterUpdateFn func() error) error {
	fbo.headLock.AssertLocked(lState)

	switch len(md.data.Changes.Ops) {
	case 0:
		return nil
	case 1:
		err := fbo.notifyOneOpLocked(
			ctx, lState, md.data.Changes.Ops[0], md, false, afterUpdateFn)
		if err != nil {
			return err
		}
	default:
		// In a multi-update batch, the first op should be the
		// resolution op with all the new pointer updates.  It's the
		// one that gets the afterUpdateFn.
		if md.data.Changes.Ops[0].(*resolutionOp) == nil {
			return errors.Errorf("First update in local batch is not a "+
				"resolutionOp: %T", md.data.Changes.Ops[0])
		}
		err := fbo.notifyOneOpLocked(
			ctx, lState, md.data.Changes.Ops[0], md, false, afterUpdateFn)
		if err != nil {
			return err
		}
		for i := 1; i < len(md.data.Changes.Ops); i++ {
			err := fbo.notifyOneOpLocked(
				ctx, lState, md.data.Changes.Ops[i], md, false, nil)
			if err != nil {
				return err
			}
		}
	}
	fbo.editHistory.UpdateHistory(ctx, []ImmutableRootMetadata{md})
	return nil
}

// searchForNode tries to figure out the path to the given
// blockPointer, using only the block updates that happened as part of
// a given MD update operation.
func (fbo *folderBranchOps) searchForNode(ctx context.Context,
	ptr BlockPointer, md ReadOnlyRootMetadata) (Node, error) {
	// Record which pointers are new to this update, and thus worth
	// searching.
	newPtrs := make(map[BlockPointer]bool)
	for _, op := range md.data.Changes.Ops {
		for _, update := range op.allUpdates() {
			newPtrs[update.Ref] = true
		}
		for _, ref := range op.Refs() {
			newPtrs[ref] = true
		}
	}

	nodeMap, _, err := fbo.blocks.SearchForNodes(ctx, fbo.nodeCache,
		[]BlockPointer{ptr}, newPtrs, md, md.data.Dir.BlockPointer)
	if err != nil {
		return nil, err
	}

	n, ok := nodeMap[ptr]
	if !ok {
		return nil, NodeNotFoundError{ptr}
	}

	return n, nil
}

func (fbo *folderBranchOps) unlinkFromCache(op op, unlinkPath path) error {
	// The entry could be under any one of the unref'd blocks, and
	// it's safe to perform this when the pointer isn't real, so just
	// try them all to avoid the overhead of looking up the right
	// pointer in the old version of the block.
	for _, ptr := range op.Unrefs() {
		// It's ok to modify this path, since we break as soon as the
		// node cache takes a reference to it.
		unlinkPath.path[len(unlinkPath.path)-1].BlockPointer = ptr
		found := fbo.nodeCache.Unlink(ptr.Ref(), unlinkPath)
		if found {
			break
		}
	}

	return nil
}

func (fbo *folderBranchOps) getUnlinkPathBeforeUpdatingPointers(
	ctx context.Context, op op) (unlinkPath path, toUnlink bool, err error) {
	var node Node
	var childName string

	switch realOp := op.(type) {
	case *rmOp:
		node = fbo.nodeCache.Get(realOp.Dir.Unref.Ref())
		childName = realOp.OldName
	case *renameOp:
		if realOp.NewDir.Unref != zeroPtr {
			// moving to a new dir
			node = fbo.nodeCache.Get(realOp.NewDir.Unref.Ref())
		} else {
			// moving to the same dir
			node = fbo.nodeCache.Get(realOp.OldDir.Unref.Ref())
		}
		childName = realOp.NewName
	}
	if node == nil {
		return path{}, false, nil
	}

	p, err := fbo.pathFromNodeForRead(node)
	if err != nil {
		return path{}, false, err
	}

	return p.ChildPathNoPtr(childName), true, nil
}

func (fbo *folderBranchOps) notifyOneOpLocked(ctx context.Context,
	lState *lockState, op op, md ImmutableRootMetadata, shouldPrefetch bool,
	afterUpdateFn func() error) error {
	fbo.headLock.AssertLocked(lState)

	if fbo.config.Mode() == InitMinimal {
		// There is no node cache in minimal mode, so there's nothing
		// to update.
		return nil
	}

	// We need to get unlinkPath before calling UpdatePointers so that
	// nodeCache.Unlink can properly update cachedPath.
	unlinkPath, toUnlink, err := fbo.getUnlinkPathBeforeUpdatingPointers(ctx, op)
	if err != nil {
		return err
	}

	err = fbo.blocks.UpdatePointers(
		md, lState, op, shouldPrefetch, afterUpdateFn)
	if err != nil {
		return err
	}

	var changes []NodeChange
	switch realOp := op.(type) {
	default:
		fbo.log.CDebugf(ctx, "Unknown op: %s", op)
		return nil
	case *createOp:
		node := fbo.nodeCache.Get(realOp.Dir.Ref.Ref())
		if node == nil {
			return nil // Nothing to do.
		}
		fbo.log.CDebugf(ctx, "notifyOneOp: create %s in node %s",
			realOp.NewName, getNodeIDStr(node))
		changes = append(changes, NodeChange{
			Node:       node,
			DirUpdated: []string{realOp.NewName},
		})
	case *rmOp:
		node := fbo.nodeCache.Get(realOp.Dir.Ref.Ref())
		if node == nil {
			return nil // Nothing to do.
		}
		fbo.log.CDebugf(ctx, "notifyOneOp: remove %s in node %s",
			realOp.OldName, getNodeIDStr(node))
		changes = append(changes, NodeChange{
			Node:       node,
			DirUpdated: []string{realOp.OldName},
		})

		// If this node exists, then the child node might exist too,
		// and we need to unlink it in the node cache.
		if toUnlink {
			err := fbo.unlinkFromCache(op, unlinkPath)
			if err != nil {
				return err
			}
		}
	case *renameOp:
		oldNode := fbo.nodeCache.Get(realOp.OldDir.Ref.Ref())
		if oldNode != nil {
			changes = append(changes, NodeChange{
				Node:       oldNode,
				DirUpdated: []string{realOp.OldName},
			})
		}
		var newNode Node
		if realOp.NewDir.Ref != zeroPtr {
			newNode = fbo.nodeCache.Get(realOp.NewDir.Ref.Ref())
			if newNode != nil {
				changes = append(changes, NodeChange{
					Node:       newNode,
					DirUpdated: []string{realOp.NewName},
				})
			}
		} else {
			newNode = oldNode
			if oldNode != nil {
				// Add another name to the existing NodeChange.
				changes[len(changes)-1].DirUpdated =
					append(changes[len(changes)-1].DirUpdated, realOp.NewName)
			}
		}

		if oldNode != nil {
			fbo.log.CDebugf(ctx, "notifyOneOp: rename %v from %s/%s to %s/%s",
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
						fbo.searchForNode(ctx, realOp.NewDir.Ref, md.ReadOnly())
					if newNode == nil {
						fbo.log.CErrorf(ctx, "Couldn't find the new node: %v",
							err)
					}
				}
			}

			if newNode != nil {
				if toUnlink {
					err := fbo.unlinkFromCache(op, unlinkPath)
					if err != nil {
						return err
					}
				}
				err := fbo.nodeCache.Move(
					realOp.Renamed.Ref(), newNode, realOp.NewName)
				if err != nil {
					return err
				}
			}
		}
	case *syncOp:
		node := fbo.nodeCache.Get(realOp.File.Ref.Ref())
		if node == nil {
			return nil // Nothing to do.
		}
		fbo.log.CDebugf(ctx, "notifyOneOp: sync %d writes in node %s",
			len(realOp.Writes), getNodeIDStr(node))

		changes = append(changes, NodeChange{
			Node:        node,
			FileUpdated: realOp.Writes,
		})
	case *setAttrOp:
		node := fbo.nodeCache.Get(realOp.Dir.Ref.Ref())
		if node == nil {
			return nil // Nothing to do.
		}
		fbo.log.CDebugf(ctx, "notifyOneOp: setAttr %s for file %s in node %s",
			realOp.Attr, realOp.Name, getNodeIDStr(node))

		p, err := fbo.pathFromNodeForRead(node)
		if err != nil {
			return err
		}

		childNode, err := fbo.blocks.UpdateCachedEntryAttributes(
			ctx, lState, md.ReadOnly(), p, realOp)
		if err != nil {
			return err
		}
		if childNode == nil {
			return nil // Nothing to do.
		}

		changes = append(changes, NodeChange{
			Node: childNode,
		})
	case *GCOp:
		// Unreferenced blocks in a GCOp mean that we shouldn't cache
		// them anymore
		fbo.log.CDebugf(ctx, "notifyOneOp: GCOp with latest rev %d and %d unref'd blocks", realOp.LatestRev, len(realOp.Unrefs()))
		bcache := fbo.config.BlockCache()
		idsToDelete := make([]kbfsblock.ID, 0, len(realOp.Unrefs()))
		for _, ptr := range realOp.Unrefs() {
			idsToDelete = append(idsToDelete, ptr.ID)
			if err := bcache.DeleteTransient(ptr, fbo.id()); err != nil {
				fbo.log.CDebugf(ctx,
					"Couldn't delete transient entry for %v: %v", ptr, err)
			}
		}
		diskCache := fbo.config.DiskBlockCache()
		if diskCache != nil {
			go diskCache.Delete(ctx, idsToDelete)
		}
	case *resolutionOp:
		// If there are any unrefs of blocks that have a node, this is an
		// implied rmOp (see KBFS-1424).
		reverseUpdates := make(map[BlockPointer]BlockPointer)
		for _, unref := range op.Unrefs() {
			// TODO: I will add logic here to unlink and invalidate any
			// corresponding unref'd nodes.
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
			if !p.hasValidParent() {
				fbo.log.CErrorf(ctx, "Removed node %s has no parent", p)
				continue
			}
			parentPath := p.parentPath()
			parentNode := fbo.nodeCache.Get(parentPath.tailPointer().Ref())
			if parentNode != nil {
				changes = append(changes, NodeChange{
					Node:       parentNode,
					DirUpdated: []string{p.tailName()},
				})
			}

			fbo.log.CDebugf(ctx, "resolutionOp: remove %s, node %s",
				p.tailPointer(), getNodeIDStr(node))
			// Revert the path back to the original BlockPointers,
			// before the updates were applied.
			if len(reverseUpdates) == 0 {
				for _, update := range op.allUpdates() {
					reverseUpdates[update.Ref] = update.Unref
				}
			}
			for i, pNode := range p.path {
				if oldPtr, ok := reverseUpdates[pNode.BlockPointer]; ok {
					p.path[i].BlockPointer = oldPtr
				}
			}
			fbo.nodeCache.Unlink(p.tailPointer().Ref(), p)
		}
		if len(changes) == 0 {
			return nil
		}
	}

	fbo.observers.batchChanges(ctx, changes)
	return nil
}

func (fbo *folderBranchOps) getCurrMDRevisionLocked(lState *lockState) MetadataRevision {
	fbo.headLock.AssertAnyLocked(lState)

	if fbo.head != (ImmutableRootMetadata{}) {
		return fbo.head.Revision()
	}
	return MetadataRevisionUninitialized
}

func (fbo *folderBranchOps) getCurrMDRevision(
	lState *lockState) MetadataRevision {
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)
	return fbo.getCurrMDRevisionLocked(lState)
}

type applyMDUpdatesFunc func(context.Context, *lockState, []ImmutableRootMetadata) error

func (fbo *folderBranchOps) applyMDUpdatesLocked(ctx context.Context,
	lState *lockState, rmds []ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)

	// If there's anything in the journal, don't apply these MDs.
	// Wait for CR to happen.
	if fbo.isMasterBranchLocked(lState) {
		mergedRev, err := fbo.getJournalPredecessorRevision(ctx)
		if err != nil {
			return err
		}
		if mergedRev != MetadataRevisionUninitialized {
			if len(rmds) > 0 {
				// We should update our view of the merged master though,
				// to avoid re-registering for the same updates again.
				func() {
					fbo.headLock.Lock(lState)
					defer fbo.headLock.Unlock(lState)
					fbo.setLatestMergedRevisionLocked(
						ctx, lState, rmds[len(rmds)-1].Revision(), false)
				}()
			}

			fbo.log.CDebugf(ctx,
				"Ignoring fetched revisions while MDs are in journal")
			return nil
		}
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)

	// if we have staged changes, ignore all updates until conflict
	// resolution kicks in.  TODO: cache these for future use.
	if !fbo.isMasterBranchLocked(lState) {
		if len(rmds) > 0 {
			latestMerged := rmds[len(rmds)-1]
			// If we're running a journal, don't trust our own updates
			// here because they might have come from our own journal
			// before the conflict was detected.  Assume we'll hear
			// about the conflict via callbacks from the journal.
			if TLFJournalEnabled(fbo.config, fbo.id()) {
				session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
				if err != nil {
					return err
				}
				if session.VerifyingKey == latestMerged.LastModifyingWriterVerifyingKey() {
					return UnmergedError{}
				}
			}

			// setHeadLocked takes care of merged case
			fbo.setLatestMergedRevisionLocked(
				ctx, lState, latestMerged.Revision(), false)

			unmergedRev := MetadataRevisionUninitialized
			if fbo.head != (ImmutableRootMetadata{}) {
				unmergedRev = fbo.head.Revision()
			}
			fbo.cr.Resolve(unmergedRev, latestMerged.Revision())
		}
		return UnmergedError{}
	}

	// Don't allow updates while we're in the dirty state; the next
	// sync will put us into an unmerged state anyway and we'll
	// require conflict resolution.
	if fbo.blocks.GetState(lState) != cleanState {
		return errors.WithStack(NoUpdatesWhileDirtyError{})
	}

	appliedRevs := make([]ImmutableRootMetadata, 0, len(rmds))
	for _, rmd := range rmds {
		// check that we're applying the expected MD revision
		if rmd.Revision() <= fbo.getCurrMDRevisionLocked(lState) {
			// Already caught up!
			continue
		}
		if err := isReadableOrError(ctx, fbo.config.KBPKI(), rmd.ReadOnly()); err != nil {
			return err
		}

		err := fbo.setHeadSuccessorLocked(ctx, lState, rmd, false)
		if err != nil {
			return err
		}
		// No new operations in these.
		if rmd.IsWriterMetadataCopiedSet() {
			continue
		}
		for _, op := range rmd.data.Changes.Ops {
			err := fbo.notifyOneOpLocked(ctx, lState, op, rmd, true, nil)
			if err != nil {
				return err
			}
		}
		appliedRevs = append(appliedRevs, rmd)
	}
	if len(appliedRevs) > 0 {
		fbo.editHistory.UpdateHistory(ctx, appliedRevs)
	}
	return nil
}

func (fbo *folderBranchOps) undoMDUpdatesLocked(ctx context.Context,
	lState *lockState, rmds []ImmutableRootMetadata) error {
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
			err = fbo.notifyOneOpLocked(ctx, lState, io, rmd, false, nil)
			if err != nil {
				return err
			}
		}
	}
	// TODO: update the edit history?
	return nil
}

func (fbo *folderBranchOps) applyMDUpdates(ctx context.Context,
	lState *lockState, rmds []ImmutableRootMetadata) error {
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	return fbo.applyMDUpdatesLocked(ctx, lState, rmds)
}

func (fbo *folderBranchOps) getLatestMergedRevision(lState *lockState) MetadataRevision {
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)
	return fbo.latestMergedRevision
}

// caller should have held fbo.headLock
func (fbo *folderBranchOps) setLatestMergedRevisionLocked(ctx context.Context, lState *lockState, rev MetadataRevision, allowBackward bool) {
	fbo.headLock.AssertLocked(lState)
	if rev == MetadataRevisionUninitialized {
		panic("Cannot set latest merged revision to an uninitialized value")
	}

	if fbo.latestMergedRevision < rev || allowBackward {
		fbo.latestMergedRevision = rev
		fbo.log.CDebugf(ctx, "Updated latestMergedRevision to %d.", rev)
	} else {
		fbo.log.CDebugf(ctx, "Local latestMergedRevision (%d) is higher than "+
			"the new revision (%d); won't update.", fbo.latestMergedRevision, rev)
	}
}

// Assumes all necessary locking is either already done by caller, or
// is done by applyFunc.
func (fbo *folderBranchOps) getAndApplyMDUpdates(ctx context.Context,
	lState *lockState, applyFunc applyMDUpdatesFunc) error {
	// first look up all MD revisions newer than my current head
	start := fbo.getLatestMergedRevision(lState) + 1
	rmds, err := getMergedMDUpdates(ctx, fbo.config, fbo.id(), start)
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
	lState *lockState) error {
	fbo.log.CDebugf(ctx, "Fetching the newest unmerged head")
	bid := func() BranchID {
		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)
		return fbo.bid
	}()

	// We can only ever be at most one revision behind, so fetch the
	// latest unmerged revision and apply it as a successor.
	md, err := fbo.config.MDOps().GetUnmergedForTLF(ctx, fbo.id(), bid)
	if err != nil {
		return err
	}

	if md == (ImmutableRootMetadata{}) {
		// There is no unmerged revision, oops!
		return errors.New("Couldn't find an unmerged head")
	}

	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	if fbo.bid != bid {
		// The branches switched (apparently CR completed), so just
		// try again.
		fbo.log.CDebugf(ctx, "Branches switched while fetching unmerged head")
		return nil
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	if err := fbo.setHeadSuccessorLocked(ctx, lState, md, false); err != nil {
		return err
	}
	if err := fbo.notifyBatchLocked(ctx, lState, md, nil); err != nil {
		return err
	}
	if err := fbo.config.MDCache().Put(md); err != nil {
		return err
	}
	return nil
}

// getUnmergedMDUpdates returns a slice of the unmerged MDs for this
// TLF's current unmerged branch and unmerged branch, between the
// merge point for the branch and the current head.  The returned MDs
// are the same instances that are stored in the MD cache, so they
// should be modified with care.
func (fbo *folderBranchOps) getUnmergedMDUpdates(
	ctx context.Context, lState *lockState) (
	MetadataRevision, []ImmutableRootMetadata, error) {
	// acquire mdWriterLock to read the current branch ID.
	bid := func() BranchID {
		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)
		return fbo.bid
	}()
	return getUnmergedMDUpdates(ctx, fbo.config, fbo.id(),
		bid, fbo.getCurrMDRevision(lState))
}

func (fbo *folderBranchOps) getUnmergedMDUpdatesLocked(
	ctx context.Context, lState *lockState) (
	MetadataRevision, []ImmutableRootMetadata, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	return getUnmergedMDUpdates(ctx, fbo.config, fbo.id(),
		fbo.bid, fbo.getCurrMDRevision(lState))
}

// Returns a list of block pointers that were created during the
// staged era.
func (fbo *folderBranchOps) undoUnmergedMDUpdatesLocked(
	ctx context.Context, lState *lockState) ([]BlockPointer, error) {
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
	fbo.setBranchIDLocked(lState, NullBranchID)

	rmd, err := getSingleMD(ctx, fbo.config, fbo.id(), NullBranchID,
		currHead, Merged)
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
	var unmergedPtrs []BlockPointer
	for _, rmd := range unmergedRmds {
		for _, op := range rmd.data.Changes.Ops {
			for _, ptr := range op.Refs() {
				if ptr != zeroPtr {
					unmergedPtrs = append(unmergedPtrs, ptr)
				}
			}
			for _, update := range op.allUpdates() {
				if update.Ref != zeroPtr {
					unmergedPtrs = append(unmergedPtrs, update.Ref)
				}
			}
		}
	}

	return unmergedPtrs, nil
}

func (fbo *folderBranchOps) unstageLocked(ctx context.Context,
	lState *lockState) error {
	fbo.mdWriterLock.AssertLocked(lState)

	// fetch all of my unstaged updates, and undo them one at a time
	bid, wasMasterBranch := fbo.bid, fbo.isMasterBranchLocked(lState)
	unmergedPtrs, err := fbo.undoUnmergedMDUpdatesLocked(ctx, lState)
	if err != nil {
		return err
	}

	// let the server know we no longer have need
	if !wasMasterBranch {
		err = fbo.config.MDOps().PruneBranch(ctx, fbo.id(), bid)
		if err != nil {
			return err
		}
	}

	// now go forward in time, if possible
	err = fbo.getAndApplyMDUpdates(ctx, lState,
		fbo.applyMDUpdatesLocked)
	if err != nil {
		return err
	}

	md, err := fbo.getMDForWriteLocked(ctx, lState)
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

	return fbo.finalizeMDWriteLocked(ctx, lState, md, bps, NoExcl, nil)
}

// TODO: remove once we have automatic conflict resolution
func (fbo *folderBranchOps) UnstageForTesting(
	ctx context.Context, folderBranch FolderBranch) (err error) {
	fbo.log.CDebugf(ctx, "UnstageForTesting")
	defer func() {
		fbo.deferLog.CDebugf(ctx, "UnstageForTesting done: %+v", err)
	}()

	if folderBranch != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, folderBranch}
	}

	return runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()

		if fbo.isMasterBranch(lState) {
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
		go func() {
			lState := makeFBOLockState()
			c <- fbo.doMDWriteWithRetry(ctx, lState,
				func(lState *lockState) error {
					return fbo.unstageLocked(freshCtx, lState)
				})
		}()

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
	lState *lockState, promptPaper bool) (res RekeyResult, err error) {
	fbo.log.CDebugf(ctx, "rekeyLocked")
	defer func() {
		fbo.deferLog.CDebugf(ctx, "rekeyLocked done: %+v %+v", res, err)
	}()

	fbo.mdWriterLock.AssertLocked(lState)

	if !fbo.isMasterBranchLocked(lState) {
		return RekeyResult{}, errors.New("can't rekey while staged")
	}

	// untrusted head is ok here.
	head, _ := fbo.getHead(lState)
	if head != (ImmutableRootMetadata{}) {
		// If we already have a cached revision, make sure we're
		// up-to-date with the latest revision before inspecting the
		// metadata, since Rekey doesn't let us go into CR mode, and
		// we don't actually get folder update notifications when the
		// rekey bit is set, just a "folder needs rekey" update.
		if err := fbo.getAndApplyMDUpdates(
			ctx, lState, fbo.applyMDUpdatesLocked); err != nil {
			if applyErr, ok := err.(MDRevisionMismatch); !ok ||
				applyErr.rev != applyErr.curr {
				return RekeyResult{}, err
			}
		}
	}

	md, lastWriterVerifyingKey, rekeyWasSet, err :=
		fbo.getMDForRekeyWriteLocked(ctx, lState)
	if err != nil {
		return RekeyResult{}, err
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
		// 2) Readers need the MetadataFlagWriterMetadataCopied bit set for
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
		if err == context.DeadlineExceeded {
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
	if currKeyGen >= FirstValidKeyGen {
		fbo.config.Reporter().Notify(ctx,
			rekeyNotification(ctx, fbo.config, handle, true))
	}

	return RekeyResult{
		DidRekey:      rekeyDone,
		NeedsPaperKey: stillNeedsRekey,
	}, nil
}

func (fbo *folderBranchOps) RequestRekey(_ context.Context, tlf tlf.ID) {
	fb := FolderBranch{tlf, MasterBranch}
	if fb != fbo.folderBranch {
		// TODO: log instead of panic?
		panic(WrongOpsError{fbo.folderBranch, fb})
	}
	fbo.rekeyFSM.Event(NewRekeyRequestEvent())
}

func (fbo *folderBranchOps) SyncFromServerForTesting(
	ctx context.Context, folderBranch FolderBranch) (err error) {
	fbo.log.CDebugf(ctx, "SyncFromServerForTesting")
	defer func() {
		fbo.deferLog.CDebugf(ctx,
			"SyncFromServerForTesting done: %+v", err)
	}()

	if folderBranch != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, folderBranch}
	}

	lState := makeFBOLockState()

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

	// Loop until we're fully updated on the master branch.
	for {
		if !fbo.isMasterBranch(lState) {
			if err := fbo.cr.Wait(ctx); err != nil {
				return err
			}
			// If we are still staged after the wait, then we have a problem.
			if !fbo.isMasterBranch(lState) {
				return errors.Errorf("Conflict resolution didn't take us out " +
					"of staging.")
			}
		}

		dirtyRefs := fbo.blocks.GetDirtyRefs(lState)
		if len(dirtyRefs) > 0 {
			for _, ref := range dirtyRefs {
				fbo.log.CDebugf(ctx, "DeCache entry left: %v", ref)
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
			ctx, lState, fbo.applyMDUpdates); err != nil {
			if applyErr, ok := err.(MDRevisionMismatch); ok {
				if applyErr.rev == applyErr.curr {
					fbo.log.CDebugf(ctx, "Already up-to-date with server")
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
	if err := fbo.editHistory.Wait(ctx); err != nil {
		return err
	}
	if err := fbo.fbm.waitForQuotaReclamations(ctx); err != nil {
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
	return ctxWithRandomIDReplayable(ctx, CtxFBOIDKey, CtxFBOOpID, fbo.log)
}

func (fbo *folderBranchOps) newCtxWithFBOID() (context.Context, context.CancelFunc) {
	// No need to call NewContextReplayable since ctxWithFBOID calls
	// ctxWithRandomIDReplayable, which attaches replayably.
	ctx := fbo.ctxWithFBOID(context.Background())
	ctx, cancelFunc := context.WithCancel(ctx)
	ctx, err := NewContextWithCancellationDelayer(ctx)
	if err != nil {
		panic(err)
	}
	return ctx, cancelFunc
}

// Run the passed function with a context that's canceled on shutdown.
func (fbo *folderBranchOps) runUnlessShutdown(fn func(ctx context.Context) error) error {
	ctx, cancelFunc := fbo.newCtxWithFBOID()
	defer cancelFunc()
	errChan := make(chan error, 1)
	go func() {
		errChan <- fn(ctx)
	}()

	select {
	case err := <-errChan:
		return err
	case <-fbo.shutdownChan:
		return ShutdownHappenedError{}
	}
}

func (fbo *folderBranchOps) doFastForwardLocked(ctx context.Context,
	lState *lockState, currHead ImmutableRootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)

	fbo.log.CDebugf(ctx, "Fast-forwarding from rev %d to rev %d",
		fbo.latestMergedRevision, currHead.Revision())
	changes, err := fbo.blocks.FastForwardAllNodes(
		ctx, lState, currHead.ReadOnly())
	if err != nil {
		return err
	}

	err = fbo.setHeadSuccessorLocked(ctx, lState, currHead, true /*rebase*/)
	if err != nil {
		return err
	}

	// Invalidate all the affected nodes.
	if len(changes) > 0 {
		fbo.observers.batchChanges(ctx, changes)
	}

	// Reset the edit history.  TODO: notify any listeners that we've
	// done this.
	fbo.editHistory.Shutdown()
	fbo.editHistory = NewTlfEditHistory(fbo.config, fbo, fbo.log)
	return nil
}

func (fbo *folderBranchOps) maybeFastForward(ctx context.Context,
	lState *lockState, lastUpdate time.Time, currUpdate time.Time) (
	fastForwardDone bool, err error) {
	// Has it been long enough to try fast-forwarding?
	if currUpdate.Before(lastUpdate.Add(fastForwardTimeThresh)) ||
		!fbo.isMasterBranch(lState) {
		return false, nil
	}

	fbo.log.CDebugf(ctx, "Checking head for possible "+
		"fast-forwarding (last update time=%s)", lastUpdate)
	currHead, err := fbo.config.MDOps().GetForTLF(ctx, fbo.id())
	if err != nil {
		return false, err
	}
	fbo.log.CDebugf(ctx, "Current head is revision %d", currHead.Revision())

	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	// If the journal has anything in it, don't fast-forward since we
	// haven't finished flushing yet.  If there was really a remote
	// update on the server, we'll end up in CR eventually.
	mergedRev, err := fbo.getJournalPredecessorRevision(ctx)
	if err != nil {
		return false, err
	}
	if mergedRev != MetadataRevisionUninitialized {
		return false, nil
	}

	if !fbo.isMasterBranchLocked(lState) {
		// Don't update if we're staged.
		return false, nil
	}

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
		tlf.HandleExtensionFinalized, 1, libkb.NormalizedUsername("<unknown>"),
		now)
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't make finalized info: %+v", err)
		return
	}

	fakeSignedHead := &RootMetadataSigned{MD: fbo.head.bareMd}
	finalRmd, err := fakeSignedHead.MakeFinalCopy(
		fbo.config.Codec(), now, finalizedInfo)
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't finalize MD: %+v", err)
		return
	}

	// Construct the data needed to fake a new head.
	mdID, err := fbo.config.Crypto().MakeMdID(finalRmd.MD)
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't get finalized MD ID: %+v", err)
		return
	}
	bareHandle, err := finalRmd.MD.MakeBareTlfHandle(fbo.head.Extra())
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't get finalized bare handle: %+v", err)
		return
	}
	handle, err := MakeTlfHandle(ctx, bareHandle, fbo.config.KBPKI())
	if err != nil {
		fbo.log.CErrorf(ctx, "Couldn't get finalized handle: %+v", err)
		return
	}
	finalBrmd, ok := finalRmd.MD.(MutableBareRootMetadata)
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
				case NewMetadataVersionError:
					fbo.log.CDebugf(ctx, "Abandoning updates since we can't "+
						"read the newest metadata: %+v", err)
					fbo.status.setPermErr(err)
					// No need to lock here, since `cancelUpdates` is
					// only set within this same goroutine.
					fbo.cancelUpdates()
					return ctx.Err()
				case MDServerErrorCannotReadFinalizedTLF:
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
					return ctx.Err()
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

func (fbo *folderBranchOps) registerForUpdates(ctx context.Context) (
	updateChan <-chan error, err error) {
	lState := makeFBOLockState()
	currRev := fbo.getLatestMergedRevision(lState)
	fbo.log.CDebugf(ctx, "Registering for updates (curr rev = %d)", currRev)
	defer func() {
		fbo.deferLog.CDebugf(ctx,
			"Registering for updates (curr rev = %d) done: %+v",
			currRev, err)
	}()
	// RegisterForUpdate will itself retry on connectivity issues
	return fbo.config.MDServer().RegisterForUpdate(ctx, fbo.id(), currRev)
}

func (fbo *folderBranchOps) waitForAndProcessUpdates(
	ctx context.Context, lastUpdate time.Time,
	updateChan <-chan error) (currUpdate time.Time, err error) {
	// successful registration; now, wait for an update or a shutdown
	fbo.log.CDebugf(ctx, "Waiting for updates")
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Waiting for updates done: %+v", err)
	}()

	lState := makeFBOLockState()

	for {
		select {
		case err := <-updateChan:
			fbo.log.CDebugf(ctx, "Got an update: %v", err)
			if err != nil {
				return time.Time{}, err
			}
			// Getting and applying the updates requires holding
			// locks, so make sure it doesn't take too long.
			ctx, cancel := context.WithTimeout(ctx, backgroundTaskTimeout)
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

			err = fbo.getAndApplyMDUpdates(ctx, lState, fbo.applyMDUpdates)
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

func (fbo *folderBranchOps) backgroundFlusher(betweenFlushes time.Duration) {
	ticker := time.NewTicker(betweenFlushes)
	defer ticker.Stop()
	lState := makeFBOLockState()
	var prevDirtyRefMap map[BlockRef]bool
	sameDirtyRefCount := 0
	for {
		doSelect := true
		if fbo.blocks.GetState(lState) == dirtyState &&
			fbo.config.DirtyBlockCache().ShouldForceSync(fbo.id()) &&
			sameDirtyRefCount < 10 {
			// We have dirty files, and the system has a full buffer,
			// so don't bother waiting for a signal, just get right to
			// the main attraction.
			doSelect = false
		}

		if doSelect {
			// Wait until we really have a write waiting.
			forced := false
			select {
			case <-fbo.syncNeededChan:
			case <-fbo.forceSyncChan:
				forced = true
			case <-fbo.shutdownChan:
				return
			}

			if !forced {
				select {
				case <-ticker.C:
				case <-fbo.forceSyncChan:
				case <-fbo.shutdownChan:
					return
				}
			}
		}

		dirtyRefs := fbo.blocks.GetDirtyRefs(lState)
		if len(dirtyRefs) == 0 {
			sameDirtyRefCount = 0
			continue
		}

		// Make sure we are making some progress
		currDirtyRefMap := make(map[BlockRef]bool)
		for _, ref := range dirtyRefs {
			currDirtyRefMap[ref] = true
		}
		if reflect.DeepEqual(currDirtyRefMap, prevDirtyRefMap) {
			sameDirtyRefCount++
		} else {
			sameDirtyRefCount = 0
		}
		prevDirtyRefMap = currDirtyRefMap

		fbo.runUnlessShutdown(func(ctx context.Context) (err error) {
			// Denote that these are coming from a background
			// goroutine, not directly from any user.
			ctx = NewContextReplayable(ctx,
				func(ctx context.Context) context.Context {
					return context.WithValue(ctx, CtxBackgroundSyncKey, "1")
				})

			if sameDirtyRefCount >= 100 {
				// If the local journal is full, we might not be able to
				// make progress until more data is flushed to the
				// servers, so just warn here rather than just an outright
				// panic.
				fbo.log.CWarningf(ctx, "Making no Sync progress on dirty refs "+
					"after %d attempts: %v", sameDirtyRefCount, dirtyRefs)
			}

			// Just in case network access or a bug gets stuck for a
			// long time, time out the sync eventually.
			longCtx, longCancel :=
				context.WithTimeout(ctx, backgroundTaskTimeout)
			defer longCancel()

			// Make sure this loop doesn't starve user requests for
			// too long.  But use the longer-timeout version in the
			// actual Sync command, to avoid unnecessary errors.
			shortCtx, shortCancel := context.WithTimeout(ctx, 1*time.Second)
			defer shortCancel()
			for _, ref := range dirtyRefs {
				select {
				case <-shortCtx.Done():
					fbo.log.CDebugf(ctx,
						"Stopping background sync early due to timeout")
					return nil
				default:
				}

				node := fbo.nodeCache.Get(ref)
				if node == nil {
					continue
				}
				err := fbo.Sync(longCtx, node)
				if err != nil {
					// Just log the warning and keep trying to
					// sync the rest of the dirty files.
					p := fbo.nodeCache.PathFromNode(node)
					fbo.log.CWarningf(ctx, "Couldn't sync dirty file with "+
						"ref=%v, nodeID=%s, and path=%v: %v",
						ref, getNodeIDStr(node), p, err)
				}
			}
			return nil
		})
	}
}

func (fbo *folderBranchOps) blockUnmergedWrites(lState *lockState) {
	fbo.mdWriterLock.Lock(lState)
}

func (fbo *folderBranchOps) unblockUnmergedWrites(lState *lockState) {
	fbo.mdWriterLock.Unlock(lState)
}

func (fbo *folderBranchOps) finalizeResolutionLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, bps *blockPutState,
	newOps []op, blocksToDelete []kbfsblock.ID) error {
	fbo.mdWriterLock.AssertLocked(lState)

	// Put the blocks into the cache so that, even if we fail below,
	// future attempts may reuse the blocks.
	err := fbo.finalizeBlocks(bps)
	if err != nil {
		return err
	}

	// Last chance to get pre-empted.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	mdID, err := fbo.config.MDOps().ResolveBranch(ctx, fbo.id(), fbo.bid,
		blocksToDelete, md)
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

	md.loadCachedBlockChanges(ctx, bps, fbo.log)

	// Set the head to the new MD.
	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	session, err := fbo.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}
	irmd := MakeImmutableRootMetadata(
		md, session.VerifyingKey, mdID, fbo.config.Clock().Now())
	err = fbo.setHeadConflictResolvedLocked(ctx, lState, irmd)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't set local MD head after a "+
			"successful put: %v", err)
		return err
	}
	fbo.setBranchIDLocked(lState, NullBranchID)

	// Archive the old, unref'd blocks if journaling is off.
	if !TLFJournalEnabled(fbo.config, fbo.id()) {
		fbo.fbm.archiveUnrefBlocks(irmd.ReadOnly())
	}

	// notifyOneOp for every fixed-up merged op.
	for _, op := range newOps {
		err := fbo.notifyOneOpLocked(ctx, lState, op, irmd, false, nil)
		if err != nil {
			return err
		}
	}
	fbo.editHistory.UpdateHistory(ctx, []ImmutableRootMetadata{irmd})
	return nil
}

// finalizeResolution caches all the blocks, and writes the new MD to
// the merged branch, failing if there is a conflict.  It also sends
// out the given newOps notifications locally.  This is used for
// completing conflict resolution.
func (fbo *folderBranchOps) finalizeResolution(ctx context.Context,
	lState *lockState, md *RootMetadata, bps *blockPutState,
	newOps []op, blocksToDelete []kbfsblock.ID) error {
	// Take the writer lock.
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	return fbo.finalizeResolutionLocked(
		ctx, lState, md, bps, newOps, blocksToDelete)
}

func (fbo *folderBranchOps) unstageAfterFailedResolution(ctx context.Context,
	lState *lockState) error {
	// Take the writer lock.
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)

	// Last chance to get pre-empted.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	fbo.log.CWarningf(ctx, "Unstaging branch %s after a resolution failure",
		fbo.bid)
	return fbo.unstageLocked(ctx, lState)
}

func (fbo *folderBranchOps) handleTLFBranchChange(ctx context.Context,
	newBID BranchID) {
	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)

	fbo.log.CDebugf(ctx, "Journal branch change: %s", newBID)

	if !fbo.isMasterBranchLocked(lState) {
		if fbo.bid == newBID {
			fbo.log.CDebugf(ctx, "Already on branch %s", newBID)
			return
		}
		panic(fmt.Sprintf("Cannot switch to branch %s while on branch %s",
			newBID, fbo.bid))
	}

	md, err := fbo.config.MDOps().GetUnmergedForTLF(ctx, fbo.id(), newBID)
	if err != nil {
		fbo.log.CWarningf(ctx,
			"No unmerged head on journal branch change (bid=%s)", newBID)
		return
	}

	if md == (ImmutableRootMetadata{}) || md.MergedStatus() != Unmerged ||
		md.BID() != newBID {
		// This can happen if CR got kicked off in some other way and
		// completed before we took the lock to process this
		// notification.
		fbo.log.CDebugf(ctx, "Ignoring stale branch change: md=%v, newBID=%d",
			md, newBID)
		return
	}

	// Everything we thought we knew about quota reclamation is now
	// called into question.
	fbo.fbm.clearLastQRData()

	// Kick off conflict resolution and set the head to the correct branch.
	fbo.setBranchIDLocked(lState, newBID)
	fbo.cr.Resolve(md.Revision(), MetadataRevisionUninitialized)

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	err = fbo.setHeadSuccessorLocked(ctx, lState, md, true /*rebased*/)
	if err != nil {
		fbo.log.CWarningf(ctx,
			"Could not set head on journal branch change: %v", err)
		return
	}
}

func (fbo *folderBranchOps) onTLFBranchChange(newBID BranchID) {
	fbo.branchChanges.Add(1)

	go func() {
		defer fbo.branchChanges.Done()
		ctx, cancelFunc := fbo.newCtxWithFBOID()
		defer cancelFunc()

		// This only happens on a `PruneBranch` call, in which case we
		// would have already updated fbo's local view of the branch/head.
		if newBID == NullBranchID {
			fbo.log.CDebugf(ctx, "Ignoring branch change back to master")
			return
		}

		fbo.handleTLFBranchChange(ctx, newBID)
	}()
}

func (fbo *folderBranchOps) handleMDFlush(ctx context.Context, bid BranchID,
	rev MetadataRevision) {
	fbo.log.CDebugf(ctx, "Considering archiving references for flushed MD revision %d", rev)

	lState := makeFBOLockState()
	func() {
		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)
		fbo.setLatestMergedRevisionLocked(ctx, lState, rev, false)
	}()

	// Get that revision.
	rmd, err := getSingleMD(ctx, fbo.config, fbo.id(), NullBranchID,
		rev, Merged)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't get revision %d for archiving: %v",
			rev, err)
		return
	}

	if err := isArchivableMDOrError(rmd.ReadOnly()); err != nil {
		fbo.log.CDebugf(
			ctx, "Skipping archiving references for flushed MD revision %d: %s", rev, err)
		return
	}

	fbo.fbm.archiveUnrefBlocks(rmd.ReadOnly())
}

func (fbo *folderBranchOps) onMDFlush(bid BranchID, rev MetadataRevision) {
	fbo.mdFlushes.Add(1)

	go func() {
		defer fbo.mdFlushes.Done()
		ctx, cancelFunc := fbo.newCtxWithFBOID()
		defer cancelFunc()

		if bid != NullBranchID {
			fbo.log.CDebugf(ctx, "Ignoring MD flush on branch %v for "+
				"revision %d", bid, rev)
			return
		}

		fbo.handleMDFlush(ctx, bid, rev)
	}()
}

// GetUpdateHistory implements the KBFSOps interface for folderBranchOps
func (fbo *folderBranchOps) GetUpdateHistory(ctx context.Context,
	folderBranch FolderBranch) (history TLFUpdateHistory, err error) {
	fbo.log.CDebugf(ctx, "GetUpdateHistory")
	defer func() {
		fbo.deferLog.CDebugf(ctx, "GetUpdateHistory done: %+v", err)
	}()

	if folderBranch != fbo.folderBranch {
		return TLFUpdateHistory{}, WrongOpsError{fbo.folderBranch, folderBranch}
	}

	rmds, err := getMergedMDUpdates(ctx, fbo.config, fbo.id(),
		MetadataRevisionInitial)
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
			name, err := fbo.config.KBPKI().
				GetNormalizedUsername(ctx, rmd.LastModifyingWriter())
			if err != nil {
				return TLFUpdateHistory{}, err
			}
			writer = string(name)
			writerNames[rmd.LastModifyingWriter()] = writer
		}
		updateSummary := UpdateSummary{
			Revision:  rmd.Revision(),
			Date:      time.Unix(0, rmd.data.Dir.Mtime),
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
func (fbo *folderBranchOps) GetEditHistory(ctx context.Context,
	folderBranch FolderBranch) (edits TlfWriterEdits, err error) {
	fbo.log.CDebugf(ctx, "GetEditHistory")
	defer func() {
		fbo.deferLog.CDebugf(ctx, "GetEditHistory done: %+v", err)
	}()

	if folderBranch != fbo.folderBranch {
		return nil, WrongOpsError{fbo.folderBranch, folderBranch}
	}

	lState := makeFBOLockState()
	head, err := fbo.getMDForReadHelper(ctx, lState, mdReadNeedIdentify)
	if err != nil {
		return nil, err
	}

	return fbo.editHistory.GetComplete(ctx, head)
}

// PushStatusChange forces a new status be fetched by status listeners.
func (fbo *folderBranchOps) PushStatusChange() {
	fbo.config.KBFSOps().PushStatusChange()
}

// ClearPrivateFolderMD implements the KBFSOps interface for
// folderBranchOps.
func (fbo *folderBranchOps) ClearPrivateFolderMD(ctx context.Context) {
	if fbo.folderBranch.Tlf.IsPublic() {
		return
	}

	lState := makeFBOLockState()
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)
	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
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
	fbo.latestMergedRevision = MetadataRevisionUninitialized
	fbo.hasBeenCleared = true
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

	fbo.forcedFastForwards.Add(1)
	go func() {
		defer fbo.forcedFastForwards.Done()
		ctx, cancelFunc := fbo.newCtxWithFBOID()
		defer cancelFunc()

		fbo.log.CDebugf(ctx, "Forcing a fast-forward")
		currHead, err := fbo.config.MDOps().GetForTLF(ctx, fbo.id())
		if err != nil {
			fbo.log.CDebugf(ctx, "Fast-forward failed: %v", err)
			return
		}
		if currHead == (ImmutableRootMetadata{}) {
			fbo.log.CDebugf(ctx, "No MD yet")
			return
		}
		fbo.log.CDebugf(ctx, "Current head is revision %d", currHead.Revision())

		lState := makeFBOLockState()
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
	}()
}

// PushConnectionStatusChange pushes human readable connection status changes.
func (fbo *folderBranchOps) PushConnectionStatusChange(service string, newStatus error) {
	fbo.config.KBFSOps().PushConnectionStatusChange(service, newStatus)
}
