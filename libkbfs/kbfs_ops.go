package libkbfs

import (
	"sync"
	"time"
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
func (fs *KBFSOpsStandard) GetFavDirs() ([]DirID, error) {
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
func (fs *KBFSOpsStandard) GetOrCreateRootPathForHandle(handle *DirHandle) (
	path Path, de DirEntry, err error) {
	// Do GetForHandle() unlocked -- no cache lookups, should be fine
	mdops := fs.config.MDOps()
	md, err := mdops.GetForHandle(handle)
	if err != nil {
		return
	}

	// TODO: add a 'branch' parameter
	ops := fs.getOps(opID{tlf: md.ID, branch: MasterBranch})
	err = ops.CheckForNewMDAndInit(md)
	if err != nil {
		return
	}

	path, de, _, err = ops.GetRootPath(md.ID)
	return
}

// GetRootPath implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetRootPath(dir DirID) (
	path Path, de DirEntry, handle *DirHandle, err error) {
	// TODO: add a 'branch' parameter
	ops := fs.getOps(opID{tlf: dir, branch: MasterBranch})
	return ops.GetRootPath(dir)
}

// GetDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetDir(dir Path) (block *DirBlock, err error) {
	ops := fs.getOpsByPath(dir)
	return ops.GetDir(dir)
}

// CreateDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateDir(dir Path, path string) (
	p Path, de DirEntry, err error) {
	ops := fs.getOpsByPath(dir)
	return ops.CreateDir(dir, path)
}

// CreateFile implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateFile(dir Path, path string, isExec bool) (
	p Path, de DirEntry, err error) {
	ops := fs.getOpsByPath(dir)
	return ops.CreateFile(dir, path, isExec)
}

// CreateLink implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) CreateLink(
	dir Path, fromPath string, toPath string) (p Path, de DirEntry, err error) {
	ops := fs.getOpsByPath(dir)
	return ops.CreateLink(dir, fromPath, toPath)
}

// RemoveDir implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RemoveDir(dir Path) (p Path, err error) {
	ops := fs.getOpsByPath(dir)
	return ops.RemoveDir(dir)
}

// RemoveEntry implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) RemoveEntry(file Path) (p Path, err error) {
	ops := fs.getOpsByPath(file)
	return ops.RemoveEntry(file)
}

// Rename implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Rename(
	oldParent Path, oldName string, newParent Path, newName string) (
	oldP Path, newP Path, err error) {
	// only works for paths within the same topdir
	if (oldParent.TopDir != newParent.TopDir) ||
		(oldParent.Branch != newParent.Branch) ||
		(oldParent.Path[0].ID != newParent.Path[0].ID) {
		return Path{}, Path{}, &RenameAcrossDirsError{}
	}

	ops := fs.getOpsByPath(oldParent)
	return ops.Rename(oldParent, oldName, newParent, newName)
}

// Read implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Read(file Path, dest []byte, off int64) (
	numRead int64, err error) {
	ops := fs.getOpsByPath(file)
	return ops.Read(file, dest, off)
}

// Write implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Write(file Path, data []byte, off int64) error {
	ops := fs.getOpsByPath(file)
	return ops.Write(file, data, off)
}

// Truncate implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Truncate(file Path, size uint64) error {
	ops := fs.getOpsByPath(file)
	return ops.Truncate(file, size)
}

// SetEx implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SetEx(file Path, ex bool) (newPath Path, err error) {
	ops := fs.getOpsByPath(file)
	return ops.SetEx(file, ex)
}

// SetMtime implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) SetMtime(file Path, mtime *time.Time) (
	p Path, err error) {
	ops := fs.getOpsByPath(file)
	return ops.SetMtime(file, mtime)
}

// Sync implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) Sync(file Path) (p Path, err error) {
	ops := fs.getOpsByPath(file)
	return ops.Sync(file)
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
