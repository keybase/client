// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"runtime"
	"testing"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func setupNodeCache(t *testing.T, id tlf.ID, branch data.BranchName, flat bool) (
	ncs *nodeCacheStandard, parentNode Node, childNode1 Node, childNode2 Node,
	childPath1 []data.PathNode, childPath2 []data.PathNode) {
	ncs = newNodeCacheStandard(data.FolderBranch{Tlf: id, Branch: branch})

	parentPtr := data.BlockPointer{ID: kbfsblock.FakeID(0)}
	parentName := "parent"
	var err error
	parentNode, err = ncs.GetOrCreate(
		parentPtr, testPPS(parentName), nil, data.Dir)
	if err != nil {
		t.Errorf("Couldn't create top-level parent node: %v", err)
	}
	if parentNode.GetBasename().Plaintext() != parentName {
		t.Errorf("Expected basename %s, got %s",
			parentName, parentNode.GetBasename())
	}

	// now create a child node for that parent
	childPtr1 := data.BlockPointer{ID: kbfsblock.FakeID(1)}
	childName1 := "child1"
	childNode1, err = ncs.GetOrCreate(
		childPtr1, testPPS(childName1), parentNode, data.Dir)
	if err != nil {
		t.Errorf("Couldn't create child node: %v", err)
	}
	if childNode1.GetBasename().Plaintext() != childName1 {
		t.Errorf("Expected basename %s, got %s",
			childName1, childNode1.GetBasename())
	}

	parent2 := childNode1
	if flat {
		parent2 = parentNode
	}

	childPtr2 := data.BlockPointer{ID: kbfsblock.FakeID(2)}
	childName2 := "child2"
	childNode2, err = ncs.GetOrCreate(
		childPtr2, testPPS(childName2), parent2, data.Dir)
	if err != nil {
		t.Errorf("Couldn't create second child node: %v", err)
	}
	if childNode2.GetBasename().Plaintext() != childName2 {
		t.Errorf("Expected basename %s, got %s",
			childName2, childNode2.GetBasename())
	}

	childPath1 = []data.PathNode{
		{
			BlockPointer: parentPtr,
			Name:         testPPS(parentName),
		},
		{
			BlockPointer: childPtr1,
			Name:         testPPS(childName1),
		},
	}
	if flat {
		childPath2 = []data.PathNode{
			{
				BlockPointer: parentPtr,
				Name:         testPPS(parentName),
			},
			{
				BlockPointer: childPtr2,
				Name:         testPPS(childName2),
			},
		}
	} else {
		childPath2 = []data.PathNode{
			{
				BlockPointer: parentPtr,
				Name:         testPPS(parentName),
			},
			{
				BlockPointer: childPtr1,
				Name:         testPPS(childName1),
			},
			{
				BlockPointer: childPtr2,
				Name:         testPPS(childName2),
			},
		}
	}
	return
}

// Simulate a GC cycle where all the nodes in liveList still have
// references.
//
// (Doing real GC cycles and running finalizers, etc. is brittle.)
func simulateGC(ncs *nodeCacheStandard, liveList []Node) {
	hasWork := true
	for hasWork {
		hasWork = false

		liveSet := make(map[*nodeCore]bool)

		// Everything in liveList is live.
		for _, n := range liveList {
			liveSet[n.(*nodeStandard).core] = true
		}

		// Everything referenced as a parent is live.
		for _, e := range ncs.nodes {
			if e.core.parent != nil {
				p := e.core.parent.Unwrap().(*nodeStandard)
				liveSet[p.core] = true
			}
		}

		// Forget everything not live.
		for _, e := range ncs.nodes {
			if _, ok := liveSet[e.core]; !ok {
				ncs.forget(e.core)
				hasWork = true
			}
		}
	}
}

