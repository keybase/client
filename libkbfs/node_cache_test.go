package libkbfs

import "testing"

// Tests for simple GetOrCreate successes (with and without a parent)
func TestNodeCacheGetOrCreateSuccess(t *testing.T) {
	ncs := newNodeCacheStandard(DirID{0}, "")

	parentPtr := BlockPointer{ID: BlockID{0}}
	parentNode, err := ncs.GetOrCreate(parentPtr, "", nil)
	if err != nil {
		t.Errorf("Couldn't create top-level parent node: %v", err)
	}

	// now create a child node for that parent
	childPtr1 := BlockPointer{ID: BlockID{1}}
	childNode1A, err := ncs.GetOrCreate(childPtr1, "child", parentNode)
	if err != nil {
		t.Errorf("Couldn't create child node: %v", err)
	}

	childPtr2 := BlockPointer{ID: BlockID{2}}
	_, err = ncs.GetOrCreate(childPtr2, "child2", parentNode)
	if err != nil {
		t.Errorf("Couldn't create second child node: %v", err)
	}

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
	ncs := newNodeCacheStandard(DirID{0}, "")

	parentPtr := BlockPointer{ID: BlockID{0}}
	parentNode, err := ncs.GetOrCreate(parentPtr, "", nil)
	if err != nil {
		t.Errorf("Couldn't create top-level parent node: %v", err)
	}

	// now create a child node for that parent
	childPtr1 := BlockPointer{ID: BlockID{1}}
	childNode1, err := ncs.GetOrCreate(childPtr1, "child", parentNode)
	if err != nil {
		t.Errorf("Couldn't create child node: %v", err)
	}

	childPtr2 := BlockPointer{ID: BlockID{2}}
	childNode2, err := ncs.GetOrCreate(childPtr2, "child2", parentNode)
	if err != nil {
		t.Errorf("Couldn't create second child node: %v", err)
	}

	// now move child2 under child1
	err = ncs.Move(childPtr2, childNode1, "child3")
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
	ncs := newNodeCacheStandard(DirID{0}, "")

	parentPtr := BlockPointer{ID: BlockID{0}}
	parentNode, err := ncs.GetOrCreate(parentPtr, "", nil)
	if err != nil {
		t.Errorf("Couldn't create top-level parent node: %v", err)
	}

	// now create a child node for that parent
	childPtr1 := BlockPointer{ID: BlockID{1}}
	childNode1, err := ncs.GetOrCreate(childPtr1, "child", parentNode)
	if err != nil {
		t.Errorf("Couldn't create child node: %v", err)
	}

	childPtr2 := BlockPointer{ID: BlockID{2}}
	_, err = ncs.GetOrCreate(childPtr2, "child2", parentNode)
	if err != nil {
		t.Errorf("Couldn't create second child node: %v", err)
	}

	// get rid of child1
	ncs.forget(childNode1)

	// now move child2 under child1
	err = ncs.Move(childPtr2, childNode1, "child3")
	expectedErr := ParentNodeNotFoundError{childPtr1}
	if err != expectedErr {
		t.Errorf("Got unexpected error when updating parent: %v", err)
	}
}

// Tests that PathFromNode works correctly
func TestNodeCachePathFromNode(t *testing.T) {
	id := DirID{42}
	branch := "testBranch"
	ncs := newNodeCacheStandard(id, BranchName(branch))

	parentPtr := BlockPointer{ID: BlockID{0}}
	parentNode, err := ncs.GetOrCreate(parentPtr, "", nil)
	if err != nil {
		t.Errorf("Couldn't create top-level parent node: %v", err)
	}

	// now create a child node for that parent
	childPtr1 := BlockPointer{ID: BlockID{1}}
	childNode1, err := ncs.GetOrCreate(childPtr1, "child", parentNode)
	if err != nil {
		t.Errorf("Couldn't create child node: %v", err)
	}

	childPtr2 := BlockPointer{ID: BlockID{2}}
	childNode2, err := ncs.GetOrCreate(childPtr2, "child2", childNode1)
	if err != nil {
		t.Errorf("Couldn't create second child node: %v", err)
	}

	path := ncs.PathFromNode(childNode2)
	expectedPath := []PathNode{
		PathNode{
			BlockPointer: parentPtr,
			Name:         "",
		},
		PathNode{
			BlockPointer: childPtr1,
			Name:         "child",
		},
		PathNode{
			BlockPointer: childPtr2,
			Name:         "child2",
		},
	}

	if len(path.Path) != len(expectedPath) {
		t.Errorf("Bad path length: %v vs %v", len(path.Path), len(expectedPath))
	}

	for i, n := range expectedPath {
		if path.Path[i] != n {
			t.Errorf("Bad node on path, index %d: %v vs %v", i, path.Path[i], n)
		}
	}
	if path.TopDir != id {
		t.Errorf("Wrong top dir: %v vs %v", path.TopDir, id)
	}
	if path.Branch != BranchName(branch) {
		t.Errorf("Wrong branch: %s vs %s", path.Branch, branch)
	}
}
