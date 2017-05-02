// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"runtime"
)

// nodeCore holds info shared among one or more nodeStandard objects.
type nodeCore struct {
	pathNode *pathNode
	parent   *nodeStandard
	cache    *nodeCacheStandard
	// used only when parent is nil (the object has been unlinked)
	cachedPath path
	cachedDe   DirEntry
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

// String is to support printing *nodeCore as a NodeID. If we want to
// print nodeCores as nodeCores (e.g., for debugging) we might have to
// implement Formatter.
func (c *nodeCore) String() string {
	return fmt.Sprintf("%p", c)
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

func (n *nodeStandard) GetBasename() string {
	if len(n.core.cachedPath.path) > 0 {
		// Must be unlinked.
		return ""
	}
	return n.core.pathNode.Name
}
