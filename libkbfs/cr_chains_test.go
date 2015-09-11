package libkbfs

import (
	"reflect"
	"testing"
)

func checkExpectedChains(t *testing.T, expected map[BlockPointer]BlockPointer,
	heads map[BlockPointer]*crOpNode, tails map[BlockPointer]*crOpNode) {
	if g, e := len(heads), len(expected); g != e {
		t.Errorf("Wrong number of heads, %v vs %v", g, e)
	}

	if g, e := len(tails), len(expected); g != e {
		t.Errorf("Wrong number of tails, %v vs %v", g, e)
	}

	for head, tail := range expected {
		currNode, ok := heads[head]
		if !ok {
			t.Fatalf("No head for %v", head)
		}

		for currNode.nextOp != nil {
			currNode = currNode.nextOp
		}

		if currNode.refPtr != tail {
			t.Fatalf("Chain for %v does not end in %v", head, tail)
		}

		tailNode, ok := tails[tail]
		if !ok {
			t.Fatalf("No tali for %v", tail)
		}

		if tailNode != currNode {
			t.Fatalf("Chain from %v does not end in tail %v", head, tail)
		}
	}
}

func TestCRMakeChainsSingleOp(t *testing.T) {
	rmd := &RootMetadata{}

	currPtr := byte(42)
	rootPtrUnref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	rootPtrRef := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir1Unref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir1Ref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir2Unref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir2Ref := BlockPointer{ID: fakeBlockID(currPtr)}

	expectedChains := make(map[BlockPointer]BlockPointer)
	expectedChains[rootPtrUnref] = rootPtrRef
	expectedChains[dir1Unref] = dir1Ref
	expectedChains[dir2Unref] = dir2Ref

	rmd.data.Dir.BlockPointer = rootPtrRef

	co := newCreateOp("new", dir2Unref, File)
	for unref, ref := range expectedChains {
		co.AddUpdate(unref, ref)
	}
	rmd.AddOp(co)

	heads, tails, root, err := crMakeChains([]*RootMetadata{rmd})
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}
	checkExpectedChains(t, expectedChains, heads, tails)
	if root != rootPtrUnref {
		t.Fatalf("Root pointer incorrect, %v vs %v", root, rootPtrUnref)
	}

	// check for the create op
	dir2 := heads[dir2Unref]
	dir2Op, ok := dir2.op.(*createOp)
	if !ok {
		t.Fatalf("No create op at %v", dir2Unref)
	}
	if dir2Op != co {
		t.Fatalf("Bad create op: %v", dir2Op)
	}
}

func TestCRMakeChainsRenameOp(t *testing.T) {
	rmd := &RootMetadata{}

	currPtr := byte(42)
	rootPtrUnref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	rootPtrRef := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir1Unref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir1Ref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir2Unref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir2Ref := BlockPointer{ID: fakeBlockID(currPtr)}

	expectedChains := make(map[BlockPointer]BlockPointer)
	expectedChains[rootPtrUnref] = rootPtrRef
	expectedChains[dir1Unref] = dir1Ref
	expectedChains[dir2Unref] = dir2Ref

	rmd.data.Dir.BlockPointer = rootPtrRef

	oldName, newName := "old", "new"
	ro := newRenameOp(oldName, dir1Unref, newName, dir2Unref)
	for unref, ref := range expectedChains {
		ro.AddUpdate(unref, ref)
	}
	rmd.AddOp(ro)

	heads, tails, root, err := crMakeChains([]*RootMetadata{rmd})
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}
	checkExpectedChains(t, expectedChains, heads, tails)
	if root != rootPtrUnref {
		t.Fatalf("Root pointer incorrect, %v vs %v", root, rootPtrUnref)
	}

	// check for the create op
	dir2 := heads[dir2Unref]
	co, ok := dir2.op.(*createOp)
	if !ok {
		t.Fatalf("No create op at %v", dir2Unref)
	}
	if co.NewName != newName || co.Dir.Unref != dir2Unref || !co.renamed {
		t.Fatalf("Bad create op after rename: %v", co)
	}

	dir1 := heads[dir1Unref]
	rmo, ok := dir1.op.(*rmOp)
	if !ok {
		t.Fatalf("No rm op at %v", dir1Unref)
	}
	if rmo.OldName != oldName || rmo.Dir.Unref != dir1Unref {
		t.Fatalf("Bad rm op after rename: %v", rmo)
	}
}

