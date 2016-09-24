// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"reflect"
	"testing"
	"time"

	"github.com/keybase/kbfs/kbfscodec"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

func checkExpectedChains(t *testing.T, expected map[BlockPointer]BlockPointer,
	expectedRenames map[BlockPointer]renameInfo, expectedRoot BlockPointer,
	cc *crChains, checkTailPtr bool) {
	if g, e := len(cc.byOriginal), len(expected); g != e {
		t.Errorf("Wrong number of originals, %v vs %v", g, e)
	}

	if g, e := len(cc.byMostRecent), len(expected); g != e {
		t.Errorf("Wrong number of most recents, %v vs %v", g, e)
	}

	if g, e := len(cc.renamedOriginals), len(expectedRenames); g != e {
		t.Errorf("Wrong number of renames, %v vs %v", g, e)
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

	if !reflect.DeepEqual(cc.renamedOriginals, expectedRenames) {
		t.Errorf("Actual renames don't match the expected renames: %v vs %v",
			cc.renamedOriginals, expectedRenames)
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
		t.Fatalf("Wrong number of operations: %d vs %d: %v", g, e, chain.ops)
	}

	codec := kbfscodec.NewMsgpack()
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
		} else {
			ok, err := kbfscodec.Equal(codec, op, eOp)
			if err != nil {
				t.Fatalf("Couldn't compare ops: %v", err)
			}
			if !ok {
				t.Errorf("Unexpected op %v at %v[%d]; expected %v", op,
					original, i, eOp)
			}
		}

	}
}

func testCRChainsFillInWriter(t *testing.T, rmds []*RootMetadata) (
	Config, []ImmutableRootMetadata) {
	config := MakeTestConfigOrBust(t, "u1")
	kbpki := config.KBPKI()
	_, uid, err := kbpki.GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatalf("Couldn't get UID: %v", err)
	}
	immutableRmds := make([]ImmutableRootMetadata, len(rmds))
	for i, rmd := range rmds {
		rmd.SetLastModifyingWriter(uid)
		rmd.SetTlfID(FakeTlfID(1, false))
		immutableRmds[i] = MakeImmutableRootMetadata(rmd,
			fakeMdID(1), time.Unix(0, 0))
	}
	return config, immutableRmds
}

func TestCRChainsSingleOp(t *testing.T) {
	rmd := NewRootMetadata()

	currPtr, ptrs, revPtrs := testCRInitPtrs(3)
	rootPtrUnref := ptrs[0]
	dir1Unref := ptrs[1]
	dir2Unref := ptrs[2]
	expected := make(map[BlockPointer]BlockPointer)

	co, err := newCreateOp("new", dir2Unref, File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir1Unref, dir2Unref}, co)
	rmd.AddOp(co)
	rmd.data.Dir.BlockPointer = expected[rootPtrUnref]

	rmds := []*RootMetadata{rmd}
	config, irmds := testCRChainsFillInWriter(t, rmds)
	defer config.Shutdown()
	cc, err := newCRChains(context.Background(), config, irmds, nil, true)
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}
	checkExpectedChains(t, expected, make(map[BlockPointer]renameInfo),
		rootPtrUnref, cc, true)

	// check for the create op
	testCRCheckOps(t, cc, dir2Unref, []op{co})
}

