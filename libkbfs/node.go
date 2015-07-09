package libkbfs

// NodeStandard implements the Node interface using a very simple data
// structure that tracks its own PathNode and parent.
type nodeStandard struct {
	pathNode *pathNode
	parent   Node
	cache    *nodeCacheStandard
	// used only when parent is nil (the node has been unlinked)
	cachedPath path
}

var _ Node = (*nodeStandard)(nil)

func newNodeStandard(ptr BlockPointer, name string, parent Node,
	cache *nodeCacheStandard) *nodeStandard {
	return &nodeStandard{
		pathNode: &pathNode{
			BlockPointer: ptr,
			Name:         name,
		},
		parent: parent,
		cache:  cache,
	}
}

// Forget implements the Node interface for NodeStandard
func (n *nodeStandard) Forget() {
	n.cache.forget(n)
}

func (n *nodeStandard) GetFolderBranch() (TlfID, BranchName) {
	return n.cache.id, n.cache.branch
}
