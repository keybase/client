// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"

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
	reIdentifyControlChan chan struct{}

	favs *Favorites

	currentStatus kbfsCurrentStatus
}

var _ KBFSOps = (*KBFSOpsStandard)(nil)

// NewKBFSOpsStandard constructs a new KBFSOpsStandard object.
func NewKBFSOpsStandard(config Config) *KBFSOpsStandard {
	log := config.MakeLogger("")
	kops := &KBFSOpsStandard{
		config:                config,
		log:                   log,
		deferLog:              log.CloneWithAddedDepth(1),
		ops:                   make(map[FolderBranch]*folderBranchOps),
		opsByFav:              make(map[Favorite]*folderBranchOps),
		reIdentifyControlChan: make(chan struct{}),
		favs: NewFavorites(config),
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
		select {
		// Normal case: feed the current time from config and mark fbos needing validation.
		case <-ticker.C:
			now = fs.config.Clock().Now()
		// Mark everything for reidentification via now being the empty value or quit.
		case _, ok := <-fs.reIdentifyControlChan:
			if !ok {
				ticker.Stop()
				return
			}
		}
		fs.markForReIdentifyIfNeeded(now, maxValid)
	}
}

func (fs *KBFSOpsStandard) markForReIdentifyIfNeeded(now time.Time, maxValid time.Duration) {
	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()

	for _, fbo := range fs.ops {
		fbo.markForReIdentifyIfNeeded(now, maxValid)
	}
}