// Tests for simple GetOrCreate successes (with and without a parent)
func TestNodeCacheGetOrCreateSuccess(t *testing.T) {
	ncs, parentNode, childNode1A, _, path1, path2 :=
		setupNodeCache(t, tlf.FakeID(0, tlf.Private), data.MasterBranch, true)
	parentPtr := path1[0].BlockPointer
	childPtr1 := path1[1].BlockPointer
	childPtr2 := path2[1].BlockPointer

	// make sure we get the same node back for the second call
	childNode1B, err := ncs.GetOrCreate(
		childPtr1, childNode1A.GetBasename(), parentNode, data.Dir)
	if err != nil {
		t.Errorf("Couldn't create child node: %v", err)
	}
	if childNode1A.(*nodeStandard).core != childNode1B.(*nodeStandard).core {
		t.Error("Two creates for the same child!")
	}

	// now make sure the refCounts are right.
	if ncs.nodes[parentPtr.Ref()].refCount != 1 {
		t.Errorf("Parent has wrong refcount: %d", ncs.nodes[parentPtr.Ref()].refCount)
	}
	if ncs.nodes[childPtr1.Ref()].refCount != 2 {
		t.Errorf("Child1 has wrong refcount: %d", ncs.nodes[childPtr1.Ref()].refCount)
	}
	if ncs.nodes[childPtr2.Ref()].refCount != 1 {
		t.Errorf("Child1 has wrong refcount: %d", ncs.nodes[childPtr2.Ref()].refCount)
	}
}

// Tests that a child can't be created with an unknown parent.
func TestNodeCacheGetOrCreateNoParent(t *testing.T) {
	ncs := newNodeCacheStandard(data.FolderBranch{
		Tlf:    tlf.FakeID(0, tlf.Private),
		Branch: "",
	})

	parentPtr := data.BlockPointer{ID: kbfsblock.FakeID(0)}
	parentNode, err := ncs.GetOrCreate(
		parentPtr, testPPS("parent"), nil, data.Dir)
	if err != nil {
		t.Errorf("Couldn't create top-level parent node: %v", err)
	}

	simulateGC(ncs, []Node{})

	// now try to create a child node for that parent
	childPtr1 := data.BlockPointer{ID: kbfsblock.FakeID(1)}
	_, err = ncs.GetOrCreate(childPtr1, testPPS("child"), parentNode, data.Dir)
	expectedErr := ParentNodeNotFoundError{parentPtr.Ref()}
	if err != expectedErr {
		t.Errorf("Got unexpected error when creating w/o parent: %v", err)
	}
}

// Tests that UpdatePointer works
func TestNodeCacheUpdatePointer(t *testing.T) {
	ncs := newNodeCacheStandard(data.FolderBranch{
		Tlf:    tlf.FakeID(0, tlf.Private),
		Branch: "",
	})

	parentPtr := data.BlockPointer{ID: kbfsblock.FakeID(0)}
	parentNode, err := ncs.GetOrCreate(
		parentPtr, testPPS("parent"), nil, data.Dir)
	if err != nil {
		t.Errorf("Couldn't create top-level parent node: %v", err)
	}

	newParentPtr := data.BlockPointer{ID: kbfsblock.FakeID(1)}
	ncs.UpdatePointer(parentPtr.Ref(), newParentPtr)

	if parentNode.(*nodeStandard).core.pathNode.BlockPointer != newParentPtr {
		t.Errorf("UpdatePointer didn't work.")
	}
}

// Tests that Move works as expected
func TestNodeCacheMoveSuccess(t *testing.T) {
	ncs, parentNode, childNode1, childNode2, path1, path2 :=
		setupNodeCache(t, tlf.FakeID(0, tlf.Private), data.MasterBranch, true)
	parentPtr := path1[0].BlockPointer
	childPtr1 := path1[1].BlockPointer
	childPtr2 := path2[1].BlockPointer

	// now move child2 under child1
	undoMove, err := ncs.Move(childPtr2.Ref(), childNode1, testPPS("child3"))
	if err != nil {
		t.Errorf("Couldn't update parent: %v", err)
	}

	if childNode2.GetBasename().Plaintext() != "child3" {
		t.Errorf("Child2 has the wrong name after move: %s",
			childNode2.GetBasename())
	}

	if childNode2.(*nodeStandard).core.parent != childNode1 {
		t.Errorf("UpdateParent didn't work")
	}

	// now make sure all nodes have 1 reference.
	if ncs.nodes[parentPtr.Ref()].refCount != 1 {
		t.Errorf("Parent has wrong refcount: %d", ncs.nodes[parentPtr.Ref()].refCount)
	}
	if ncs.nodes[childPtr1.Ref()].refCount != 1 {
		t.Errorf("Child1 has wrong refcount: %d", ncs.nodes[childPtr1.Ref()].refCount)
	}
	if ncs.nodes[childPtr2.Ref()].refCount != 1 {
		t.Errorf("Child1 has wrong refcount: %d", ncs.nodes[childPtr2.Ref()].refCount)
	}

	undoMove()
	if childNode2.GetBasename().Plaintext() != "child2" {
		t.Errorf("Child2 has the wrong name after move: %s",
			childNode2.GetBasename())
	}
	if childNode2.(*nodeStandard).core.parent != parentNode {
		t.Errorf("UpdateParent didn't work")
	}

}

