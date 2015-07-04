package libkbfs

import "sync"

type nodeCacheEntry struct {
	node     *nodeStandard
	refCount int
}

// nodeCacheStandard implements the NodeCache interface by tracking
// the reference counts of nodeStandard Nodes, and using their member
// fields to construct paths.
type nodeCacheStandard struct {
	id     DirID
	branch BranchName
	nodes  map[BlockPointer]*nodeCacheEntry
	lock   sync.RWMutex
}

var _ NodeCache = (*nodeCacheStandard)(nil)

func newNodeCacheStandard(id DirID, branch BranchName) *nodeCacheStandard {
	return &nodeCacheStandard{
		id:     id,
		branch: branch,
		nodes:  make(map[BlockPointer]*nodeCacheEntry),
	}
}

// lock must be locked for writing by the caller
func (ncs *nodeCacheStandard) forgetLocked(node Node) {
	nodeStandard, ok := node.(*nodeStandard)
	if !ok {
		return
	}
	ptr := nodeStandard.pathNode.BlockPointer

	entry, ok := ncs.nodes[ptr]
	if !ok {
		return
	}
	if entry.node != node {
		return
	}

	entry.refCount--
	if entry.refCount <= 0 {
		delete(ncs.nodes, ptr)
	}
}

// Forget implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) forget(node Node) {
	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	ncs.forgetLocked(node)
}

// lock must be held for writing by the caller
func (ncs *nodeCacheStandard) newChildForParentLocked(parent Node) error {
	pNodeStandard, ok := parent.(*nodeStandard)
	if !ok {
		return ParentNodeNotFoundError{BlockPointer{}}
	}

	ptr := pNodeStandard.pathNode.BlockPointer
	pEntry, ok := ncs.nodes[ptr]
	if !ok {
		return ParentNodeNotFoundError{ptr}
	}
	if parent != pNodeStandard {
		return ParentNodeNotFoundError{ptr}
	}
	pEntry.refCount++
	return nil
}

// GetOrCreate implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) GetOrCreate(
	ptr BlockPointer, name string, parent Node) (Node, error) {
	ncs.lock.RLock()
	entry, ok := ncs.nodes[ptr]
	if ok {
		entry.refCount++
		ncs.lock.RUnlock()
		return entry.node, nil
	}
	ncs.lock.RUnlock()

	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	// check again to make sure
	entry, ok = ncs.nodes[ptr]
	if ok {
		entry.refCount++
		return entry.node, nil
	}

	// increment the parent's refcount when a child points to it
	if parent != nil {
		err := ncs.newChildForParentLocked(parent)
		if err != nil {
			return nil, err
		}
	}

	entry = &nodeCacheEntry{
		node:     newNodeStandard(ptr, name, parent, ncs),
		refCount: 1,
	}
	ncs.nodes[ptr] = entry
	return entry.node, nil
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

	entry.node.pathNode.BlockPointer = newPtr
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

	oldParent := entry.node.parent
	if oldParent != nil {
		ncs.forgetLocked(oldParent)
	}
	if newParent != nil {
		err := ncs.newChildForParentLocked(newParent)
		if err != nil {
			return err
		}
	}
	entry.node.parent = newParent
	entry.node.pathNode.Name = newName
	return nil
}

// PathFromNode implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) PathFromNode(node Node) (p Path) {
	ncs.lock.RLock()
	defer ncs.lock.RUnlock()

	currNode := node
	for currNode != nil {
		ns, ok := currNode.(*nodeStandard)
		if !ok {
			p.Path = nil
			return
		}
		p.Path = append(p.Path, *ns.pathNode)
		currNode = ns.parent
	}

	// need to reverse the path nodes
	for i := len(p.Path)/2 - 1; i >= 0; i-- {
		opp := len(p.Path) - 1 - i
		p.Path[i], p.Path[opp] = p.Path[opp], p.Path[i]
	}

	// TODO: would it make any sense to cache the constructed path?
	p.TopDir = ncs.id
	p.Branch = ncs.branch
	return
}
