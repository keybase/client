// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsedits"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/kbfssync"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

const (
	quotaUsageStaleTolerance = 10 * time.Second
)

// KBFSOpsStandard implements the KBFSOps interface, and is go-routine
// safe by forwarding requests to individual per-folder-branch
// handlers that are go-routine-safe.
type KBFSOpsStandard struct {
	appStateUpdater env.AppStateUpdater
	config          Config
	log             logger.Logger
	deferLog        logger.Logger
	ops             map[FolderBranch]*folderBranchOps
	opsByFav        map[Favorite]*folderBranchOps
	opsLock         sync.RWMutex
	// reIdentifyControlChan controls reidentification.
	// Sending a value to this channel forces all fbos
	// to be marked for revalidation.
	// Closing this channel will shutdown the reidentification
	// watcher.
	reIdentifyControlChan chan chan<- struct{}

	favs *Favorites

	editActivity kbfssync.RepeatedWaitGroup
	editLock     sync.Mutex
	editShutdown bool

	currentStatus            *kbfsCurrentStatus
	quotaUsage               *EventuallyConsistentQuotaUsage
	longOperationDebugDumper *ImpatientDebugDumper
}

var _ KBFSOps = (*KBFSOpsStandard)(nil)

const longOperationDebugDumpDuration = time.Minute

// NewKBFSOpsStandard constructs a new KBFSOpsStandard object.
func NewKBFSOpsStandard(appStateUpdater env.AppStateUpdater, config Config) *KBFSOpsStandard {
	log := config.MakeLogger("")
	kops := &KBFSOpsStandard{
		appStateUpdater:       appStateUpdater,
		config:                config,
		log:                   log,
		deferLog:              log.CloneWithAddedDepth(1),
		ops:                   make(map[FolderBranch]*folderBranchOps),
		opsByFav:              make(map[Favorite]*folderBranchOps),
		reIdentifyControlChan: make(chan chan<- struct{}),
		favs:       NewFavorites(config),
		quotaUsage: NewEventuallyConsistentQuotaUsage(config, "KBFSOps"),
		longOperationDebugDumper: NewImpatientDebugDumper(
			config, longOperationDebugDumpDuration),
		currentStatus: &kbfsCurrentStatus{},
	}
	kops.currentStatus.Init()
	go kops.markForReIdentifyIfNeededLoop()
	return kops
}

func (fs *KBFSOpsStandard) markForReIdentifyIfNeededLoop() {
	maxValid := fs.config.TLFValidDuration()
	// Tests and some users fail to set this properly.
	if maxValid <= 10*time.Second || maxValid > 24*365*time.Hour {
		maxValid = tlfValidDurationDefault
	}
	// Tick ten times the rate of valid duration allowing only overflows of +-10%
	ticker := time.NewTicker(maxValid / 10)
	for {
		var now time.Time
		var returnCh chan<- struct{}
		var ok bool
		select {
		// Normal case: feed the current time from config and mark fbos needing
		// validation.
		case <-ticker.C:
			now = fs.config.Clock().Now()
		// Mark everything for reidentification via now being the empty value or
		// quit.
		case returnCh, ok = <-fs.reIdentifyControlChan:
			if !ok {
				ticker.Stop()
				return
			}
		}
		fs.markForReIdentifyIfNeeded(now, maxValid)
		if returnCh != nil {
			returnCh <- struct{}{}
		}
	}
}

func (fs *KBFSOpsStandard) markForReIdentifyIfNeeded(
	now time.Time, maxValid time.Duration) {
	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()

	for _, fbo := range fs.ops {
		fbo.markForReIdentifyIfNeeded(now, maxValid)
	}
}

func (fs *KBFSOpsStandard) shutdownEdits(ctx context.Context) error {
	fs.editLock.Lock()
	fs.editShutdown = true
	fs.editLock.Unlock()

	err := fs.editActivity.Wait(ctx)
	if err != nil {
		return err
	}
	return nil
}

// Shutdown safely shuts down any background goroutines that may have
// been launched by KBFSOpsStandard.
func (fs *KBFSOpsStandard) Shutdown(ctx context.Context) error {
	defer fs.longOperationDebugDumper.Shutdown() // shut it down last
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	err := fs.shutdownEdits(ctx)
	if err != nil {
		return err
	}

	close(fs.reIdentifyControlChan)
	var errors []error
	if err := fs.favs.Shutdown(); err != nil {
		errors = append(errors, err)
	}
	for _, ops := range fs.ops {
		if err := ops.Shutdown(ctx); err != nil {
			errors = append(errors, err)
			// Continue on and try to shut down the other FBOs.
		}
	}
	if len(errors) == 1 {
		return errors[0]
	} else if len(errors) > 1 {
		// Aggregate errors
		return fmt.Errorf("Multiple errors on shutdown: %v", errors)
	}
	return nil
}

// PushConnectionStatusChange pushes human readable connection status changes.
func (fs *KBFSOpsStandard) PushConnectionStatusChange(
	service string, newStatus error) {
	fs.currentStatus.PushConnectionStatusChange(service, newStatus)

	if fs.config.KeybaseService() == nil {
		return
	}

	switch service {
	case KeybaseServiceName, GregorServiceName:
	default:
		return
	}

	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()

	for _, fbo := range fs.ops {
		fbo.PushConnectionStatusChange(service, newStatus)
	}

	if newStatus == nil {
		fs.log.CDebugf(nil, "Asking for an edit re-init after reconnection")
		fs.editActivity.Add(1)
		go fs.initTlfsForEditHistories()
	}
}