// Tests that a child can't be updated with an unknown parent
func TestNodeCacheMoveNoParent(t *testing.T) {
	ncs, _, childNode1, childNode2, path1, path2 :=
		setupNodeCache(t, tlf.FakeID(0, tlf.Private), data.MasterBranch, true)
	childPtr1 := path1[1].BlockPointer
	childPtr2 := path2[1].BlockPointer

	// get rid of child1
	simulateGC(ncs, []Node{childNode2})

	// now move child2 under child1
	_, err := ncs.Move(childPtr2.Ref(), childNode1, testPPS("child3"))
	expectedErr := ParentNodeNotFoundError{childPtr1.Ref()}
	if err != expectedErr {
		t.Errorf("Got unexpected error when updating parent: %v", err)
	}
}

func checkNodeCachePath(t *testing.T, id tlf.ID, branch data.BranchName,
	path data.Path, expectedPath []data.PathNode) {
	if len(path.Path) != len(expectedPath) {
		t.Errorf("Bad path length: %v vs %v", len(path.Path), len(expectedPath))
	}

	for i, n := range expectedPath {
		if path.Path[i] != n {
			t.Errorf("Bad node on path, index %d: %v vs %v", i, path.Path[i], n)
		}
	}
	if path.Tlf != id {
		t.Errorf("Wrong top dir: %v vs %v", path.Tlf, id)
	}
	if path.Branch != data.BranchName(branch) {
		t.Errorf("Wrong branch: %s vs %s", path.Branch, branch)
	}
}

// Tests that a child can be unlinked completely from the parent, and
// still have a path, but not a basename.
func TestNodeCacheUnlink(t *testing.T) {
	id := tlf.FakeID(42, tlf.Private)
	branch := data.BranchName("testBranch")
	ncs, _, _, childNode2, _, path2 :=
		setupNodeCache(t, id, branch, false)
	childPtr2 := path2[2].BlockPointer

	// unlink child2
	undoFn := ncs.Unlink(
		childPtr2.Ref(), ncs.PathFromNode(childNode2), data.DirEntry{})
	if undoFn == nil {
		t.Fatalf("Couldn't unlink")
	}

	path := ncs.PathFromNode(childNode2)
	checkNodeCachePath(t, id, branch, path, path2)

	if childNode2.GetBasename().Plaintext() != "" {
		t.Errorf("Expected empty basename, got %s", childNode2.GetBasename())
	}

	// Undo
	undoFn()
	if childNode2.GetBasename().Plaintext() != path2[2].Name.Plaintext() {
		t.Errorf("Expected basename %s, got %s",
			path2[2].Name, childNode2.GetBasename())
	}
}

// Tests that a child's ancestor can be unlinked completely from its
// parent, and the child still has a path and a basename.
func TestNodeCacheUnlinkParent(t *testing.T) {
	id := tlf.FakeID(42, tlf.Private)
	branch := data.BranchName("testBranch")
	ncs, _, childNode1, childNode2, _, path2 :=
		setupNodeCache(t, id, branch, false)
	childPtr1 := path2[1].BlockPointer

	// unlink node 2's parent
	undoFn := ncs.Unlink(
		childPtr1.Ref(), ncs.PathFromNode(childNode1), data.DirEntry{})
	if undoFn == nil {
		t.Fatalf("Couldn't unlink")
	}

	path := ncs.PathFromNode(childNode2)
	checkNodeCachePath(t, id, branch, path, path2)

	if childNode2.GetBasename().Plaintext() != "child2" {
		t.Errorf("Expected basename child2, got %s", childNode2.GetBasename())
	}
}

