// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// mdReqType indicates whether an operation makes MD modifications or not
type mdReqType int

const (
	// A read request that doesn't need an identify to be
	// performed.
	mdReadNoIdentify mdReqType = iota
	// A read request that needs an identify to be performed (if
	// it hasn't been already).
	mdReadNeedIdentify
	// A write request.
	mdWrite
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
	// Max response size for a single DynamoDB query is 1MB.
	maxMDsAtATime = 10
	// Time between checks for dirty files to flush, in case Sync is
	// never called.
	secondsBetweenBackgroundFlushes = 10
	// Cap the number of times we retry after a recoverable error
	maxRetriesOnRecoverableErrors = 10
	// When the number of dirty bytes exceeds this level, force a sync.
	dirtyBytesThreshold = maxParallelBlockPuts * MaxBlockSizeBytesDefault
	// The timeout for any background task.
	backgroundTaskTimeout = 1 * time.Minute
)

type fboMutexLevel mutexLevel

const (
	fboMDWriter fboMutexLevel = 1
	fboHead                   = 2
	fboBlock                  = 3
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
	head         *RootMetadata
	observers    *observerList

	// these locks, when locked concurrently by the same goroutine,
	// should only be taken in the following order to avoid deadlock:
	mdWriterLock leveledMutex   // taken by any method making MD modifications
	headLock     leveledRWMutex // protects access to the MD

	blocks folderBlockOps

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

	// After a shutdown, this channel will be closed when the register
	// goroutine completes.
	updateDoneChan chan struct{}

	// forceSyncChan is read from by the background sync process
	// to know when it should sync immediately.
	forceSyncChan <-chan struct{}

	// How to resolve conflicts
	cr *ConflictResolver

	// Helper class for archiving and cleaning up the blocks for this TLF
	fbm *folderBlockManager

	// rekeyWithPromptTimer tracks a timed function that will try to
	// rekey with a paper key prompt, if enough time has passed.
	// Protected by mdWriterLock
	rekeyWithPromptTimer *time.Timer

	// latestMergedRevision tracks the latest heard merged revision on server
	latestMergedRevision MetadataRevision
}

var _ KBFSOps = (*folderBranchOps)(nil)

var _ fbmHelper = (*folderBranchOps)(nil)

// newFolderBranchOps constructs a new folderBranchOps object.
func newFolderBranchOps(config Config, fb FolderBranch,
	bType branchType) *folderBranchOps {
	nodeCache := newNodeCacheStandard(fb)

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
			unrefCache: make(map[blockRef]*syncInfo),
			deCache:    make(map[blockRef]DirEntry),
			deferredWrites: make(
				[]func(context.Context, *lockState, *RootMetadata, path) error, 0),
			nodeCache: nodeCache,
		},
		nodeCache:       nodeCache,
		log:             log,
		deferLog:        log.CloneWithAddedDepth(1),
		shutdownChan:    make(chan struct{}),
		updatePauseChan: make(chan (<-chan struct{})),
		forceSyncChan:   forceSyncChan,
	}
	fbo.cr = NewConflictResolver(config, fbo)
	fbo.fbm = newFolderBlockManager(config, fb, fbo)
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
func (fbo *folderBranchOps) Shutdown() error {
	if fbo.config.CheckStateOnShutdown() {
		ctx := context.TODO()
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
	// Wait for the update goroutine to finish, so that we don't have
	// any races with logging during test reporting.
	if fbo.updateDoneChan != nil {
		<-fbo.updateDoneChan
	}
	return nil
}

func (fbo *folderBranchOps) id() TlfID {
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
	if _, _, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx); err != nil {
		// Can't favorite while not logged in
		return nil
	}

	lState := makeFBOLockState()
	head := fbo.getHead(lState)
	if head == nil {
		return errors.New("Can't add a favorite without a handle")
	}

	h := head.GetTlfHandle()
	favorites.AddAsync(ctx, h.toFavToAdd(created))
	return nil
}

func (fbo *folderBranchOps) deleteFromFavorites(ctx context.Context,
	favorites *Favorites) error {
	if _, _, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx); err != nil {
		// Can't unfavorite while not logged in
		return nil
	}

	lState := makeFBOLockState()
	head := fbo.getHead(lState)
	if head == nil {
		return errors.New("Can't delete a favorite without a handle")
	}

	h := head.GetTlfHandle()
	return favorites.Delete(ctx, h.ToFavorite())
}

func (fbo *folderBranchOps) getHead(lState *lockState) *RootMetadata {
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)
	return fbo.head
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

	fbo.bid = bid
	if bid == NullBranchID {
		fbo.status.setCRChains(nil, nil)
	}
}

func (fbo *folderBranchOps) checkDataVersion(p path, ptr BlockPointer) error {
	if ptr.DataVer < FirstValidDataVer {
		return InvalidDataVersionError{ptr.DataVer}
	}
	// TODO: migrate back to fbo.config.DataVersion
	if ptr.DataVer > FilesWithHolesDataVer {
		return NewDataVersionError{p, ptr.DataVer}
	}
	return nil
}

func (fbo *folderBranchOps) setHeadLocked(
	ctx context.Context, lState *lockState, md *RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)

	isFirstHead := fbo.head == nil
	wasReadable := false
	if !isFirstHead {
		wasReadable = fbo.head.IsReadable()

		mdID, err := md.MetadataID(fbo.config)
		if err != nil {
			return err
		}

		headID, err := fbo.head.MetadataID(fbo.config)
		if err != nil {
			return err
		}

		if headID == mdID {
			// only save this new MD if the MDID has changed
			return nil
		}
	}

	fbo.log.CDebugf(ctx, "Setting head revision to %d", md.Revision)
	err := fbo.config.MDCache().Put(md)
	if err != nil {
		return err
	}

	// If this is the first time the MD is being set, and we are
	// operating on unmerged data, initialize the state properly and
	// kick off conflict resolution.
	if isFirstHead && md.MergedStatus() == Unmerged {
		fbo.setBranchIDLocked(lState, md.BID)
		// Use uninitialized for the merged branch; the unmerged
		// revision is enough to trigger conflict resolution.
		fbo.cr.Resolve(md.Revision, MetadataRevisionUninitialized)
	} else if md.MergedStatus() == Merged {
		// If we are already merged through this write, the revision would be the
		// latestMergedRevision on server.
		fbo.setLatestMergedRevisionLocked(ctx, lState, md.Revision)
	}

	fbo.head = md
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
			md.GetTlfHandle().GetCanonicalName(), md.ID.IsPublic()))
	}
	return nil
}

// setInitialHeadUntrustedLocked is for when the given RootMetadata
// was fetched not due to a user action, i.e. via a Rekey
// notification, and we don't have a TLF name to check against.
func (fbo *folderBranchOps) setInitialHeadUntrustedLocked(ctx context.Context,
	lState *lockState, md *RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head != nil {
		return errors.New("Unexpected non-nil head in setInitialHeadUntrustedLocked")
	}
	return fbo.setHeadLocked(ctx, lState, md)
}

// setNewInitialHeadLocked is for when we're creating a brand-new TLF.
func (fbo *folderBranchOps) setNewInitialHeadLocked(ctx context.Context,
	lState *lockState, md *RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head != nil {
		return errors.New("Unexpected non-nil head in setNewInitialHeadLocked")
	}
	if md.Revision != MetadataRevisionInitial {
		return fmt.Errorf("setNewInitialHeadLocked unexpectedly called with revision %d", md.Revision)
	}
	return fbo.setHeadLocked(ctx, lState, md)
}

// setInitialHeadUntrustedLocked is for when the given RootMetadata
// was fetched due to a user action, and will be checked against the
// TLF name.
func (fbo *folderBranchOps) setInitialHeadTrustedLocked(ctx context.Context,
	lState *lockState, md *RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head != nil {
		return errors.New("Unexpected non-nil head in setInitialHeadUntrustedLocked")
	}
	return fbo.setHeadLocked(ctx, lState, md)
}

// setHeadSuccessorLocked is for when we're applying updates from the
// server or when we're applying new updates we created ourselves.
func (fbo *folderBranchOps) setHeadSuccessorLocked(ctx context.Context,
	lState *lockState, md *RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head == nil {
		// This can happen in tests via SyncFromServerForTesting().
		return fbo.setInitialHeadTrustedLocked(ctx, lState, md)
	}

	err := fbo.head.CheckValidSuccessor(fbo.config, md)
	if err != nil {
		return err
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
			newHandle)
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

	err = fbo.setHeadLocked(ctx, lState, md)
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
	lState *lockState, md *RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head == nil {
		return errors.New("Unexpected nil head in setHeadPredecessorLocked")
	}
	if fbo.head.Revision <= MetadataRevisionInitial {
		return fmt.Errorf("setHeadPredecessorLocked unexpectedly called with revision %d", fbo.head.Revision)
	}

	if fbo.head.MergedStatus() != Unmerged {
		return errors.New("Unexpected merged head in setHeadPredecessorLocked")
	}

	err := md.CheckValidSuccessor(fbo.config, fbo.head)
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
		return fmt.Errorf(
			"head handle %v unexpectedly not equal to new handle = %v",
			oldHandle, newHandle)
	}

	return fbo.setHeadLocked(ctx, lState, md)
}

// setHeadConflictResolvedLocked is for when we're setting the merged
// update with resolved conflicts.
func (fbo *folderBranchOps) setHeadConflictResolvedLocked(ctx context.Context,
	lState *lockState, md *RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)
	fbo.headLock.AssertLocked(lState)
	if fbo.head.MergedStatus() != Unmerged {
		return errors.New("Unexpected merged head in setHeadConflictResolvedLocked")
	}
	if md.MergedStatus() != Merged {
		return errors.New("Unexpected unmerged update in setHeadConflictResolvedLocked")
	}
	return fbo.setHeadLocked(ctx, lState, md)
}

func (fbo *folderBranchOps) identifyOnce(
	ctx context.Context, md *RootMetadata) error {
	fbo.identifyLock.Lock()
	defer fbo.identifyLock.Unlock()
	if fbo.identifyDone {
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

	fbo.log.CDebugf(ctx, "Identify finished successfully")
	fbo.identifyDone = true
	fbo.identifyTime = fbo.config.Clock().Now()
	return nil
}

// if rtype == mdWrite || mdRekey, then mdWriterLock must be taken
func (fbo *folderBranchOps) getMDLocked(
	ctx context.Context, lState *lockState, rtype mdReqType) (
	md *RootMetadata, err error) {
	defer func() {
		if err != nil || rtype == mdReadNoIdentify || rtype == mdRekey {
			return
		}
		err = fbo.identifyOnce(ctx, md)
	}()

	md = fbo.getHead(lState)
	if md != nil {
		return md, nil
	}

	// Unless we're in mdWrite or mdRekey mode, we can't safely fetch
	// the new MD without causing races, so bail.
	if rtype != mdWrite && rtype != mdRekey {
		return nil, MDWriteNeededInRequest{}
	}

	fbo.mdWriterLock.AssertLocked(lState)

	// Not in cache, fetch from server and add to cache.  First, see
	// if this device has any unmerged commits -- take the latest one.
	mdops := fbo.config.MDOps()

	// get the head of the unmerged branch for this device (if any)
	md, err = mdops.GetUnmergedForTLF(ctx, fbo.id(), NullBranchID)
	if err != nil {
		return nil, err
	}
	if md == nil {
		// no unmerged MDs for this device, so just get the current head
		md, err = mdops.GetForTLF(ctx, fbo.id())
		if err != nil {
			return nil, err
		}
	}

	if md.data.Dir.Type != Dir && (!md.IsInitialized() || md.IsReadable()) {
		err = fbo.initMDLocked(ctx, lState, md)
		if err != nil {
			return nil, err
		}
	} else {
		// We go down this code path either due to a rekey
		// notification for an unseen TLF, or in some tests.
		//
		// TODO: Make tests not take this code path, and keep
		// track of the fact that MDs coming from rekey
		// notifications are untrusted.
		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)
		err = fbo.setInitialHeadUntrustedLocked(ctx, lState, md)
		if err != nil {
			return nil, err
		}
	}

	return md, err
}

