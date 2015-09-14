package libkbfs

import (
	"reflect"
	"testing"
)

func checkExpectedChains(t *testing.T, expected map[BlockPointer]BlockPointer,
	expectedRoot BlockPointer, cc *crChains) {
	if g, e := len(cc.heads), len(expected); g != e {
		t.Errorf("Wrong number of heads, %v vs %v", g, e)
	}

	if g, e := len(cc.tails), len(expected); g != e {
		t.Errorf("Wrong number of tails, %v vs %v", g, e)
	}

	if g, e := len(cc.tailHeads), len(expected); g != e {
		t.Errorf("Wrong number of tail heads, %v vs %v", g, e)
	}

	if cc.root != expectedRoot {
		t.Fatalf("Root pointer incorrect for multi RMDs, %v vs %v",
			cc.root, expectedRoot)
	}

	for head, tail := range expected {
		currNode, ok := cc.heads[head]
		if !ok {
			t.Fatalf("No head for %v", head)
		}

		for currNode.nextOp != nil {
			currNode = currNode.nextOp
		}

		if currNode.refPtr != tail {
			t.Fatalf("Chain for %v does not end in %v", head, tail)
		}

		tailNode, ok := cc.tails[tail]
		if !ok {
			t.Fatalf("No tail for %v", tail)
		}

		if tailNode != currNode {
			t.Fatalf("Chain from %v does not end in tail %v", head, tail)
		}

		if cc.tailHeads[tail] != head {
			t.Fatalf("Wrong head %v for tail %v", head, tail)
		}
	}
}

func testCRInitPtrs(n int) (currPtr byte, ptrs []BlockPointer,
	revPtrs map[BlockPointer]BlockPointer) {
	currPtr = byte(42)
	revPtrs = make(map[BlockPointer]BlockPointer)
	for i := 0; i < n; i++ {
		ptr := BlockPointer{ID: fakeBlockID(currPtr)}
		currPtr++
		ptrs = append(ptrs, ptr)
		revPtrs[ptr] = ptr
	}
	return currPtr, ptrs, revPtrs
}

func testCRFillOpPtrs(currPtr byte,
	expected map[BlockPointer]BlockPointer,
	revPtrs map[BlockPointer]BlockPointer,
	affectedPtrs []BlockPointer, op op) (nextCurrPtr byte) {
	for _, ptr := range affectedPtrs {
		newPtr := BlockPointer{ID: fakeBlockID(currPtr)}
		currPtr++
		op.AddUpdate(ptr, newPtr)
		expected[revPtrs[ptr]] = newPtr
		revPtrs[newPtr] = revPtrs[ptr]
	}
	return currPtr
}

func TestCRChainsSingleOp(t *testing.T) {
	rmd := &RootMetadata{}

	currPtr, ptrs, revPtrs := testCRInitPtrs(3)
	rootPtrUnref := ptrs[0]
	dir1Unref := ptrs[1]
	dir2Unref := ptrs[2]
	expected := make(map[BlockPointer]BlockPointer)

	co := newCreateOp("new", dir2Unref, File)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir1Unref, dir2Unref}, co)
	rmd.AddOp(co)
	rmd.data.Dir.BlockPointer = expected[rootPtrUnref]

	cc, err := newCRChains([]*RootMetadata{rmd})
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}
	checkExpectedChains(t, expected, rootPtrUnref, cc)

	// check for the create op
	dir2 := cc.heads[dir2Unref]
	dir2Op, ok := dir2.op.(*createOp)
	if !ok {
		t.Fatalf("No create op at %v", dir2Unref)
	}
	if dir2Op != co {
		t.Fatalf("Bad create op: %v", dir2Op)
	}
}

func TestCRChainsRenameOp(t *testing.T) {
	rmd := &RootMetadata{}

	currPtr, ptrs, revPtrs := testCRInitPtrs(3)
	rootPtrUnref := ptrs[0]
	dir1Unref := ptrs[1]
	dir2Unref := ptrs[2]
	expected := make(map[BlockPointer]BlockPointer)

	oldName, newName := "old", "new"
	ro := newRenameOp(oldName, dir1Unref, newName, dir2Unref)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir1Unref, dir2Unref}, ro)
	rmd.AddOp(ro)
	rmd.data.Dir.BlockPointer = expected[rootPtrUnref]

	cc, err := newCRChains([]*RootMetadata{rmd})
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}
	checkExpectedChains(t, expected, rootPtrUnref, cc)

	// check for the create op
	dir2 := cc.heads[dir2Unref]
	co, ok := dir2.op.(*createOp)
	if !ok {
		t.Fatalf("No create op at %v", dir2Unref)
	}
	if co.NewName != newName || co.Dir.Unref != dir2Unref || !co.renamed {
		t.Fatalf("Bad create op after rename: %v", co)
	}

	dir1 := cc.heads[dir1Unref]
	rmo, ok := dir1.op.(*rmOp)
	if !ok {
		t.Fatalf("No rm op at %v", dir1Unref)
	}
	if rmo.OldName != oldName || rmo.Dir.Unref != dir1Unref {
		t.Fatalf("Bad rm op after rename: %v", rmo)
	}
}