// PushStatusChange forces a new status be fetched by status listeners.
func (fs *KBFSOpsStandard) PushStatusChange() {
	fs.currentStatus.PushStatusChange()

	fs.log.CDebugf(nil, "Asking for an edit re-init after status change")
	fs.editActivity.Add(1)
	go fs.initTlfsForEditHistories()
}

// ClearPrivateFolderMD implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) ClearPrivateFolderMD(ctx context.Context) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()

	// Block until all private folders have been reset.  TODO:
	// parallelize these, as they can block for a while waiting for
	// the lock.
	for _, fbo := range fs.ops {
		// This call is a no-op for public folders.
		fbo.ClearPrivateFolderMD(ctx)
	}
}

// ForceFastForward implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) ForceFastForward(ctx context.Context) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()

	fs.log.CDebugf(ctx, "Forcing fast-forwards for %d folders", len(fs.ops))
	for _, fbo := range fs.ops {
		fbo.ForceFastForward(ctx)
	}
}

// InvalidateNodeAndChildren implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) InvalidateNodeAndChildren(
	ctx context.Context, node Node) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, node)
	return ops.InvalidateNodeAndChildren(ctx, node)
}

// GetFavorites implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) GetFavorites(ctx context.Context) (
	[]Favorite, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	return fs.favs.Get(ctx)
}

// RefreshCachedFavorites implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) RefreshCachedFavorites(ctx context.Context) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	fs.favs.RefreshCache(ctx)
}

// AddFavorite implements the KBFSOps interface for KBFSOpsStandard.
func (fs *KBFSOpsStandard) AddFavorite(ctx context.Context,
	fav Favorite) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	kbpki := fs.config.KBPKI()
	_, err := kbpki.GetCurrentSession(ctx)
	isLoggedIn := err == nil

	if isLoggedIn {
		err := fs.favs.Add(ctx, favToAdd{Favorite: fav, created: false})
		if err != nil {
			return err
		}
	}

	return nil
}

func (fs *KBFSOpsStandard) getOpsByFav(fav Favorite) *folderBranchOps {
	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()
	return fs.opsByFav[fav]
}

// DeleteFavorite implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) DeleteFavorite(ctx context.Context,
	fav Favorite) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	kbpki := fs.config.KBPKI()
	_, err := kbpki.GetCurrentSession(ctx)
	isLoggedIn := err == nil

	// Let this ops remove itself, if we have one available.
	ops := fs.getOpsByFav(fav)
	if ops != nil {
		err := ops.doFavoritesOp(ctx, fs.favs, FavoritesOpRemove, nil)
		if _, ok := err.(OpsCantHandleFavorite); !ok {
			return err
		}
		// If the ops couldn't handle the delete, fall through to
		// going directly via Favorites.
	}

	if isLoggedIn {
		err := fs.favs.Delete(ctx, fav)
		if err != nil {
			return err
		}
	}

	// TODO: Shut down the running folderBranchOps, if one exists?
	// What about open file handles?

	return nil
}

func (fs *KBFSOpsStandard) getOpsNoAdd(
	ctx context.Context, fb FolderBranch) *folderBranchOps {
	if fb == (FolderBranch{}) {
		panic("zero FolderBranch in getOps")
	}

	fs.opsLock.RLock()
	if ops, ok := fs.ops[fb]; ok {
		fs.opsLock.RUnlock()
		return ops
	}

	fs.opsLock.RUnlock()
	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()
	// look it up again in case someone else got the lock
	ops, ok := fs.ops[fb]
	if !ok {
		bType := standard
		if _, isRevBranch := fb.Branch.RevisionIfSpecified(); isRevBranch {
			bType = archive
		}
		var quotaUsage *EventuallyConsistentQuotaUsage
		if fb.Tlf.Type() != tlf.SingleTeam {
			// If this is a non-team TLF, pass in a shared quota usage
			// object, since the status of each non-team TLF will show
			// the same quota usage. TODO: for team TLFs, we should
			// also pass in a shared instance (see
			// `ConfigLocal.quotaUsage`).
			quotaUsage = fs.quotaUsage
		}
		ops = newFolderBranchOps(
			ctx, fs.appStateUpdater, fs.config, fb, bType, quotaUsage,
			fs.currentStatus)
		fs.ops[fb] = ops
	}
	return ops
}

func (fs *KBFSOpsStandard) getOpsIfExists(
	ctx context.Context, fb FolderBranch) *folderBranchOps {
	if fb == (FolderBranch{}) {
		panic("zero FolderBranch in getOps")
	}

	fs.opsLock.RLock()
	defer fs.opsLock.RUnlock()
	return fs.ops[fb]
}

func (fs *KBFSOpsStandard) getOps(ctx context.Context,
	fb FolderBranch, fop FavoritesOp) *folderBranchOps {
	ops := fs.getOpsNoAdd(ctx, fb)
	if err := ops.doFavoritesOp(ctx, fs.favs, fop, nil); err != nil {
		// Failure to favorite shouldn't cause a failure.  Just log
		// and move on.
		fs.log.CDebugf(ctx, "Couldn't add favorite: %v", err)
	}
	return ops
}

func (fs *KBFSOpsStandard) getOpsByNode(ctx context.Context,
	node Node) *folderBranchOps {
	return fs.getOps(ctx, node.GetFolderBranch(), FavoritesOpAdd)
}

func (fs *KBFSOpsStandard) getOpsByHandle(ctx context.Context,
	handle *TlfHandle, fb FolderBranch, fop FavoritesOp) *folderBranchOps {
	ops := fs.getOpsNoAdd(ctx, fb)
	if err := ops.doFavoritesOp(ctx, fs.favs, fop, handle); err != nil {
		// Failure to favorite shouldn't cause a failure.  Just log
		// and move on.
		fs.log.CDebugf(ctx, "Couldn't add favorite: %v", err)
	}

	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()
	fav := handle.ToFavorite()
	_, ok := fs.opsByFav[fav]
	if ok {
		// Already added.
		return ops
	}

	// Track under its name, so we can later tell it to remove itself
	// from the favorites list.
	fs.opsByFav[fav] = ops
	ops.RegisterForChanges(&kbfsOpsFavoriteObserver{
		kbfsOps: fs,
		currFav: fav,
	})
	return ops
}

