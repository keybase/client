package libkbfs

import (
	"sync"

	"github.com/keybase/client/go/libkb"

	"golang.org/x/net/context"
)

// FolderBranchStatus is a simple data structure describing the
// current status of a particular folder-branch.  It is suitable for
// encoding directly as JSON.
type FolderBranchStatus struct {
	Staged     bool
	HeadWriter libkb.NormalizedUsername
	DiskUsage  uint64
	// DirtyPaths are files that have been written, but not flushed.
	// They do not represent unstaged changes in your local instance.
	DirtyPaths []string

	// If we're in the staged state, these summaries show the
	// diverging operations per-file
	Unmerged []*crChainSummary
	Merged   []*crChainSummary
}

// StatusUpdate is a dummy type used to indicate status has been updated.
type StatusUpdate struct{}

// folderBranchStatusKeeper holds and updates the status for a given
// folder-branch, and produces FolderBranchStatus instances suitable
// for callers outside this package to consume.
type folderBranchStatusKeeper struct {
	config    Config
	nodeCache NodeCache

	md         *RootMetadata
	dirtyNodes map[NodeID]Node
	unmerged   *crChains
	merged     *crChains
	dataMutex  sync.Mutex

	updateChan  chan StatusUpdate
	updateMutex sync.Mutex
}

func newFolderBranchStatusKeeper(
	config Config, nodeCache NodeCache) *folderBranchStatusKeeper {
	return &folderBranchStatusKeeper{
		config:     config,
		nodeCache:  nodeCache,
		dirtyNodes: make(map[NodeID]Node),
		updateChan: make(chan StatusUpdate, 1),
	}
}

// dataMutex should be taken by the caller
func (fbsk *folderBranchStatusKeeper) signalChangeLocked() {
	fbsk.updateMutex.Lock()
	defer fbsk.updateMutex.Unlock()
	close(fbsk.updateChan)
	fbsk.updateChan = make(chan StatusUpdate, 1)
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

func (fbsk *folderBranchStatusKeeper) setCRChains(unmerged *crChains,
	merged *crChains) {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	if unmerged == fbsk.unmerged && merged == fbsk.merged {
		return
	}
	fbsk.unmerged = unmerged
	fbsk.merged = merged
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
	FolderBranchStatus, <-chan StatusUpdate, error) {
	fbsk.dataMutex.Lock()
	defer fbsk.dataMutex.Unlock()
	fbsk.updateMutex.Lock()
	defer fbsk.updateMutex.Unlock()

	var fbs FolderBranchStatus

	if fbsk.md != nil {
		fbs.Staged = (fbsk.md.Flags & MetadataFlagUnmerged) != 0
		name, err := fbsk.config.KBPKI().GetNormalizedUsername(ctx, fbsk.md.data.LastWriter)
		if err != nil {
			return FolderBranchStatus{}, nil, err
		}
		fbs.HeadWriter = name
		fbs.DiskUsage = fbsk.md.DiskUsage
	}

	fbs.DirtyPaths = fbsk.convertNodesToPathsLocked(fbsk.dirtyNodes)

	// Make the chain summaries.  Identify using the unmerged chains,
	// since those are most likely to be able to identify a node in
	// the cache.
	if fbsk.unmerged != nil {
		fbs.Unmerged = fbsk.unmerged.summary(fbsk.unmerged, fbsk.nodeCache)
		if fbsk.merged != nil {
			fbs.Merged = fbsk.merged.summary(fbsk.unmerged, fbsk.nodeCache)
		}
	}

	return fbs, fbsk.updateChan, nil
}
