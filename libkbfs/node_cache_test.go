package libkbfs

import "testing"

func setupNodeCache(t *testing.T, id DirID, branch BranchName, flat bool) (
	ncs *nodeCacheStandard, parentNode Node, childNode1 Node, childNode2 Node,
	childPath1 []pathNode, childPath2 []pathNode) {
	ncs = newNodeCacheStandard(id, branch)

	parentPtr := BlockPointer{ID: BlockID{0}}
	var err error
	parentNode, err = ncs.GetOrCreate(parentPtr, "", nil)
	if err != nil {
		t.Errorf("Couldn't create top-level parent node: %v", err)
	}

	// now create a child node for that parent
	childPtr1 := BlockPointer{ID: BlockID{1}}
	childNode1, err = ncs.GetOrCreate(childPtr1, "child", parentNode)
	if err != nil {
		t.Errorf("Couldn't create child node: %v", err)
	}

	parent2 := childNode1
	if flat {
		parent2 = parentNode
	}

	childPtr2 := BlockPointer{ID: BlockID{2}}
	childNode2, err = ncs.GetOrCreate(childPtr2, "child2", parent2)
	if err != nil {
		t.Errorf("Couldn't create second child node: %v", err)
	}

	childPath1 = []pathNode{
		pathNode{
			BlockPointer: parentPtr,
			Name:         "",
		},
		pathNode{
			BlockPointer: childPtr1,
			Name:         "child",
		},
	}
	if flat {
		childPath2 = []pathNode{
			pathNode{
				BlockPointer: parentPtr,
				Name:         "",
			},
			pathNode{
				BlockPointer: childPtr2,
				Name:         "child2",
			},
		}
	} else {
		childPath2 = []pathNode{
			pathNode{
				BlockPointer: parentPtr,
				Name:         "",
			},
			pathNode{
				BlockPointer: childPtr1,
				Name:         "child",
			},
			pathNode{
				BlockPointer: childPtr2,
				Name:         "child2",
			},
		}
	}
	return
}

// Tests for simple GetOrCreate successes (with and without a parent)
func TestNodeCacheGetOrCreateSuccess(t *testing.T) {
	ncs, parentNode, childNode1A, _, path1, path2 :=
		setupNodeCache(t, DirID{0}, "", true)
	parentPtr := path1[0].BlockPointer
	childPtr1 := path1[1].BlockPointer
	childPtr2 := path2[1].BlockPointer

	// make sure we get the same node back for the second call
	childNode1B, err := ncs.GetOrCreate(childPtr1, "child", parentNode)
	if err != nil {
		t.Errorf("Couldn't create child node: %v", err)
	}
	if childNode1A != childNode1B {
		t.Error("Two creates for the same child!")
	}

	// now make sure the parent has 3 references, child 1 has 2, and
	// child 2 has 1
	if ncs.nodes[parentPtr].refCount != 3 {
		t.Errorf("Parent has wrong refcount: %d", ncs.nodes[parentPtr].refCount)
	}
	if ncs.nodes[childPtr1].refCount != 2 {
		t.Errorf("Child1 has wrong refcount: %d", ncs.nodes[childPtr1].refCount)
	}
	if ncs.nodes[childPtr2].refCount != 1 {
		t.Errorf("Child1 has wrong refcount: %d", ncs.nodes[childPtr2].refCount)
	}
}

// Tests that a child can't be created with an unknown parent (and
// that forget() works)
func TestNodeCacheGetOrCreateNoParent(t *testing.T) {
	ncs := newNodeCacheStandard(DirID{0}, "")

	parentPtr := BlockPointer{ID: BlockID{0}}
	parentNode, err := ncs.GetOrCreate(parentPtr, "", nil)
	if err != nil {
		t.Errorf("Couldn't create top-level parent node: %v", err)
	}
	ncs.forget(parentNode)

	// now try to create a child node for that parent
	childPtr1 := BlockPointer{ID: BlockID{1}}
	_, err = ncs.GetOrCreate(childPtr1, "child", parentNode)
	expectedErr := ParentNodeNotFoundError{parentPtr}
	if err != expectedErr {
		t.Errorf("Got unexpected error when creating w/o parent: %v", err)
	}
}

// Tests that UpdatePointer works
func TestNodeCacheUpdatePointer(t *testing.T) {
	ncs := newNodeCacheStandard(DirID{0}, "")

	parentPtr := BlockPointer{ID: BlockID{0}}
	parentNode, err := ncs.GetOrCreate(parentPtr, "", nil)
	if err != nil {
		t.Errorf("Couldn't create top-level parent node: %v", err)
	}

	newParentPtr := BlockPointer{ID: BlockID{1}}
	ncs.UpdatePointer(parentPtr, newParentPtr)

	if parentNode.(*nodeStandard).pathNode.BlockPointer != newParentPtr {
		t.Errorf("UpdatePointer didn't work.")
	}
}

