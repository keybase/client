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

func (fs *KBFSOpsStandard) getOpsByNode(node Node) *FolderBranchOps {
	id, branch := node.GetFolderBranch()
	opID := opID{id, branch}
	return fs.getOps(opID)
}

// GetOrCreateRootNodeForHandle implements the KBFSOps interface for
// KBFSOpsStandard
func (fs *KBFSOpsStandard) GetOrCreateRootNodeForHandle(
	ctx context.Context, handle *DirHandle) (
	node Node, de DirEntry, err error) {
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

	node, de, _, err = ops.GetRootNode(ctx, md.ID)
	return
}

// GetRootNode implements the KBFSOps interface for KBFSOpsStandard
func (fs *KBFSOpsStandard) GetRootNode(ctx context.Context, dir DirID) (
	node Node, de DirEntry, handle *DirHandle, err error) {
	// TODO: add a 'branch' parameter
	ops := fs.getOps(opID{tlf: dir, branch: MasterBranch})
	return ops.GetRootNode(ctx, dir)
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
	oldID, oldBranch := oldParent.GetFolderBranch()
	newID, newBranch := newParent.GetFolderBranch()

	// only works for nodes within the same topdir
	if (oldID != newID) || (oldBranch != newBranch) {
		return &RenameAcrossDirsError{}
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