func (fbo *folderBranchOps) getMDForReadHelper(
	ctx context.Context, lState *lockState, rtype mdReqType) (*RootMetadata, error) {
	md, err := fbo.getMDLocked(ctx, lState, rtype)
	if err != nil {
		return nil, err
	}
	if !md.ID.IsPublic() {
		username, uid, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx)
		if err != nil {
			return nil, err
		}
		if !md.GetTlfHandle().IsReader(uid) {
			return nil, NewReadAccessError(md.GetTlfHandle(), username)
		}
	}
	return md, nil
}

// getMDForFBM is a helper method for the folderBlockManager only.
func (fbo *folderBranchOps) getMDForFBM(ctx context.Context) (
	*RootMetadata, error) {
	lState := makeFBOLockState()
	return fbo.getMDForReadHelper(ctx, lState, mdReadNoIdentify)
}

func (fbo *folderBranchOps) getMDForReadNoIdentify(
	ctx context.Context, lState *lockState) (*RootMetadata, error) {
	return fbo.getMDForReadHelper(ctx, lState, mdReadNoIdentify)
}

func (fbo *folderBranchOps) getMDForReadNeedIdentify(
	ctx context.Context, lState *lockState) (*RootMetadata, error) {
	return fbo.getMDForReadHelper(ctx, lState, mdReadNeedIdentify)
}

func (fbo *folderBranchOps) getMDForWriteLocked(
	ctx context.Context, lState *lockState) (*RootMetadata, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	md, err := fbo.getMDLocked(ctx, lState, mdWrite)
	if err != nil {
		return nil, err
	}

	username, uid, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return nil, err
	}
	if !md.GetTlfHandle().IsWriter(uid) {
		return nil,
			NewWriteAccessError(md.GetTlfHandle(), username)
	}

	// Make a new successor of the current MD to hold the coming
	// writes.  The caller must pass this into
	// syncBlockAndCheckEmbedLocked or the changes will be lost.
	newMd, err := md.MakeSuccessor(fbo.config, true)
	if err != nil {
		return nil, err
	}

	return newMd, nil
}

func (fbo *folderBranchOps) getMDForRekeyWriteLocked(
	ctx context.Context, lState *lockState) (rmd *RootMetadata, wasRekeySet bool, err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	md, err := fbo.getMDLocked(ctx, lState, mdRekey)
	if err != nil {
		return nil, false, err
	}

	username, uid, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return nil, false, err
	}

	handle := md.GetTlfHandle()

	// must be a reader or writer (it checks both.)
	if !handle.IsReader(uid) {
		return nil, false,
			NewRekeyPermissionError(md.GetTlfHandle(), username)
	}

	newMd, err := md.MakeSuccessor(fbo.config, handle.IsWriter(uid))
	if err != nil {
		return nil, false, err
	}

	// readers shouldn't modify writer metadata
	if !handle.IsWriter(uid) && !newMd.IsWriterMetadataCopiedSet() {
		return nil, false,
			NewRekeyPermissionError(handle, username)
	}

	return newMd, md.IsRekeySet(), nil
}

func (fbo *folderBranchOps) nowUnixNano() int64 {
	return fbo.config.Clock().Now().UnixNano()
}

func (fbo *folderBranchOps) initMDLocked(
	ctx context.Context, lState *lockState, md *RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)

	// create a dblock since one doesn't exist yet
	username, uid, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return err
	}

	handle := md.GetTlfHandle()

	// make sure we're a writer before rekeying or putting any blocks.
	if !handle.IsWriter(uid) {
		return NewWriteAccessError(handle, username)
	}

	newDblock := &DirBlock{
		Children: make(map[string]DirEntry),
	}

	var expectedKeyGen KeyGen
	var tlfCryptKey *TLFCryptKey
	if md.ID.IsPublic() {
		expectedKeyGen = PublicKeyGen
	} else {
		var rekeyDone bool
		// create a new set of keys for this metadata
		rekeyDone, tlfCryptKey, err = fbo.config.KeyManager().Rekey(ctx, md, false)
		if err != nil {
			return err
		}
		if !rekeyDone {
			return fmt.Errorf("Initial rekey unexpectedly not done for private TLF %v", md.ID)
		}
		expectedKeyGen = FirstValidKeyGen
	}
	keyGen := md.LatestKeyGeneration()
	if keyGen != expectedKeyGen {
		return InvalidKeyGenerationError{handle, keyGen}
	}
	info, plainSize, readyBlockData, err :=
		fbo.blocks.ReadyBlock(ctx, md, newDblock, uid)
	if err != nil {
		return err
	}

	now := fbo.nowUnixNano()
	md.data.Dir = DirEntry{
		BlockInfo: info,
		EntryInfo: EntryInfo{
			Type:  Dir,
			Size:  uint64(plainSize),
			Mtime: now,
			Ctime: now,
		},
	}
	md.AddOp(newCreateOp("", BlockPointer{}, Dir))
	md.AddRefBlock(md.data.Dir.BlockInfo)
	md.UnrefBytes = 0

	if err = fbo.config.BlockOps().Put(ctx, md, info.BlockPointer,
		readyBlockData); err != nil {
		return err
	}
	if err = fbo.config.BlockCache().Put(
		info.BlockPointer, fbo.id(), newDblock, TransientEntry); err != nil {
		return err
	}

	// finally, write out the new metadata
	if err = fbo.config.MDOps().Put(ctx, md); err != nil {
		return err
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	if fbo.head != nil {
		headID, _ := fbo.head.MetadataID(fbo.config)
		return fmt.Errorf(
			"%v: Unexpected MD ID during new MD initialization: %v",
			md.ID, headID)
	}
	fbo.setNewInitialHeadLocked(ctx, lState, md)
	if err != nil {
		return err
	}

	// cache any new TLF crypt key
	if tlfCryptKey != nil {
		err = fbo.config.KeyCache().PutTLFCryptKey(md.ID, keyGen, *tlfCryptKey)
		if err != nil {
			return err
		}
	}

	return nil
}

func (fbo *folderBranchOps) GetOrCreateRootNode(
	ctx context.Context, h *TlfHandle, branch BranchName) (
	node Node, ei EntryInfo, err error) {
	err = errors.New("GetOrCreateRootNode is not supported by " +
		"folderBranchOps")
	return
}

func (fbo *folderBranchOps) checkNode(node Node) error {
	fb := node.GetFolderBranch()
	if fb != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, fb}
	}
	return nil
}

// CheckForNewMDAndInit sees whether the given MD object has been
// initialized yet; if not, it does so.
func (fbo *folderBranchOps) CheckForNewMDAndInit(
	ctx context.Context, md *RootMetadata) (created bool, err error) {
	fbo.log.CDebugf(ctx, "CheckForNewMDAndInit, revision=%d (%s)",
		md.Revision, md.MergedStatus())
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Done: %v, created: %t", err, created)
	}()

	err = runUnlessCanceled(ctx, func() error {
		fb := FolderBranch{md.ID, MasterBranch}
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
		err = fbo.identifyOnce(ctx, md)
		if err != nil {
			return err
		}

		lState := makeFBOLockState()

		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)

		if md.data.Dir.Type == Dir {
			// this MD is already initialized
			fbo.headLock.Lock(lState)
			defer fbo.headLock.Unlock(lState)
			// Only update the head the first time; later it will be
			// updated either directly via writes or through the
			// background update processor.
			if fbo.head == nil {
				err := fbo.setInitialHeadTrustedLocked(ctx, lState, md)
				if err != nil {
					return err
				}
			}
			return nil
		}
		// Initialize if needed
		created = true
		return fbo.initMDLocked(ctx, lState, md)
	})
	if err != nil {
		return false, err
	}
	return created, nil
}

// execMDReadNoIdentifyThenMDWrite first tries to execute the
// passed-in method in mdReadNoIdentify mode.  If it fails with an
// MDWriteNeededInRequest error, it re-executes the method as in
// mdWrite mode.  The passed-in method must note whether or not this
// is an mdWrite call.
//
// This must only be used by getRootNode().
func (fbo *folderBranchOps) execMDReadNoIdentifyThenMDWrite(
	lState *lockState, f func(*lockState, mdReqType) error) error {
	err := f(lState, mdReadNoIdentify)

	// Redo as an MD write request if needed
	if _, ok := err.(MDWriteNeededInRequest); ok {
		fbo.mdWriterLock.Lock(lState)
		defer fbo.mdWriterLock.Unlock(lState)
		err = f(lState, mdWrite)
	}
	return err
}

