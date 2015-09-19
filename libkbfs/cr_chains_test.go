package libkbfs

import (
	"reflect"
	"testing"
)

func checkExpectedChains(t *testing.T, expected map[BlockPointer]BlockPointer,
	expectedRoot BlockPointer, cc *crChains, checkTailPtr bool) {
	if g, e := len(cc.byOriginal), len(expected); g != e {
		t.Errorf("Wrong number of originals, %v vs %v", g, e)
	}

	if g, e := len(cc.byMostRecent), len(expected); g != e {
		t.Errorf("Wrong number of most recents, %v vs %v", g, e)
	}

	if cc.originalRoot != expectedRoot {
		t.Fatalf("Root pointer incorrect for multi RMDs, %v vs %v",
			cc.originalRoot, expectedRoot)
	}

	for original, mostRecent := range expected {
		chain, ok := cc.byOriginal[original]
		if !ok {
			t.Fatalf("No original for %v", original)
		}

		if checkTailPtr && chain.mostRecent != mostRecent {
			t.Fatalf("Chain for %v does not end in %v", original, mostRecent)
		}

		mrChain, ok := cc.byMostRecent[mostRecent]
		if !ok {
			t.Fatalf("No most recent for %v", mostRecent)
		}

		if chain != mrChain {
			t.Fatalf("Chain from %v does not end in most recent %v "+
				"(%v) vs. (%v)", original, mostRecent, chain, mrChain)
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

// If one of the ops is a rename, it doesn't check for exact equality
func testCRCheckOps(t *testing.T, cc *crChains, original BlockPointer,
	expectedOps []op) {
	chain, ok := cc.byOriginal[original]
	if !ok {
		t.Fatalf("No chain at %v", original)
	}

	if g, e := len(chain.ops), len(expectedOps); g != e {
		t.Fatalf("Wrong number of operations: %d vs %d", g, e)
	}

	for i, op := range chain.ops {
		eOp := expectedOps[i]
		// First check for rename create ops.
		if co, ok := op.(*createOp); ok && co.renamed {
			eCOp, ok := eOp.(*createOp)
			if !ok {
				t.Errorf("Expected op isn't a create for %v[%d]", original, i)
			}

			if co.NewName != eCOp.NewName || co.Dir.Unref != eCOp.Dir.Unref ||
				!eCOp.renamed {
				t.Errorf("Bad create op after rename: %v", co)
			}
		} else if ro, ok := op.(*rmOp); ok &&
			// We can tell the rm half of a rename because the updates
			// aren't initialized.
			len(ro.Updates) == 0 {
			eROp, ok := eOp.(*rmOp)
			if !ok {
				t.Errorf("Expected op isn't an rm for %v[%d]", original, i)
			}

			if ro.OldName != eROp.OldName || ro.Dir.Unref != eROp.Dir.Unref ||
				eROp.Dir.Ref.IsInitialized() {
				t.Errorf("Bad create op after rename: %v", ro)
			}
		} else if op != eOp {
			t.Errorf("Unexpected op %v at %v[%d]", op, original, i)
		}

	}
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
	checkExpectedChains(t, expected, rootPtrUnref, cc, true)

	// check for the create op
	testCRCheckOps(t, cc, dir2Unref, []op{co})
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
	checkExpectedChains(t, expected, rootPtrUnref, cc, true)

	co := newCreateOp(newName, dir2Unref, File)
	co.renamed = true
	testCRCheckOps(t, cc, dir2Unref, []op{co})
	rmo := newRmOp(oldName, dir1Unref)
	testCRCheckOps(t, cc, dir1Unref, []op{rmo})
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
	checkExpectedChains(t, expected, rootPtrUnref, cc, true)

	// root should have no direct ops
	testCRCheckOps(t, cc, rootPtrUnref, []op{})

	// dir1 should have two creates (one of which is a rename)
	co1 := newCreateOp(f4, op3.NewDir.Unref, File)
	co1.renamed = true
	testCRCheckOps(t, cc, dir1Unref, []op{op2, co1})

	// dir2 should have one rm op
	testCRCheckOps(t, cc, dir2Unref, []op{op5})

	// dir3 should have a setex and the rm part of a rename
	ro3 := newRmOp(f2, op3.OldDir.Unref)
	testCRCheckOps(t, cc, dir3Unref, []op{op1, ro3})

	// file4 should have one op
	testCRCheckOps(t, cc, file4Unref, []op{op4})

	// now make sure the chain of MDs gets the same answers
	mcc, err := newCRChains(multiRmds)
	if err != nil {
		t.Fatalf("Error making chains for multi RMDs: %v", err)
	}
	if !reflect.DeepEqual(cc.byOriginal, mcc.byOriginal) {
		t.Fatalf("Heads for multi RMDs does not match original for big RMD: %v",
			mcc.byOriginal)
	}
	if !reflect.DeepEqual(cc.byMostRecent, mcc.byMostRecent) {
		t.Fatalf("Tails for multi RMDs does not match most recents for "+
			"big RMD: %v", mcc.byMostRecent)
	}
	if mcc.originalRoot != rootPtrUnref {
		t.Fatalf("Root pointer incorrect for multi RMDs, %v vs %v",
			mcc.originalRoot, rootPtrUnref)
	}
}

// Test that we collapse chains correctly
func TestCRChainsCollapse(t *testing.T) {
	// To start, we have: root/dir1/ and root/dir2/file1
	// Sequence of operations:
	// * createfile root/dir1/file2
	// * setex root/dir2/file1
	// * createfile root/dir1/file3
	// * createfile root/dir1/file4
	// * rm root/dir1/file2
	// * rename root/dir2/file1 root/dir1/file3
	// * rm root/dir1/file3
	// * rename root/dir1/file4 root/dir1/file3

	f1 := "file1"
	f2 := "file2"
	f3 := "file3"
	f4 := "file4"

	currPtr, ptrs, revPtrs := testCRInitPtrs(3)
	rootPtrUnref := ptrs[0]
	dir1Unref := ptrs[1]
	dir2Unref := ptrs[2]
	expected := make(map[BlockPointer]BlockPointer)

	rmd := &RootMetadata{}

	// createfile root/dir1/file2
	op1 := newCreateOp(f2, dir1Unref, File)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir1Unref}, op1)
	rmd.AddOp(op1)

	// setex root/dir2/file1
	op2 := newSetAttrOp(f1, dir2Unref, exAttr)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], dir2Unref}, op2)
	rmd.AddOp(op2)

	// createfile root/dir1/file3
	op3 := newCreateOp(f3, expected[dir1Unref], File)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op3)
	rmd.AddOp(op3)

	// createfile root/dir1/file4
	op4 := newCreateOp(f4, expected[dir1Unref], File)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op4)
	rmd.AddOp(op4)

	// rm root/dir1/file2
	op5 := newRmOp(f2, expected[dir1Unref])
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op5)
	rmd.AddOp(op5)

	// rename root/dir2/file1 root/dir1/file3
	op6 := newRenameOp(f1, expected[dir2Unref], f3, expected[dir1Unref])
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref],
			expected[dir2Unref]}, op6)
	rmd.AddOp(op6)

	// rm root/dir1/file3
	op7 := newRmOp(f3, expected[dir1Unref])
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op7)
	rmd.AddOp(op7)

	// rename root/dir1/file4 root/dir1/file3
	op8 := newRenameOp(f4, expected[dir1Unref], f3, expected[dir1Unref])
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op8)
	rmd.AddOp(op8)

	rmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	cc, err := newCRChains([]*RootMetadata{rmd})
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}
	checkExpectedChains(t, expected, rootPtrUnref, cc,
		false /*tail ref pointer won't match due to collapsing*/)

	// root should have no direct ops
	testCRCheckOps(t, cc, rootPtrUnref, []op{})

	// dir1 should only have one createOp (the final rename)
	co1 := newCreateOp(f3, op8.OldDir.Unref, File)
	co1.renamed = true
	testCRCheckOps(t, cc, dir1Unref, []op{co1})

	// dir2 should have a setex and the rm part of a rename
	ro2 := newRmOp(f1, op6.OldDir.Unref)
	testCRCheckOps(t, cc, dir2Unref, []op{op2, ro2})
}
