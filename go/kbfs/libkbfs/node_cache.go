// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
)

type nodeCacheEntry struct {
	core     *nodeCore
	refCount int
}

// nodeCacheStandard implements the NodeCache interface by tracking
// the reference counts of nodeStandard Nodes, and using their member
// fields to construct paths.
type nodeCacheStandard struct {
	folderBranch FolderBranch

	lock         sync.RWMutex
	nodes        map[BlockRef]*nodeCacheEntry
	rootWrappers []func(Node) Node
}

var _ NodeCache = (*nodeCacheStandard)(nil)

func newNodeCacheStandard(fb FolderBranch) *nodeCacheStandard {
	return &nodeCacheStandard{
		folderBranch: fb,
		nodes:        make(map[BlockRef]*nodeCacheEntry),
	}
}

// lock must be locked for writing by the caller
func (ncs *nodeCacheStandard) forgetLocked(core *nodeCore) {
	ref := core.pathNode.Ref()

	entry, ok := ncs.nodes[ref]
	if !ok {
		return
	}
	if entry.core != core {
		return
	}

	entry.refCount--
	if entry.refCount <= 0 {
		delete(ncs.nodes, ref)
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
	nodeStandard, ok := parent.Unwrap().(*nodeStandard)
	if !ok {
		return nil, ParentNodeNotFoundError{BlockRef{}}
	}

	ref := nodeStandard.core.pathNode.Ref()
	entry, ok := ncs.nodes[ref]
	if !ok {
		return nil, ParentNodeNotFoundError{ref}
	}
	if nodeStandard.core != entry.core {
		return nil, ParentNodeNotFoundError{ref}
	}
	return nodeStandard, nil
}
func (ncs *nodeCacheStandard) wrapNodeStandard(
	n Node, rootWrappers []func(Node) Node, parent Node) Node {
	if parent != nil {
		return parent.WrapChild(n)
	}
	for _, f := range rootWrappers {
		n = f(n)
	}
	return n
}

func (ncs *nodeCacheStandard) makeNodeStandardForEntryLocked(
	entry *nodeCacheEntry) *nodeStandard {
	entry.refCount++
	return makeNodeStandard(entry.core)
}

// GetOrCreate implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) GetOrCreate(
	ptr BlockPointer, name string, parent Node, et EntryType) (
	n Node, err error) {
	var rootWrappers []func(Node) Node
	defer func() {
		if n != nil {
			n = ncs.wrapNodeStandard(n, rootWrappers, parent)
		}
	}()

	if !ptr.IsValid() {
		// Temporary code to track down bad block
		// pointers. Remove when not needed anymore.
		panic(InvalidBlockRefError{ptr.Ref()})
	}

	if name == "" {
		return nil, EmptyNameError{ptr.Ref()}
	}

	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	rootWrappers = ncs.rootWrappers
	entry, ok := ncs.nodes[ptr.Ref()]
	if ok {
		// If the entry happens to be unlinked, we may be in a
		// situation where a node got unlinked and then recreated, but
		// someone held onto a node the whole time and so it never got
		// removed from the cache.  In that case, forcibly remove it
		// from the cache to make room for the new node.
		if parent != nil && entry.core.parent == nil {
			delete(ncs.nodes, ptr.Ref())
		} else {
			return ncs.makeNodeStandardForEntryLocked(entry), nil
		}
	}

	if parent != nil {
		// Make sure a child can be made for this parent.
		_, err := ncs.newChildForParentLocked(parent)
		if err != nil {
			return nil, err
		}
	}

	entry = &nodeCacheEntry{
		core: newNodeCore(ptr, name, parent, ncs, et),
	}
	ncs.nodes[ptr.Ref()] = entry
	return ncs.makeNodeStandardForEntryLocked(entry), nil
}

// Get implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) Get(ref BlockRef) (n Node) {
	if ref == (BlockRef{}) {
		return nil
	}

	// Temporary code to track down bad block pointers. Remove (or
	// return an error) when not needed anymore.
	if !ref.IsValid() {
		panic(InvalidBlockRefError{ref})
	}

	var rootWrappers []func(Node) Node
	var parent Node
	defer func() {
		if n != nil {
			n = ncs.wrapNodeStandard(n, rootWrappers, parent)
		}
	}()

	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	rootWrappers = ncs.rootWrappers
	entry, ok := ncs.nodes[ref]
	if !ok {
		return nil
	}
	ns := ncs.makeNodeStandardForEntryLocked(entry)
	parent = ns.core.parent // get while under lock
	return ns
}

// UpdatePointer implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) UpdatePointer(
	oldRef BlockRef, newPtr BlockPointer) (updatedNode NodeID) {
	if oldRef == (BlockRef{}) && newPtr == (BlockPointer{}) {
		return nil
	}

	if !oldRef.IsValid() {
		panic(fmt.Sprintf("invalid oldRef %s with newPtr %s", oldRef, newPtr))
	}

	if !newPtr.IsValid() {
		panic(fmt.Sprintf("invalid newPtr %s with oldRef %s", newPtr, oldRef))
	}

	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	entry, ok := ncs.nodes[oldRef]
	if !ok {
		return nil
	}

	// Cannot update the pointer for an unlinked node.
	if entry.core.cachedPath.isValid() {
		return nil
	}

	entry.core.pathNode.BlockPointer = newPtr
	delete(ncs.nodes, oldRef)
	ncs.nodes[newPtr.Ref()] = entry
	return entry.core
}

