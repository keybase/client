package libkbfs

import "runtime"

// nodeCore holds info shared among one or more nodeStandard objects.
type nodeCore struct {
	pathNode *pathNode
	parent   *nodeStandard
	cache    *nodeCacheStandard
	// used only when parent is nil (the object has been unlinked)
	cachedPath path
}

func newNodeCore(ptr BlockPointer, name string, parent *nodeStandard,
	cache *nodeCacheStandard) *nodeCore {
	return &nodeCore{
		pathNode: &pathNode{
			BlockPointer: ptr,
			Name:         name,
		},
		parent: parent,
		cache:  cache,
	}
}

func (c *nodeCore) ParentID() NodeID {
	if c.parent == nil {
		return nil
	}
	return c.parent.GetID()
}

type nodeStandard struct {
	core *nodeCore
}

var _ Node = (*nodeStandard)(nil)

func nodeStandardFinalizer(n *nodeStandard) {
	n.core.cache.forget(n.core)
}

func makeNodeStandard(core *nodeCore) *nodeStandard {
	n := &nodeStandard{core}
	runtime.SetFinalizer(n, nodeStandardFinalizer)
	return n
}

func (n *nodeStandard) GetID() NodeID {
	return n.core
}

func (n *nodeStandard) GetFolderBranch() FolderBranch {
	return n.core.cache.folderBranch
}