// Test multiple operations, both in one MD and across multiple MDs
func TestCRChainsMultiOps(t *testing.T) {
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

	currPtr, ptrs, revPtrs := testCRInitPtrs(5)
	rootPtrUnref := ptrs[0]
	dir1Unref := ptrs[1]
	dir2Unref := ptrs[2]
	dir3Unref := ptrs[3]
	file4Unref := ptrs[4]
	expected := make(map[BlockPointer]BlockPointer)

	bigRmd := &RootMetadata{}
	var multiRmds []*RootMetadata

	// setex root/dir3/file2
	op1 := newSetAttrOp(f2, dir3Unref, exAttr)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir3Unref}, op1)
	bigRmd.AddOp(op1)
	newRmd := &RootMetadata{}
	newRmd.AddOp(op1)
	newRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiRmds = append(multiRmds, newRmd)

	// createfile root/dir1/file3
	op2 := newCreateOp(f3, dir1Unref, File)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], dir1Unref}, op2)
	bigRmd.AddOp(op2)
	newRmd = &RootMetadata{}
	newRmd.AddOp(op2)
	newRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiRmds = append(multiRmds, newRmd)

	// rename root/dir3/file2 root/dir1/file4
	op3 := newRenameOp(f2, expected[dir3Unref], f4,
		expected[dir1Unref])
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref],
			expected[dir3Unref]}, op3)
	bigRmd.AddOp(op3)
	newRmd = &RootMetadata{}
	newRmd.AddOp(op3)
	newRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiRmds = append(multiRmds, newRmd)

	// write root/dir1/file4
	op4 := newSyncOp(file4Unref)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref], file4Unref},
		op4)
	bigRmd.AddOp(op4)
	newRmd = &RootMetadata{}
	newRmd.AddOp(op4)
	newRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiRmds = append(multiRmds, newRmd)

	// rm root/dir1/dir2/file1
	op5 := newRmOp(f1, dir2Unref)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref], dir2Unref},
		op5)
	bigRmd.AddOp(op5)
	newRmd = &RootMetadata{}
	newRmd.AddOp(op5)
	newRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiRmds = append(multiRmds, newRmd)

	bigRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	cc, err := newCRChains([]*RootMetadata{bigRmd})
	if err != nil {
		t.Fatalf("Error making chains for big RMD: %v", err)
	}
	checkExpectedChains(t, expected, rootPtrUnref, cc)

	// root should have no direct ops
	if node := cc.heads[rootPtrUnref]; node.op != nil || node.nextOp != nil {
		t.Fatalf("Unexpected root operation at %v", rootPtrUnref)
	}

	// dir1 should have two creates (one of which is a rename)
	dir1Head := cc.heads[dir1Unref]
	if dir1Head.op != op2 || dir1Head.nextOp == nil {
		t.Fatalf("Unexpected dir1 head: %v", dir1Head)
	}
	dir1Next := dir1Head.nextOp
	if co, ok := dir1Next.op.(*createOp); !ok ||
		co.NewName != f4 || !co.renamed {
		t.Fatalf("Unexpected dir1 op: %v", dir1Next.op)
	}

	// dir2 should have one rm op
	dir2Head := cc.heads[dir2Unref]
	if dir2Head.op != op5 || dir2Head.nextOp != nil {
		t.Fatalf("Unexpected dir2 head: %v", dir2Head)
	}

	// dir3 should have a setex and the rm part of a rename
	dir3Head := cc.heads[dir3Unref]
	if dir3Head.op != op1 || dir3Head.nextOp == nil {
		t.Fatalf("Unexpected dir3 head: %v", dir3Head)
	}
	dir3Next := dir3Head.nextOp
	if ro, ok := dir3Next.op.(*rmOp); !ok || ro.OldName != f2 {
		t.Fatalf("Unexpected dir3 op: %v", dir3Next.op)
	}

	// file4 should have one op
	file4Head := cc.heads[file4Unref]
	if file4Head.op != op4 {
		t.Fatalf("Unexpected file 4 op: %v", file4Head.op)
	}

	// now make sure the chain of MDs gets the same answers
	mcc, err := newCRChains(multiRmds)
	if err != nil {
		t.Fatalf("Error making chains for multi RMDs: %v", err)
	}
	if !reflect.DeepEqual(cc.heads, mcc.heads) {
		t.Fatalf("Heads for multi RMDs does not match heads for big RMD: %v",
			mcc.heads)
	}
	if !reflect.DeepEqual(cc.tails, mcc.tails) {
		t.Fatalf("Tails for multi RMDs does not match tails for big RMD: %v",
			mcc.tails)
	}
	if mcc.root != rootPtrUnref {
		t.Fatalf("Root pointer incorrect for multi RMDs, %v vs %v",
			mcc.root, rootPtrUnref)
	}
}
