// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	billy "gopkg.in/src-d/go-billy.v4"
)

// nodeCore holds info shared among one or more nodeStandard objects.
type nodeCore struct {
	pathNode  *data.PathNode
	parent    Node
	cache     *nodeCacheStandard
	entryType data.EntryType
	// used only when parent is nil (the object has been unlinked)
	cachedPath data.Path
	cachedDe   data.DirEntry
	obfuscator data.Obfuscator
}

func newNodeCore(
	ptr data.BlockPointer, name data.PathPartString, parent Node,
	cache *nodeCacheStandard, et data.EntryType) *nodeCore {
	return &nodeCore{
		pathNode: &data.PathNode{
			BlockPointer: ptr,
			Name:         name,
		},
		parent:    parent,
		cache:     cache,
		entryType: et,
	}
}

func newNodeCoreForDir(
	ptr data.BlockPointer, name data.PathPartString, parent Node,
	cache *nodeCacheStandard, obfuscator data.Obfuscator) *nodeCore {
	nc := newNodeCore(ptr, name, parent, cache, data.Dir)
	nc.obfuscator = obfuscator
	return nc
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

func (n *nodeStandard) GetBlockID() (blockID kbfsblock.ID) {
	return n.core.pathNode.BlockPointer.ID
}

func (n *nodeStandard) GetCanonicalPath() string {
	return n.core.cache.PathFromNode(n).CanonicalPathString()
}

func (n *nodeStandard) GetID() NodeID {
	return n.core
}

func (n *nodeStandard) GetFolderBranch() data.FolderBranch {
	return n.core.cache.folderBranch
}

func (n *nodeStandard) GetBasename() data.PathPartString {
	if len(n.core.cachedPath.Path) > 0 {
		// Must be unlinked.
		return data.PathPartString{}
	}
	return n.core.pathNode.Name
}

func (n *nodeStandard) Readonly(_ context.Context) bool {
	return false
}

func (n *nodeStandard) ShouldCreateMissedLookup(
	ctx context.Context, _ data.PathPartString) (
	bool, context.Context, data.EntryType, os.FileInfo, string) {
	return false, ctx, data.File, nil, ""
}

func (n *nodeStandard) ShouldRetryOnDirRead(ctx context.Context) bool {
	return false
}

func (n *nodeStandard) RemoveDir(_ context.Context, _ data.PathPartString) (
	removeHandled bool, err error) {
	return false, nil
}

func (n *nodeStandard) WrapChild(child Node) Node {
	return child
}

func (n *nodeStandard) Unwrap() Node {
	return n
}

func (n *nodeStandard) GetFS(_ context.Context) billy.Filesystem {
	return nil
}

func (n *nodeStandard) GetFile(_ context.Context) billy.File {
	return nil
}

func (n *nodeStandard) EntryType() data.EntryType {
	return n.core.entryType
}

func (n *nodeStandard) FillCacheDuration(d *time.Duration) {}

func (n *nodeStandard) Obfuscator() data.Obfuscator {
	return n.core.obfuscator
}

func (n *nodeStandard) ChildName(name string) data.PathPartString {
	if n.core.entryType != data.Dir {
		panic("Only dirs can have child names")
	}
	return data.NewPathPartString(name, n.core.obfuscator)
}
