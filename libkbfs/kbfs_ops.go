package libkbfs

import (
	"sync"
	"time"

	"golang.org/x/net/context"
)

// KBFSOpsStandard implements the KBFSOps interface, and is go-routine
// safe by forwarding requests to individual per-folder-branch
// handlers that are go-routine-safe.
type KBFSOpsStandard struct {
	config  Config
	ops     map[FolderBranch]*FolderBranchOps
	opsLock sync.RWMutex
}

var _ KBFSOps = (*KBFSOpsStandard)(nil)

// NewKBFSOpsStandard constructs a new KBFSOpsStandard object.
func NewKBFSOpsStandard(config Config) *KBFSOpsStandard {
	return &KBFSOpsStandard{
		config: config,
		ops:    make(map[FolderBranch]*FolderBranchOps),
	}
}

// Shutdown safely shuts down any background goroutines that may have
// been launched by KBFSOpsStandard.
func (fs *KBFSOpsStandard) Shutdown() {
	for _, ops := range fs.ops {
		ops.Shutdown()
	}
}

// GetFavorites implements the KBFSOps interface for
// KBFSOpsStandard.
func (fs *KBFSOpsStandard) GetFavorites(ctx context.Context) ([]*Favorite, error) {
	kbd := fs.config.KBPKI()
	folders, err := kbd.FavoriteList(ctx)
	if err != nil {
		return nil, err
	}

	favorites := make([]*Favorite, len(folders))
	for i, folder := range folders {
		favorites[i] = NewFavoriteFromFolder(folder)
	}
	return favorites, nil
}

func (fs *KBFSOpsStandard) getOps(fb FolderBranch) *FolderBranchOps {
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
		ops = NewFolderBranchOps(fs.config, fb, standard)
		fs.ops[fb] = ops
	}
	return ops
}

func (fs *KBFSOpsStandard) getOpsByNode(node Node) *FolderBranchOps {
	return fs.getOps(node.GetFolderBranch())
}

func (fs *KBFSOpsStandard) getOpsByHandle(ctx context.Context, handle *TlfHandle, fb FolderBranch) (*FolderBranchOps, error) {
	fs.opsLock.RLock()
	_, exists := fs.ops[fb]
	fs.opsLock.RUnlock()

	if !exists && fb.Branch == MasterBranch {
		err := fs.config.KBPKI().FavoriteAdd(ctx, handle.ToKBFolder(ctx, fs.config))
		if err != nil {
			return nil, err
		}
	}

	return fs.getOps(fb), nil
}

// GetOrCreateRootNodeForHandle implements the KBFSOps interface for
// KBFSOpsStandard
func (fs *KBFSOpsStandard) GetOrCreateRootNodeForHandle(
	ctx context.Context, handle *TlfHandle, branch BranchName) (
	node Node, de DirEntry, err error) {
	// Do GetForHandle() unlocked -- no cache lookups, should be fine
	mdops := fs.config.MDOps()
	// TODO: only do this the first time, cache the folder ID after that
	md, err := mdops.GetForHandle(ctx, handle)
	if err != nil {
		return
	}

	fb := FolderBranch{Tlf: md.ID, Branch: branch}
	ops, err := fs.getOpsByHandle(ctx, handle, fb)
	if err != nil {
		return
	}
	if branch == MasterBranch {
		// For now, only the master branch can be initialized with a
		// branch new MD object.
		err = ops.CheckForNewMDAndInit(ctx, md)
		if err != nil {
			return
		}
	}

	node, de, _, err = ops.GetRootNode(ctx, fb)
	return
}

// GetRootNode implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetRootNode(ctx context.Context,
	folderBranch FolderBranch) (Node, DirEntry, *TlfHandle, error) {
	ops := fs.getOps(folderBranch)
	return ops.GetRootNode(ctx, folderBranch)
}

// GetDirChildren implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetDirChildren(ctx context.Context, dir Node) (
	map[string]EntryType, error) {
	ops := fs.getOpsByNode(dir)
	return ops.GetDirChildren(ctx, dir)
}

// Lookup implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Lookup(ctx context.Context, dir Node, name string) (
	Node, DirEntry, error) {
	ops := fs.getOpsByNode(dir)
	return ops.Lookup(ctx, dir, name)
}