// Move implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) Move(
	ref BlockRef, newParent Node, newName string) (undoFn func(), err error) {
	if ref == (BlockRef{}) {
		return nil, nil
	}

	// Temporary code to track down bad block pointers. Remove (or
	// return an error) when not needed anymore.
	if !ref.IsValid() {
		panic(InvalidBlockRefError{ref})
	}

	if newName == "" {
		return nil, EmptyNameError{ref}
	}

	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	entry, ok := ncs.nodes[ref]
	if !ok {
		return nil, nil
	}

	newParentNS, err := ncs.newChildForParentLocked(newParent)
	if err != nil {
		return nil, err
	}

	oldParent := entry.core.parent
	oldName := entry.core.pathNode.Name

	entry.core.parent = newParentNS
	entry.core.pathNode.Name = newName

	return func() {
		entry.core.parent = oldParent
		entry.core.pathNode.Name = oldName
	}, nil
}

// Unlink implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) Unlink(
	ref BlockRef, oldPath path, oldDe DirEntry) (undoFn func()) {
	if ref == (BlockRef{}) {
		return nil
	}

	// Temporary code to track down bad block pointers. Remove (or
	// return an error) when not needed anymore.
	if !ref.IsValid() {
		panic(InvalidBlockRefError{ref})
	}

	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	entry, ok := ncs.nodes[ref]
	if !ok {
		return nil
	}

	if entry.core.cachedPath.isValid() {
		// Already unlinked!
		return nil
	}

	oldParent := entry.core.parent
	oldName := entry.core.pathNode.Name

	entry.core.cachedPath = oldPath
	entry.core.cachedDe = oldDe
	entry.core.parent = nil
	entry.core.pathNode.Name = ""

	return func() {
		entry.core.cachedPath = path{}
		entry.core.cachedDe = DirEntry{}
		entry.core.parent = oldParent
		entry.core.pathNode.Name = oldName
	}
}

// IsUnlinked implements the NodeCache interface for
// nodeCacheStandard.
func (ncs *nodeCacheStandard) IsUnlinked(node Node) bool {
	ncs.lock.RLock()
	defer ncs.lock.RUnlock()

	ns, ok := node.Unwrap().(*nodeStandard)
	if !ok {
		return false
	}

	return ns.core.cachedPath.isValid()
}

// UnlinkedDirEntry implements the NodeCache interface for
// nodeCacheStandard.
func (ncs *nodeCacheStandard) UnlinkedDirEntry(node Node) DirEntry {
	ncs.lock.RLock()
	defer ncs.lock.RUnlock()

	ns, ok := node.Unwrap().(*nodeStandard)
	if !ok {
		return DirEntry{}
	}

	return ns.core.cachedDe
}

// UpdateUnlinkedDirEntry implements the NodeCache interface for
// nodeCacheStandard.
func (ncs *nodeCacheStandard) UpdateUnlinkedDirEntry(
	node Node, newDe DirEntry) {
	ncs.lock.Lock()
	defer ncs.lock.Unlock()

	ns, ok := node.Unwrap().(*nodeStandard)
	if !ok {
		return
	}

	ns.core.cachedDe = newDe
}

// PathFromNode implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) PathFromNode(node Node) (p path) {
	ncs.lock.RLock()
	defer ncs.lock.RUnlock()

	ns, ok := node.Unwrap().(*nodeStandard)
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
		if core.parent != nil {
			ns = core.parent.Unwrap().(*nodeStandard)
		} else {
			break
		}
	}

	// need to reverse the path nodes
	for i := len(p.path)/2 - 1; i >= 0; i-- {
		opp := len(p.path) - 1 - i
		p.path[i], p.path[opp] = p.path[opp], p.path[i]
	}

	// TODO: would it make any sense to cache the constructed path?
	p.FolderBranch = ncs.folderBranch
	return
}

// AllNodes implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) AllNodes() (nodes []Node) {
	ncs.lock.RLock()
	defer ncs.lock.RUnlock()
	nodes = make([]Node, 0, len(ncs.nodes))
	for _, entry := range ncs.nodes {
		nodes = append(nodes, ncs.makeNodeStandardForEntryLocked(entry))
	}
	return nodes
}

// AllNodeChildren implements the NodeCache interface for nodeCacheStandard.
func (ncs *nodeCacheStandard) AllNodeChildren(n Node) (nodes []Node) {
	ncs.lock.RLock()
	defer ncs.lock.RUnlock()
	nodes = make([]Node, 0, len(ncs.nodes))
	entryIDs := make(map[NodeID]bool)
	for _, entry := range ncs.nodes {
		var pathIDs []NodeID
		parent := entry.core.parent
		for parent != nil {
			// If the node's parent is what we're looking for (or on
			// the path to what we're looking for), include it in the
			// list.
			parentID := parent.GetID()
			if parentID == n.GetID() || entryIDs[parentID] {
				nodes = append(nodes, ncs.makeNodeStandardForEntryLocked(entry))
				for _, id := range pathIDs {
					entryIDs[id] = true
				}
				entryIDs[entry.core] = true
				break
			}

			// Otherwise, remember this parent and continue back
			// toward the root.
			pathIDs = append(pathIDs, parentID)
			ns, ok := parent.Unwrap().(*nodeStandard)
			if !ok {
				break
			}
			parent = ns.core.parent
		}
	}
	return nodes
}

func (ncs *nodeCacheStandard) AddRootWrapper(f func(Node) Node) {
	ncs.lock.Lock()
	defer ncs.lock.Unlock()
	ncs.rootWrappers = append(ncs.rootWrappers, f)
}