func (fs *KBFSOpsStandard) resetTlfID(ctx context.Context, h *TlfHandle) error {
	if !h.IsBackedByTeam() {
		return errors.New("Can't create TLF ID for non-team-backed handle")
	}

	teamID, err := h.FirstResolvedWriter().AsTeam()
	if err != nil {
		return err
	}

	matches, epoch, err := h.tlfID.GetEpochFromTeamTLF(teamID)
	if err != nil {
		return err
	}
	if matches {
		epoch++
	} else {
		epoch = 0
	}

	// When creating a new TLF for an implicit team, always start with
	// epoch 0.  A different path will handle TLF resets with an
	// increased epoch, if necessary.
	tlfID, err := tlf.MakeIDFromTeam(h.Type(), teamID, epoch)
	if err != nil {
		return err
	}

	fs.log.CDebugf(ctx, "Creating new TLF ID %s for team %s, %s",
		tlfID, teamID, h.GetCanonicalName())

	err = fs.config.KBPKI().CreateTeamTLF(ctx, teamID, tlfID)
	if err != nil {
		return err
	}

	h.tlfID = tlfID
	return fs.config.MDCache().PutIDForHandle(h, tlfID)
}

// createAndStoreTlfIDIfNeeded creates a TLF ID for a team-backed
// handle that doesn't have one yet, and associates it in the service
// with the team.  If it returns a `nil` error, it may have modified
// `h` to include the new TLF ID.
func (fs *KBFSOpsStandard) createAndStoreTlfIDIfNeeded(
	ctx context.Context, h *TlfHandle) error {
	if h.tlfID != tlf.NullID {
		return nil
	}

	return fs.resetTlfID(ctx, h)
}

func (fs *KBFSOpsStandard) getOrInitializeNewMDMaster(ctx context.Context,
	mdops MDOps, h *TlfHandle, fb FolderBranch, create bool, fop FavoritesOp) (
	initialized bool, md ImmutableRootMetadata, id tlf.ID, err error) {
	defer func() {
		if getExtendedIdentify(ctx).behavior.AlwaysRunIdentify() &&
			!initialized && err == nil {
			kbpki := fs.config.KBPKI()
			// We are not running identify for existing TLFs in
			// KBFS. This makes sure if requested, identify runs even
			// for existing TLFs.
			err = identifyHandle(ctx, kbpki, kbpki, h)
		}
	}()

	err = fs.createAndStoreTlfIDIfNeeded(ctx, h)
	if err != nil {
		return false, ImmutableRootMetadata{}, tlf.NullID, err
	}

	if rev, isRevBranch := fb.Branch.RevisionIfSpecified(); isRevBranch {
		fs.log.CDebugf(ctx, "Getting archived revision %d for branch %s",
			rev, fb.Branch)

		// Make sure that rev hasn't been garbage-collected yet.
		rmd, err := fs.getMDByHandle(ctx, h, FavoritesOpNoChange)
		if err != nil {
			return false, ImmutableRootMetadata{}, tlf.NullID, err
		}
		if rmd != (ImmutableRootMetadata{}) && rmd.IsReadable() {
			if rev <= rmd.data.LastGCRevision {
				return false, ImmutableRootMetadata{}, tlf.NullID,
					RevGarbageCollectedError{rev, rmd.data.LastGCRevision}
			}
		}

		md, err = getSingleMD(
			ctx, fs.config, h.tlfID, kbfsmd.NullBranchID, rev,
			kbfsmd.Merged, nil)
		// This will error if there's no corresponding MD, which is
		// what we want since that means the user input an incorrect
		// MD revision.
		if err != nil {
			return false, ImmutableRootMetadata{}, tlf.NullID, err
		}
		return false, md, h.tlfID, nil
	}

	md, err = mdops.GetForTLF(ctx, h.tlfID, nil)
	if err != nil {
		return false, ImmutableRootMetadata{}, tlf.NullID, err
	}
	if md != (ImmutableRootMetadata{}) {
		return false, md, h.tlfID, nil
	}

	if !create {
		return false, ImmutableRootMetadata{}, h.tlfID, nil
	}

	// Init new MD.
	fops := fs.getOpsByHandle(ctx, h, fb, fop)
	err = fops.SetInitialHeadToNew(ctx, h.tlfID, h)
	// Someone else initialized the TLF out from under us, so we
	// didn't initialize it.
	_, alreadyExisted := errors.Cause(err).(RekeyConflictError)
	if err != nil && !alreadyExisted {
		return false, ImmutableRootMetadata{}, tlf.NullID, err
	}

	md, err = mdops.GetForTLF(ctx, h.tlfID, nil)
	if err != nil {
		return false, ImmutableRootMetadata{}, tlf.NullID, err
	}

	return !alreadyExisted, md, h.tlfID, err

}

