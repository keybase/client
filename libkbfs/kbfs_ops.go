package libkbfs

import (
	"sync"
	"time"

	"golang.org/x/net/context"
)

// opID is a key for a particular Ops data structure, corresponding to
// a TLF ID and a branch name in that folder.
type opID struct {
	tlf    DirID
	branch BranchName
}

// KBFSOpsStandard implements the KBFSOps interface, and is go-routine
// safe by forwarding requests to individual per-folder-branch
// handlers that are go-routine-safe.
type KBFSOpsStandard struct {
	config  Config
	ops     map[opID]*FolderBranchOps
	opsLock sync.RWMutex
}

var _ KBFSOps = (*KBFSOpsStandard)(nil)

// NewKBFSOpsStandard constructs a new KBFSOpsStandard object.
func NewKBFSOpsStandard(config Config) *KBFSOpsStandard {
	return &KBFSOpsStandard{
		config: config,
		ops:    make(map[opID]*FolderBranchOps),
	}
}

// Shutdown safely shuts down any background goroutines that may have
// been launched by KBFSOpsStandard.
func (fs *KBFSOpsStandard) Shutdown() {
	for _, ops := range fs.ops {
		ops.Shutdown()
	}
}

// GetFavDirs implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetFavDirs(ctx context.Context) ([]DirID, error) {
	mdops := fs.config.MDOps()
	return mdops.GetFavorites()
}

func (fs *KBFSOpsStandard) getOps(id opID) *FolderBranchOps {
	fs.opsLock.RLock()
	if ops, ok := fs.ops[id]; ok {
		fs.opsLock.RUnlock()
		return ops
	}

	fs.opsLock.RUnlock()
	fs.opsLock.Lock()
	defer fs.opsLock.Unlock()
	// look it up again in case someone else got the lock
	ops, ok := fs.ops[id]
	if !ok {
		// TODO: add some interface for specifying the type of the
		// branch; for now assume online and read-write.
		ops = NewFolderBranchOps(fs.config, id.tlf, id.branch, standard)
		fs.ops[id] = ops
	}
	return ops
}

func (fs *KBFSOpsStandard) getOpsByPath(path Path) *FolderBranchOps {
	id := opID{tlf: path.TopDir, branch: path.Branch}
	return fs.getOps(id)
}

// GetOrCreateRootPathForHandle implements the KBFSOps interface for
// KBFSOpsStandard
func (fs *KBFSOpsStandard) GetOrCreateRootPathForHandle(
	ctx context.Context, handle *DirHandle) (
	path Path, de DirEntry, err error) {
	// Do GetForHandle() unlocked -- no cache lookups, should be fine
	mdops := fs.config.MDOps()
	md, err := mdops.GetForHandle(handle)
	if err != nil {
		return
	}

	// TODO: add a 'branch' parameter
	ops := fs.getOps(opID{tlf: md.ID, branch: MasterBranch})
	err = ops.CheckForNewMDAndInit(ctx, md)
	if err != nil {
		return
	}

	path, de, _, err = ops.GetRootPath(ctx, md.ID)
	return
}

// GetRootPath implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetRootPath(ctx context.Context, dir DirID) (
	path Path, de DirEntry, handle *DirHandle, err error) {
	// TODO: add a 'branch' parameter
	ops := fs.getOps(opID{tlf: dir, branch: MasterBranch})
	return ops.GetRootPath(ctx, dir)
}

// GetDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetDir(ctx context.Context, dir Path) (
	block *DirBlock, err error) {
	ops := fs.getOpsByPath(dir)
	return ops.GetDir(ctx, dir)
}

// CreateDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateDir(
	ctx context.Context, dir Path, path string) (
	p Path, de DirEntry, err error) {
	ops := fs.getOpsByPath(dir)
	return ops.CreateDir(ctx, dir, path)
}

// CreateFile implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateFile(
	ctx context.Context, dir Path, path string, isExec bool) (
	p Path, de DirEntry, err error) {
	ops := fs.getOpsByPath(dir)
	return ops.CreateFile(ctx, dir, path, isExec)
}

// CreateLink implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateLink(
	ctx context.Context, dir Path, fromPath string, toPath string) (
	p Path, de DirEntry, err error) {
	ops := fs.getOpsByPath(dir)
	return ops.CreateLink(ctx, dir, fromPath, toPath)
}

// RemoveDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RemoveDir(ctx context.Context, dir Path) (
	p Path, err error) {
	ops := fs.getOpsByPath(dir)
	return ops.RemoveDir(ctx, dir)
}

// RemoveEntry implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RemoveEntry(ctx context.Context, file Path) (
	p Path, err error) {
	ops := fs.getOpsByPath(file)
	return ops.RemoveEntry(ctx, file)
}

// Rename implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Rename(
	ctx context.Context, oldParent Path, oldName string, newParent Path,
	newName string) (oldP Path, newP Path, err error) {
	// only works for paths within the same topdir
	if (oldParent.TopDir != newParent.TopDir) ||
		(oldParent.Branch != newParent.Branch) ||
		(oldParent.Path[0].ID != newParent.Path[0].ID) {
		return Path{}, Path{}, &RenameAcrossDirsError{}
	}

	ops := fs.getOpsByPath(oldParent)
	return ops.Rename(ctx, oldParent, oldName, newParent, newName)
}

// Read implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Read(
	ctx context.Context, file Path, dest []byte, off int64) (
	numRead int64, err error) {
	ops := fs.getOpsByPath(file)
	return ops.Read(ctx, file, dest, off)
}

// Write implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Write(
	ctx context.Context, file Path, data []byte, off int64) error {
	ops := fs.getOpsByPath(file)
	return ops.Write(ctx, file, data, off)
}

// Truncate implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Truncate(
	ctx context.Context, file Path, size uint64) error {
	ops := fs.getOpsByPath(file)
	return ops.Truncate(ctx, file, size)
}

// SetEx implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SetEx(ctx context.Context, file Path, ex bool) (
	newPath Path, err error) {
	ops := fs.getOpsByPath(file)
	return ops.SetEx(ctx, file, ex)
}

// SetMtime implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SetMtime(
	ctx context.Context, file Path, mtime *time.Time) (p Path, err error) {
	ops := fs.getOpsByPath(file)
	return ops.SetMtime(ctx, file, mtime)
}

// Sync implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Sync(ctx context.Context, file Path) (
	p Path, err error) {
	ops := fs.getOpsByPath(file)
	return ops.Sync(ctx, file)
}

// Notifier:
var _ Notifier = (*KBFSOpsStandard)(nil)

// RegisterForChanges implements the Notifer interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RegisterForChanges(
	dirs []DirID, obs Observer) error {
	for _, dir := range dirs {
		// TODO: add branch parameter to notifier interface
		ops := fs.getOps(opID{tlf: dir, branch: MasterBranch})
		return ops.RegisterForChanges(obs)
	}
	return nil
}

// UnregisterFromChanges implements the Notifer interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) UnregisterFromChanges(
	dirs []DirID, obs Observer) error {
	for _, dir := range dirs {
		// TODO: add branch parameter to notifier interface
		ops := fs.getOps(opID{tlf: dir, branch: MasterBranch})
		return ops.UnregisterFromChanges(obs)
	}
	return nil
}