// Tests that a child can be unlinked completely from the parent, and
// then re-added with a new pointer and still work, but with a new
// node core.
func TestNodeCacheUnlinkThenRelink(t *testing.T) {
	id := tlf.FakeID(42, tlf.Private)
	branch := data.BranchName("testBranch")
	ncs, _, childNode1, childNode2, _, path2 :=
		setupNodeCache(t, id, branch, false)
	childPtr2 := path2[2].BlockPointer

	// unlink child2
	undoFn := ncs.Unlink(
		childPtr2.Ref(), ncs.PathFromNode(childNode2), data.DirEntry{})
	if undoFn == nil {
		t.Fatalf("Couldn't unlink")
	}

	newChildName := "newChildName"
	newChildPtr2 := data.BlockPointer{ID: kbfsblock.FakeID(22)}
	ncs.UpdatePointer(childPtr2.Ref(), newChildPtr2) // NO-OP
	childNode2B, err := ncs.GetOrCreate(
		newChildPtr2, testPPS(newChildName), childNode1, data.Dir)
	if err != nil {
		t.Fatalf("Couldn't relink node: %v", err)
	}
	if childNode2.GetID() == childNode2B.GetID() {
		t.Errorf("Relink left the node the same")
	}

	// Old unlinked node didn't get updated
	path := ncs.PathFromNode(childNode2)
	checkNodeCachePath(t, id, branch, path, path2)

	// New node
	path = ncs.PathFromNode(childNode2B)
	path2[2].BlockPointer = newChildPtr2
	path2[2].Name = testPPS(newChildName)
	checkNodeCachePath(t, id, branch, path, path2)

	if g, e := childNode2.GetBasename().Plaintext(), ""; g != e {
		t.Errorf("Expected basename %s, got %s", e, g)
	}
	if g, e := childNode2B.GetBasename().Plaintext(), newChildName; g != e {
		t.Errorf("Expected basename %s, got %s", e, g)
	}
}

// Tests that PathFromNode works correctly
func TestNodeCachePathFromNode(t *testing.T) {
	id := tlf.FakeID(42, tlf.Private)
	branch := data.BranchName("testBranch")
	ncs, _, _, childNode2, _, path2 :=
		setupNodeCache(t, id, branch, false)
	path := ncs.PathFromNode(childNode2)
	checkNodeCachePath(t, id, branch, path, path2)
}

// Make sure that (simulated) GC works as expected.
func TestNodeCacheGCBasic(t *testing.T) {
	ncs, parentNode, _, childNode2, _, _ :=
		setupNodeCache(t, tlf.FakeID(0, tlf.Private), data.MasterBranch, true)

	if len(ncs.nodes) != 3 {
		t.Errorf("Expected %d nodes, got %d", 3, len(ncs.nodes))
	}

	simulateGC(ncs, []Node{parentNode, childNode2})

	if len(ncs.nodes) != 2 {
		t.Errorf("Expected %d nodes, got %d", 2, len(ncs.nodes))
	}

	simulateGC(ncs, []Node{parentNode})

	if len(ncs.nodes) != 1 {
		t.Errorf("Expected %d nodes, got %d", 1, len(ncs.nodes))
	}

	simulateGC(ncs, []Node{})

	if len(ncs.nodes) != 0 {
		t.Errorf("Expected %d nodes, got %d", 0, len(ncs.nodes))
	}
}

// Make sure that GC works as expected when a child node holds the
// last reference to a parent.
func TestNodeCacheGCParent(t *testing.T) {
	ncs, _, _, childNode2, _, _ :=
		setupNodeCache(t, tlf.FakeID(0, tlf.Private), data.MasterBranch, true)

	if len(ncs.nodes) != 3 {
		t.Errorf("Expected %d nodes, got %d", 3, len(ncs.nodes))
	}

	simulateGC(ncs, []Node{childNode2})

	if len(ncs.nodes) != 2 {
		t.Errorf("Expected %d nodes, got %d", 2, len(ncs.nodes))
	}

	simulateGC(ncs, []Node{})

	if len(ncs.nodes) != 0 {
		t.Errorf("Expected %d nodes, got %d", 0, len(ncs.nodes))
	}
}

var finalizerChan = make(chan struct{})

// Like nodeStandardFinalizer(), but sends on finalizerChan
// afterwards.
func testNodeStandardFinalizer(n *nodeStandard) {
	nodeStandardFinalizer(n)
	finalizerChan <- struct{}{}
}

// Make sure that that making a node unreachable runs the finalizer on GC.
func TestNodeCacheGCReal(t *testing.T) {
	ncs, _, childNode1, childNode2, _, _ :=
		setupNodeCache(t, tlf.FakeID(0, tlf.Private), data.MasterBranch, true)

	if len(ncs.nodes) != 3 {
		t.Errorf("Expected %d nodes, got %d", 3, len(ncs.nodes))
	}

	runtime.SetFinalizer(childNode1, nil)
	runtime.SetFinalizer(childNode1, testNodeStandardFinalizer)

	childNode1 = nil
	runtime.GC()
	<-finalizerChan

	require.Len(t, ncs.nodes, 2)

	// Make sure childNode2 isn't GCed until after this point.
	runtime.KeepAlive(childNode2)
}