func (fs *KBFSOpsStandard) getMDByHandle(ctx context.Context,
	tlfHandle *TlfHandle, fop FavoritesOp) (rmd ImmutableRootMetadata, err error) {
	fbo := fs.getOpsByFav(tlfHandle.ToFavorite())
	if fbo != nil {
		lState := makeFBOLockState()
		rmd, err = fbo.getMDForReadNeedIdentifyOnMaybeFirstAccess(ctx, lState)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
	}
	if rmd != (ImmutableRootMetadata{}) {
		return rmd, nil
	}

	err = fs.createAndStoreTlfIDIfNeeded(ctx, tlfHandle)
	if err != nil {
		return ImmutableRootMetadata{}, err
	}

	// Check for an unmerged MD first if necessary.
	if fs.config.Mode().UnmergedTLFsEnabled() {
		rmd, err = fs.config.MDOps().GetUnmergedForTLF(
			ctx, tlfHandle.tlfID, kbfsmd.NullBranchID)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
	}

	fb := FolderBranch{Tlf: tlfHandle.tlfID, Branch: MasterBranch}
	if rmd == (ImmutableRootMetadata{}) {
		if fop == FavoritesOpAdd {
			_, rmd, _, err = fs.getOrInitializeNewMDMaster(
				ctx, fs.config.MDOps(), tlfHandle, fb, true,
				FavoritesOpAddNewlyCreated)
		} else {
			_, rmd, _, err = fs.getOrInitializeNewMDMaster(
				ctx, fs.config.MDOps(), tlfHandle, fb, true, fop)
		}
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
	}

	// Make sure fbo exists and head is set so that next time we use this we
	// don't need to hit server even when there isn't any FS activity.
	if fbo == nil {
		fbo = fs.getOpsByHandle(ctx, tlfHandle, fb, fop)
	}
	if err = fbo.SetInitialHeadFromServer(ctx, rmd); err != nil {
		return ImmutableRootMetadata{}, err
	}

	return rmd, nil
}

// GetTLFCryptKeys implements the KBFSOps interface for
// KBFSOpsStandard
func (fs *KBFSOpsStandard) GetTLFCryptKeys(
	ctx context.Context, tlfHandle *TlfHandle) (
	keys []kbfscrypto.TLFCryptKey, id tlf.ID, err error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	fs.log.CDebugf(ctx, "GetTLFCryptKeys(%s)", tlfHandle.GetCanonicalPath())
	defer func() { fs.deferLog.CDebugf(ctx, "Done: %+v", err) }()

	rmd, err := fs.getMDByHandle(ctx, tlfHandle, FavoritesOpNoChange)
	if err != nil {
		return nil, tlf.ID{}, err
	}
	keys, err = fs.config.KeyManager().GetTLFCryptKeyOfAllGenerations(ctx, rmd)
	return keys, rmd.TlfID(), err
}

// GetTLFID implements the KBFSOps interface for KBFSOpsStandard.
func (fs *KBFSOpsStandard) GetTLFID(ctx context.Context,
	tlfHandle *TlfHandle) (id tlf.ID, err error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	fs.log.CDebugf(ctx, "GetTLFID(%s)", tlfHandle.GetCanonicalPath())
	defer func() { fs.deferLog.CDebugf(ctx, "Done: %+v", err) }()

	rmd, err := fs.getMDByHandle(ctx, tlfHandle, FavoritesOpNoChange)
	if err != nil {
		return tlf.ID{}, err
	}
	return rmd.TlfID(), err
}

// GetTLFHandle implements the KBFSOps interface for KBFSOpsStandard.
func (fs *KBFSOpsStandard) GetTLFHandle(ctx context.Context, node Node) (
	*TlfHandle, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, node)
	return ops.GetTLFHandle(ctx, node)
}

// getMaybeCreateRootNode is called for GetOrCreateRootNode and GetRootNode.
func (fs *KBFSOpsStandard) getMaybeCreateRootNode(
	ctx context.Context, h *TlfHandle, branch BranchName, create bool) (
	node Node, ei EntryInfo, err error) {
	fs.log.CDebugf(ctx, "getMaybeCreateRootNode(%s, %v, %v)",
		h.GetCanonicalPath(), branch, create)
	defer func() { fs.deferLog.CDebugf(ctx, "Done: %#v", err) }()

	if branch != MasterBranch && create {
		return nil, EntryInfo{}, errors.Errorf(
			"Can't create a root node for branch %s", branch)
	}

	err = fs.createAndStoreTlfIDIfNeeded(ctx, h)
	if err != nil {
		return nil, EntryInfo{}, err
	}

	// Check if we already have the MD cached, before contacting any
	// servers.
	if h.tlfID == tlf.NullID {
		return nil, EntryInfo{},
			errors.Errorf("Handle for %s doesn't have a TLF ID set",
				h.GetCanonicalPath())
	}
	fb := FolderBranch{Tlf: h.tlfID, Branch: branch}
	fops := fs.getOpsIfExists(ctx, fb)
	if fops != nil {
		// If a folderBranchOps has already been initialized for this TLF,
		// use it to get the root node.  But if we haven't done an
		// identify yet, we better do so, because `getRootNode()` doesn't
		// do one.
		lState := makeFBOLockState()
		md, err := fops.getMDForReadNeedIdentifyOnMaybeFirstAccess(ctx, lState)
		if err != nil {
			return nil, EntryInfo{}, err
		}
		if md != (ImmutableRootMetadata{}) && md.IsReadable() {
			node, ei, _, err := fops.getRootNode(ctx)
			if err != nil {
				return nil, EntryInfo{}, err
			}
			if node != nil {
				return node, ei, nil
			}
		}
	}

	mdops := fs.config.MDOps()
	var md ImmutableRootMetadata
	// Check for an unmerged MD first if necessary.
	if fs.config.Mode().UnmergedTLFsEnabled() {
		md, err = mdops.GetUnmergedForTLF(ctx, h.tlfID, kbfsmd.NullBranchID)
		if err != nil {
			return nil, EntryInfo{}, err
		}
	}

	if md == (ImmutableRootMetadata{}) {
		var id tlf.ID
		var initialized bool
		initialized, md, id, err = fs.getOrInitializeNewMDMaster(
			ctx, mdops, h, fb, create, FavoritesOpAdd)
		if err != nil {
			return nil, EntryInfo{}, err
		}
		if initialized {
			fb := FolderBranch{Tlf: id, Branch: MasterBranch}
			fops := fs.getOpsByHandle(ctx, h, fb, FavoritesOpAddNewlyCreated)

			node, ei, _, err = fops.getRootNode(ctx)
			if err != nil {
				return nil, EntryInfo{}, err
			}

			return node, ei, nil
		}
		if !create && md == (ImmutableRootMetadata{}) {
			kbpki := fs.config.KBPKI()
			err := identifyHandle(ctx, kbpki, kbpki, h)
			if err != nil {
				return nil, EntryInfo{}, err
			}
			fb := FolderBranch{Tlf: id, Branch: MasterBranch}
			fs.getOpsByHandle(ctx, h, fb, FavoritesOpAdd)
			return nil, EntryInfo{}, nil
		}
	}

	// we might not be able to read the metadata if we aren't in the
	// key group yet.
	if err := isReadableOrError(ctx, fs.config.KBPKI(), md.ReadOnly()); err != nil {
		fs.opsLock.Lock()
		defer fs.opsLock.Unlock()
		// If we already have an FBO for this ID, trigger a rekey
		// prompt in the background, if possible.
		if ops, ok := fs.ops[fb]; ok {
			fs.log.CDebugf(ctx, "Triggering a paper prompt rekey on folder "+
				"access due to unreadable MD for %s", h.GetCanonicalPath())
			ops.rekeyFSM.Event(NewRekeyRequestWithPaperPromptEvent())
		}
		return nil, EntryInfo{}, err
	}

	ops := fs.getOpsByHandle(ctx, h, fb, FavoritesOpAdd)

	err = ops.SetInitialHeadFromServer(ctx, md)
	if err != nil {
		return nil, EntryInfo{}, err
	}

	node, ei, _, err = ops.getRootNode(ctx)
	if err != nil {
		return nil, EntryInfo{}, err
	}

	if err := ops.doFavoritesOp(ctx, fs.favs, FavoritesOpAdd, h); err != nil {
		// Failure to favorite shouldn't cause a failure.  Just log
		// and move on.
		fs.log.CDebugf(ctx, "Couldn't add favorite: %v", err)
	}
	return node, ei, nil
}

