package libkbfs

import "sync"

type nodeCacheEntry struct {
	core     *nodeCore
	refCount int
}

// nodeCacheStandard implements the NodeCache interface by tracking
// the reference counts of nodeStandard Nodes, and using their member
// fields to construct paths.
type nodeCacheStandard struct {
	id     TlfID
	branch BranchName
	nodes  map[BlockPointer]*nodeCacheEntry
	lock   sync.RWMutex
}

var _ NodeCache = (*nodeCacheStandard)(nil)

func newNodeCacheStandard(id TlfID, branch BranchName) *nodeCacheStandard {
	return &nodeCacheStandard{
		id:     id,
		branch: branch,
		nodes:  make(map[BlockPointer]*nodeCacheEntry),
	}
}

// lock must be locked for writing by the caller
func (ncs *nodeCacheStandard) forgetLocked(core *nodeCore) {
	ptr := core.pathNode.BlockPointer

	entry, ok := ncs.nodes[ptr]
	if !ok {
		return
	}
	if entry.core != core {
		return
	}

	entry.refCount--
	if entry.refCount <= 0 {
		delete(ncs.nodes, ptr)
	}
}

// should be called only by nodeStandardFinalizer().
func (ncs *nodeCacheStandard) forget(core *nodeCore) {
	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	ncs.forgetLocked(core)
}

// lock must be held for writing by the caller
func (ncs *nodeCacheStandard) newChildForParentLocked(parent Node) (*nodeStandard, error) {
	nodeStandard, ok := parent.(*nodeStandard)
	if !ok {
		return nil, ParentNodeNotFoundError{BlockPointer{}}
	}

	ptr := nodeStandard.core.pathNode.BlockPointer
	entry, ok := ncs.nodes[ptr]
	if !ok {
		return nil, ParentNodeNotFoundError{ptr}
	}
	if nodeStandard.core != entry.core {
		return nil, ParentNodeNotFoundError{ptr}
	}
	return nodeStandard, nil
}

func makeNodeStandardForEntry(entry *nodeCacheEntry) *nodeStandard {
	entry.refCount++
	return makeNodeStandard(entry.core)
}

// GetOrCreate implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) GetOrCreate(
	ptr BlockPointer, name string, parent Node) (Node, error) {
	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	entry, ok := ncs.nodes[ptr]
	if ok {
		return makeNodeStandardForEntry(entry), nil
	}

	var parentNS *nodeStandard
	if parent != nil {
		var err error
		parentNS, err = ncs.newChildForParentLocked(parent)
		if err != nil {
			return nil, err
		}
	}

	entry = &nodeCacheEntry{
		core: newNodeCore(ptr, name, parentNS, ncs),
	}
	ncs.nodes[ptr] = entry
	return makeNodeStandardForEntry(entry), nil
}

// Get implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) Get(ptr BlockPointer) Node {
	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	entry, ok := ncs.nodes[ptr]
	if !ok {
		return nil
	}
	return makeNodeStandardForEntry(entry)
}

// UpdatePointer implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) UpdatePointer(
	oldPtr BlockPointer, newPtr BlockPointer) {
	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	entry, ok := ncs.nodes[oldPtr]
	if !ok {
		return
	}

	entry.core.pathNode.BlockPointer = newPtr
	delete(ncs.nodes, oldPtr)
	ncs.nodes[newPtr] = entry
}

// Move implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) Move(
	ptr BlockPointer, newParent Node, newName string) error {
	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	entry, ok := ncs.nodes[ptr]
	if !ok {
		return nil
	}

	newParentNS, err := ncs.newChildForParentLocked(newParent)
	if err != nil {
		return err
	}

	entry.core.parent = newParentNS
	entry.core.pathNode.Name = newName
	return nil
}

// Unlink implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) Unlink(ptr BlockPointer, oldPath path) {
	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	entry, ok := ncs.nodes[ptr]
	if !ok {
		return
	}

	entry.core.cachedPath = oldPath
	entry.core.parent = nil
	entry.core.pathNode.Name = ""
	return
}

// PathFromNode implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) PathFromNode(node Node) (p path) {
	ncs.lock.RLock()
	defer ncs.lock.RUnlock()

	ns, ok := node.(*nodeStandard)
	if !ok {
		p.path = nil
		return
	}

	for ns != nil {
		core := ns.core
		if core.parent == nil && len(core.cachedPath.path) > 0 {
			// The node was unlinked, but is still in use, so use its
			// cached path.  The path is already reversed, so append
			// it backwards one-by-one to the existing path.  If this
			// is the first node, we can just optimize by returning
			// the complete cached path.
			if len(p.path) == 0 {
				return core.cachedPath
			}
			for i := len(core.cachedPath.path) - 1; i >= 0; i-- {
				p.path = append(p.path, core.cachedPath.path[i])
			}
			break
		}

		p.path = append(p.path, *core.pathNode)
		ns = core.parent
	}

	// need to reverse the path nodes
	for i := len(p.path)/2 - 1; i >= 0; i-- {
		opp := len(p.path) - 1 - i
		p.path[i], p.path[opp] = p.path[opp], p.path[i]
	}

	// TODO: would it make any sense to cache the constructed path?
	p.tlf = ncs.id
	p.branch = ncs.branch
	return
}