func (fbo *folderBranchOps) getRootNode(ctx context.Context) (
	node Node, ei EntryInfo, handle *TlfHandle, err error) {
	fbo.log.CDebugf(ctx, "getRootNode")
	defer func() {
		if err != nil {
			fbo.deferLog.CDebugf(ctx, "Error: %v", err)
		} else {
			// node may still be nil if we're unwinding
			// from a panic.
			fbo.deferLog.CDebugf(ctx, "Done: %v", node)
		}
	}()

	lState := makeFBOLockState()

	var md *RootMetadata
	err = fbo.execMDReadNoIdentifyThenMDWrite(lState,
		func(lState *lockState, rtype mdReqType) error {
			md, err = fbo.getMDLocked(ctx, lState, rtype)
			return err
		})
	if err != nil {
		return nil, EntryInfo{}, nil, err
	}

	// we may be an unkeyed client
	if err := md.isReadableOrError(ctx, fbo.config); err != nil {
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
	fbo.log.CDebugf(ctx, "GetDirChildren %p", dir.GetID())
	defer func() { fbo.deferLog.CDebugf(ctx, "Done GetDirChildren: %v", err) }()

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

		children, err = fbo.blocks.GetDirtyDirChildren(
			ctx, lState, md, dirPath)
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
	fbo.log.CDebugf(ctx, "Lookup %p %s", dir.GetID(), name)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

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

		dirPath, err := fbo.pathFromNodeForRead(dir)
		if err != nil {
			return err
		}

		childPath := dirPath.ChildPathNoPtr(name)

		de, err = fbo.blocks.GetDirtyEntry(ctx, lState, md, childPath)
		if err != nil {
			return err
		}

		if de.Type == Sym {
			node = nil
		} else {
			err = fbo.checkDataVersion(childPath, de.BlockPointer)
			if err != nil {
				return err
			}

			node, err = fbo.nodeCache.GetOrCreate(de.BlockPointer, name, dir)
			if err != nil {
				return err
			}
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

	var md *RootMetadata
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
		de, err = fbo.blocks.GetDirtyEntry(ctx, lState, md, nodePath)
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
	fbo.log.CDebugf(ctx, "Stat %p", node.GetID())
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

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

func (fbo *folderBranchOps) readyBlockMultiple(ctx context.Context,
	md *RootMetadata, currBlock Block, uid keybase1.UID, bps *blockPutState) (
	info BlockInfo, plainSize int, err error) {
	info, plainSize, readyBlockData, err :=
		fbo.blocks.ReadyBlock(ctx, md, currBlock, uid)
	if err != nil {
		return
	}

	bps.addNewBlock(info.BlockPointer, currBlock, readyBlockData, nil)
	return
}

func (fbo *folderBranchOps) unembedBlockChanges(
	ctx context.Context, bps *blockPutState, md *RootMetadata,
	changes *BlockChanges, uid keybase1.UID) (err error) {
	buf, err := fbo.config.Codec().Encode(changes)
	if err != nil {
		return
	}
	block := NewFileBlock().(*FileBlock)
	block.Contents = buf
	info, _, err := fbo.readyBlockMultiple(ctx, md, block, uid, bps)
	if err != nil {
		return
	}
	md.data.cachedChanges = *changes
	changes.Info = info
	changes.Ops = nil
	md.RefBytes += uint64(info.EncodedSize)
	md.DiskUsage += uint64(info.EncodedSize)
	return
}

type localBcache map[BlockPointer]*DirBlock

// syncBlock updates, and readies, the blocks along the path for the
// given write, up to the root of the tree or stopAt (if specified).
// When it updates the root of the tree, it also modifies the given
// head object with a new revision number and root block ID.  It first
// checks the provided lbc for blocks that may have been modified by
// previous syncBlock calls or the FS calls themselves.  It returns
// the updated path to the changed directory, the new or updated
// directory entry created as part of the call, and a summary of all
// the blocks that now must be put to the block server.
//
// This function is safe to use unlocked, but may modify MD to have
// the same revision number as another one. All functions in this file
// must call syncBlockLocked instead, which holds mdWriterLock and
// thus serializes the revision numbers. Conflict resolution may call
// syncBlockForConflictResolution, which doesn't hold the lock, since
// it already handles conflicts correctly.
//
// entryType must not be Sym.
//
// TODO: deal with multiple nodes for indirect blocks
func (fbo *folderBranchOps) syncBlock(
	ctx context.Context, lState *lockState, uid keybase1.UID,
	md *RootMetadata, newBlock Block, dir path, name string,
	entryType EntryType, mtime bool, ctime bool, stopAt BlockPointer,
	lbc localBcache) (path, DirEntry, *blockPutState, error) {
	// now ready each dblock and write the DirEntry for the next one
	// in the path
	currBlock := newBlock
	currName := name
	newPath := path{
		FolderBranch: dir.FolderBranch,
		path:         make([]pathNode, 0, len(dir.path)),
	}
	bps := newBlockPutState(len(dir.path))
	refPath := dir.ChildPathNoPtr(name)
	var newDe DirEntry
	doSetTime := true
	now := fbo.nowUnixNano()
	for len(newPath.path) < len(dir.path)+1 {
		info, plainSize, err :=
			fbo.readyBlockMultiple(ctx, md, currBlock, uid, bps)
		if err != nil {
			return path{}, DirEntry{}, nil, err
		}

		// prepend to path and setup next one
		newPath.path = append([]pathNode{{info.BlockPointer, currName}},
			newPath.path...)

		// get the parent block
		prevIdx := len(dir.path) - len(newPath.path)
		var prevDblock *DirBlock
		var de DirEntry
		var nextName string
		nextDoSetTime := false
		if prevIdx < 0 {
			// root dir, update the MD instead
			de = md.data.Dir
		} else {
			prevDir := path{
				FolderBranch: dir.FolderBranch,
				path:         dir.path[:prevIdx+1],
			}

			// First, check the localBcache, which could contain
			// blocks that were modified across multiple calls to
			// syncBlock.
			var ok bool
			prevDblock, ok = lbc[prevDir.tailPointer()]
			if !ok {
				// If the block isn't in the local bcache, we
				// have to fetch it, possibly from the
				// network. Directory blocks are only ever
				// modified while holding mdWriterLock, so it's
				// safe to fetch them one at a time.
				prevDblock, err = fbo.blocks.GetDir(
					ctx, lState, md, prevDir, blockWrite)
				if err != nil {
					return path{}, DirEntry{}, nil, err
				}
			}

			// modify the direntry for currName; make one
			// if it doesn't exist (which should only
			// happen the first time around).
			//
			// TODO: Pull the creation out of here and
			// into createEntryLocked().
			if de, ok = prevDblock.Children[currName]; !ok {
				// If this isn't the first time
				// around, we have an error.
				if len(newPath.path) > 1 {
					return path{}, DirEntry{}, nil, NoSuchNameError{currName}
				}

				// If this is a file, the size should be 0. (TODO:
				// Ensure this.) If this is a directory, the size will
				// be filled in below.  The times will be filled in
				// below as well, since we should only be creating a
				// new directory entry when doSetTime is true.
				de = DirEntry{
					EntryInfo: EntryInfo{
						Type: entryType,
						Size: 0,
					},
				}
				// If we're creating a new directory entry, the
				// parent's times must be set as well.
				nextDoSetTime = true
			}

			currBlock = prevDblock
			nextName = prevDir.tailName()
		}

		if de.Type == Dir {
			// TODO: When we use indirect dir blocks,
			// we'll have to calculate the size some other
			// way.
			de.Size = uint64(plainSize)
		}

		if prevIdx < 0 {
			md.AddUpdate(md.data.Dir.BlockInfo, info)
		} else if prevDe, ok := prevDblock.Children[currName]; ok {
			md.AddUpdate(prevDe.BlockInfo, info)
		} else {
			// this is a new block
			md.AddRefBlock(info)
		}

		if len(refPath.path) > 1 {
			refPath = *refPath.parentPath()
		}
		de.BlockInfo = info

		if doSetTime {
			if mtime {
				de.Mtime = now
			}
			if ctime {
				de.Ctime = now
			}
		}
		if !newDe.IsInitialized() {
			newDe = de
		}

		if prevIdx < 0 {
			md.data.Dir = de
		} else {
			prevDblock.Children[currName] = de
		}
		currName = nextName

		// Stop before we get to the common ancestor; it will be taken care of
		// on the next sync call
		if prevIdx >= 0 && dir.path[prevIdx].BlockPointer == stopAt {
			// Put this back into the cache as dirty -- the next
			// syncBlock call will ready it.
			dblock, ok := currBlock.(*DirBlock)
			if !ok {
				return path{}, DirEntry{}, nil, BadDataError{stopAt.ID}
			}
			lbc[stopAt] = dblock
			break
		}
		doSetTime = nextDoSetTime
	}

	return newPath, newDe, bps, nil
}

// syncBlockLock calls syncBlock under mdWriterLock.
func (fbo *folderBranchOps) syncBlockLocked(
	ctx context.Context, lState *lockState, uid keybase1.UID,
	md *RootMetadata, newBlock Block, dir path, name string,
	entryType EntryType, mtime bool, ctime bool, stopAt BlockPointer,
	lbc localBcache) (path, DirEntry, *blockPutState, error) {
	fbo.mdWriterLock.AssertLocked(lState)
	return fbo.syncBlock(ctx, lState, uid, md, newBlock, dir, name,
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
	return fbo.syncBlock(
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

	_, uid, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return path{}, DirEntry{}, nil, err
	}

	newPath, newDe, bps, err := fbo.syncBlockLocked(
		ctx, lState, uid, md, newBlock, dir, name, entryType, mtime,
		ctime, stopAt, lbc)
	if err != nil {
		return path{}, DirEntry{}, nil, err
	}

	// do the block changes need their own blocks?
	bsplit := fbo.config.BlockSplitter()
	if !bsplit.ShouldEmbedBlockChanges(&md.data.Changes) {
		err = fbo.unembedBlockChanges(ctx, bps, md, &md.data.Changes,
			uid)
		if err != nil {
			return path{}, DirEntry{}, nil, err
		}
	}

	return newPath, newDe, bps, nil
}

func isRecoverableBlockError(err error) bool {
	_, isArchiveError := err.(BServerErrorBlockArchived)
	_, isDeleteError := err.(BServerErrorBlockDeleted)
	_, isRefError := err.(BServerErrorBlockNonExistent)
	return isArchiveError || isDeleteError || isRefError
}

func isRetriableError(err error, retries int) bool {
	recoverable := isRecoverableBlockError(err)
	return recoverable && retries < maxRetriesOnRecoverableErrors
}

func (fbo *folderBranchOps) doOneBlockPut(ctx context.Context,
	md *RootMetadata, blockState blockState,
	errChan chan error, blocksToRemoveChan chan *FileBlock) {
	err := fbo.config.BlockOps().
		Put(ctx, md, blockState.blockPtr, blockState.readyBlockData)
	if err == nil && blockState.syncedCb != nil {
		err = blockState.syncedCb()
	}
	if err != nil {
		if isRecoverableBlockError(err) {
			fblock, ok := blockState.block.(*FileBlock)
			if ok && !fblock.IsInd {
				blocksToRemoveChan <- fblock
			}
		}

		// one error causes everything else to cancel
		select {
		case errChan <- err:
		default:
			return
		}
	}
}

// doBlockPuts writes all the pending block puts to the cache and
// server. If the err returned by this function satisfies
// isRecoverableBlockError(err), the caller should retry its entire
// operation, starting from when the MD successor was created.
//
// Returns a slice of block pointers that resulted in recoverable
// errors and should be removed by the caller from any saved state.
func (fbo *folderBranchOps) doBlockPuts(ctx context.Context,
	md *RootMetadata, bps blockPutState) ([]BlockPointer, error) {
	errChan := make(chan error, 1)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	blocks := make(chan blockState, len(bps.blockStates))
	var wg sync.WaitGroup

	numWorkers := len(bps.blockStates)
	if numWorkers > maxParallelBlockPuts {
		numWorkers = maxParallelBlockPuts
	}
	wg.Add(numWorkers)
	// A channel to list any blocks that have been archived or
	// deleted.  Any of these will result in an error, so the maximum
	// we'll get is the same as the number of workers.
	blocksToRemoveChan := make(chan *FileBlock, numWorkers)

	worker := func() {
		defer wg.Done()
		for blockState := range blocks {
			fbo.doOneBlockPut(ctx, md, blockState, errChan, blocksToRemoveChan)
			select {
			// return early if the context has been canceled
			case <-ctx.Done():
				return
			default:
			}
		}
	}
	for i := 0; i < numWorkers; i++ {
		go worker()
	}

	for _, blockState := range bps.blockStates {
		blocks <- blockState
	}
	close(blocks)

	go func() {
		wg.Wait()
		close(errChan)
		close(blocksToRemoveChan)
	}()
	err := <-errChan
	var blocksToRemove []BlockPointer
	if isRecoverableBlockError(err) {
		bcache := fbo.config.BlockCache()
		// Wait for all the outstanding puts to finish, to amortize
		// the work of re-doing the put.
		for fblock := range blocksToRemoveChan {
			for i, bs := range bps.blockStates {
				if bs.block == fblock {
					// Let the caller know which blocks shouldn't be
					// retried.
					blocksToRemove = append(blocksToRemove,
						bps.blockStates[i].blockPtr)
				}
			}

			// Remove each problematic block from the cache so the
			// redo can just make a new block instead.
			if err := bcache.DeleteKnownPtr(fbo.id(), fblock); err != nil {
				fbo.log.CWarningf(ctx, "Couldn't delete ptr for a block: %v",
					err)
			}
		}
	}
	return blocksToRemove, err
}

func (fbo *folderBranchOps) finalizeBlocks(bps *blockPutState) error {
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
func (fbo *folderBranchOps) isRevisionConflict(err error) bool {
	if err == nil {
		return false
	}
	_, isConflictRevision := err.(MDServerErrorConflictRevision)
	_, isConflictPrevRoot := err.(MDServerErrorConflictPrevRoot)
	_, isConflictDiskUsage := err.(MDServerErrorConflictDiskUsage)
	_, isConditionFailed := err.(MDServerErrorConditionFailed)
	_, isConflictFolderMapping := err.(MDServerErrorConflictFolderMapping)
	return isConflictRevision || isConflictPrevRoot ||
		isConflictDiskUsage || isConditionFailed ||
		isConflictFolderMapping
}

func (fbo *folderBranchOps) finalizeMDWriteLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, bps *blockPutState) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// finally, write out the new metadata
	mdops := fbo.config.MDOps()

	doUnmergedPut, wasMasterBranch := true, fbo.isMasterBranchLocked(lState)
	mergedRev := MetadataRevisionUninitialized

	if fbo.isMasterBranchLocked(lState) {
		// only do a normal Put if we're not already staged.
		err = mdops.Put(ctx, md)
		doUnmergedPut = fbo.isRevisionConflict(err)
		if err != nil && !doUnmergedPut {
			return err
		}
		// The first time we transition, our last known MD revision is
		// the same (at least) as what we thought our new revision
		// should be.  Otherwise, just leave it at uninitialized and
		// let the resolver sort it out.
		if doUnmergedPut {
			fbo.log.CDebugf(ctx, "Conflict: %v", err)
			mergedRev = md.Revision
		}
	}

	if doUnmergedPut {
		// We're out of date, so put it as an unmerged MD.
		var bid BranchID
		if wasMasterBranch {
			// new branch ID
			crypto := fbo.config.Crypto()
			if bid, err = crypto.MakeRandomBranchID(); err != nil {
				return err
			}
		} else {
			bid = fbo.bid
		}
		err := mdops.PutUnmerged(ctx, md, bid)
		if err != nil {
			// TODO: if this is a conflict error, we should try to
			// fast-forward to the most recent revision after
			// returning this error.
			return err
		}
		fbo.setBranchIDLocked(lState, bid)
		fbo.cr.Resolve(md.Revision, mergedRev)
	} else {
		if !fbo.isMasterBranchLocked(lState) {
			// If we were staged, prune all unmerged history now
			err = fbo.config.MDServer().PruneBranch(ctx, fbo.id(), fbo.bid)
			if err != nil {
				return err
			}
		}

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
			defer fbo.config.RekeyQueue().Enqueue(md.ID)
		}
	}

	md.swapCachedBlockChanges()

	err = fbo.finalizeBlocks(bps)
	if err != nil {
		return err
	}

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	err = fbo.setHeadSuccessorLocked(ctx, lState, md)
	if err != nil {
		return err
	}

	// Archive the old, unref'd blocks
	fbo.fbm.archiveUnrefBlocks(md)

	fbo.notifyBatchLocked(ctx, lState, md)
	return nil
}

func (fbo *folderBranchOps) finalizeMDRekeyWriteLocked(ctx context.Context,
	lState *lockState, md *RootMetadata) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// finally, write out the new metadata
	err = fbo.config.MDOps().Put(ctx, md)
	isConflict := fbo.isRevisionConflict(err)
	if err != nil && !isConflict {
		return err
	}

	if isConflict {
		// drop this block. we've probably collided with someone also
		// trying to rekey the same folder but that's not necessarily
		// the case. we'll queue another rekey just in case. it should
		// be safe as it's idempotent. we don't want any rekeys present
		// in unmerged history or that will just make a mess.
		fbo.config.RekeyQueue().Enqueue(md.ID)
		return err
	}

	fbo.setBranchIDLocked(lState, NullBranchID)

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	return fbo.setHeadSuccessorLocked(ctx, lState, md)
}

func (fbo *folderBranchOps) finalizeGCOp(ctx context.Context, gco *gcOp) (
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

	if !fbo.config.BlockSplitter().ShouldEmbedBlockChanges(&md.data.Changes) {
		var uid keybase1.UID
		_, uid, err = fbo.config.KBPKI().GetCurrentUserInfo(ctx)
		if err != nil {
			return err
		}

		bps := newBlockPutState(1)
		err = fbo.unembedBlockChanges(ctx, bps, md, &md.data.Changes, uid)
		if err != nil {
			return err
		}

		defer func() {
			if err != nil {
				fbo.fbm.cleanUpBlockState(md, bps)
			}
		}()

		ptrsToDelete, err := fbo.doBlockPuts(ctx, md, *bps)
		if err != nil {
			return err
		}
		if len(ptrsToDelete) > 0 {
			return fmt.Errorf("Unexpected pointers to delete after "+
				"unembedding block changes in gc op: %v", ptrsToDelete)
		}
	}

	// finally, write out the new metadata
	err = fbo.config.MDOps().Put(ctx, md)
	if err != nil {
		// Don't allow garbage collection to put us into a conflicting
		// state; just wait for the next period.
		return err
	}

	fbo.setBranchIDLocked(lState, NullBranchID)
	md.swapCachedBlockChanges()

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	err = fbo.setHeadSuccessorLocked(ctx, lState, md)
	if err != nil {
		return err
	}

	fbo.notifyBatchLocked(ctx, lState, md)
	return nil
}

func (fbo *folderBranchOps) syncBlockAndFinalizeLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, newBlock Block, dir path,
	name string, entryType EntryType, mtime bool, ctime bool,
	stopAt BlockPointer) (de DirEntry, err error) {
	fbo.mdWriterLock.AssertLocked(lState)
	_, de, bps, err := fbo.syncBlockAndCheckEmbedLocked(
		ctx, lState, md, newBlock, dir, name, entryType, mtime,
		ctime, zeroPtr, nil)
	if err != nil {
		return DirEntry{}, err
	}

	defer func() {
		if err != nil {
			fbo.fbm.cleanUpBlockState(md, bps)
		}
	}()

	_, err = fbo.doBlockPuts(ctx, md, *bps)
	if err != nil {
		return DirEntry{}, err
	}
	err = fbo.finalizeMDWriteLocked(ctx, lState, md, bps)
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
	lState *lockState, md *RootMetadata, dirPath path, newName string) error {
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

// entryType must not by Sym.
func (fbo *folderBranchOps) createEntryLocked(
	ctx context.Context, lState *lockState, dir Node, name string,
	entryType EntryType) (Node, DirEntry, error) {
	fbo.mdWriterLock.AssertLocked(lState)

	if err := checkDisallowedPrefixes(name); err != nil {
		return nil, DirEntry{}, err
	}

	if uint32(len(name)) > fbo.config.MaxNameBytes() {
		return nil, DirEntry{},
			NameTooLongError{name, fbo.config.MaxNameBytes()}
	}

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return nil, DirEntry{}, err
	}

	dirPath, err := fbo.pathFromNodeForMDWriteLocked(lState, dir)
	if err != nil {
		return nil, DirEntry{}, err
	}

	dblock, err := fbo.blocks.GetDir(ctx, lState, md, dirPath, blockWrite)
	if err != nil {
		return nil, DirEntry{}, err
	}

	// does name already exist?
	if _, ok := dblock.Children[name]; ok {
		return nil, DirEntry{}, NameExistsError{name}
	}

	if err := fbo.checkNewDirSize(ctx, lState, md, dirPath, name); err != nil {
		return nil, DirEntry{}, err
	}

	md.AddOp(newCreateOp(name, dirPath.tailPointer(), entryType))
	// create new data block
	var newBlock Block
	// XXX: for now, put a unique ID in every new block, to make sure it
	// has a unique block ID. This may not be needed once we have encryption.
	if entryType == Dir {
		newBlock = &DirBlock{
			Children: make(map[string]DirEntry),
		}
	} else {
		newBlock = &FileBlock{}
	}

	de, err := fbo.syncBlockAndFinalizeLocked(
		ctx, lState, md, newBlock, dirPath, name, entryType,
		true, true, zeroPtr)
	if err != nil {
		return nil, DirEntry{}, err
	}
	node, err := fbo.nodeCache.GetOrCreate(de.BlockPointer, name, dir)
	if err != nil {
		return nil, DirEntry{}, err
	}
	return node, de, nil
}