type wrappedTestNode struct {
	Node
	wrapChildCalled bool
}

func (wtn *wrappedTestNode) WrapChild(child Node) Node {
	child = wtn.Node.WrapChild(child)
	wtn.wrapChildCalled = true
	return child
}

func TestNodeCacheWrapChild(t *testing.T) {
	ncs := newNodeCacheStandard(
		data.FolderBranch{
			Tlf:    tlf.FakeID(0, tlf.Private),
			Branch: data.MasterBranch,
		})
	var wtn1, wtn2 *wrappedTestNode
	rw1 := func(root Node) Node {
		wtn1 = &wrappedTestNode{root, false}
		return wtn1
	}
	rw2 := func(root Node) Node {
		wtn2 = &wrappedTestNode{root, false}
		return wtn2
	}
	ncs.AddRootWrapper(rw1)
	ncs.AddRootWrapper(rw2)

	rootPtr := data.BlockPointer{ID: kbfsblock.FakeID(0)}
	rootName := "root"
	rootNode, err := ncs.GetOrCreate(rootPtr, testPPS(rootName), nil, data.Dir)
	require.NoError(t, err)

	childPtr := data.BlockPointer{ID: kbfsblock.FakeID(1)}
	childName := "child1"
	_, err = ncs.GetOrCreate(childPtr, testPPS(childName), rootNode, data.Dir)
	require.NoError(t, err)
	require.True(t, wtn1.wrapChildCalled)
	require.True(t, wtn2.wrapChildCalled)
}

func TestNodeCacheAllNodeChildren(t *testing.T) {
	ncs, parentNode, childNode1, childNode2, _, _ :=
		setupNodeCache(t, tlf.FakeID(0, tlf.Private), data.MasterBranch, false)

	// Structure:
	// parent:
	//   child1:
	//      child2
	//      child3
	//   child4

	childPtr3 := data.BlockPointer{ID: kbfsblock.FakeID(3)}
	childName3 := "child3"
	_, err := ncs.GetOrCreate(
		childPtr3, testPPS(childName3), childNode1, data.Dir)
	require.NoError(t, err)

	childPtr4 := data.BlockPointer{ID: kbfsblock.FakeID(4)}
	childName4 := "child4"
	_, err = ncs.GetOrCreate(
		childPtr4, testPPS(childName4), parentNode, data.Dir)
	require.NoError(t, err)

	parentChildren := ncs.AllNodeChildren(parentNode)
	require.Len(t, parentChildren, 4)

	child1Children := ncs.AllNodeChildren(childNode1)
	require.Len(t, child1Children, 2)

	child2Children := ncs.AllNodeChildren(childNode2)
	require.Len(t, child2Children, 0)

	t.Log("Move child3 under the parent node.")
	_, err = ncs.Move(childPtr3.Ref(), parentNode, testPPS("child3"))
	require.NoError(t, err)

	parentChildren = ncs.AllNodeChildren(parentNode)
	require.Len(t, parentChildren, 4)

	child1Children = ncs.AllNodeChildren(childNode1)
	require.Len(t, child1Children, 1)
}

func TestNodeCacheObfuscator(t *testing.T) {
	ncs := newNodeCacheStandard(
		data.FolderBranch{
			Tlf:    tlf.FakeID(0, tlf.Private),
			Branch: data.MasterBranch,
		})
	ncs.SetObfuscatorMaker(func() data.Obfuscator {
		return data.NewNodeObfuscator(nil)
	})

	t.Log("Root node should have an obfuscator")
	rootPtr := data.BlockPointer{ID: kbfsblock.FakeID(0)}
	rootName := "root"
	rootNode, err := ncs.GetOrCreate(rootPtr, testPPS(rootName), nil, data.Dir)
	require.NoError(t, err)
	rootOb := rootNode.Obfuscator()
	require.NotNil(t, rootOb)

	t.Log("A new root node should have the same obfuscator")
	rootNode2 := ncs.Get(rootPtr.Ref())
	rootOb2 := rootNode2.Obfuscator()
	require.NotNil(t, rootOb2)
	require.True(t, rootOb == rootOb2)

	t.Log("Child file should not have an obfuscator")
	childPtr := data.BlockPointer{ID: kbfsblock.FakeID(1)}
	childName := "child1"
	childNode, err := ncs.GetOrCreate(
		childPtr, testPPS(childName), rootNode, data.File)
	require.NoError(t, err)
	childOb := childNode.Obfuscator()
	require.Nil(t, childOb)
}