// Shutdown safely shuts down any background goroutines that may have
// been launched by KBFSOpsStandard.
func (fs *KBFSOpsStandard) Shutdown() error {
	close(fs.reIdentifyControlChan)
	var errors []error
	if err := fs.favs.Shutdown(); err != nil {
		errors = append(errors, err)
	}
	for _, ops := range fs.ops {
		if err := ops.Shutdown(); err != nil {
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
func (fs *KBFSOpsStandard) PushConnectionStatusChange(service string, newStatus error) {
	fs.currentStatus.PushConnectionStatusChange(service, newStatus)
}

// GetFavorites implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) GetFavorites(ctx context.Context) (
	[]Favorite, error) {
	return fs.favs.Get(ctx)
}

// RefreshCachedFavorites implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) RefreshCachedFavorites(ctx context.Context) {
	fs.favs.RefreshCache(ctx)
}

// AddFavorite implements the KBFSOps interface for KBFSOpsStandard.
func (fs *KBFSOpsStandard) AddFavorite(ctx context.Context,
	fav Favorite) error {
	kbpki := fs.config.KBPKI()
	_, _, err := kbpki.GetCurrentUserInfo(ctx)
	isLoggedIn := err == nil

	if isLoggedIn {
		err := fs.favs.Add(ctx, favToAdd{Favorite: fav, created: false})
		if err != nil {
			return err
		}
	}

	return nil
}

// DeleteFavorite implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) DeleteFavorite(ctx context.Context,
	fav Favorite) error {
	kbpki := fs.config.KBPKI()
	_, _, err := kbpki.GetCurrentUserInfo(ctx)
	isLoggedIn := err == nil

	// Let this ops remove itself, if we have one available.
	ops := func() *folderBranchOps {
		fs.opsLock.Lock()
		defer fs.opsLock.Unlock()
		return fs.opsByFav[fav]
	}()
	if ops != nil {
		err := ops.deleteFromFavorites(ctx, fs.favs)
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

func (fs *KBFSOpsStandard) getOpsNoAdd(fb FolderBranch) *folderBranchOps {
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
		ops = newFolderBranchOps(fs.config, fb, standard)
		fs.ops[fb] = ops
	}
	return ops
}

func (fs *KBFSOpsStandard) getOps(
	ctx context.Context, fb FolderBranch) *folderBranchOps {
	ops := fs.getOpsNoAdd(fb)
	if err := ops.addToFavorites(ctx, fs.favs, false); err != nil {
		// Failure to favorite shouldn't cause a failure.  Just log
		// and move on.
		fs.log.CDebugf(ctx, "Couldn't add favorite: %v", err)
	}
	return ops
}

func (fs *KBFSOpsStandard) getOpsByNode(ctx context.Context,
	node Node) *folderBranchOps {
	return fs.getOps(ctx, node.GetFolderBranch())
}

func (fs *KBFSOpsStandard) getOpsByHandle(ctx context.Context,
	handle *TlfHandle, fb FolderBranch) *folderBranchOps {
	ops := fs.getOps(ctx, fb)
	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()
	// Track under its name, so we can later tell it to remove itself
	// from the favorites list.  TODO: fix this when unresolved
	// assertions are allowed and become resolved.
	fs.opsByFav[handle.ToFavorite()] = ops
	return ops
}

// GetOrCreateRootNode implements the KBFSOps interface for
// KBFSOpsStandard
func (fs *KBFSOpsStandard) GetOrCreateRootNode(
	ctx context.Context, h *TlfHandle, branch BranchName) (
	node Node, ei EntryInfo, err error) {
	fs.log.CDebugf(ctx, "GetOrCreateRootNode(%s, %v)",
		h.GetCanonicalPath(), branch)
	defer func() { fs.deferLog.CDebugf(ctx, "Done: %#v", err) }()

	// Do GetForHandle() unlocked -- no cache lookups, should be fine
	mdops := fs.config.MDOps()
	// TODO: only do this the first time, cache the folder ID after that
	_, md, err := mdops.GetForHandle(ctx, h, Unmerged)
	if err != nil {
		return nil, EntryInfo{}, err
	}

	if md == (ImmutableRootMetadata{}) {
		var id TlfID
		id, md, err = mdops.GetForHandle(ctx, h, Merged)
		if err != nil {
			return nil, EntryInfo{}, err
		}
		if md == (ImmutableRootMetadata{}) {
			if id == (TlfID{}) {
				return nil, EntryInfo{}, errors.New("No ID or MD")
			}
			if branch != MasterBranch {
				return nil, EntryInfo{}, errors.New("Can only initialize with branch == MasterBranch")
			}

			// Init new MD.

			fb := FolderBranch{Tlf: id, Branch: branch}
			ops := fs.getOpsByHandle(ctx, h, fb)

			err = ops.SetInitialHeadToNew(ctx, id, h)
			if err != nil {
				return nil, EntryInfo{}, err
			}

			node, ei, _, err = ops.getRootNode(ctx)
			if err != nil {
				return nil, EntryInfo{}, err
			}

			if err := ops.addToFavorites(ctx, fs.favs, true); err != nil {
				// Failure to favorite shouldn't cause a failure.  Just log
				// and move on.
				fs.log.CDebugf(ctx, "Couldn't add favorite: %v", err)
			}

			return node, ei, nil
		}
	}

	fb := FolderBranch{Tlf: md.ID, Branch: branch}

	// we might not be able to read the metadata if we aren't in the
	// key group yet.
	if err := md.isReadableOrError(ctx, fs.config); err != nil {
		fs.opsLock.Lock()
		defer fs.opsLock.Unlock()
		// If we already have an FBO for this ID, trigger a rekey
		// prompt in the background, if possible.
		if ops, ok := fs.ops[fb]; ok {
			fs.log.CDebugf(ctx, "Triggering a paper prompt rekey on folder "+
				"access due to unreadable MD for %s", h.GetCanonicalPath())
			go ops.rekeyWithPrompt()
		}
		return nil, EntryInfo{}, err
	}

	ops := fs.getOpsByHandle(ctx, h, fb)

	err = ops.SetInitialHeadFromServer(ctx, md)
	if err != nil {
		return nil, EntryInfo{}, err
	}

	node, ei, _, err = ops.getRootNode(ctx)
	if err != nil {
		return nil, EntryInfo{}, err
	}

	if err := ops.addToFavorites(ctx, fs.favs, false); err != nil {
		// Failure to favorite shouldn't cause a failure.  Just log
		// and move on.
		fs.log.CDebugf(ctx, "Couldn't add favorite: %v", err)
	}
	return node, ei, nil
}

// GetDirChildren implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetDirChildren(ctx context.Context, dir Node) (
	map[string]EntryInfo, error) {
	ops := fs.getOpsByNode(ctx, dir)
	return ops.GetDirChildren(ctx, dir)
}

// Lookup implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Lookup(ctx context.Context, dir Node, name string) (
	Node, EntryInfo, error) {
	ops := fs.getOpsByNode(ctx, dir)
	return ops.Lookup(ctx, dir, name)
}

// Stat implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Stat(ctx context.Context, node Node) (
	EntryInfo, error) {
	ops := fs.getOpsByNode(ctx, node)
	return ops.Stat(ctx, node)
}

// CreateDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateDir(
	ctx context.Context, dir Node, name string) (Node, EntryInfo, error) {
	ops := fs.getOpsByNode(ctx, dir)
	return ops.CreateDir(ctx, dir, name)
}

// CreateFile implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateFile(
	ctx context.Context, dir Node, name string, isExec bool, excl Excl) (
	Node, EntryInfo, error) {
	ops := fs.getOpsByNode(ctx, dir)
	return ops.CreateFile(ctx, dir, name, isExec, excl)
}

// CreateLink implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateLink(
	ctx context.Context, dir Node, fromName string, toPath string) (
	EntryInfo, error) {
	ops := fs.getOpsByNode(ctx, dir)
	return ops.CreateLink(ctx, dir, fromName, toPath)
}

// RemoveDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RemoveDir(
	ctx context.Context, dir Node, name string) error {
	ops := fs.getOpsByNode(ctx, dir)
	return ops.RemoveDir(ctx, dir, name)
}