// GetOrCreateRootNode implements the KBFSOps interface for
// KBFSOpsStandard
func (fs *KBFSOpsStandard) GetOrCreateRootNode(
	ctx context.Context, h *TlfHandle, branch BranchName) (
	node Node, ei EntryInfo, err error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	return fs.getMaybeCreateRootNode(ctx, h, branch, true)
}

// GetRootNode implements the KBFSOps interface for
// KBFSOpsStandard. Returns a nil Node and nil error
// if the tlf does not exist but there is no error present.
func (fs *KBFSOpsStandard) GetRootNode(
	ctx context.Context, h *TlfHandle, branch BranchName) (
	node Node, ei EntryInfo, err error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	return fs.getMaybeCreateRootNode(ctx, h, branch, false)
}

// GetDirChildren implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetDirChildren(ctx context.Context, dir Node) (
	map[string]EntryInfo, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, dir)
	return ops.GetDirChildren(ctx, dir)
}

// Lookup implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Lookup(ctx context.Context, dir Node, name string) (
	Node, EntryInfo, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, dir)
	return ops.Lookup(ctx, dir, name)
}

// Stat implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Stat(ctx context.Context, node Node) (
	EntryInfo, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, node)
	return ops.Stat(ctx, node)
}

// CreateDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateDir(
	ctx context.Context, dir Node, name string) (Node, EntryInfo, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, dir)
	return ops.CreateDir(ctx, dir, name)
}

// CreateFile implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateFile(
	ctx context.Context, dir Node, name string, isExec bool, excl Excl) (
	Node, EntryInfo, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, dir)
	return ops.CreateFile(ctx, dir, name, isExec, excl)
}

// CreateLink implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateLink(
	ctx context.Context, dir Node, fromName string, toPath string) (
	EntryInfo, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, dir)
	return ops.CreateLink(ctx, dir, fromName, toPath)
}

// RemoveDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RemoveDir(
	ctx context.Context, dir Node, name string) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, dir)
	return ops.RemoveDir(ctx, dir, name)
}

// RemoveEntry implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RemoveEntry(
	ctx context.Context, dir Node, name string) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, dir)
	return ops.RemoveEntry(ctx, dir, name)
}

// Rename implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Rename(
	ctx context.Context, oldParent Node, oldName string, newParent Node,
	newName string) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	oldFB := oldParent.GetFolderBranch()
	newFB := newParent.GetFolderBranch()

	// only works for nodes within the same topdir
	if oldFB != newFB {
		return RenameAcrossDirsError{}
	}

	ops := fs.getOpsByNode(ctx, oldParent)
	return ops.Rename(ctx, oldParent, oldName, newParent, newName)
}

// Read implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Read(
	ctx context.Context, file Node, dest []byte, off int64) (
	numRead int64, err error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, file)
	return ops.Read(ctx, file, dest, off)
}

// Write implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Write(
	ctx context.Context, file Node, data []byte, off int64) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, file)
	return ops.Write(ctx, file, data, off)
}

// Truncate implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Truncate(
	ctx context.Context, file Node, size uint64) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, file)
	return ops.Truncate(ctx, file, size)
}

// SetEx implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SetEx(
	ctx context.Context, file Node, ex bool) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, file)
	return ops.SetEx(ctx, file, ex)
}