func (fbo *folderBranchOps) doMDWriteWithRetry(ctx context.Context,
	lState *lockState, fn func(lState *lockState) error) error {
	doUnlock := false
	defer func() {
		if doUnlock {
			fbo.mdWriterLock.Unlock(lState)
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
	fbo.log.CDebugf(ctx, "CreateDir %p %s", dir.GetID(), path)
	defer func() {
		if err != nil {
			fbo.deferLog.CDebugf(ctx, "Error: %v", err)
		} else {
			fbo.deferLog.CDebugf(ctx, "Done: %p", n.GetID())
		}
	}()

	err = fbo.checkNode(dir)
	if err != nil {
		return nil, EntryInfo{}, err
	}

	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			node, de, err := fbo.createEntryLocked(ctx, lState, dir, path, Dir)
			n = node
			ei = de.EntryInfo
			return err
		})
	if err != nil {
		return nil, EntryInfo{}, err
	}
	return n, ei, nil
}

func (fbo *folderBranchOps) CreateFile(
	ctx context.Context, dir Node, path string, isExec bool) (
	n Node, ei EntryInfo, err error) {
	fbo.log.CDebugf(ctx, "CreateFile %p %s", dir.GetID(), path)
	defer func() {
		if err != nil {
			fbo.deferLog.CDebugf(ctx, "Error: %v", err)
		} else {
			fbo.deferLog.CDebugf(ctx, "Done: %p", n.GetID())
		}
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

	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			node, de, err :=
				fbo.createEntryLocked(ctx, lState, dir, path, entryType)
			n = node
			ei = de.EntryInfo
			return err
		})
	if err != nil {
		return nil, EntryInfo{}, err
	}
	return n, ei, nil
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

	dblock, err := fbo.blocks.GetDir(ctx, lState, md, dirPath, blockWrite)
	if err != nil {
		return DirEntry{}, err
	}

	// TODO: validate inputs

	// does name already exist?
	if _, ok := dblock.Children[fromName]; ok {
		return DirEntry{}, NameExistsError{fromName}
	}

	if err := fbo.checkNewDirSize(ctx, lState, md,
		dirPath, fromName); err != nil {
		return DirEntry{}, err
	}

	md.AddOp(newCreateOp(fromName, dirPath.tailPointer(), Sym))

	// Create a direntry for the link, and then sync
	now := fbo.nowUnixNano()
	dblock.Children[fromName] = DirEntry{
		EntryInfo: EntryInfo{
			Type:    Sym,
			Size:    uint64(len(toPath)),
			SymPath: toPath,
			Mtime:   now,
			Ctime:   now,
		},
	}

	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, lState, md, dblock, *dirPath.parentPath(),
		dirPath.tailName(), Dir, true, true, zeroPtr)
	if err != nil {
		return DirEntry{}, err
	}
	return dblock.Children[fromName], nil
}

