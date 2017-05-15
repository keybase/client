// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"reflect"
	"testing"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
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
		ptr := BlockPointer{ID: kbfsblock.FakeID(currPtr)}
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
		newPtr := BlockPointer{ID: kbfsblock.FakeID(currPtr)}
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

func newChainMDForTest(t *testing.T) rootMetadataWithKeyAndTimestamp {
	tlfID := tlf.FakeID(1, false)

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	nug := testNormalizedUsernameGetter{
		uid: "fake_user",
	}

	ctx := context.Background()
	h, err := MakeTlfHandle(ctx, bh, nug)
	require.NoError(t, err)

	rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, tlfID, h)
	require.NoError(t, err)
	rmd.SetLastModifyingWriter(uid)
	key := kbfscrypto.MakeFakeVerifyingKeyOrBust("fake key")
	return rootMetadataWithKeyAndTimestamp{
		rmd, key, time.Unix(0, 0),
	}
}

func makeChainCodec() kbfscodec.Codec {
	codec := kbfscodec.NewMsgpack()
	RegisterOps(codec)
	return codec
}

func TestCRChainsSingleOp(t *testing.T) {
	chainMD := newChainMDForTest(t)

	currPtr, ptrs, revPtrs := testCRInitPtrs(3)
	rootPtrUnref := ptrs[0]
	dir1Unref := ptrs[1]
	dir2Unref := ptrs[2]
	expected := make(map[BlockPointer]BlockPointer)

	co, err := newCreateOp("new", dir2Unref, File)
	require.NoError(t, err)
	_ = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir1Unref, dir2Unref}, co)
	chainMD.AddOp(co)
	chainMD.data.Dir.BlockPointer = expected[rootPtrUnref]

	chainMDs := []chainMetadata{chainMD}
	cc, err := newCRChains(
		context.Background(), makeChainCodec(), chainMDs, nil, true)
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}
	checkExpectedChains(t, expected, make(map[BlockPointer]renameInfo),
		rootPtrUnref, cc, true)

	// check for the create op
	testCRCheckOps(t, cc, dir2Unref, []op{co})
}

func TestCRChainsRenameOp(t *testing.T) {
	chainMD := newChainMDForTest(t)

	currPtr, ptrs, revPtrs := testCRInitPtrs(3)
	rootPtrUnref := ptrs[0]
	dir1Unref := ptrs[1]
	dir2Unref := ptrs[2]
	filePtr := BlockPointer{ID: kbfsblock.FakeID(currPtr)}
	currPtr++
	expected := make(map[BlockPointer]BlockPointer)
	expectedRenames := make(map[BlockPointer]renameInfo)

	oldName, newName := "old", "new"
	ro, err := newRenameOp(oldName, dir1Unref, newName, dir2Unref, filePtr, File)
	require.NoError(t, err)
	expectedRenames[filePtr] = renameInfo{dir1Unref, "old", dir2Unref, "new"}
	_ = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir1Unref, dir2Unref}, ro)
	chainMD.AddOp(ro)
	chainMD.data.Dir.BlockPointer = expected[rootPtrUnref]

	chainMDs := []chainMetadata{chainMD}
	cc, err := newCRChains(
		context.Background(), makeChainCodec(), chainMDs, nil, true)
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

