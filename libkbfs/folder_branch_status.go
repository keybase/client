package libkbfs

import (
	"sync"

	"golang.org/x/net/context"
)

// FolderBranchStatus is a simple data structure describing the
// current status of a particular folder-branch.  It is suitable for
// encoding directly as JSON.
type FolderBranchStatus struct {
	Staged     bool
	HeadWriter string
	DiskUsage  uint64
	// DirtyPaths are files that have been written, but not flushed.
	// They do not represent unstaged changes in your local instance.
	DirtyPaths []string

	updateChan chan struct{}
}

// Changed returns a channel that is closed whenever the status of the
// corresponding folder-branch changes and should be re-fetched by
// anyone who cares.
func (fbs FolderBranchStatus) Changed() <-chan struct{} {
	return fbs.updateChan
}

// folderBranchStatusKeeper holds and updates the status for a given
// folder-branch, and produces FolderBranchStatus instances suitable
// for callers outside this package to consume.
type folderBranchStatusKeeper struct {
	config    Config
	nodeCache NodeCache

	md         *RootMetadata
	dirtyNodes map[NodeID]Node
	dataMutex  *sync.Mutex

	updateChan  chan struct{}
	updateMutex *sync.Mutex
}

func newFolderBranchStatusKeeper(
	config Config, nodeCache NodeCache) *folderBranchStatusKeeper {
	return &folderBranchStatusKeeper{
		config:      config,
		nodeCache:   nodeCache,
		dirtyNodes:  make(map[NodeID]Node),
		dataMutex:   &sync.Mutex{},
		updateChan:  make(chan struct{}, 1),
		updateMutex: &sync.Mutex{},
	}
}

// dataMutex should be taken by the caller
func (fbsk *folderBranchStatusKeeper) signalChangeLocked() {
	fbsk.updateMutex.Lock()
	defer fbsk.updateMutex.Unlock()
	close(fbsk.updateChan)
	fbsk.updateChan = make(chan struct{}, 1)
}

// setRootMetadata sets the current head metadata for the
// corresponding folder-branch.
func (fbsk *folderBranchStatusKeeper) setRootMetadata(md *RootMetadata) {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	if fbsk.md == md {
		return
	}
	fbsk.md = md
	fbsk.signalChangeLocked()
}

func (fbsk *folderBranchStatusKeeper) addNode(m map[NodeID]Node, n Node) {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	id := n.GetID()
	_, ok := m[id]
	if ok {
		return
	}
	m[id] = n
	fbsk.signalChangeLocked()
}

func (fbsk *folderBranchStatusKeeper) rmNode(m map[NodeID]Node, n Node) {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	id := n.GetID()
	_, ok := m[id]
	if !ok {
		return
	}
	delete(m, id)
	fbsk.signalChangeLocked()
}

func (fbsk *folderBranchStatusKeeper) addDirtyNode(n Node) {
	fbsk.addNode(fbsk.dirtyNodes, n)
}

func (fbsk *folderBranchStatusKeeper) rmDirtyNode(n Node) {
	fbsk.rmNode(fbsk.dirtyNodes, n)
}

// dataMutex should be taken by the caller
func (fbsk *folderBranchStatusKeeper) convertNodesToPathsLocked(
	m map[NodeID]Node) []string {
	var ret []string
	for _, n := range m {
		ret = append(ret, fbsk.nodeCache.PathFromNode(n).String())
	}
	return ret
}

// getStatus returns a FolderBranchStatus-representation of the
// current status.
func (fbsk *folderBranchStatusKeeper) getStatus(ctx context.Context) (
	FolderBranchStatus, error) {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	fbsk.updateMutex.Lock()
	defer fbsk.updateMutex.Unlock()

	var fbs FolderBranchStatus
	fbs.updateChan = fbsk.updateChan

	if fbsk.md != nil {
		fbs.Staged = (fbsk.md.Flags & MetadataFlagUnmerged) != 0
		u, err := fbsk.config.KBPKI().GetUser(ctx, fbsk.md.data.LastWriter)
		if err != nil {
			return FolderBranchStatus{}, err
		}
		fbs.HeadWriter = u.GetName()
		fbs.DiskUsage = fbsk.md.DiskUsage
	}

	fbs.DirtyPaths = fbsk.convertNodesToPathsLocked(fbsk.dirtyNodes)
	return fbs, nil
}