// SetMtime implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SetMtime(
	ctx context.Context, file Node, mtime *time.Time) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, file)
	return ops.SetMtime(ctx, file, mtime)
}

// SyncAll implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SyncAll(
	ctx context.Context, folderBranch FolderBranch) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOps(ctx, folderBranch, FavoritesOpAdd)
	return ops.SyncAll(ctx, folderBranch)
}

// FolderStatus implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) FolderStatus(
	ctx context.Context, folderBranch FolderBranch) (
	FolderBranchStatus, <-chan StatusUpdate, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOps(ctx, folderBranch, FavoritesOpNoChange)
	return ops.FolderStatus(ctx, folderBranch)
}

// Status implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Status(ctx context.Context) (
	KBFSStatus, <-chan StatusUpdate, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	session, err := fs.config.KBPKI().GetCurrentSession(ctx)
	var usageBytes, archiveBytes, limitBytes int64 = -1, -1, -1
	var gitUsageBytes, gitArchiveBytes, gitLimitBytes int64 = -1, -1, -1
	// Don't request the quota info until we're sure we've
	// authenticated with our password.  TODO: fix this in the
	// service/GUI by handling multiple simultaneous passphrase
	// requests at once.
	if err == nil && fs.config.MDServer().IsConnected() {
		var quErr error
		_, usageBytes, archiveBytes, limitBytes,
			gitUsageBytes, gitArchiveBytes, gitLimitBytes, quErr =
			fs.quotaUsage.GetAllTypes(
				ctx, quotaUsageStaleTolerance/2, quotaUsageStaleTolerance)
		if quErr != nil {
			// The error is ignored here so that other fields can still be populated
			// even if this fails.
			fs.log.CDebugf(ctx, "Getting quota usage error: %v", quErr)
		}
	}
	failures, ch := fs.currentStatus.CurrentStatus()
	var jServerStatus *JournalServerStatus
	jServer, jErr := GetJournalServer(fs.config)
	if jErr == nil {
		status, tlfIDs := jServer.Status(ctx)
		jServerStatus = &status
		err := FillInJournalStatusUnflushedPaths(
			ctx, fs.config, jServerStatus, tlfIDs)
		if err != nil {
			// The caller might depend on the channel (e.g., in
			// libfs/remote_status.go), even in the case where err !=
			// nil.
			return KBFSStatus{}, ch, err
		}
		if usageBytes >= 0 {
			usageBytes += status.UnflushedBytes
		}
	}

	dbc := fs.config.DiskBlockCache()
	var dbcStatus map[string]DiskBlockCacheStatus
	if dbc != nil {
		dbcStatus = dbc.Status(ctx)
	}

	dmc := fs.config.DiskMDCache()
	var dmcStatus DiskMDCacheStatus
	if dmc != nil {
		dmcStatus = dmc.Status(ctx)
	}
	dqc := fs.config.DiskQuotaCache()
	var dqcStatus DiskQuotaCacheStatus
	if dqc != nil {
		dqcStatus = dqc.Status(ctx)
	}

	return KBFSStatus{
		CurrentUser:          session.Name.String(),
		IsConnected:          fs.config.MDServer().IsConnected(),
		UsageBytes:           usageBytes,
		ArchiveBytes:         archiveBytes,
		LimitBytes:           limitBytes,
		GitUsageBytes:        gitUsageBytes,
		GitArchiveBytes:      gitArchiveBytes,
		GitLimitBytes:        gitLimitBytes,
		FailingServices:      failures,
		JournalServer:        jServerStatus,
		DiskBlockCacheStatus: dbcStatus,
		DiskMDCacheStatus:    dmcStatus,
		DiskQuotaCacheStatus: dqcStatus,
	}, ch, err
}

// UnstageForTesting implements the KBFSOps interface for KBFSOpsStandard
// TODO: remove once we have automatic conflict resolution
func (fs *KBFSOpsStandard) UnstageForTesting(
	ctx context.Context, folderBranch FolderBranch) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOps(ctx, folderBranch, FavoritesOpAdd)
	return ops.UnstageForTesting(ctx, folderBranch)
}

// RequestRekey implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RequestRekey(ctx context.Context, id tlf.ID) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	// We currently only support rekeys of master branches.
	ops := fs.getOps(ctx,
		FolderBranch{Tlf: id, Branch: MasterBranch}, FavoritesOpNoChange)
	ops.RequestRekey(ctx, id)
}

// SyncFromServer implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SyncFromServer(ctx context.Context,
	folderBranch FolderBranch, lockBeforeGet *keybase1.LockID) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOps(ctx, folderBranch, FavoritesOpAdd)
	return ops.SyncFromServer(ctx, folderBranch, lockBeforeGet)
}

// GetUpdateHistory implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetUpdateHistory(ctx context.Context,
	folderBranch FolderBranch) (history TLFUpdateHistory, err error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOps(ctx, folderBranch, FavoritesOpAdd)
	return ops.GetUpdateHistory(ctx, folderBranch)
}

// GetEditHistory implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetEditHistory(
	ctx context.Context, folderBranch FolderBranch) (
	tlfHistory keybase1.FSFolderEditHistory, err error) {
	ops := fs.getOps(ctx, folderBranch, FavoritesOpAdd)
	return ops.GetEditHistory(ctx, folderBranch)
}

// GetNodeMetadata implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetNodeMetadata(ctx context.Context, node Node) (
	NodeMetadata, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOpsByNode(ctx, node)
	return ops.GetNodeMetadata(ctx, node)
}