// Test multiple operations, both in one MD and across multiple MDs
func TestCRMakeChainsMultiOps(t *testing.T) {
	// To start, we have: root/dir1/dir2/file1 and root/dir3/file2
	// Sequence of operations:
	// * setex root/dir3/file2
	// * createfile root/dir1/file3
	// * rename root/dir3/file2 root/dir1/file4
	// * write root/dir1/file4
	// * rm root/dir1/dir2/file1

	f1 := "file1"
	f2 := "file2"
	f3 := "file3"
	f4 := "file4"

	currPtr := byte(42)
	rootPtrUnref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir1Unref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir2Unref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir3Unref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++

	bigRmd := &RootMetadata{}
	var multiRmds []*RootMetadata

	// setex root/dir3/file2
	rootPtrRef := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir3Ref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	op1 := newSetAttrOp(f2, dir3Unref, exAttr)
	op1.AddUpdate(rootPtrUnref, rootPtrRef)
	op1.AddUpdate(dir3Unref, dir3Ref)
	bigRmd.AddOp(op1)
	newRmd := &RootMetadata{}
	newRmd.AddOp(op1)
	newRmd.data.Dir.BlockPointer = rootPtrRef
	multiRmds = append(multiRmds, newRmd)

	// createfile root/dir1/file3
	rootPtrRef2 := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir1Ref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	op2 := newCreateOp(f3, dir1Unref, File)
	op2.AddUpdate(rootPtrRef, rootPtrRef2)
	op2.AddUpdate(dir1Unref, dir1Ref)
	bigRmd.AddOp(op2)
	newRmd = &RootMetadata{}
	newRmd.AddOp(op2)
	newRmd.data.Dir.BlockPointer = rootPtrRef2
	multiRmds = append(multiRmds, newRmd)

	// rename root/dir3/file2 root/dir1/file4
	rootPtrRef3 := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir3Ref2 := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir1Ref2 := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	op3 := newRenameOp(f2, dir3Ref, f4, dir1Ref)
	op3.AddUpdate(rootPtrRef2, rootPtrRef3)
	op3.AddUpdate(dir3Ref, dir3Ref2)
	op3.AddUpdate(dir1Ref, dir1Ref2)
	bigRmd.AddOp(op3)
	newRmd = &RootMetadata{}
	newRmd.AddOp(op3)
	newRmd.data.Dir.BlockPointer = rootPtrRef3
	multiRmds = append(multiRmds, newRmd)

	// write root/dir1/file4
	rootPtrRef4 := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir1Ref3 := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	file4Unref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	file4Ref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	op4 := newSyncOp(file4Unref)
	op4.AddUpdate(rootPtrRef3, rootPtrRef4)
	op4.AddUpdate(dir1Ref2, dir1Ref3)
	op4.AddUpdate(file4Unref, file4Ref)
	bigRmd.AddOp(op4)
	newRmd = &RootMetadata{}
	newRmd.AddOp(op4)
	newRmd.data.Dir.BlockPointer = rootPtrRef4
	multiRmds = append(multiRmds, newRmd)

	// rm root/dir1/dir2/file1
	rootPtrRef5 := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir1Ref4 := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	dir2Ref := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	op5 := newRmOp(f1, dir2Unref)
	op5.AddUpdate(rootPtrRef4, rootPtrRef5)
	op5.AddUpdate(dir1Ref3, dir1Ref4)
	op5.AddUpdate(dir2Unref, dir2Ref)
	bigRmd.AddOp(op5)
	newRmd = &RootMetadata{}
	newRmd.AddOp(op5)
	newRmd.data.Dir.BlockPointer = rootPtrRef5
	multiRmds = append(multiRmds, newRmd)

	expectedChains := make(map[BlockPointer]BlockPointer)
	expectedChains[rootPtrUnref] = rootPtrRef5
	expectedChains[dir1Unref] = dir1Ref4
	expectedChains[dir2Unref] = dir2Ref
	expectedChains[dir3Unref] = dir3Ref2
	expectedChains[file4Unref] = file4Ref

	bigRmd.data.Dir.BlockPointer = rootPtrRef5
	heads, tails, root, err := crMakeChains([]*RootMetadata{bigRmd})
	if err != nil {
		t.Fatalf("Error making chains for big RMD: %v", err)
	}
	checkExpectedChains(t, expectedChains, heads, tails)
	if root != rootPtrUnref {
		t.Fatalf("Root pointer incorrect for big RMD, %v vs %v",
			root, rootPtrUnref)
	}

	// root should have no direct ops
	if node := heads[rootPtrUnref]; node.op != nil || node.nextOp != nil {
		t.Fatalf("Unexpected root operation at %v", rootPtrUnref)
	}

	// dir1 should have two creates (one of which is a rename)
	dir1Head := heads[dir1Unref]
	if dir1Head.op != op2 || dir1Head.nextOp == nil {
		t.Fatalf("Unexpected dir1 head: %v", dir1Head)
	}
	dir1Next := dir1Head.nextOp
	if co, ok := dir1Next.op.(*createOp); !ok ||
		co.NewName != f4 || !co.renamed {
		t.Fatalf("Unexpected dir1 op: %v", dir1Next.op)
	}

	// dir2 should have one rm op
	dir2Head := heads[dir2Unref]
	if dir2Head.op != op5 || dir2Head.nextOp != nil {
		t.Fatalf("Unexpected dir2 head: %v", dir2Head)
	}

	// dir3 should have a setex and the rm part of a rename
	dir3Head := heads[dir3Unref]
	if dir3Head.op != op1 || dir3Head.nextOp == nil {
		t.Fatalf("Unexpected dir3 head: %v", dir3Head)
	}
	dir3Next := dir3Head.nextOp
	if ro, ok := dir3Next.op.(*rmOp); !ok || ro.OldName != f2 {
		t.Fatalf("Unexpected dir3 op: %v", dir3Next.op)
	}

	// file4 should have one op
	file4Head := heads[file4Unref]
	if file4Head.op != op4 {
		t.Fatalf("Unexpected file 4 op: %v", file4Head.op)
	}

	// now make sure the chain of MDs gets the same answers
	mHeads, mTails, mRoot, err := crMakeChains(multiRmds)
	if err != nil {
		t.Fatalf("Error making chains for multi RMDs: %v", err)
	}
	if !reflect.DeepEqual(heads, mHeads) {
		t.Fatalf("Heads for multi RMDs does not match heads for big RMD: %v",
			mHeads)
	}
	if !reflect.DeepEqual(tails, mTails) {
		t.Fatalf("Tails for multi RMDs does not match tails for big RMD: %v",
			mTails)
	}
	if mRoot != rootPtrUnref {
		t.Fatalf("Root pointer incorrect for multi RMDs, %v vs %v",
			mRoot, rootPtrUnref)
	}
}