func TestCRChainsRenameOp(t *testing.T) {
	rmd := NewRootMetadata()

	currPtr, ptrs, revPtrs := testCRInitPtrs(3)
	rootPtrUnref := ptrs[0]
	dir1Unref := ptrs[1]
	dir2Unref := ptrs[2]
	filePtr := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	expected := make(map[BlockPointer]BlockPointer)
	expectedRenames := make(map[BlockPointer]renameInfo)

	oldName, newName := "old", "new"
	ro, err := newRenameOp(oldName, dir1Unref, newName, dir2Unref, filePtr, File)
	require.NoError(t, err)
	expectedRenames[filePtr] = renameInfo{dir1Unref, "old", dir2Unref, "new"}
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir1Unref, dir2Unref}, ro)
	rmd.AddOp(ro)
	rmd.data.Dir.BlockPointer = expected[rootPtrUnref]

	rmds := []*RootMetadata{rmd}
	config, irmds := testCRChainsFillInWriter(t, rmds)
	defer config.Shutdown()
	cc, err := newCRChains(context.Background(), config, irmds, nil, true)
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}

	checkExpectedChains(t, expected, expectedRenames, rootPtrUnref, cc, true)

	co, err := newCreateOp(newName, dir2Unref, File)
	require.NoError(t, err)
	co.renamed = true
	testCRCheckOps(t, cc, dir2Unref, []op{co})
	rmo, err := newRmOp(oldName, dir1Unref)
	require.NoError(t, err)
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
	file2Ptr := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	expected := make(map[BlockPointer]BlockPointer)
	expectedRenames := make(map[BlockPointer]renameInfo)

	bigRmd := NewRootMetadata()
	var multiRmds []*RootMetadata

	// setex root/dir3/file2
	op1, err := newSetAttrOp(f2, dir3Unref, exAttr, file2Ptr)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir3Unref}, op1)
	expected[file2Ptr] = file2Ptr // no update to the file ptr
	bigRmd.AddOp(op1)
	newRmd := NewRootMetadata()
	newRmd.AddOp(op1)
	newRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiRmds = append(multiRmds, newRmd)

	// createfile root/dir1/file3
	op2, err := newCreateOp(f3, dir1Unref, File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], dir1Unref}, op2)
	bigRmd.AddOp(op2)
	newRmd = NewRootMetadata()
	newRmd.AddOp(op2)
	newRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiRmds = append(multiRmds, newRmd)

	// rename root/dir3/file2 root/dir1/file4
	op3, err := newRenameOp(f2, expected[dir3Unref], f4,
		expected[dir1Unref], file2Ptr, File)
	require.NoError(t, err)
	expectedRenames[file2Ptr] = renameInfo{dir3Unref, f2, dir1Unref, f4}
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref],
			expected[dir3Unref]}, op3)
	bigRmd.AddOp(op3)
	newRmd = NewRootMetadata()
	newRmd.AddOp(op3)
	newRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiRmds = append(multiRmds, newRmd)

	// write root/dir1/file4
	op4, err := newSyncOp(file4Unref)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref], file4Unref},
		op4)
	bigRmd.AddOp(op4)
	newRmd = NewRootMetadata()
	newRmd.AddOp(op4)
	newRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiRmds = append(multiRmds, newRmd)

	// rm root/dir1/dir2/file1
	op5, err := newRmOp(f1, dir2Unref)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref], dir2Unref},
		op5)
	bigRmd.AddOp(op5)
	newRmd = NewRootMetadata()
	newRmd.AddOp(op5)
	newRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiRmds = append(multiRmds, newRmd)

	bigRmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	rmds := []*RootMetadata{bigRmd}
	config, irmds := testCRChainsFillInWriter(t, rmds)
	defer config.Shutdown()
	cc, err := newCRChains(context.Background(), config, irmds, nil, true)
	if err != nil {
		t.Fatalf("Error making chains for big RMD: %v", err)
	}
	checkExpectedChains(t, expected, expectedRenames, rootPtrUnref, cc, true)

	// root should have no direct ops
	testCRCheckOps(t, cc, rootPtrUnref, []op{})

	// dir1 should have two creates (one of which is a rename)
	co1, err := newCreateOp(f4, op3.NewDir.Unref, File)
	require.NoError(t, err)
	co1.renamed = true
	testCRCheckOps(t, cc, dir1Unref, []op{op2, co1})

	// dir2 should have one rm op
	testCRCheckOps(t, cc, dir2Unref, []op{op5})

	// dir3 should have the rm part of a rename
	ro3, err := newRmOp(f2, op3.OldDir.Unref)
	require.NoError(t, err)
	testCRCheckOps(t, cc, dir3Unref, []op{ro3})

	// file2 should have the setattr
	testCRCheckOps(t, cc, file2Ptr, []op{op1})

	// file4 should have one op
	testCRCheckOps(t, cc, file4Unref, []op{op4})

	// now make sure the chain of MDs gets the same answers
	config, multiIrmds := testCRChainsFillInWriter(t, multiRmds)
	defer config.Shutdown()
	mcc, err := newCRChains(context.Background(), config, multiIrmds, nil, true)
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
	// * rename root/dir1/file4 root/dir1/file5
	// * rename root/dir1/file5 root/dir1/file3

	f1 := "file1"
	f2 := "file2"
	f3 := "file3"
	f4 := "file4"
	f5 := "file5"

	currPtr, ptrs, revPtrs := testCRInitPtrs(3)
	rootPtrUnref := ptrs[0]
	dir1Unref := ptrs[1]
	dir2Unref := ptrs[2]
	file1Ptr := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	file4Ptr := BlockPointer{ID: fakeBlockID(currPtr)}
	currPtr++
	expected := make(map[BlockPointer]BlockPointer)
	expectedRenames := make(map[BlockPointer]renameInfo)

	rmd := NewRootMetadata()

	// createfile root/dir1/file2
	op1, err := newCreateOp(f2, dir1Unref, File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir1Unref}, op1)
	rmd.AddOp(op1)

	// setex root/dir2/file1
	op2, err := newSetAttrOp(f1, dir2Unref, exAttr, file1Ptr)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], dir2Unref}, op2)
	expected[file1Ptr] = file1Ptr
	rmd.AddOp(op2)

	// createfile root/dir1/file3
	op3, err := newCreateOp(f3, expected[dir1Unref], File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op3)
	rmd.AddOp(op3)

	// createfile root/dir1/file4
	op4, err := newCreateOp(f4, expected[dir1Unref], File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op4)
	rmd.AddOp(op4)

	// rm root/dir1/file2
	op5, err := newRmOp(f2, expected[dir1Unref])
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op5)
	rmd.AddOp(op5)

	// rename root/dir2/file1 root/dir1/file3
	op6, err := newRenameOp(f1, expected[dir2Unref], f3, expected[dir1Unref],
		file1Ptr, File)
	require.NoError(t, err)
	expectedRenames[file1Ptr] = renameInfo{dir2Unref, f1, dir1Unref, f3}
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref],
			expected[dir2Unref]}, op6)
	rmd.AddOp(op6)

	// rm root/dir1/file3
	op7, err := newRmOp(f3, expected[dir1Unref])
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op7)
	rmd.AddOp(op7)

	// rename root/dir1/file4 root/dir1/file5
	op8, err := newRenameOp(f4, expected[dir1Unref], f5, expected[dir1Unref],
		file4Ptr, File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op8)
	rmd.AddOp(op8)

	// rename root/dir1/file5 root/dir1/file3
	op9, err := newRenameOp(f5, expected[dir1Unref], f3, expected[dir1Unref],
		file4Ptr, File)
	require.NoError(t, err)
	// expected the previous old name, not the new one
	expectedRenames[file4Ptr] = renameInfo{dir1Unref, f4, dir1Unref, f3}
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op9)
	rmd.AddOp(op9)

	rmd.data.Dir.BlockPointer = expected[rootPtrUnref]
	rmds := []*RootMetadata{rmd}
	config, irmds := testCRChainsFillInWriter(t, rmds)
	defer config.Shutdown()
	cc, err := newCRChains(context.Background(), config, irmds, nil, true)
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}
	checkExpectedChains(t, expected, expectedRenames, rootPtrUnref, cc,
		false /*tail ref pointer won't match due to collapsing*/)

	// root should have no direct ops
	testCRCheckOps(t, cc, rootPtrUnref, []op{})

	// dir1 should only have one createOp (the final rename)
	co1, err := newCreateOp(f3, op9.OldDir.Unref, File)
	require.NoError(t, err)
	co1.renamed = true
	testCRCheckOps(t, cc, dir1Unref, []op{co1})

	// dir2 should have the rm part of a rename
	ro2, err := newRmOp(f1, op6.OldDir.Unref)
	require.NoError(t, err)
	testCRCheckOps(t, cc, dir2Unref, []op{ro2})

	// file1 should have the setattr
	testCRCheckOps(t, cc, file1Ptr, []op{op2})
}