func testCRChainsMultiOps(t *testing.T) ([]chainMetadata, BlockPointer) {
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
	file2Ptr := BlockPointer{ID: kbfsblock.FakeID(currPtr)}
	currPtr++
	expected := make(map[BlockPointer]BlockPointer)
	expectedRenames := make(map[BlockPointer]renameInfo)

	bigChainMD := newChainMDForTest(t)
	var multiChainMDs []chainMetadata

	// setex root/dir3/file2
	op1, err := newSetAttrOp(f2, dir3Unref, exAttr, file2Ptr)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir3Unref}, op1)
	expected[file2Ptr] = file2Ptr // no update to the file ptr
	bigChainMD.AddOp(op1)
	newChainMD := newChainMDForTest(t)
	newChainMD.AddOp(op1)
	newChainMD.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiChainMDs = append(multiChainMDs, newChainMD)

	// createfile root/dir1/file3
	op2, err := newCreateOp(f3, dir1Unref, File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], dir1Unref}, op2)
	bigChainMD.AddOp(op2)
	newChainMD = newChainMDForTest(t)
	newChainMD.AddOp(op2)
	newChainMD.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiChainMDs = append(multiChainMDs, newChainMD)

	// rename root/dir3/file2 root/dir1/file4
	op3, err := newRenameOp(f2, expected[dir3Unref], f4,
		expected[dir1Unref], file2Ptr, File)
	require.NoError(t, err)
	expectedRenames[file2Ptr] = renameInfo{dir3Unref, f2, dir1Unref, f4}
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref],
			expected[dir3Unref]}, op3)
	bigChainMD.AddOp(op3)
	newChainMD = newChainMDForTest(t)
	newChainMD.AddOp(op3)
	newChainMD.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiChainMDs = append(multiChainMDs, newChainMD)

	// write root/dir1/file4
	op4, err := newSyncOp(file4Unref)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref], file4Unref},
		op4)
	bigChainMD.AddOp(op4)
	newChainMD = newChainMDForTest(t)
	newChainMD.AddOp(op4)
	newChainMD.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiChainMDs = append(multiChainMDs, newChainMD)

	// rm root/dir1/dir2/file1
	op5, err := newRmOp(f1, dir2Unref)
	require.NoError(t, err)
	_ = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref], dir2Unref},
		op5)
	bigChainMD.AddOp(op5)
	newChainMD = newChainMDForTest(t)
	newChainMD.AddOp(op5)
	newChainMD.data.Dir.BlockPointer = expected[rootPtrUnref]
	multiChainMDs = append(multiChainMDs, newChainMD)

	bigChainMD.data.Dir.BlockPointer = expected[rootPtrUnref]
	chainMDs := []chainMetadata{bigChainMD}
	cc, err := newCRChains(
		context.Background(), makeChainCodec(), chainMDs, nil, true)
	if err != nil {
		t.Fatalf("Error making chains for big chainMD: %v", err)
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
	mcc, err := newCRChains(
		context.Background(), makeChainCodec(), multiChainMDs, nil, true)
	if err != nil {
		t.Fatalf("Error making chains for multi chainMDs: %v", err)
	}
	if !reflect.DeepEqual(cc.byOriginal, mcc.byOriginal) {
		t.Fatalf("Heads for multi chainMDs does not match original for big chainMD: %v",
			mcc.byOriginal)
	}
	if !reflect.DeepEqual(cc.byMostRecent, mcc.byMostRecent) {
		t.Fatalf("Tails for multi chainMDs does not match most recents for "+
			"big chainMD: %v", mcc.byMostRecent)
	}
	if mcc.originalRoot != rootPtrUnref {
		t.Fatalf("Root pointer incorrect for multi chainMDs, %v vs %v",
			mcc.originalRoot, rootPtrUnref)
	}
	return multiChainMDs, file4Unref
}

// Test multiple operations, both in one MD and across multiple MDs
func TestCRChainsMultiOps(t *testing.T) {
	testCRChainsMultiOps(t)
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
	file1Ptr := BlockPointer{ID: kbfsblock.FakeID(currPtr)}
	currPtr++
	file4Ptr := BlockPointer{ID: kbfsblock.FakeID(currPtr)}
	currPtr++
	expected := make(map[BlockPointer]BlockPointer)
	expectedRenames := make(map[BlockPointer]renameInfo)

	chainMD := newChainMDForTest(t)

	// createfile root/dir1/file2
	op1, err := newCreateOp(f2, dir1Unref, File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{rootPtrUnref, dir1Unref}, op1)
	chainMD.AddOp(op1)

	// setex root/dir2/file1
	op2, err := newSetAttrOp(f1, dir2Unref, exAttr, file1Ptr)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], dir2Unref}, op2)
	expected[file1Ptr] = file1Ptr
	chainMD.AddOp(op2)

	// createfile root/dir1/file3
	op3, err := newCreateOp(f3, expected[dir1Unref], File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op3)
	chainMD.AddOp(op3)

	// createfile root/dir1/file4
	op4, err := newCreateOp(f4, expected[dir1Unref], File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op4)
	chainMD.AddOp(op4)

	// rm root/dir1/file2
	op5, err := newRmOp(f2, expected[dir1Unref])
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op5)
	chainMD.AddOp(op5)

	// rename root/dir2/file1 root/dir1/file3
	op6, err := newRenameOp(f1, expected[dir2Unref], f3, expected[dir1Unref],
		file1Ptr, File)
	require.NoError(t, err)
	expectedRenames[file1Ptr] = renameInfo{dir2Unref, f1, dir1Unref, f3}
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref],
			expected[dir2Unref]}, op6)
	chainMD.AddOp(op6)

	// rm root/dir1/file3
	op7, err := newRmOp(f3, expected[dir1Unref])
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op7)
	chainMD.AddOp(op7)

	// rename root/dir1/file4 root/dir1/file5
	op8, err := newRenameOp(f4, expected[dir1Unref], f5, expected[dir1Unref],
		file4Ptr, File)
	require.NoError(t, err)
	currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op8)
	chainMD.AddOp(op8)

	// rename root/dir1/file5 root/dir1/file3
	op9, err := newRenameOp(f5, expected[dir1Unref], f3, expected[dir1Unref],
		file4Ptr, File)
	require.NoError(t, err)
	// expected the previous old name, not the new one
	expectedRenames[file4Ptr] = renameInfo{dir1Unref, f4, dir1Unref, f3}
	_ = testCRFillOpPtrs(currPtr, expected, revPtrs,
		[]BlockPointer{expected[rootPtrUnref], expected[dir1Unref]}, op9)
	chainMD.AddOp(op9)

	chainMD.data.Dir.BlockPointer = expected[rootPtrUnref]
	chainMDs := []chainMetadata{chainMD}
	cc, err := newCRChains(
		context.Background(), makeChainCodec(), chainMDs, nil, true)
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