func (fbo *folderBranchOps) CreateLink(
	ctx context.Context, dir Node, fromName string, toPath string) (
	ei EntryInfo, err error) {
	fbo.log.CDebugf(ctx, "CreateLink %p %s -> %s",
		dir.GetID(), fromName, toPath)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

	err = fbo.checkNode(dir)
	if err != nil {
		return EntryInfo{}, err
	}

	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			de, err := fbo.createLinkLocked(ctx, lState, dir, fromName, toPath)
			ei = de.EntryInfo
			return err
		})
	if err != nil {
		return EntryInfo{}, err
	}
	return ei, nil
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
			ctx, lState, md, childPath)
		if err != nil {
			return NoSuchBlockError{de.ID}
		}
		for _, blockInfo := range blockInfos {
			md.AddUnrefBlock(blockInfo)
		}
	}
	return nil
}

func (fbo *folderBranchOps) removeEntryLocked(ctx context.Context,
	lState *lockState, md *RootMetadata, dir path, name string) error {
	fbo.mdWriterLock.AssertLocked(lState)

	pblock, err := fbo.blocks.GetDir(ctx, lState, md, dir, blockWrite)
	if err != nil {
		return err
	}

	// make sure the entry exists
	de, ok := pblock.Children[name]
	if !ok {
		return NoSuchNameError{name}
	}

	md.AddOp(newRmOp(name, dir.tailPointer()))
	err = fbo.unrefEntry(ctx, lState, md, dir, de, name)
	if err != nil {
		return err
	}

	// the actual unlink
	delete(pblock.Children, name)

	// sync the parent directory
	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, lState, md, pblock, *dir.parentPath(), dir.tailName(),
		Dir, true, true, zeroPtr)
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

	pblock, err := fbo.blocks.GetDir(ctx, lState, md, dirPath, blockRead)
	de, ok := pblock.Children[dirName]
	if !ok {
		return NoSuchNameError{dirName}
	}

	// construct a path for the child so we can check for an empty dir
	childPath := dirPath.ChildPath(dirName, de.BlockPointer)

	childBlock, err := fbo.blocks.GetDir(
		ctx, lState, md, childPath, blockRead)
	if err != nil {
		return err
	}

	if len(childBlock.Children) > 0 {
		return DirNotEmptyError{dirName}
	}

	return fbo.removeEntryLocked(ctx, lState, md, dirPath, dirName)
}

func (fbo *folderBranchOps) RemoveDir(
	ctx context.Context, dir Node, dirName string) (err error) {
	fbo.log.CDebugf(ctx, "RemoveDir %p %s", dir.GetID(), dirName)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

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
	fbo.log.CDebugf(ctx, "RemoveEntry %p %s", dir.GetID(), name)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

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

			return fbo.removeEntryLocked(ctx, lState, md, dirPath, name)
		})
}

func (fbo *folderBranchOps) renameLocked(
	ctx context.Context, lState *lockState, oldParent path,
	oldName string, newParent path, newName string) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	oldPBlock, newPBlock, newDe, lbc, err := fbo.blocks.PrepRename(
		ctx, lState, md, oldParent, oldName, newParent, newName)

	if err != nil {
		return err
	}

	// does name exist?
	if de, ok := newPBlock.Children[newName]; ok {
		// Usually higher-level programs check these, but just in case.
		if de.Type == Dir && newDe.Type != Dir {
			return NotDirError{newParent.ChildPathNoPtr(newName)}
		} else if de.Type != Dir && newDe.Type == Dir {
			return NotFileError{newParent.ChildPathNoPtr(newName)}
		}

		if de.Type == Dir {
			// The directory must be empty.
			oldTargetDir, err := fbo.blocks.GetDirBlockForReading(ctx, lState,
				md, de.BlockPointer, newParent.Branch,
				newParent.ChildPathNoPtr(newName))
			if err != nil {
				return err
			}
			if len(oldTargetDir.Children) != 0 {
				fbo.log.CWarningf(ctx, "Renaming over a non-empty directory "+
					" (%s/%s) not allowed.", newParent, newName)
				return DirNotEmptyError{newName}
			}
		}

		// Delete the old block pointed to by this direntry.
		err := fbo.unrefEntry(ctx, lState, md, newParent, de, newName)
		if err != nil {
			return err
		}
	}

	// only the ctime changes
	newDe.Ctime = fbo.nowUnixNano()
	newPBlock.Children[newName] = newDe
	delete(oldPBlock.Children, oldName)

	// find the common ancestor
	var i int
	found := false
	// the root block will always be the same, so start at number 1
	for i = 1; i < len(oldParent.path) && i < len(newParent.path); i++ {
		if oldParent.path[i].ID != newParent.path[i].ID {
			found = true
			i--
			break
		}
	}
	if !found {
		// if we couldn't find one, then the common ancestor is the
		// last node in the shorter path
		if len(oldParent.path) < len(newParent.path) {
			i = len(oldParent.path) - 1
		} else {
			i = len(newParent.path) - 1
		}
	}
	commonAncestor := oldParent.path[i].BlockPointer
	oldIsCommon := oldParent.tailPointer() == commonAncestor
	newIsCommon := newParent.tailPointer() == commonAncestor

	newOldPath := path{FolderBranch: oldParent.FolderBranch}
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
			lbc[oldParent.tailPointer()] = oldPBlock
		}
	} else {
		if newIsCommon {
			// If the new one is common, then the first
			// syncBlockAndCheckEmbedLocked call will need to access
			// it.
			lbc[newParent.tailPointer()] = newPBlock
		}

		// The old one is not the common ancestor, so we need to sync it.
		// TODO: optimize by pushing blocks from both paths in parallel
		newOldPath, _, oldBps, err = fbo.syncBlockAndCheckEmbedLocked(
			ctx, lState, md, oldPBlock, *oldParent.parentPath(), oldParent.tailName(),
			Dir, true, true, commonAncestor, lbc)
		if err != nil {
			return err
		}
	}

	newNewPath, _, newBps, err := fbo.syncBlockAndCheckEmbedLocked(
		ctx, lState, md, newPBlock, *newParent.parentPath(), newParent.tailName(),
		Dir, true, true, zeroPtr, lbc)
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
			fbo.fbm.cleanUpBlockState(md, newBps)
		}
	}()

	_, err = fbo.doBlockPuts(ctx, md, *newBps)
	if err != nil {
		return err
	}

	return fbo.finalizeMDWriteLocked(ctx, lState, md, newBps)
}

func (fbo *folderBranchOps) Rename(
	ctx context.Context, oldParent Node, oldName string, newParent Node,
	newName string) (err error) {
	fbo.log.CDebugf(ctx, "Rename %p/%s -> %p/%s", oldParent.GetID(),
		oldName, newParent.GetID(), newName)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

	err = fbo.checkNode(newParent)
	if err != nil {
		return err
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			oldParentPath, err := fbo.pathFromNodeForMDWriteLocked(lState, oldParent)
			if err != nil {
				return err
			}

			newParentPath, err := fbo.pathFromNodeForMDWriteLocked(lState, newParent)
			if err != nil {
				return err
			}

			// only works for paths within the same topdir
			if oldParentPath.FolderBranch != newParentPath.FolderBranch {
				return RenameAcrossDirsError{}
			}

			return fbo.renameLocked(ctx, lState, oldParentPath, oldName,
				newParentPath, newName)
		})
}

func (fbo *folderBranchOps) Read(
	ctx context.Context, file Node, dest []byte, off int64) (
	n int64, err error) {
	fbo.log.CDebugf(ctx, "Read %p %d %d", file.GetID(), len(dest), off)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

	err = fbo.checkNode(file)
	if err != nil {
		return 0, err
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

		filePath, err := fbo.pathFromNodeForRead(file)
		if err != nil {
			return err
		}

		bytesRead, err = fbo.blocks.Read(ctx, lState, md, filePath, dest, off)
		return err
	})
	if err != nil {
		return 0, err
	}
	return bytesRead, nil
}

func (fbo *folderBranchOps) Write(
	ctx context.Context, file Node, data []byte, off int64) (err error) {
	fbo.log.CDebugf(ctx, "Write %p %d %d", file.GetID(), len(data), off)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

	err = fbo.checkNode(file)
	if err != nil {
		return err
	}

	return runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()

		// Get the MD for reading.  We won't modify it; we'll track the
		// unref changes on the side, and put them into the MD during the
		// sync.
		md, err := fbo.getMDLocked(ctx, lState, mdReadNeedIdentify)
		if err != nil {
			return err
		}

		err = fbo.blocks.Write(ctx, lState, md, file, data, off)
		if err != nil {
			return err
		}

		fbo.status.addDirtyNode(file)
		return nil
	})
}

func (fbo *folderBranchOps) Truncate(
	ctx context.Context, file Node, size uint64) (err error) {
	fbo.log.CDebugf(ctx, "Truncate %p %d", file.GetID(), size)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

	err = fbo.checkNode(file)
	if err != nil {
		return err
	}

	return runUnlessCanceled(ctx, func() error {
		lState := makeFBOLockState()

		// Get the MD for reading.  We won't modify it; we'll track the
		// unref changes on the side, and put them into the MD during the
		// sync.
		md, err := fbo.getMDLocked(ctx, lState, mdReadNeedIdentify)
		if err != nil {
			return err
		}

		err = fbo.blocks.Truncate(ctx, lState, md, file, size)
		if err != nil {
			return err
		}

		fbo.status.addDirtyNode(file)
		return nil
	})
}

func (fbo *folderBranchOps) setExLocked(
	ctx context.Context, lState *lockState, file path,
	ex bool) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return
	}

	dblock, de, err := fbo.blocks.GetDirtyParentAndEntry(
		ctx, lState, md, file)
	if err != nil {
		return
	}

	// If the file is a symlink, do nothing (to match ext4
	// behavior).
	if de.Type == Sym {
		return
	}

	if ex && (de.Type == File) {
		de.Type = Exec
	} else if !ex && (de.Type == Exec) {
		de.Type = File
	}

	parentPath := file.parentPath()
	md.AddOp(newSetAttrOp(file.tailName(), parentPath.tailPointer(), exAttr,
		file.tailPointer()))

	// If the type isn't File or Exec, there's nothing to do, but
	// change the ctime anyway (to match ext4 behavior).
	de.Ctime = fbo.nowUnixNano()
	dblock.Children[file.tailName()] = de
	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, lState, md, dblock, *parentPath.parentPath(), parentPath.tailName(),
		Dir, false, false, zeroPtr)
	return err
}

