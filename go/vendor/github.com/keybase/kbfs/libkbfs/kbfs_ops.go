// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// KBFSOpsStandard implements the KBFSOps interface, and is go-routine
// safe by forwarding requests to individual per-folder-branch
// handlers that are go-routine-safe.
type KBFSOpsStandard struct {
	config   Config
	log      logger.Logger
	deferLog logger.Logger
	ops      map[FolderBranch]*folderBranchOps
	opsByFav map[Favorite]*folderBranchOps
	opsLock  sync.RWMutex
	// reIdentifyControlChan controls reidentification.
	// Sending a value to this channel forces all fbos
	// to be marked for revalidation.
	// Closing this channel will shutdown the reidentification
	// watcher.
	reIdentifyControlChan chan chan<- struct{}

	favs *Favorites

	currentStatus            kbfsCurrentStatus
	quotaUsage               *EventuallyConsistentQuotaUsage
	longOperationDebugDumper *ImpatientDebugDumper
}

var _ KBFSOps = (*KBFSOpsStandard)(nil)

const longOperationDebugDumpDuration = time.Minute

// NewKBFSOpsStandard constructs a new KBFSOpsStandard object.
func NewKBFSOpsStandard(config Config) *KBFSOpsStandard {
	log := config.MakeLogger("")
	kops := &KBFSOpsStandard{
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

// Shutdown safely shuts down any background goroutines that may have
// been launched by KBFSOpsStandard.
func (fs *KBFSOpsStandard) Shutdown(ctx context.Context) error {
	defer fs.longOperationDebugDumper.Shutdown() // shut it down last
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

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
}

// PushStatusChange forces a new status be fetched by status listeners.
func (fs *KBFSOpsStandard) PushStatusChange() {
	fs.currentStatus.PushStatusChange()
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
		// TODO: add some interface for specifying the type of the
		// branch; for now assume online and read-write.
		ops = newFolderBranchOps(ctx, fs.config, fb, standard)
		fs.ops[fb] = ops
	}
	return ops
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

func (fs *KBFSOpsStandard) getOrInitializeNewMDMaster(ctx context.Context,
	mdops MDOps, h *TlfHandle, create bool, fop FavoritesOp) (
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

	if h.tlfID == tlf.NullID {
		return false, ImmutableRootMetadata{}, tlf.NullID,
			errors.New("No ID")
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

	fb := FolderBranch{Tlf: h.tlfID, Branch: MasterBranch}
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

	if tlfHandle.tlfID == tlf.NullID {
		return ImmutableRootMetadata{}, errors.New("No ID")
	}

	// Check for an unmerged MD first, unless we're in single-op
	// mode.  If this is a single-op, we can skip this check because
	// there's basically no way for a TLF to start off as unmerged
	// since single-ops should be using a fresh journal.
	if fs.config.Mode() != InitSingleOp {
		rmd, err = fs.config.MDOps().GetUnmergedForTLF(
			ctx, tlfHandle.tlfID, kbfsmd.NullBranchID)
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
	}

	if rmd == (ImmutableRootMetadata{}) {
		if fop == FavoritesOpAdd {
			_, rmd, _, err = fs.getOrInitializeNewMDMaster(
				ctx, fs.config.MDOps(), tlfHandle, true, FavoritesOpAddNewlyCreated)
		} else {
			_, rmd, _, err = fs.getOrInitializeNewMDMaster(
				ctx, fs.config.MDOps(), tlfHandle, true, fop)
		}
		if err != nil {
			return ImmutableRootMetadata{}, err
		}
	}

	// Make sure fbo exists and head is set so that next time we use this we
	// don't need to hit server even when there isn't any FS activity.
	if fbo == nil {
		fb := FolderBranch{Tlf: rmd.TlfID(), Branch: MasterBranch}
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

// getMaybeCreateRootNode is called for GetOrCreateRootNode and GetRootNode.
func (fs *KBFSOpsStandard) getMaybeCreateRootNode(
	ctx context.Context, h *TlfHandle, branch BranchName, create bool) (
	node Node, ei EntryInfo, err error) {
	fs.log.CDebugf(ctx, "getMaybeCreateRootNode(%s, %v, %v)",
		h.GetCanonicalPath(), branch, create)
	defer func() { fs.deferLog.CDebugf(ctx, "Done: %#v", err) }()

	// Check if we already have the MD cached, before contacting any
	// servers.
	fops := fs.getOpsByFav(h.ToFavorite())
	if fops != nil {
		// If a folderBranchOps already exists for this TLF, use it to
		// get the root node.  But if we haven't done an identify yet,
		// we better do so, because `getRootNode()` doesn't do one.
		lState := makeFBOLockState()
		md, err := fops.getMDForReadNeedIdentifyOnMaybeFirstAccess(ctx, lState)
		if err != nil {
			return nil, EntryInfo{}, err
		}
		if md != (ImmutableRootMetadata{}) {
			node, ei, _, err := fops.getRootNode(ctx)
			if err != nil {
				return nil, EntryInfo{}, err
			}
			if node != nil {
				return node, ei, nil
			}
		}
	}

	if h.tlfID == tlf.NullID {
		return nil, EntryInfo{}, errors.New("No ID")
	}

	mdops := fs.config.MDOps()
	var md ImmutableRootMetadata
	// Check for an unmerged MD first, unless we're in single-op
	// mode.  If this is a single-op, we can skip this check because
	// there's basically no way for a TLF to start off as unmerged
	// since single-ops should be using a fresh journal.
	if fs.config.Mode() != InitSingleOp {
		md, err = mdops.GetUnmergedForTLF(ctx, h.tlfID, kbfsmd.NullBranchID)
		if err != nil {
			return nil, EntryInfo{}, err
		}
	}

	if md == (ImmutableRootMetadata{}) {
		var id tlf.ID
		var initialized bool
		initialized, md, id, err = fs.getOrInitializeNewMDMaster(
			ctx, mdops, h, create, FavoritesOpAdd)
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

	fb := FolderBranch{Tlf: md.TlfID(), Branch: branch}

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
	var usageBytes, limitBytes int64 = -1, -1
	var gitUsageBytes, gitLimitBytes int64 = -1, -1
	// Don't request the quota info until we're sure we've
	// authenticated with our password.  TODO: fix this in the
	// service/GUI by handling multiple simultaneous passphrase
	// requests at once.
	if err == nil && fs.config.MDServer().IsConnected() {
		var quErr error
		_, usageBytes, limitBytes, gitUsageBytes, gitLimitBytes, quErr =
			fs.quotaUsage.GetAllTypes(ctx, 0, 0)
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
		err := fillInJournalStatusUnflushedPaths(
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

	return KBFSStatus{
		CurrentUser:     session.Name.String(),
		IsConnected:     fs.config.MDServer().IsConnected(),
		UsageBytes:      usageBytes,
		LimitBytes:      limitBytes,
		GitUsageBytes:   gitUsageBytes,
		GitLimitBytes:   gitLimitBytes,
		FailingServices: failures,
		JournalServer:   jServerStatus,
		DiskCacheStatus: dbcStatus,
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

// SyncFromServerForTesting implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SyncFromServerForTesting(ctx context.Context,
	folderBranch FolderBranch, lockBeforeGet *keybase1.LockID) error {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	ops := fs.getOps(ctx, folderBranch, FavoritesOpAdd)
	return ops.SyncFromServerForTesting(ctx, folderBranch, lockBeforeGet)
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
func (fs *KBFSOpsStandard) GetEditHistory(ctx context.Context,
	folderBranch FolderBranch) (edits TlfWriterEdits, err error) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

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

// TeamNameChanged implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) TeamNameChanged(
	ctx context.Context, tid keybase1.TeamID) {
	timeTrackerDone := fs.longOperationDebugDumper.Begin(ctx)
	defer timeTrackerDone()

	fs.log.CDebugf(ctx, "Got TeamNameChanged for %s", tid)
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
		if fb.Tlf.Type() != tlf.SingleTeam {
			continue
		}

		_, _, handle, err := fbo.getRootNode(ctx)
		if err != nil {
			fs.log.CDebugf(
				ctx, "Error getting root node for %s: %+v", fb.Tlf, err)
			continue
		}

		if handle.FirstResolvedWriter().AsTeamOrBust() != tid {
			continue
		}

		fs.log.CDebugf(ctx, "Team name changed for team %s", tid)
		go fbo.TeamNameChanged(ctx, tid)
		break
	}
}

// KickoffAllOutstandingRekeys implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) KickoffAllOutstandingRekeys() error {
	for _, op := range fs.ops {
		op.rekeyFSM.Event(newRekeyKickoffEvent())
	}
	return nil
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
	_ context.Context, _ []NodeChange) {
}

func (kofo *kbfsOpsFavoriteObserver) TlfHandleChange(
	ctx context.Context, newHandle *TlfHandle) {
	kofo.lock.Lock()
	defer kofo.lock.Unlock()
	kofo.kbfsOps.changeHandle(ctx, kofo.currFav, newHandle)
	kofo.currFav = newHandle.ToFavorite()
}