func (fs *KBFSOpsStandard) findTeamByID(
	ctx context.Context, tid keybase1.TeamID) *folderBranchOps {
	fs.opsLock.Lock()
	// Copy the ops list so we don't have to hold opsLock when calling
	// `getRootNode()` (which can lead to deadlocks).
	ops := make(map[FolderBranch]*folderBranchOps)
	for fb, fbo := range fs.ops {
		ops[fb] = fbo
	}
	fs.opsLock.Unlock()

	// We have to search for the tid since we don't know the old name
	// of the team here.  Should we add an index for this?
	for fb, fbo := range ops {
		_, _, handle, err := fbo.getRootNode(ctx)
		if err != nil {
			fs.log.CDebugf(
				ctx, "Error getting root node for %s: %+v", fb.Tlf, err)
			continue
		}

		if handle.TypeForKeying() != tlf.TeamKeying {
			continue
		}

		if handle.FirstResolvedWriter().AsTeamOrBust() != tid {
			continue
		}

		fs.log.CDebugf(ctx, "Team name changed for team %s", tid)
		return fbo
	}
	return nil
}

// TeamNameChanged implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) TeamNameChanged(
	ctx context.Context, tid keybase1.TeamID) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	fs.log.CDebugf(ctx, "Got TeamNameChanged for %s", tid)
	fbo := fs.findTeamByID(ctx, tid)
	if fbo != nil {
		go fbo.TeamNameChanged(ctx, tid)
	}
}

// TeamAbandoned implements the KBFSOps interface for KBFSOpsStandard.
func (fs *KBFSOpsStandard) TeamAbandoned(
	ctx context.Context, tid keybase1.TeamID) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	fs.log.CDebugf(ctx, "Got TeamAbandoned for %s", tid)
	fbo := fs.findTeamByID(ctx, tid)
	if fbo != nil {
		go fbo.TeamAbandoned(ctx, tid)
	}
}

// MigrateToImplicitTeam implements the KBFSOps interface for KBFSOpsStandard.
func (fs *KBFSOpsStandard) MigrateToImplicitTeam(
	ctx context.Context, id tlf.ID) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	// We currently only migrate on the master branch of a TLF.
	ops := fs.getOps(ctx,
		FolderBranch{Tlf: id, Branch: MasterBranch}, FavoritesOpNoChange)
	return ops.MigrateToImplicitTeam(ctx, id)
}

// KickoffAllOutstandingRekeys implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) KickoffAllOutstandingRekeys() error {
	for _, op := range fs.ops {
		op.rekeyFSM.Event(newRekeyKickoffEvent())
	}
	return nil
}

// NewNotificationChannel implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) NewNotificationChannel(
	ctx context.Context, handle *TlfHandle, convID chat1.ConversationID,
	channelName string) {
	if !fs.config.Mode().TLFEditHistoryEnabled() {
		return
	}

	fs.log.CDebugf(ctx, "New notification channel for %s",
		handle.GetCanonicalPath())

	// If the FBO already exists, notify it.  If the FBO doesn't exist
	// yet, we need to create it, so that it shows up in the edit
	// history.
	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()
	fav := handle.ToFavorite()
	if ops, ok := fs.opsByFav[fav]; ok {
		ops.NewNotificationChannel(ctx, handle, convID, channelName)
	} else if handle.tlfID != tlf.NullID {
		fs.editActivity.Add(1)
		go func() {
			defer fs.editActivity.Done()
			fs.log.CDebugf(ctx, "Initializing TLF %s for the edit history",
				handle.GetCanonicalPath())
			ctx := CtxWithRandomIDReplayable(
				context.Background(), CtxFBOIDKey, CtxFBOOpID, fs.log)
			ops := fs.getOpsByHandle(
				ctx, handle, FolderBranch{handle.tlfID, MasterBranch},
				FavoritesOpNoChange)
			// Don't initialize the entire TLF, because we don't want
			// to run identifies on it.  Instead, just start the
			// chat-monitoring part.
			ops.startMonitorChat(handle.GetCanonicalName())
		}()
	} else {
		fs.log.CWarningf(ctx,
			"Handle %s for existing folder unexpectedly has no TLF ID",
			handle.GetCanonicalName())
	}
}

// Reset implements the KBFSOps interface for KBFSOpsStandard.
func (fs *KBFSOpsStandard) Reset(
	ctx context.Context, handle *TlfHandle) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	// First, make sure the folder has been reset according to the
	// mdserver.
	bareHandle, err := handle.ToBareHandle()
	if err != nil {
		return err
	}
	id, _, err := fs.config.MDServer().GetForHandle(
		ctx, bareHandle, kbfsmd.Merged, nil)
	if err == nil {
		fs.log.CDebugf(ctx, "Folder %s can't be reset; still has ID %s",
			handle.GetCanonicalPath(), id)
		return errors.WithStack(FolderNotResetOnServer{handle})
	} else if _, ok := errors.Cause(err).(kbfsmd.ServerErrorClassicTLFDoesNotExist); !ok {
		// Return errors if they don't indicate the folder is new.
		return err
	}

	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()
	fs.log.CDebugf(ctx, "Reset %s", handle.GetCanonicalPath())
	fb := FolderBranch{handle.tlfID, MasterBranch}
	ops, ok := fs.ops[fb]
	if ok {
		err := ops.Reset(ctx, handle)
		if err != nil {
			return err
		}
		delete(fs.ops, fb)
		fav := handle.ToFavorite()
		delete(fs.opsByFav, fav)
		err = ops.Shutdown(ctx)
		if err != nil {
			return err
		}
	}

	// Reset the TLF by overwriting the TLF ID in the sigchain.  This
	// assumes that the server is in implicit team mode for new TLFs,
	// which at this point it should always be.
	return fs.resetTlfID(ctx, handle)
}