func (fbo *folderBranchOps) SetEx(
	ctx context.Context, file Node, ex bool) (err error) {
	fbo.log.CDebugf(ctx, "SetEx %p %t", file.GetID(), ex)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

	err = fbo.checkNode(file)
	if err != nil {
		return
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			filePath, err := fbo.pathFromNodeForMDWriteLocked(lState, file)
			if err != nil {
				return err
			}

			return fbo.setExLocked(ctx, lState, filePath, ex)
		})
}

func (fbo *folderBranchOps) setMtimeLocked(
	ctx context.Context, lState *lockState, file path,
	mtime *time.Time) error {
	fbo.mdWriterLock.AssertLocked(lState)

	// verify we have permission to write
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	dblock, de, err := fbo.blocks.GetDirtyParentAndEntry(
		ctx, lState, md, file)
	if err != nil {
		return err
	}

	parentPath := file.parentPath()
	md.AddOp(newSetAttrOp(file.tailName(), parentPath.tailPointer(), mtimeAttr,
		file.tailPointer()))

	de.Mtime = mtime.UnixNano()
	// setting the mtime counts as changing the file MD, so must set ctime too
	de.Ctime = fbo.nowUnixNano()
	dblock.Children[file.tailName()] = de
	_, err = fbo.syncBlockAndFinalizeLocked(
		ctx, lState, md, dblock, *parentPath.parentPath(), parentPath.tailName(),
		Dir, false, false, zeroPtr)
	return err
}

func (fbo *folderBranchOps) SetMtime(
	ctx context.Context, file Node, mtime *time.Time) (err error) {
	fbo.log.CDebugf(ctx, "SetMtime %p %v", file.GetID(), mtime)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

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
			filePath, err := fbo.pathFromNodeForMDWriteLocked(lState, file)
			if err != nil {
				return err
			}

			return fbo.setMtimeLocked(ctx, lState, filePath, mtime)
		})
}

func (fbo *folderBranchOps) syncLocked(ctx context.Context,
	lState *lockState, file path) (stillDirty bool, err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	// if the cache for this file isn't dirty, we're done
	if !fbo.blocks.IsDirty(lState, file) {
		return false, nil
	}

	// Verify we have permission to write.  We do this after the dirty
	// check because otherwise readers who sync clean files on close
	// would get an error.
	md, err := fbo.getMDForWriteLocked(ctx, lState)
	if err != nil {
		return true, err
	}

	// If the MD doesn't match the MD expected by the path, that
	// implies we are using a cached path, which implies the node has
	// been unlinked.  In that case, we can safely ignore this sync.
	if md.data.Dir.BlockPointer != file.path[0].BlockPointer {
		fbo.log.CDebugf(ctx, "Skipping sync for a removed file %v",
			file.tailPointer())
		// Removing the cached info here is a little sketchy,
		// since there's no guarantee that this sync comes
		// from closing the file, and we still want to serve
		// stat calls accurately if the user still has an open
		// handle to this file. TODO: Hook this in with the
		// node cache GC logic to be perfectly accurate.
		return true, fbo.blocks.ClearCacheInfo(lState, file)
	}

	_, uid, err := fbo.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return true, err
	}

	// notify the daemon that a write is being performed
	fbo.config.Reporter().Notify(ctx, writeNotification(file, false))
	defer fbo.config.Reporter().Notify(ctx, writeNotification(file, true))

	// Filled in by doBlockPuts below.
	var blocksToRemove []BlockPointer
	fblock, bps, lbc, syncState, err :=
		fbo.blocks.StartSync(ctx, lState, md, uid, file)
	defer func() {
		fbo.blocks.CleanupSyncState(
			ctx, lState, file, blocksToRemove, syncState, err)
	}()
	if err != nil {
		return true, err
	}

	newPath, _, newBps, err :=
		fbo.syncBlockAndCheckEmbedLocked(
			ctx, lState, md, fblock, *file.parentPath(),
			file.tailName(), File, true, true, zeroPtr, lbc)
	if err != nil {
		return true, err
	}

	bps.mergeOtherBps(newBps)

	defer func() {
		if err != nil {
			fbo.fbm.cleanUpBlockState(md, bps)
		}
	}()

	blocksToRemove, err = fbo.doBlockPuts(ctx, md, *bps)
	if err != nil {
		return true, err
	}

	err = fbo.finalizeMDWriteLocked(ctx, lState, md, bps)
	if err != nil {
		return true, err
	}

	// At this point, all reads through the old path (i.e., file)
	// see writes that happened since StartSync, whereas all reads
	// through the new path (newPath) don't.
	//
	// TODO: This isn't completely correct, since reads that
	// happen after a write should always see the new data.
	//
	// After FinishSync succeeds, then reads through both the old
	// and the new paths will see the writes that happened during
	// the sync.

	return fbo.blocks.FinishSync(ctx, lState, file, newPath, md, syncState)
}