// RemoveEntry implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RemoveEntry(
	ctx context.Context, dir Node, name string) error {
	ops := fs.getOpsByNode(ctx, dir)
	return ops.RemoveEntry(ctx, dir, name)
}

// Rename implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Rename(
	ctx context.Context, oldParent Node, oldName string, newParent Node,
	newName string) error {
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
	ops := fs.getOpsByNode(ctx, file)
	return ops.Read(ctx, file, dest, off)
}

// Write implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Write(
	ctx context.Context, file Node, data []byte, off int64) error {
	ops := fs.getOpsByNode(ctx, file)
	return ops.Write(ctx, file, data, off)
}

// Truncate implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Truncate(
	ctx context.Context, file Node, size uint64) error {
	ops := fs.getOpsByNode(ctx, file)
	return ops.Truncate(ctx, file, size)
}

// SetEx implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SetEx(
	ctx context.Context, file Node, ex bool) error {
	ops := fs.getOpsByNode(ctx, file)
	return ops.SetEx(ctx, file, ex)
}

// SetMtime implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SetMtime(
	ctx context.Context, file Node, mtime *time.Time) error {
	ops := fs.getOpsByNode(ctx, file)
	return ops.SetMtime(ctx, file, mtime)
}

// Sync implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Sync(ctx context.Context, file Node) error {
	ops := fs.getOpsByNode(ctx, file)
	return ops.Sync(ctx, file)
}

// FolderStatus implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) FolderStatus(
	ctx context.Context, folderBranch FolderBranch) (
	FolderBranchStatus, <-chan StatusUpdate, error) {
	ops := fs.getOps(ctx, folderBranch)
	return ops.FolderStatus(ctx, folderBranch)
}

// Status implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Status(ctx context.Context) (
	KBFSStatus, <-chan StatusUpdate, error) {
	username, _, err := fs.config.KBPKI().GetCurrentUserInfo(ctx)
	var usageBytes int64 = -1
	var limitBytes int64 = -1
	// Don't request the quota info until we're sure we've
	// authenticated with our password.  TODO: fix this in the
	// service/GUI by handling multiple simultaneous passphrase
	// requests at once.
	if err == nil && fs.config.MDServer().IsConnected() {
		quotaInfo, err := fs.config.BlockServer().GetUserQuotaInfo(ctx)
		if err == nil {
			limitBytes = quotaInfo.Limit
			if quotaInfo.Total != nil {
				usageBytes = quotaInfo.Total.Bytes[UsageWrite]
			} else {
				usageBytes = 0
			}
		}
	}
	failures, ch := fs.currentStatus.CurrentStatus()
	return KBFSStatus{
		CurrentUser:     username.String(),
		IsConnected:     fs.config.MDServer().IsConnected(),
		UsageBytes:      usageBytes,
		LimitBytes:      limitBytes,
		FailingServices: failures,
	}, ch, err
}

// UnstageForTesting implements the KBFSOps interface for KBFSOpsStandard
// TODO: remove once we have automatic conflict resolution
func (fs *KBFSOpsStandard) UnstageForTesting(
	ctx context.Context, folderBranch FolderBranch) error {
	ops := fs.getOps(ctx, folderBranch)
	return ops.UnstageForTesting(ctx, folderBranch)
}

// Rekey implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Rekey(ctx context.Context, id TlfID) error {
	// We currently only support rekeys of master branches.
	ops := fs.getOpsNoAdd(FolderBranch{Tlf: id, Branch: MasterBranch})
	return ops.Rekey(ctx, id)
}

// SyncFromServerForTesting implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SyncFromServerForTesting(
	ctx context.Context, folderBranch FolderBranch) error {
	ops := fs.getOps(ctx, folderBranch)
	return ops.SyncFromServerForTesting(ctx, folderBranch)
}

// GetUpdateHistory implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetUpdateHistory(ctx context.Context,
	folderBranch FolderBranch) (history TLFUpdateHistory, err error) {
	ops := fs.getOps(ctx, folderBranch)
	return ops.GetUpdateHistory(ctx, folderBranch)
}

// Notifier:
var _ Notifier = (*KBFSOpsStandard)(nil)

// RegisterForChanges implements the Notifer interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RegisterForChanges(
	folderBranches []FolderBranch, obs Observer) error {
	for _, fb := range folderBranches {
		// TODO: add branch parameter to notifier interface
		ops := fs.getOpsNoAdd(fb)
		return ops.RegisterForChanges(obs)
	}
	return nil
}

// UnregisterFromChanges implements the Notifer interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) UnregisterFromChanges(
	folderBranches []FolderBranch, obs Observer) error {
	for _, fb := range folderBranches {
		// TODO: add branch parameter to notifier interface
		ops := fs.getOpsNoAdd(fb)
		return ops.UnregisterFromChanges(obs)
	}
	return nil
}