// Stat implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Stat(ctx context.Context, node Node) (
	DirEntry, error) {
	ops := fs.getOpsByNode(node)
	return ops.Stat(ctx, node)
}

// CreateDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateDir(
	ctx context.Context, dir Node, name string) (Node, DirEntry, error) {
	ops := fs.getOpsByNode(dir)
	return ops.CreateDir(ctx, dir, name)
}

// CreateFile implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateFile(
	ctx context.Context, dir Node, name string, isExec bool) (
	Node, DirEntry, error) {
	ops := fs.getOpsByNode(dir)
	return ops.CreateFile(ctx, dir, name, isExec)
}

// CreateLink implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateLink(
	ctx context.Context, dir Node, fromName string, toPath string) (
	DirEntry, error) {
	ops := fs.getOpsByNode(dir)
	return ops.CreateLink(ctx, dir, fromName, toPath)
}

// RemoveDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RemoveDir(
	ctx context.Context, dir Node, name string) error {
	ops := fs.getOpsByNode(dir)
	return ops.RemoveDir(ctx, dir, name)
}

// RemoveEntry implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RemoveEntry(
	ctx context.Context, dir Node, name string) error {
	ops := fs.getOpsByNode(dir)
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

	ops := fs.getOpsByNode(oldParent)
	return ops.Rename(ctx, oldParent, oldName, newParent, newName)
}

// Read implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Read(
	ctx context.Context, file Node, dest []byte, off int64) (
	numRead int64, err error) {
	ops := fs.getOpsByNode(file)
	return ops.Read(ctx, file, dest, off)
}

// Write implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Write(
	ctx context.Context, file Node, data []byte, off int64) error {
	ops := fs.getOpsByNode(file)
	return ops.Write(ctx, file, data, off)
}

// Truncate implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Truncate(
	ctx context.Context, file Node, size uint64) error {
	ops := fs.getOpsByNode(file)
	return ops.Truncate(ctx, file, size)
}

// SetEx implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SetEx(
	ctx context.Context, file Node, ex bool) error {
	ops := fs.getOpsByNode(file)
	return ops.SetEx(ctx, file, ex)
}

// SetMtime implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SetMtime(
	ctx context.Context, file Node, mtime *time.Time) error {
	ops := fs.getOpsByNode(file)
	return ops.SetMtime(ctx, file, mtime)
}

// Sync implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Sync(ctx context.Context, file Node) error {
	ops := fs.getOpsByNode(file)
	return ops.Sync(ctx, file)
}

// Status implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Status(
	ctx context.Context, folderBranch FolderBranch) (
	FolderBranchStatus, <-chan StatusUpdate, error) {
	ops := fs.getOps(folderBranch)
	return ops.Status(ctx, folderBranch)
}

// UnstageForTesting implements the KBFSOps interface for KBFSOpsStandard
// TODO: remove once we have automatic conflict resolution
func (fs *KBFSOpsStandard) UnstageForTesting(
	ctx context.Context, folderBranch FolderBranch) error {
	ops := fs.getOps(folderBranch)
	return ops.UnstageForTesting(ctx, folderBranch)
}

// SyncFromServer implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SyncFromServer(
	ctx context.Context, folderBranch FolderBranch) error {
	ops := fs.getOps(folderBranch)
	return ops.SyncFromServer(ctx, folderBranch)
}

// Notifier:
var _ Notifier = (*KBFSOpsStandard)(nil)

// RegisterForChanges implements the Notifer interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RegisterForChanges(
	folderBranches []FolderBranch, obs Observer) error {
	for _, fb := range folderBranches {
		// TODO: add branch parameter to notifier interface
		ops := fs.getOps(fb)
		return ops.RegisterForChanges(obs)
	}
	return nil
}

// UnregisterFromChanges implements the Notifer interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) UnregisterFromChanges(
	folderBranches []FolderBranch, obs Observer) error {
	for _, fb := range folderBranches {
		// TODO: add branch parameter to notifier interface
		ops := fs.getOps(fb)
		return ops.UnregisterFromChanges(obs)
	}
	return nil
}