// Tests that Move works as expected
func TestNodeCacheMoveSuccess(t *testing.T) {
	ncs, _, childNode1, childNode2, path1, path2 :=
		setupNodeCache(t, DirID{0}, "", true)
	parentPtr := path1[0].BlockPointer
	childPtr1 := path1[1].BlockPointer
	childPtr2 := path2[1].BlockPointer

	// now move child2 under child1
	err := ncs.Move(childPtr2, childNode1, "child3")
	if err != nil {
		t.Errorf("Couldn't update parent: %v", err)
	}

	if childNode2.(*nodeStandard).parent != childNode1 {
		t.Errorf("UpdateParent didn't work")
	}

	// now make sure the parent has 2 references, child 1 has 2, and
	// child 2 has 1
	if ncs.nodes[parentPtr].refCount != 2 {
		t.Errorf("Parent has wrong refcount: %d", ncs.nodes[parentPtr].refCount)
	}
	if ncs.nodes[childPtr1].refCount != 2 {
		t.Errorf("Child1 has wrong refcount: %d", ncs.nodes[childPtr1].refCount)
	}
	if ncs.nodes[childPtr2].refCount != 1 {
		t.Errorf("Child1 has wrong refcount: %d", ncs.nodes[childPtr2].refCount)
	}
	if childNode2.(*nodeStandard).pathNode.Name != "child3" {
		t.Errorf("Child2 has the wrong name after move: %s",
			childNode2.(*nodeStandard).pathNode.Name)
	}
}

// Tests that a child can't be updated with an unknown parent (and
// that forget() works)
func TestNodeCacheMoveNoParent(t *testing.T) {
	ncs, _, childNode1, _, path1, path2 :=
		setupNodeCache(t, DirID{0}, "", true)
	childPtr1 := path1[1].BlockPointer
	childPtr2 := path2[1].BlockPointer

	// get rid of child1
	ncs.forget(childNode1)

	// now move child2 under child1
	err := ncs.Move(childPtr2, childNode1, "child3")
	expectedErr := ParentNodeNotFoundError{childPtr1}
	if err != expectedErr {
		t.Errorf("Got unexpected error when updating parent: %v", err)
	}
}

func checkNodeCachePath(t *testing.T, id DirID, branch BranchName,
	path path, expectedPath []pathNode) {
	if len(path.path) != len(expectedPath) {
		t.Errorf("Bad path length: %v vs %v", len(path.path), len(expectedPath))
	}

	for i, n := range expectedPath {
		if path.path[i] != n {
			t.Errorf("Bad node on path, index %d: %v vs %v", i, path.path[i], n)
		}
	}
	if path.topDir != id {
		t.Errorf("Wrong top dir: %v vs %v", path.topDir, id)
	}
	if path.branch != BranchName(branch) {
		t.Errorf("Wrong branch: %s vs %s", path.branch, branch)
	}
}

// Tests that a child can be unlinked completely from the parent, and
// still have a path
func TestNodeCacheUnlink(t *testing.T) {
	id := DirID{42}
	branch := BranchName("testBranch")
	ncs, _, _, childNode2, _, path2 :=
		setupNodeCache(t, id, branch, false)
	childPtr2 := path2[2].BlockPointer

	// unlink child2
	ncs.Unlink(childPtr2, ncs.PathFromNode(childNode2))

	path := ncs.PathFromNode(childNode2)
	checkNodeCachePath(t, id, branch, path, path2)
}

// Tests that a child can be unlinked completely from the parent, and
// still have a path
func TestNodeCacheUnlinkParent(t *testing.T) {
	id := DirID{42}
	branch := BranchName("testBranch")
	ncs, _, childNode1, childNode2, _, path2 :=
		setupNodeCache(t, id, branch, false)
	childPtr1 := path2[1].BlockPointer

	// unlink node 2's parent
	ncs.Unlink(childPtr1, ncs.PathFromNode(childNode1))

	path := ncs.PathFromNode(childNode2)
	checkNodeCachePath(t, id, branch, path, path2)
}

// Tests that PathFromNode works correctly
func TestNodeCachePathFromNode(t *testing.T) {
	id := DirID{42}
	branch := BranchName("testBranch")
	ncs, _, _, childNode2, _, path2 :=
		setupNodeCache(t, id, branch, false)
	path := ncs.PathFromNode(childNode2)
	checkNodeCachePath(t, id, branch, path, path2)
}