func (fbo *folderBranchOps) Sync(ctx context.Context, file Node) (err error) {
	fbo.log.CDebugf(ctx, "Sync %p", file.GetID())
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

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

func (fbo *folderBranchOps) FolderStatus(
	ctx context.Context, folderBranch FolderBranch) (
	fbs FolderBranchStatus, updateChan <-chan StatusUpdate, err error) {
	fbo.log.CDebugf(ctx, "Status")
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

	if folderBranch != fbo.folderBranch {
		return FolderBranchStatus{}, nil,
			WrongOpsError{fbo.folderBranch, folderBranch}
	}

	// Wait for conflict resolution to settle down, if necessary.
	fbo.cr.Wait(ctx)

	return fbo.status.getStatus(ctx)
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

// notifyBatchLocked sends out a notification for the most recent op
// in md.
func (fbo *folderBranchOps) notifyBatchLocked(
	ctx context.Context, lState *lockState, md *RootMetadata) {
	fbo.headLock.AssertLocked(lState)

	lastOp := md.data.Changes.Ops[len(md.data.Changes.Ops)-1]
	fbo.notifyOneOpLocked(ctx, lState, lastOp, md)
}

// searchForNode tries to figure out the path to the given
// blockPointer, using only the block updates that happened as part of
// a given MD update operation.
func (fbo *folderBranchOps) searchForNode(ctx context.Context,
	ptr BlockPointer, md *RootMetadata) (Node, error) {
	// Record which pointers are new to this update, and thus worth
	// searching.
	newPtrs := make(map[BlockPointer]bool)
	for _, op := range md.data.Changes.Ops {
		for _, update := range op.AllUpdates() {
			newPtrs[update.Ref] = true
		}
		for _, ref := range op.Refs() {
			newPtrs[ref] = true
		}
	}

	nodeMap, err := fbo.blocks.SearchForNodes(ctx, fbo.nodeCache, []BlockPointer{ptr},
		newPtrs, md)
	if err != nil {
		return nil, err
	}

	n, ok := nodeMap[ptr]
	if !ok {
		return nil, NodeNotFoundError{ptr}
	}

	return n, nil
}

func (fbo *folderBranchOps) unlinkFromCache(op op, oldDir BlockPointer,
	node Node, name string) error {
	// The entry could be under any one of the unref'd blocks, and
	// it's safe to perform this when the pointer isn't real, so just
	// try them all to avoid the overhead of looking up the right
	// pointer in the old version of the block.
	p, err := fbo.pathFromNodeForRead(node)
	if err != nil {
		return err
	}

	childPath := p.ChildPathNoPtr(name)

	// revert the parent pointer
	childPath.path[len(childPath.path)-2].BlockPointer = oldDir
	for _, ptr := range op.Unrefs() {
		childPath.path[len(childPath.path)-1].BlockPointer = ptr
		fbo.nodeCache.Unlink(ptr.ref(), childPath)
	}

	return nil
}

func (fbo *folderBranchOps) updatePointers(op op) {
	for _, update := range op.AllUpdates() {
		oldRef := update.Unref.ref()
		fbo.nodeCache.UpdatePointer(oldRef, update.Ref)
	}
}

func (fbo *folderBranchOps) notifyOneOpLocked(ctx context.Context,
	lState *lockState, op op, md *RootMetadata) {
	fbo.headLock.AssertLocked(lState)

	fbo.updatePointers(op)

	var changes []NodeChange
	switch realOp := op.(type) {
	default:
		return
	case *createOp:
		node := fbo.nodeCache.Get(realOp.Dir.Ref.ref())
		if node == nil {
			return
		}
		fbo.log.CDebugf(ctx, "notifyOneOp: create %s in node %p",
			realOp.NewName, node.GetID())
		changes = append(changes, NodeChange{
			Node:       node,
			DirUpdated: []string{realOp.NewName},
		})
	case *rmOp:
		node := fbo.nodeCache.Get(realOp.Dir.Ref.ref())
		if node == nil {
			return
		}
		fbo.log.CDebugf(ctx, "notifyOneOp: remove %s in node %p",
			realOp.OldName, node.GetID())
		changes = append(changes, NodeChange{
			Node:       node,
			DirUpdated: []string{realOp.OldName},
		})

		// If this node exists, then the child node might exist too,
		// and we need to unlink it in the node cache.
		err := fbo.unlinkFromCache(op, realOp.Dir.Unref, node, realOp.OldName)
		if err != nil {
			fbo.log.CErrorf(ctx, "Couldn't unlink from cache: %v", err)
			return
		}
	case *renameOp:
		oldNode := fbo.nodeCache.Get(realOp.OldDir.Ref.ref())
		if oldNode != nil {
			changes = append(changes, NodeChange{
				Node:       oldNode,
				DirUpdated: []string{realOp.OldName},
			})
		}
		var newNode Node
		if realOp.NewDir.Ref != zeroPtr {
			newNode = fbo.nodeCache.Get(realOp.NewDir.Ref.ref())
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
			var newNodeID NodeID
			if newNode != nil {
				newNodeID = newNode.GetID()
			}
			fbo.log.CDebugf(ctx, "notifyOneOp: rename %v from %s/%p to %s/%p",
				realOp.Renamed, realOp.OldName, oldNode.GetID(), realOp.NewName,
				newNodeID)

			if newNode == nil {
				if childNode :=
					fbo.nodeCache.Get(realOp.Renamed.ref()); childNode != nil {
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
				// If new node exists as well, unlink any previously
				// existing entry and move the node.
				var unrefPtr BlockPointer
				if oldNode != newNode {
					unrefPtr = realOp.NewDir.Unref
				} else {
					unrefPtr = realOp.OldDir.Unref
				}
				err := fbo.unlinkFromCache(op, unrefPtr, newNode, realOp.NewName)
				if err != nil {
					fbo.log.CErrorf(ctx, "Couldn't unlink from cache: %v", err)
					return
				}
				err = fbo.nodeCache.Move(realOp.Renamed.ref(), newNode, realOp.NewName)
				if err != nil {
					fbo.log.CErrorf(ctx, "Couldn't move node in cache: %v", err)
					return
				}
			}
		}
	case *syncOp:
		node := fbo.nodeCache.Get(realOp.File.Ref.ref())
		if node == nil {
			return
		}
		fbo.log.CDebugf(ctx, "notifyOneOp: sync %d writes in node %p",
			len(realOp.Writes), node.GetID())

		changes = append(changes, NodeChange{
			Node:        node,
			FileUpdated: realOp.Writes,
		})
	case *setAttrOp:
		node := fbo.nodeCache.Get(realOp.Dir.Ref.ref())
		if node == nil {
			return
		}
		fbo.log.CDebugf(ctx, "notifyOneOp: setAttr %s for file %s in node %p",
			realOp.Attr, realOp.Name, node.GetID())

		p, err := fbo.pathFromNodeForRead(node)
		if err != nil {
			return
		}

		childNode, err := fbo.blocks.UpdateCachedEntryAttributes(
			ctx, lState, md, p, realOp)
		if err != nil {
			// TODO: Log error?
			return
		}
		if childNode == nil {
			return
		}

		changes = append(changes, NodeChange{
			Node: childNode,
		})
	case *gcOp:
		// Unreferenced blocks in a gcOp mean that we shouldn't cache
		// them anymore
		bcache := fbo.config.BlockCache()
		for _, ptr := range realOp.Unrefs() {
			if err := bcache.DeleteTransient(ptr, fbo.id()); err != nil {
				fbo.log.CDebugf(ctx,
					"Couldn't delete transient entry for %v: %v", ptr, err)
			}
		}
	}

	fbo.observers.batchChanges(ctx, changes)
}

func (fbo *folderBranchOps) getCurrMDRevisionLocked(lState *lockState) MetadataRevision {
	fbo.headLock.AssertAnyLocked(lState)

	if fbo.head != nil {
		return fbo.head.Revision
	}
	return MetadataRevisionUninitialized
}

func (fbo *folderBranchOps) getCurrMDRevision(
	lState *lockState) MetadataRevision {
	fbo.headLock.RLock(lState)
	defer fbo.headLock.RUnlock(lState)
	return fbo.getCurrMDRevisionLocked(lState)
}

type applyMDUpdatesFunc func(context.Context, *lockState, []*RootMetadata) error

func (fbo *folderBranchOps) applyMDUpdatesLocked(ctx context.Context,
	lState *lockState, rmds []*RootMetadata) error {
	fbo.mdWriterLock.AssertLocked(lState)

	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)

	if len(rmds) > 0 {
		fbo.setLatestMergedRevisionLocked(ctx, lState, rmds[len(rmds)-1].Revision)
	}

	// if we have staged changes, ignore all updates until conflict
	// resolution kicks in.  TODO: cache these for future use.
	if !fbo.isMasterBranchLocked(lState) {
		if len(rmds) > 0 {
			unmergedRev := MetadataRevisionUninitialized
			if fbo.head != nil {
				unmergedRev = fbo.head.Revision
			}
			fbo.cr.Resolve(unmergedRev, rmds[len(rmds)-1].Revision)
		}
		return UnmergedError{}
	}

	// Don't allow updates while we're in the dirty state; the next
	// sync will put us into an unmerged state anyway and we'll
	// require conflict resolution.
	if fbo.blocks.GetState(lState) != cleanState {
		return errors.New("Ignoring MD updates while writes are dirty")
	}

	for _, rmd := range rmds {
		// check that we're applying the expected MD revision
		if rmd.Revision <= fbo.getCurrMDRevisionLocked(lState) {
			// Already caught up!
			continue
		}
		if err := rmd.isReadableOrError(ctx, fbo.config); err != nil {
			return err
		}

		err := fbo.setHeadSuccessorLocked(ctx, lState, rmd)
		if err != nil {
			return err
		}
		// No new operations in these.
		if rmd.IsWriterMetadataCopiedSet() {
			continue
		}
		for _, op := range rmd.data.Changes.Ops {
			fbo.notifyOneOpLocked(ctx, lState, op, rmd)
		}
	}
	return nil
}

func (fbo *folderBranchOps) undoMDUpdatesLocked(ctx context.Context,
	lState *lockState, rmds []*RootMetadata) error {
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
		if rmd.Revision != fbo.getCurrMDRevisionLocked(lState) &&
			rmd.Revision != fbo.getCurrMDRevisionLocked(lState)-1 {
			return MDUpdateInvertError{rmd.Revision,
				fbo.getCurrMDRevisionLocked(lState)}
		}

		// TODO: Check that the revisions are equal only for
		// the first iteration.
		if rmd.Revision < fbo.getCurrMDRevisionLocked(lState) {
			err := fbo.setHeadPredecessorLocked(ctx, lState, rmd)
			if err != nil {
				return err
			}
		}

		// iterate the ops in reverse and invert each one
		ops := rmd.data.Changes.Ops
		for j := len(ops) - 1; j >= 0; j-- {
			fbo.notifyOneOpLocked(ctx, lState, invertOpForLocalNotifications(ops[j]), rmd)
		}
	}
	return nil
}

func (fbo *folderBranchOps) applyMDUpdates(ctx context.Context,
	lState *lockState, rmds []*RootMetadata) error {
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
func (fbo *folderBranchOps) setLatestMergedRevisionLocked(ctx context.Context, lState *lockState, rev MetadataRevision) {
	fbo.headLock.AssertLocked(lState)

	fbo.latestMergedRevision = rev
	fbo.log.CDebugf(ctx, "Updated latestMergedRevision to %d.", rev)
}

// Assumes all necessary locking is either already done by caller, or
// is done by applyFunc.
func (fbo *folderBranchOps) getAndApplyMDUpdates(ctx context.Context,
	lState *lockState, applyFunc applyMDUpdatesFunc) error {
	// first look up all MD revisions newer than my current head
	start := fbo.getCurrMDRevision(lState) + 1
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

// getUnmergedMDUpdates returns a slice of the unmerged MDs for this
// TLF's current unmerged branch and unmerged branch, between the
// merge point for the branch and the current head.  The returned MDs
// are the same instances that are stored in the MD cache, so they
// should be modified with care.
func (fbo *folderBranchOps) getUnmergedMDUpdates(
	ctx context.Context, lState *lockState) (
	MetadataRevision, []*RootMetadata, error) {
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
	MetadataRevision, []*RootMetadata, error) {
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

	rmds, err := getMDRange(ctx, fbo.config, fbo.id(), NullBranchID,
		currHead, currHead, Merged)
	if err != nil {
		return nil, err
	}
	if len(rmds) == 0 {
		return nil, fmt.Errorf("Couldn't find the branch point %d", currHead)
	}
	err = func() error {
		fbo.headLock.Lock(lState)
		defer fbo.headLock.Unlock(lState)
		return fbo.setHeadPredecessorLocked(ctx, lState, rmds[0])
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
			for _, update := range op.AllUpdates() {
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
		err = fbo.config.MDServer().PruneBranch(ctx, fbo.id(), bid)
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
	return fbo.finalizeMDWriteLocked(ctx, lState, md, &blockPutState{})
}

// TODO: remove once we have automatic conflict resolution
func (fbo *folderBranchOps) UnstageForTesting(
	ctx context.Context, folderBranch FolderBranch) (err error) {
	fbo.log.CDebugf(ctx, "UnstageForTesting")
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

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
		ctxWithTags := fbo.ctxWithFBOID(context.Background())
		freshCtx, cancel := context.WithCancel(ctxWithTags)
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
	lState *lockState, promptPaper bool) (err error) {
	fbo.mdWriterLock.AssertLocked(lState)

	if !fbo.isMasterBranchLocked(lState) {
		return errors.New("Can't rekey while staged.")
	}

	head := fbo.getHead(lState)
	if head != nil {
		// If we already have a cached revision, make sure we're
		// up-to-date with the latest revision before inspecting the
		// metadata, since Rekey doesn't let us go into CR mode, and
		// we don't actually get folder update notifications when the
		// rekey bit is set, just a "folder needs rekey" update.
		if err := fbo.getAndApplyMDUpdates(
			ctx, lState, fbo.applyMDUpdatesLocked); err != nil {
			if applyErr, ok := err.(MDRevisionMismatch); !ok ||
				applyErr.rev != applyErr.curr {
				return err
			}
		}
	}

	md, rekeyWasSet, err := fbo.getMDForRekeyWriteLocked(ctx, lState)
	if err != nil {
		return err
	}

	if fbo.rekeyWithPromptTimer != nil {
		if !promptPaper {
			fbo.log.CDebugf(ctx, "rekeyWithPrompt superseded before it fires.")
		} else if !md.IsRekeySet() {
			fbo.rekeyWithPromptTimer.Stop()
			fbo.rekeyWithPromptTimer = nil
			// If the rekey bit isn't set, then some other device
			// already took care of our request, and we can stop
			// early.  Note that if this FBO never registered for
			// updates, then we might not yet have seen the update, in
			// which case we'll still try to rekey but it will fail as
			// a conflict.
			fbo.log.CDebugf(ctx, "rekeyWithPrompt not needed because the "+
				"rekey bit was already unset.")
			return nil
		}
	}

	rekeyDone, tlfCryptKey, err := fbo.config.KeyManager().
		Rekey(ctx, md, promptPaper)

	stillNeedsRekey := false
	switch err.(type) {
	case nil:
		// TODO: implement a "forced" option that rekeys even when the
		// devices haven't changed?
		if !rekeyDone {
			fbo.log.CDebugf(ctx, "No rekey necessary")
			return nil
		}
		// Clear the rekey bit if any.
		md.Flags &= ^MetadataFlagRekey
		md.clearLastRevision()

	case RekeyIncompleteError:
		if !rekeyDone && rekeyWasSet {
			// The rekey bit was already set, and there's nothing else
			// we can to do, so don't put any new revisions.
			fbo.log.CDebugf(ctx, "No further rekey possible by this user.")
			return nil
		}

		// Rekey incomplete, fallthrough without early exit, to ensure
		// we write the metadata with any potential changes
		fbo.log.CDebugf(ctx,
			"Rekeyed reader devices, but still need writer rekey")

	case NeedOtherRekeyError:
		stillNeedsRekey = true
	case NeedSelfRekeyError:
		stillNeedsRekey = true

	default:
		if err == context.DeadlineExceeded {
			fbo.log.CDebugf(ctx, "Paper key prompt timed out")
			// Reschedule the prompt in the timeout case.
			stillNeedsRekey = true
		} else {
			return err
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
		//
		// Only ever set the timer once.
		if fbo.rekeyWithPromptTimer == nil {
			d := fbo.config.RekeyWithPromptWaitTime()
			fbo.log.CDebugf(ctx, "Scheduling a rekeyWithPrompt in %s", d)
			fbo.rekeyWithPromptTimer = time.AfterFunc(d, fbo.rekeyWithPrompt)
		}

		if rekeyWasSet {
			// Devices not yet keyed shouldn't set the rekey bit again
			fbo.log.CDebugf(ctx, "Rekey bit already set")
			return nil
		}
		// This device hasn't been keyed yet, fall through to set the rekey bit
	}

	// add an empty operation to satisfy assumptions elsewhere
	md.AddOp(newRekeyOp())

	// we still let readers push a new md block that we validate against reader
	// permissions
	err = fbo.finalizeMDRekeyWriteLocked(ctx, lState, md)
	if err != nil {
		return err
	}

	// cache any new TLF crypt key
	if tlfCryptKey != nil {
		keyGen := md.LatestKeyGeneration()
		err = fbo.config.KeyCache().PutTLFCryptKey(md.ID, keyGen, *tlfCryptKey)
		if err != nil {
			return err
		}
	}

	// send rekey finish notification
	handle := md.GetTlfHandle()
	fbo.config.Reporter().Notify(ctx,
		rekeyNotification(ctx, fbo.config, handle, true))
	if !stillNeedsRekey && fbo.rekeyWithPromptTimer != nil {
		fbo.log.CDebugf(ctx, "Scheduled rekey timer no longer needed")
		fbo.rekeyWithPromptTimer.Stop()
		fbo.rekeyWithPromptTimer = nil
	}
	return nil
}

func (fbo *folderBranchOps) rekeyWithPrompt() {
	var err error
	ctx := ctxWithRandomID(context.Background(), CtxRekeyIDKey, CtxRekeyOpID,
		fbo.log)

	// Only give the user limited time to enter their paper key, so we
	// don't wait around forever.
	d := fbo.config.RekeyWithPromptWaitTime()
	ctx, cancel := context.WithTimeout(ctx, d)
	defer cancel()

	fbo.log.CDebugf(ctx, "rekeyWithPrompt")
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

	err = fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			return fbo.rekeyLocked(ctx, lState, true)
		})
}

// Rekey rekeys the given folder.
func (fbo *folderBranchOps) Rekey(ctx context.Context, tlf TlfID) (err error) {
	fbo.log.CDebugf(ctx, "Rekey")
	defer func() {
		fbo.deferLog.CDebugf(ctx, "Done: %v", err)
	}()

	fb := FolderBranch{tlf, MasterBranch}
	if fb != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, fb}
	}

	return fbo.doMDWriteWithRetryUnlessCanceled(ctx,
		func(lState *lockState) error {
			return fbo.rekeyLocked(ctx, lState, false)
		})
}

func (fbo *folderBranchOps) SyncFromServerForTesting(
	ctx context.Context, folderBranch FolderBranch) (err error) {
	fbo.log.CDebugf(ctx, "SyncFromServerForTesting")
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

	if folderBranch != fbo.folderBranch {
		return WrongOpsError{fbo.folderBranch, folderBranch}
	}

	lState := makeFBOLockState()

	if !fbo.isMasterBranch(lState) {
		if err := fbo.cr.Wait(ctx); err != nil {
			return err
		}
		// If we are still staged after the wait, then we have a problem.
		if !fbo.isMasterBranch(lState) {
			return fmt.Errorf("Conflict resolution didn't take us out of " +
				"staging.")
		}
	}

	dirtyRefs := fbo.blocks.GetDirtyRefs(lState)
	if len(dirtyRefs) > 0 {
		for _, ref := range dirtyRefs {
			fbo.log.CDebugf(ctx, "DeCache entry left: %v", ref)
		}
		return errors.New("Can't sync from server while dirty.")
	}

	if err := fbo.getAndApplyMDUpdates(ctx, lState, fbo.applyMDUpdates); err != nil {
		if applyErr, ok := err.(MDRevisionMismatch); ok {
			if applyErr.rev == applyErr.curr {
				fbo.log.CDebugf(ctx, "Already up-to-date with server")
				return nil
			}
		}
		return err
	}

	// Wait for all the asynchronous block archiving and quota
	// reclamation to hit the block server.
	if err := fbo.fbm.waitForArchives(ctx); err != nil {
		return err
	}
	return fbo.fbm.waitForQuotaReclamations(ctx)
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
	return ctxWithRandomID(ctx, CtxFBOIDKey, CtxFBOOpID, fbo.log)
}

// Run the passed function with a context that's canceled on shutdown.
func (fbo *folderBranchOps) runUnlessShutdown(fn func(ctx context.Context) error) error {
	ctx := fbo.ctxWithFBOID(context.Background())
	ctx, cancelFunc := context.WithCancel(ctx)
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

func (fbo *folderBranchOps) registerAndWaitForUpdates() {
	defer close(fbo.updateDoneChan)
	childDone := make(chan struct{})
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
				err = fbo.waitForAndProcessUpdates(newCtx, updateChan)
				if _, ok := err.(UnmergedError); ok {
					// skip the back-off timer and continue directly to next
					// registerForUpdates
					return nil
				}
				select {
				case <-ctx.Done():
					// Shortcut the retry, we're done.
					return nil
				default:
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
	currRev := fbo.getCurrMDRevision(lState)
	fbo.log.CDebugf(ctx, "Registering for updates (curr rev = %d)", currRev)
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()
	// RegisterForUpdate will itself retry on connectivity issues
	return fbo.config.MDServer().RegisterForUpdate(ctx, fbo.id(),
		fbo.getLatestMergedRevision(lState))
}

func (fbo *folderBranchOps) waitForAndProcessUpdates(
	ctx context.Context, updateChan <-chan error) (err error) {
	// successful registration; now, wait for an update or a shutdown
	fbo.log.CDebugf(ctx, "Waiting for updates")
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

	lState := makeFBOLockState()

	for {
		select {
		case err := <-updateChan:
			fbo.log.CDebugf(ctx, "Got an update: %v", err)
			if err != nil {
				return err
			}
			// Getting and applying the updates requires holding
			// locks, so make sure it doesn't take too long.
			ctx, cancel := context.WithTimeout(ctx, backgroundTaskTimeout)
			defer cancel()
			err = fbo.getAndApplyMDUpdates(ctx, lState, fbo.applyMDUpdates)
			if err != nil {
				fbo.log.CDebugf(ctx, "Got an error while applying "+
					"updates: %v", err)
				return err
			}
			return nil
		case unpause := <-fbo.updatePauseChan:
			fbo.log.CInfof(ctx, "Updates paused")
			// wait to be unpaused
			select {
			case <-unpause:
				fbo.log.CInfof(ctx, "Updates unpaused")
			case <-ctx.Done():
				return ctx.Err()
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (fbo *folderBranchOps) backgroundFlusher(betweenFlushes time.Duration) {
	ticker := time.NewTicker(betweenFlushes)
	defer ticker.Stop()
	lState := makeFBOLockState()
	for {
		doSelect := true
		if fbo.blocks.GetState(lState) == dirtyState &&
			fbo.config.DirtyBlockCache().ShouldForceSync() {
			// We have dirty files, and the system has a full buffer,
			// so don't bother waiting for a signal, just get right to
			// the main attraction.
			doSelect = false
		}

		if doSelect {
			select {
			case <-ticker.C:
			case <-fbo.forceSyncChan:
			case <-fbo.shutdownChan:
				return
			}
		}
		dirtyRefs := fbo.blocks.GetDirtyRefs(lState)
		fbo.runUnlessShutdown(func(ctx context.Context) (err error) {
			// Denote that these are coming from a background
			// goroutine, not directly from any user.
			ctx = context.WithValue(ctx, CtxBackgroundSyncKey, "1")
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
						"ref=%v, nodeID=%p, and path=%v: %v",
						ref, node.GetID(), p, err)
				}
			}
			return nil
		})
	}
}

// finalizeResolution caches all the blocks, and writes the new MD to
// the merged branch, failing if there is a conflict.  It also sends
// out the given newOps notifications locally.  This is used for
// completing conflict resolution.
func (fbo *folderBranchOps) finalizeResolution(ctx context.Context,
	lState *lockState, md *RootMetadata, bps *blockPutState,
	newOps []op) error {
	// Take the writer lock.
	fbo.mdWriterLock.Lock(lState)
	defer fbo.mdWriterLock.Unlock(lState)

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

	// Put the MD.  If there's a conflict, abort the whole process and
	// let CR restart itself.
	err = fbo.config.MDOps().Put(ctx, md)
	doUnmergedPut := fbo.isRevisionConflict(err)
	if doUnmergedPut {
		fbo.log.CDebugf(ctx, "Got a conflict after resolution; aborting CR")
		return err
	}
	if err != nil {
		return err
	}
	err = fbo.config.MDServer().PruneBranch(ctx, fbo.id(), fbo.bid)
	if err != nil {
		return err
	}

	// Queue a rekey if the bit was set.
	if md.IsRekeySet() {
		defer fbo.config.RekeyQueue().Enqueue(md.ID)
	}

	// Set the head to the new MD.
	fbo.headLock.Lock(lState)
	defer fbo.headLock.Unlock(lState)
	err = fbo.setHeadConflictResolvedLocked(ctx, lState, md)
	if err != nil {
		fbo.log.CWarningf(ctx, "Couldn't set local MD head after a "+
			"successful put: %v", err)
		return err
	}
	fbo.setBranchIDLocked(lState, NullBranchID)

	// Archive the old, unref'd blocks
	fbo.fbm.archiveUnrefBlocks(md)

	// notifyOneOp for every fixed-up merged op.
	for _, op := range newOps {
		fbo.notifyOneOpLocked(ctx, lState, op, md)
	}
	return nil
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

// GetUpdateHistory implements the KBFSOps interface for folderBranchOps
func (fbo *folderBranchOps) GetUpdateHistory(ctx context.Context,
	folderBranch FolderBranch) (history TLFUpdateHistory, err error) {
	fbo.log.CDebugf(ctx, "GetUpdateHistory")
	defer func() { fbo.deferLog.CDebugf(ctx, "Done: %v", err) }()

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
		history.ID = rmd.ID.String()
		history.Name = rmd.GetTlfHandle().GetCanonicalPath()
	}
	history.Updates = make([]UpdateSummary, 0, len(rmds))
	writerNames := make(map[keybase1.UID]string)
	for _, rmd := range rmds {
		writer, ok := writerNames[rmd.LastModifyingWriter]
		if !ok {
			name, err := fbo.config.KBPKI().
				GetNormalizedUsername(ctx, rmd.LastModifyingWriter)
			if err != nil {
				return TLFUpdateHistory{}, err
			}
			writer = string(name)
			writerNames[rmd.LastModifyingWriter] = writer
		}
		updateSummary := UpdateSummary{
			Revision:  rmd.Revision,
			Date:      time.Unix(0, rmd.data.Dir.Mtime),
			Writer:    writer,
			LiveBytes: rmd.DiskUsage,
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
			for _, update := range op.AllUpdates() {
				opSummary.Updates[update.Unref.String()] = update.Ref.String()
			}
			updateSummary.Ops = append(updateSummary.Ops, opSummary)
		}
		history.Updates = append(history.Updates, updateSummary)
	}
	return history, nil
}

// PushConnectionStatusChange pushes human readable connection status changes.
func (fbo *folderBranchOps) PushConnectionStatusChange(service string, newStatus error) {
	fbo.config.KBFSOps().PushConnectionStatusChange(service, newStatus)
}