// GetSyncConfig implements the KBFSOps interface for KBFSOpsStandard.
func (fs *KBFSOpsStandard) GetSyncConfig(
	ctx context.Context, tlfID tlf.ID) (keybase1.FolderSyncConfig, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOps(ctx,
		FolderBranch{Tlf: tlfID, Branch: MasterBranch}, FavoritesOpNoChange)
	return ops.GetSyncConfig(ctx, tlfID)
}

// SetSyncConfig implements the KBFSOps interface for KBFSOpsStandard.
func (fs *KBFSOpsStandard) SetSyncConfig(
	ctx context.Context, tlfID tlf.ID,
	config keybase1.FolderSyncConfig) (<-chan error, error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOps(ctx,
		FolderBranch{Tlf: tlfID, Branch: MasterBranch}, FavoritesOpNoChange)
	return ops.SetSyncConfig(ctx, tlfID, config)
}

func (fs *KBFSOpsStandard) changeHandle(ctx context.Context,
	oldFav Favorite, newHandle *TlfHandle) {
	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()
	ops, ok := fs.opsByFav[oldFav]
	if !ok {
		return
	}
	newFav := newHandle.ToFavorite()
	fs.log.CDebugf(ctx, "Changing handle: %v -> %v", oldFav, newFav)
	fs.opsByFav[newFav] = ops
	delete(fs.opsByFav, oldFav)
}

// Notifier:
var _ Notifier = (*KBFSOpsStandard)(nil)

// RegisterForChanges implements the Notifer interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RegisterForChanges(
	folderBranches []FolderBranch, obs Observer) error {
	for _, fb := range folderBranches {
		// TODO: add branch parameter to notifier interface
		ops := fs.getOps(context.Background(), fb, FavoritesOpNoChange)
		return ops.RegisterForChanges(obs)
	}
	return nil
}

// UnregisterFromChanges implements the Notifer interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) UnregisterFromChanges(
	folderBranches []FolderBranch, obs Observer) error {
	for _, fb := range folderBranches {
		// TODO: add branch parameter to notifier interface
		ops := fs.getOps(context.Background(), fb, FavoritesOpNoChange)
		return ops.UnregisterFromChanges(obs)
	}
	return nil
}

func (fs *KBFSOpsStandard) onTLFBranchChange(tlfID tlf.ID, newBID kbfsmd.BranchID) {
	ops := fs.getOps(context.Background(),
		FolderBranch{Tlf: tlfID, Branch: MasterBranch}, FavoritesOpNoChange)
	ops.onTLFBranchChange(newBID) // folderBranchOps makes a goroutine
}

func (fs *KBFSOpsStandard) onMDFlush(tlfID tlf.ID, bid kbfsmd.BranchID,
	rev kbfsmd.Revision) {
	ops := fs.getOps(context.Background(),
		FolderBranch{Tlf: tlfID, Branch: MasterBranch}, FavoritesOpNoChange)
	ops.onMDFlush(bid, rev) // folderBranchOps makes a goroutine
}

func (fs *KBFSOpsStandard) initTlfsForEditHistories() {
	defer fs.editActivity.Done()
	shutdown := func() bool {
		fs.editLock.Lock()
		defer fs.editLock.Unlock()
		return fs.editShutdown
	}()
	if shutdown {
		return
	}

	if !fs.config.Mode().TLFEditHistoryEnabled() {
		return
	}

	ctx := CtxWithRandomIDReplayable(
		context.Background(), CtxFBOIDKey, CtxFBOOpID, fs.log)
	fs.log.CDebugf(ctx, "Querying the kbfs-edits inbox for new TLFs")
	handles, err := fs.config.Chat().GetGroupedInbox(
		ctx, chat1.TopicType_KBFSFILEEDIT, kbfsedits.MaxClusters)
	if err != nil {
		fs.log.CWarningf(ctx, "Can't get inbox: %+v", err)
		return
	}

	// Construct folderBranchOps instances for each TLF in the inbox
	// that doesn't have one yet.  Also make sure there's one for the
	// logged-in user's public folder.
	for _, h := range handles {
		if h.tlfID != tlf.NullID {
			fs.log.CDebugf(ctx, "Initializing TLF %s (%s) for the edit history",
				h.GetCanonicalPath(), h.tlfID)
			ops := fs.getOpsByHandle(
				ctx, h, FolderBranch{h.tlfID, MasterBranch},
				FavoritesOpNoChange)
			// Don't initialize the entire TLF, because we don't want
			// to run identifies on it.  Instead, just start the
			// chat-monitoring part.
			ops.startMonitorChat(h.GetCanonicalName())
		} else {
			fs.log.CWarningf(ctx,
				"Handle %s for existing folder unexpectedly has no TLF ID",
				h.GetCanonicalName())
		}
	}
}

// kbfsOpsFavoriteObserver deals with a handle change for a particular
// favorites.  It ignores local and batch changes.
type kbfsOpsFavoriteObserver struct {
	kbfsOps *KBFSOpsStandard

	lock    sync.Mutex
	currFav Favorite
}

var _ Observer = (*kbfsOpsFavoriteObserver)(nil)

func (kofo *kbfsOpsFavoriteObserver) LocalChange(
	_ context.Context, _ Node, _ WriteRange) {
}

func (kofo *kbfsOpsFavoriteObserver) BatchChanges(
	_ context.Context, _ []NodeChange, _ []NodeID) {
}

func (kofo *kbfsOpsFavoriteObserver) TlfHandleChange(
	ctx context.Context, newHandle *TlfHandle) {
	kofo.lock.Lock()
	defer kofo.lock.Unlock()
	kofo.kbfsOps.changeHandle(ctx, kofo.currFav, newHandle)
	kofo.currFav = newHandle.ToFavorite()
}