func TestCRChainsRemove(t *testing.T) {
	chainMDs, writtenFileUnref := testCRChainsMultiOps(t)

	for i := range chainMDs {
		chainMDs[i].(rootMetadataWithKeyAndTimestamp).RootMetadata.SetRevision(
			kbfsmd.Revision(i))
	}

	ccs, err := newCRChains(
		context.Background(), makeChainCodec(), chainMDs, nil, true)
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}

	// This should remove the write operation.
	removedChains := ccs.remove(context.Background(),
		logger.NewTestLogger(t), chainMDs[3].Revision())
	require.Len(t, removedChains, 1)
	require.Equal(t, removedChains[0].original, writtenFileUnref)
	require.Len(t, removedChains[0].ops, 0)
}

func TestCRChainsCollapsedSyncOps(t *testing.T) {
	chainMD := newChainMDForTest(t)

	currPtr, ptrs, revPtrs := testCRInitPtrs(3)
	rootPtrUnref := ptrs[0]
	file1Unref := ptrs[1]
	file2Unref := ptrs[2]
	expected := make(map[BlockPointer]BlockPointer)

	// Alternate contiguous writes between two files
	currOff := uint64(0)
	writeLen := uint64(10)
	numWrites := uint64(3)
	expected[rootPtrUnref] = rootPtrUnref
	expected[file1Unref] = file1Unref
	expected[file2Unref] = file2Unref

	var so1, so2 *syncOp
	var err error
	for i := uint64(0); i < numWrites; i++ {
		so1, err = newSyncOp(expected[file1Unref])
		require.NoError(t, err)
		so1.Writes = append(so1.Writes, WriteRange{Off: currOff, Len: writeLen})
		currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
			[]BlockPointer{expected[rootPtrUnref], expected[file1Unref]}, so1)
		chainMD.AddOp(so1)
		chainMD.data.Dir.BlockPointer = expected[rootPtrUnref]

		so2, err = newSyncOp(expected[file2Unref])
		require.NoError(t, err)
		so2.Writes = append(so2.Writes, WriteRange{Off: currOff, Len: writeLen})
		currPtr = testCRFillOpPtrs(currPtr, expected, revPtrs,
			[]BlockPointer{expected[rootPtrUnref], expected[file2Unref]}, so2)
		chainMD.AddOp(so2)
		chainMD.data.Dir.BlockPointer = expected[rootPtrUnref]

		currOff += writeLen
	}

	chainMDs := []chainMetadata{chainMD}
	cc, err := newCRChains(
		context.Background(), makeChainCodec(), chainMDs, nil, true)
	if err != nil {
		t.Fatalf("Error making chains: %v", err)
	}
	checkExpectedChains(t, expected, make(map[BlockPointer]renameInfo),
		rootPtrUnref, cc, true)

	// newCRChains copies the ops, so modifying them now is ok.
	so1.Writes = []WriteRange{{Off: 0, Len: writeLen * numWrites}}
	so2.Writes = []WriteRange{{Off: 0, Len: writeLen * numWrites}}

	// Check for the collapsed syncOps.
	testCRCheckOps(t, cc, file1Unref, []op{so1})
	testCRCheckOps(t, cc, file2Unref, []op{so2})
}
