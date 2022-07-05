// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"bytes"
	"fmt"
	"math"
	"reflect"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/libkey"
	libkeytest "github.com/keybase/client/go/kbfs/libkey/test"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func setupFileDataTest(t *testing.T, maxBlockSize int64,
	maxPtrsPerBlock int) (*FileData, BlockCache, DirtyBlockCache, *DirtyFile) {
	// Make a fake file.
	ptr := BlockPointer{
		ID:         kbfsblock.FakeID(42),
		DirectType: DirectBlock,
	}
	id := tlf.FakeID(1, tlf.Private)
	file := Path{
		FolderBranch{Tlf: id},
		[]PathNode{{ptr, NewPathPartString("file", nil)}},
		nil,
	}
	chargedTo := keybase1.MakeTestUID(1).AsUserOrTeam()
	bsplit := &BlockSplitterSimple{maxBlockSize, maxPtrsPerBlock, 10, 0}
	kmd := libkeytest.NewEmptyKeyMetadata(id, 1)

	cleanCache := NewBlockCacheStandard(1<<10, 1<<20)
	dirtyBcache := SimpleDirtyBlockCacheStandard()
	getter := func(ctx context.Context, _ libkey.KeyMetadata, ptr BlockPointer,
		_ Path, _ BlockReqType) (*FileBlock, bool, error) {
		isDirty := true
		block, err := dirtyBcache.Get(ctx, id, ptr, MasterBranch)
		if err != nil {
			// Check the clean cache.
			block, err = cleanCache.Get(ptr)
			if err != nil {
				return nil, false, err
			}
			isDirty = false
		}
		fblock, ok := block.(*FileBlock)
		if !ok {
			return nil, false,
				fmt.Errorf("Block for %s is not a file block", ptr)
		}
		return fblock, isDirty, nil
	}
	cacher := func(ctx context.Context, ptr BlockPointer, block Block) error {
		return dirtyBcache.Put(ctx, id, ptr, MasterBranch, block)
	}

	log := logger.NewTestLogger(t)
	fd := NewFileData(
		file, chargedTo, bsplit, kmd, getter, cacher, log,
		libkb.NewVDebugLog(log))
	df := NewDirtyFile(file, dirtyBcache)
	return fd, cleanCache, dirtyBcache, df
}

type testFileDataLevel struct {
	dirty    bool
	children []testFileDataLevel
	off      Int64Offset
	size     int
}

type testFileDataHole struct {
	start Int64Offset
	end   Int64Offset
}

func testFileDataLevelFromData(t *testing.T, maxBlockSize Int64Offset,
	maxPtrsPerBlock int, existingLevels int, fullDataLen Int64Offset,
	holes []testFileDataHole, startWrite, endWrite,
	holeShiftAfter Int64Offset, truncateExtend bool) testFileDataLevel {
	// First fill in the leaf level.
	var prevChildren []testFileDataLevel
	var off Int64Offset
	size := 0
	nextHole := 0
	for off < fullDataLen {
		var nextOff Int64Offset
		size = int(maxBlockSize)
		makeFinalHole := false
		switch {
		case nextHole < len(holes) && off+maxBlockSize >= holes[nextHole].start:
			size = int(holes[nextHole].start - off)
			nextOff = holes[nextHole].end
			nextHole++
			makeFinalHole = nextHole >= len(holes) &&
				nextOff >= fullDataLen
		case off+maxBlockSize > fullDataLen:
			size = int(fullDataLen - off)
			nextOff = fullDataLen
		default:
			nextOff = off + maxBlockSize
		}
		dirty := off < endWrite && startWrite < off+Int64Offset(size)
		// If this is a shrink, dirty the block containing startWrite.
		if endWrite < 0 {
			dirty = nextOff >= startWrite
		}
		newChild := testFileDataLevel{dirty, nil, off, size}
		t.Logf("Expected leaf offset %d [dirty=%t]", off, dirty)
		prevChildren = append(prevChildren, newChild)

		if makeFinalHole {
			// The final hole can only ever be dirty if there was a
			// truncate to a new length.
			newChild := testFileDataLevel{truncateExtend, nil, nextOff, 0}
			t.Logf("Expected leaf offset %d (final)", nextOff)
			prevChildren = append(prevChildren, newChild)
		}

		off = nextOff
	}
	if fullDataLen == 0 {
		// Special case for a file that's been left empty.
		newChild := testFileDataLevel{true, nil, 0, 0}
		prevChildren = append(prevChildren, newChild)
	}

	// Now fill in any parents.  If this is a shrink, force the new
	// data to have the same number of levels (we never remove levels
	// of indirection at the moment).
	newLevels := 1
	for len(prevChildren) != 1 || (endWrite < 0 && newLevels < existingLevels) {
		prevChildIndex := 0
		var level []testFileDataLevel

		numAtLevel := int(math.Ceil(float64(len(prevChildren)) /
			float64(maxPtrsPerBlock)))
		for i := 0; i < numAtLevel; i++ {
			// Split the previous children up (if any) into
			// maxPtrsPerBlock chunks.
			var children []testFileDataLevel
			var off Int64Offset
			newIndex := prevChildIndex + maxPtrsPerBlock
			if newIndex > len(prevChildren) {
				newIndex = len(prevChildren)
			}
			off = prevChildren[prevChildIndex].off
			children = prevChildren[prevChildIndex:newIndex]
			prevChildIndex = newIndex
			dirty := false
			for _, child := range children {
				// A parent is dirty if it has a dirty child.
				if child.dirty {
					dirty = true
					break
				}
			}
			// Also if a new block was made in a hole, any indirect
			// parent that comes after the end of the write will be
			// dirty, due to hole shifting.
			if holeShiftAfter > 0 && off >= holeShiftAfter {
				dirty = true
				// If this is the bottom-most parent block after a
				// hole shift, its rightmost child will also be marked
				// dirty.
				if newLevels == 1 {
					children[len(children)-1].dirty = true
				}
			}
			newChild := testFileDataLevel{dirty, children, off, 0}
			level = append(level, newChild)
		}
		prevChildren = level
		newLevels++
	}

	// Even in a shrink, the top block is always dirty.
	currNode := &(prevChildren[0])
	if endWrite < 0 {
		currNode.dirty = true
	}

	// If we added new levels, we can expect the old topmost block to
	// be dirty, since we have to upload it with a new block ID.
	for i := 0; i <= newLevels-existingLevels; i++ {
		t.Logf("Dirtying level %d %d %d", i, newLevels, existingLevels)
		currNode.dirty = true
		if len(currNode.children) == 0 {
			break
		}
		currNode = &(currNode.children[0])
	}

	return prevChildren[0]
}

func (tfdl testFileDataLevel) check(t *testing.T, fd *FileData,
	ptr BlockPointer, off Int64Offset, dirtyBcache DirtyBlockCache) (
	dirtyPtrs map[BlockPointer]bool) {
	dirtyPtrs = make(map[BlockPointer]bool)
	levelString := fmt.Sprintf("ptr=%s, off=%d", ptr, off)
	t.Logf("Checking %s", levelString)

	require.Equal(t, tfdl.off, off, levelString)
	if tfdl.dirty {
		dirtyPtrs[ptr] = true
		require.True(
			t, dirtyBcache.IsDirty(fd.tree.file.Tlf, ptr, MasterBranch),
			levelString)
	}

	fblock, isDirty, err := fd.getter(nil, nil, ptr, Path{}, BlockRead)
	require.NoError(t, err, levelString)
	require.Equal(t, tfdl.dirty, isDirty, levelString)
	require.NotNil(t, fblock, levelString)

	// We expect this to be a leaf block.
	if len(tfdl.children) == 0 {
		require.False(t, fblock.IsInd, levelString)
		require.Len(t, fblock.IPtrs, 0, levelString)
		require.Len(t, fblock.Contents, tfdl.size, levelString)
		return dirtyPtrs
	}

	// Otherwise it's indirect, so check all the children.
	require.True(t, fblock.IsInd, levelString)
	require.Len(t, fblock.IPtrs, len(tfdl.children), levelString)
	require.Len(t, fblock.Contents, 0, levelString)
	for i, iptr := range fblock.IPtrs {
		childDirtyPtrs := tfdl.children[i].check(
			t, fd, iptr.BlockPointer, iptr.Off, dirtyBcache)
		for ptr := range childDirtyPtrs {
			dirtyPtrs[ptr] = true
		}
	}
	return dirtyPtrs
}

func testFileDataCheckWrite(t *testing.T, fd *FileData,
	dirtyBcache DirtyBlockCache, df *DirtyFile, data []byte, off Int64Offset,
	topBlock *FileBlock, oldDe DirEntry, expectedSize uint64,
	expectedUnrefs []BlockInfo, expectedDirtiedBytes int64,
	expectedBytesExtended int64, expectedTopLevel testFileDataLevel) {
	// Do the write.
	ctx := context.Background()
	newDe, dirtyPtrs, unrefs, newlyDirtiedChildBytes, bytesExtended, err :=
		fd.Write(ctx, data, off, topBlock, oldDe, df)
	require.NoError(t, err)

	// Check the basics.
	require.Equal(t, expectedSize, newDe.Size)
	require.Equal(t, expectedDirtiedBytes, newlyDirtiedChildBytes)
	require.Equal(t, expectedBytesExtended, bytesExtended)

	// Go through each expected level and make sure we have the right
	// set of dirty pointers and children.
	expectedDirtyPtrs := expectedTopLevel.check(
		t, fd, fd.rootBlockPointer(), 0, dirtyBcache)
	dirtyPtrsMap := make(map[BlockPointer]bool)
	for _, ptr := range dirtyPtrs {
		dirtyPtrsMap[ptr] = true
	}
	require.True(t, reflect.DeepEqual(expectedDirtyPtrs, dirtyPtrsMap),
		fmt.Sprintf("expected %v; got %v", expectedDirtyPtrs, dirtyPtrsMap))

	// TODO: set the EncodedSize of the existing blocks to something
	// non-zero so that we get some unrefs.
	require.Len(t, unrefs, 0)
}

func testFileDataWriteExtendEmptyFile(t *testing.T, maxBlockSize Int64Offset,
	maxPtrsPerBlock int, fullDataLen Int64Offset) {
	fd, cleanBcache, dirtyBcache, df := setupFileDataTest(
		t, int64(maxBlockSize), maxPtrsPerBlock)
	topBlock := NewFileBlock().(*FileBlock)
	err := cleanBcache.Put(
		fd.rootBlockPointer(), fd.tree.file.Tlf, topBlock, TransientEntry,
		SkipCacheHash)
	require.NoError(t, err)
	de := DirEntry{}
	data := make([]byte, fullDataLen)
	for i := 0; i < int(fullDataLen); i++ {
		data[i] = byte(i)
	}
	expectedTopLevel := testFileDataLevelFromData(
		t, maxBlockSize, maxPtrsPerBlock, 0, fullDataLen, nil, 0,
		fullDataLen, 0, false)

	testFileDataCheckWrite(
		t, fd, dirtyBcache, df, data, 0, topBlock, de, uint64(fullDataLen),
		nil, int64(fullDataLen), int64(fullDataLen), expectedTopLevel)

	// Make sure we can read back the complete data.
	gotData := make([]byte, fullDataLen)
	nRead, err := fd.Read(context.Background(), gotData, 0)
	require.NoError(t, err)
	require.Equal(t, Int64Offset(nRead), fullDataLen)
	require.True(t, bytes.Equal(data, gotData))
}

func testFileDataWriteNewLevel(t *testing.T, levels float64) {
	capacity := math.Pow(2, levels)
	halfCapacity := capacity/2 + 1
	if levels == 1 {
		halfCapacity = capacity - 1
	}
	// Fills half the leaf level.
	testFileDataWriteExtendEmptyFile(t, 2, 2, Int64Offset(halfCapacity))
	// Fills whole leaf level.
	testFileDataWriteExtendEmptyFile(t, 2, 2, Int64Offset(capacity))

}

func TestFileDataWriteNewLevel(t *testing.T) {
	for _, level := range []float64{1, 2, 3, 10} {
		// capture range variable.
		level := level
		t.Run(fmt.Sprintf("%dLevels", int(level)), func(t *testing.T) {
			testFileDataWriteNewLevel(t, level)
		})
	}
}

func testFileDataLevelExistingBlocks(t *testing.T, fd *FileData,
	maxBlockSize Int64Offset, maxPtrsPerBlock int, existingData []byte,
	holes []testFileDataHole, cleanBcache BlockCache) (*FileBlock, int) {
	// First fill in the leaf blocks.
	var off Int64Offset
	existingDataLen := Int64Offset(len(existingData))
	var prevChildren []*FileBlock
	var leafOffs []Int64Offset
	nextHole := 0
	for off < existingDataLen {
		endOff := off + maxBlockSize
		var nextOff Int64Offset
		makeFinalHole := false
		switch {
		case nextHole < len(holes) && endOff > holes[nextHole].start:
			endOff = holes[nextHole].start
			nextOff = holes[nextHole].end
			nextHole++
			makeFinalHole = nextHole >= len(holes) &&
				nextOff >= existingDataLen
		case endOff > existingDataLen:
			endOff = existingDataLen
			nextOff = existingDataLen
		default:
			nextOff = endOff
		}

		fblock := NewFileBlock().(*FileBlock)
		fblock.Contents = existingData[off:endOff]
		prevChildren = append(prevChildren, fblock)
		t.Logf("Initial leaf offset %d, size %d", off, len(fblock.Contents))
		leafOffs = append(leafOffs, off)

		if makeFinalHole {
			fblock := NewFileBlock().(*FileBlock)
			prevChildren = append(prevChildren, fblock)
			t.Logf("Initial leaf offset %d (final)", nextOff)
			leafOffs = append(leafOffs, nextOff)
		}

		off = nextOff
	}

	// Now fill in any parents.
	numLevels := 1
	for len(prevChildren) != 1 {
		prevChildIndex := 0
		var level []*FileBlock
		numAtLevel := int(math.Ceil(float64(len(prevChildren)) /
			float64(maxPtrsPerBlock)))
		for i := 0; i < numAtLevel; i++ {
			// Split the previous children up (if any) into maxPtrsPerBlock
			// chunks.
			var children []*FileBlock
			newIndex := prevChildIndex + maxPtrsPerBlock
			if newIndex > len(prevChildren) {
				newIndex = len(prevChildren)
			}
			children = prevChildren[prevChildIndex:newIndex]
			fblock := NewFileBlock().(*FileBlock)
			fblock.IsInd = true
			dt := DirectBlock
			if numLevels > 1 {
				dt = IndirectBlock
			}
			for j, child := range children {
				id, err := kbfsblock.MakeTemporaryID()
				require.NoError(t, err)
				ptr := BlockPointer{
					ID:         id,
					DirectType: dt,
				}
				var off Int64Offset
				if child.IsInd {
					off = child.IPtrs[0].Off
				} else {
					off = leafOffs[prevChildIndex+j]
				}

				fblock.IPtrs = append(fblock.IPtrs, IndirectFilePtr{
					BlockInfo: BlockInfo{ptr, 0},
					Off:       off,
				})
				err = cleanBcache.Put(
					ptr, fd.tree.file.Tlf, child, TransientEntry, SkipCacheHash)
				require.NoError(t, err)
			}
			prevChildIndex = newIndex
			level = append(level, fblock)
		}
		prevChildren = level
		numLevels++
	}

	if numLevels > 1 {
		fd.tree.file.Path[len(fd.tree.file.Path)-1].DirectType = IndirectBlock
	}

	err := cleanBcache.Put(
		fd.rootBlockPointer(), fd.tree.file.Tlf, prevChildren[0],
		TransientEntry, SkipCacheHash)
	require.NoError(t, err)
	return prevChildren[0], numLevels
}

func testFileDataWriteExtendExistingFile(t *testing.T, maxBlockSize Int64Offset,
	maxPtrsPerBlock int, existingLen, fullDataLen Int64Offset) {
	fd, cleanBcache, dirtyBcache, df := setupFileDataTest(
		t, int64(maxBlockSize), maxPtrsPerBlock)
	data := make([]byte, fullDataLen)
	for i := 0; i < int(fullDataLen); i++ {
		data[i] = byte(i)
	}
	topBlock, levels := testFileDataLevelExistingBlocks(
		t, fd, maxBlockSize, maxPtrsPerBlock, data[:existingLen], nil,
		cleanBcache)
	de := DirEntry{
		EntryInfo: EntryInfo{
			Size: uint64(existingLen),
		},
	}
	expectedTopLevel := testFileDataLevelFromData(
		t, maxBlockSize, maxPtrsPerBlock, levels, fullDataLen, nil, existingLen,
		fullDataLen, 0, false)

	extendedBytes := fullDataLen - existingLen
	// Round up to find out the number of dirty bytes.
	remainder := extendedBytes % maxBlockSize
	dirtiedBytes := extendedBytes
	if remainder > 0 {
		dirtiedBytes += (maxBlockSize - remainder)
	}
	// Add a block's worth of dirty bytes if we're extending past the
	// first full level, because the original block still gets dirtied
	// because it needs to be inserted under a new ID.
	if existingLen == maxBlockSize {
		dirtiedBytes += maxBlockSize
	}
	testFileDataCheckWrite(
		t, fd, dirtyBcache, df, data[existingLen:], existingLen,
		topBlock, de, uint64(fullDataLen),
		nil, int64(dirtiedBytes), int64(extendedBytes), expectedTopLevel)

	// Make sure we can read back the complete data.
	gotData := make([]byte, fullDataLen)
	nRead, err := fd.Read(context.Background(), gotData, 0)
	require.NoError(t, err)
	require.Equal(t, nRead, int64(fullDataLen))
	require.True(t, bytes.Equal(data, gotData))
}

func testFileDataExtendExistingLevels(t *testing.T, levels float64) {
	capacity := math.Pow(2, levels)
	halfCapacity := capacity / 2
	// Starts with one lower level and adds a level.
	testFileDataWriteExtendExistingFile(
		t, 2, 2, Int64Offset(halfCapacity), Int64Offset(capacity))
}

func TestFileDataExtendExistingLevels(t *testing.T) {
	for _, level := range []float64{1, 2, 3, 10} {
		// capture range variable.
		level := level
		t.Run(fmt.Sprintf("%dLevels", int(level)), func(t *testing.T) {
			testFileDataExtendExistingLevels(t, level)
		})
	}
}

func testFileDataOverwriteExistingFile(t *testing.T, maxBlockSize Int64Offset,
	maxPtrsPerBlock int, fullDataLen Int64Offset, holes []testFileDataHole,
	startWrite, endWrite Int64Offset, finalHoles []testFileDataHole) {
	fd, cleanBcache, dirtyBcache, df := setupFileDataTest(
		t, int64(maxBlockSize), maxPtrsPerBlock)
	data := make([]byte, fullDataLen)
	for i := 0; i < int(fullDataLen); i++ {
		data[i] = byte(i)
	}
	holeShiftAfter := Int64Offset(0)
	effectiveStartWrite := startWrite
	for _, hole := range holes {
		for i := hole.start; i < hole.end; i++ {
			data[i] = byte(0)
			if holeShiftAfter == 0 && startWrite <= i && i < endWrite {
				holeShiftAfter = i
				// If we're writing in a hole, we might extend the
				// block on its left edge to its block boundary,
				// which means that's effectively the start of the
				// write.
				effectiveStartWrite = hole.start
			}
		}
	}
	topBlock, levels := testFileDataLevelExistingBlocks(
		t, fd, maxBlockSize, maxPtrsPerBlock, data, holes, cleanBcache)
	de := DirEntry{
		EntryInfo: EntryInfo{
			Size: uint64(fullDataLen),
		},
	}

	t.Logf("holeShiftAfter=%d", holeShiftAfter)
	expectedTopLevel := testFileDataLevelFromData(
		t, maxBlockSize, maxPtrsPerBlock, levels, fullDataLen, finalHoles,
		effectiveStartWrite, endWrite, holeShiftAfter, false)

	// Round up to find out the number of dirty bytes.
	writtenBytes := endWrite - startWrite
	remainder := writtenBytes % maxBlockSize
	dirtiedBytes := writtenBytes
	if remainder > 0 {
		dirtiedBytes += (maxBlockSize - remainder)
	}
	// Capture extending an existing block to its block boundary when
	// writing in a hole.
	if effectiveStartWrite != startWrite &&
		effectiveStartWrite%maxBlockSize > 0 {
		dirtiedBytes += maxBlockSize
	}

	// The extended bytes are the size of the new blocks that were
	// added.  This isn't exactly right, but for now just pick the
	// start of the last hole and round it up to the next block.
	extendedBytes := Int64Offset(0)
	existingBytes := holes[len(holes)-1].start
	remainder = existingBytes % maxBlockSize
	if remainder > 0 {
		existingBytes += (maxBlockSize - remainder)
	}
	if endWrite > existingBytes {
		extendedBytes = endWrite - existingBytes
		// Also ignore any bytes that are still in the hole.
		if existingBytes < holeShiftAfter {
			extendedBytes -= holeShiftAfter - existingBytes
		}
	}

	newData := make([]byte, writtenBytes)
	for i := startWrite; i < endWrite; i++ {
		// The new data shifts each byte over by 1.
		newData[i-startWrite] = byte(i + 1)
	}
	testFileDataCheckWrite(
		t, fd, dirtyBcache, df, newData, startWrite,
		topBlock, de, uint64(fullDataLen),
		nil, int64(dirtiedBytes), int64(extendedBytes), expectedTopLevel)

	copy(data[startWrite:endWrite], newData)

	// Make sure we can read back the complete data.
	gotData := make([]byte, fullDataLen)
	nRead, err := fd.Read(context.Background(), gotData, 0)
	require.NoError(t, err)
	require.Equal(t, nRead, int64(fullDataLen))
	require.True(t, bytes.Equal(data, gotData))
}

func TestFileDataWriteHole(t *testing.T) {
	type test struct {
		name  string
		start Int64Offset
		end   Int64Offset
		final []testFileDataHole
	}

	tests := []test{
		{"Start", 5, 8, []testFileDataHole{{8, 10}}},
		// The first final hole starts at 6, instead of 5, because a write
		// extends the existing block.
		{"End", 8, 10, []testFileDataHole{{6, 8}, {10, 10}}},
		// The first final hole starts at 6, instead of 5, because a write
		// extends the existing block.
		{"Middle", 7, 9, []testFileDataHole{{6, 7}, {9, 10}}},
	}

	for _, test := range tests {
		// capture range variable.
		test := test
		t.Run(test.name, func(t *testing.T) {
			testFileDataOverwriteExistingFile(t, 2, 2, 10,
				[]testFileDataHole{{5, 10}}, test.start, test.end, test.final)
		})
	}
}

func testFileDataCheckTruncateExtend(t *testing.T, fd *FileData,
	dirtyBcache DirtyBlockCache, df *DirtyFile, size uint64,
	topBlock *FileBlock, oldDe DirEntry, expectedTopLevel testFileDataLevel) {
	// Do the extending truncate.
	ctx := context.Background()

	_, parentBlocks, _, _, _, _, err :=
		fd.GetFileBlockAtOffset(ctx, topBlock, Int64Offset(size), BlockWrite)
	require.NoError(t, err)

	newDe, dirtyPtrs, err := fd.TruncateExtend(
		ctx, size, topBlock, parentBlocks, oldDe, df)
	require.NoError(t, err)

	// Check the basics.
	require.Equal(t, size, newDe.Size)

	// Go through each expected level and make sure we have the right
	// set of dirty pointers and children.
	expectedDirtyPtrs := expectedTopLevel.check(
		t, fd, fd.rootBlockPointer(), 0, dirtyBcache)
	dirtyPtrsMap := make(map[BlockPointer]bool)
	for _, ptr := range dirtyPtrs {
		dirtyPtrsMap[ptr] = true
	}
	require.True(t, reflect.DeepEqual(expectedDirtyPtrs, dirtyPtrsMap),
		fmt.Sprintf("expected %v; got %v", expectedDirtyPtrs, dirtyPtrsMap))
}

func testFileDataTruncateExtendFile(t *testing.T, maxBlockSize Int64Offset,
	maxPtrsPerBlock int, currDataLen Int64Offset, newSize uint64,
	holes []testFileDataHole) {
	fd, cleanBcache, dirtyBcache, df := setupFileDataTest(
		t, int64(maxBlockSize), maxPtrsPerBlock)
	data := make([]byte, currDataLen)
	for i := 0; i < int(currDataLen); i++ {
		data[i] = byte(i)
	}
	for _, hole := range holes {
		for i := hole.start; i < hole.end; i++ {
			data[i] = byte(0)
		}
	}
	topBlock, levels := testFileDataLevelExistingBlocks(
		t, fd, maxBlockSize, maxPtrsPerBlock, data, holes, cleanBcache)
	de := DirEntry{
		EntryInfo: EntryInfo{
			Size: uint64(currDataLen),
		},
	}

	expectedTopLevel := testFileDataLevelFromData(
		t, maxBlockSize, maxPtrsPerBlock, levels, currDataLen,
		append(holes, testFileDataHole{currDataLen, Int64Offset(newSize)}),
		currDataLen, Int64Offset(newSize), 0, true)

	testFileDataCheckTruncateExtend(
		t, fd, dirtyBcache, df, newSize, topBlock, de, expectedTopLevel)

	newZeroes := make([]byte, Int64Offset(newSize)-currDataLen)
	data = append(data, newZeroes...)

	// Make sure we can read back the complete data.
	gotData := make([]byte, newSize)
	nRead, err := fd.Read(context.Background(), gotData, 0)
	require.NoError(t, err)
	require.Equal(t, nRead, int64(newSize))
	require.True(t, bytes.Equal(data, gotData))
}

func TestFileDataTruncateExtendLevel(t *testing.T) {
	type test struct {
		name    string
		currLen Int64Offset
		newSize uint64
	}

	tests := []test{
		{"Same", 5, 8},
		{"New", 3, 8},
	}

	for _, test := range tests {
		// capture range variable.
		test := test
		t.Run(test.name, func(t *testing.T) {
			testFileDataTruncateExtendFile(
				t, 2, 2, test.currLen, test.newSize, nil)
		})
	}
}

func testFileDataCheckTruncateShrink(t *testing.T, fd *FileData,
	dirtyBcache DirtyBlockCache, size uint64,
	topBlock *FileBlock, oldDe DirEntry, expectedUnrefs []BlockInfo,
	expectedDirtiedBytes int64, expectedTopLevel testFileDataLevel) {
	// Do the extending truncate.
	ctx := context.Background()

	newDe, dirtyPtrs, unrefs, newlyDirtiedChildBytes, err := fd.TruncateShrink(
		ctx, size, topBlock, oldDe)
	require.NoError(t, err)

	// Check the basics.
	require.Equal(t, size, newDe.Size)
	require.Equal(t, expectedDirtiedBytes, newlyDirtiedChildBytes)

	// Go through each expected level and make sure we have the right
	// set of dirty pointers and children.
	expectedDirtyPtrs := expectedTopLevel.check(
		t, fd, fd.rootBlockPointer(), 0, dirtyBcache)
	dirtyPtrsMap := make(map[BlockPointer]bool)
	for _, ptr := range dirtyPtrs {
		dirtyPtrsMap[ptr] = true
	}
	require.True(t, reflect.DeepEqual(expectedDirtyPtrs, dirtyPtrsMap),
		fmt.Sprintf("expected %v; got %v", expectedDirtyPtrs, dirtyPtrsMap))

	// TODO: set the EncodedSize of the existing blocks to something
	// non-zero so that we get some unrefs.
	require.Len(t, unrefs, 0)
}

func testFileDataShrinkExistingFile(t *testing.T, maxBlockSize Int64Offset,
	maxPtrsPerBlock int, existingLen int64, newSize uint64) {
	fd, cleanBcache, dirtyBcache, _ := setupFileDataTest(
		t, int64(maxBlockSize), maxPtrsPerBlock)
	data := make([]byte, existingLen)
	for i := 0; i < int(existingLen); i++ {
		data[i] = byte(i)
	}
	topBlock, levels := testFileDataLevelExistingBlocks(
		t, fd, maxBlockSize, maxPtrsPerBlock, data, nil, cleanBcache)
	de := DirEntry{
		EntryInfo: EntryInfo{
			Size: uint64(existingLen),
		},
	}
	expectedTopLevel := testFileDataLevelFromData(
		t, maxBlockSize, maxPtrsPerBlock, levels, Int64Offset(newSize), nil,
		Int64Offset(newSize),
		Int64Offset(int64(newSize)-existingLen), /*negative*/
		0, false)

	// Round up to find out the number of dirty bytes.
	dirtiedBytes := int64(newSize) % int64(maxBlockSize)
	testFileDataCheckTruncateShrink(
		t, fd, dirtyBcache, newSize, topBlock, de, nil, dirtiedBytes,
		expectedTopLevel)

	// Make sure we can read back the complete data.
	gotData := make([]byte, newSize)
	nRead, err := fd.Read(context.Background(), gotData, 0)
	require.NoError(t, err)
	require.Equal(t, nRead, int64(newSize))
	require.True(t, bytes.Equal(data[:newSize], gotData))
}

func TestFileDataTruncateShrink(t *testing.T) {
	type test struct {
		name    string
		currLen int64
		newSize uint64
	}

	tests := []test{
		{"WithinBlock", 6, 5},
		{"WithinLevel", 8, 5},
		{"ToZero", 8, 0},
	}

	for _, test := range tests {
		// capture range variable.
		test := test
		t.Run(test.name, func(t *testing.T) {
			testFileDataShrinkExistingFile(t, 2, 2, test.currLen, test.newSize)
		})
	}
}

func testFileDataWriteExtendExistingFileWithGap(t *testing.T,
	maxBlockSize Int64Offset, maxPtrsPerBlock int, existingLen,
	fullDataLen, startWrite Int64Offset, finalHoles []testFileDataHole) {
	fd, cleanBcache, dirtyBcache, df := setupFileDataTest(
		t, int64(maxBlockSize), maxPtrsPerBlock)
	data := make([]byte, fullDataLen)
	for i := Int64Offset(0); i < fullDataLen; i++ {
		if i < existingLen || i >= startWrite {
			data[i] = byte(i)
		}
	}
	topBlock, levels := testFileDataLevelExistingBlocks(
		t, fd, maxBlockSize, maxPtrsPerBlock, data[:existingLen], nil,
		cleanBcache)
	de := DirEntry{
		EntryInfo: EntryInfo{
			Size: uint64(existingLen),
		},
	}
	// The write starts at `existingLen`, instead of `startWrite`,
	// because we need to account for any bytes dirtied when extending
	// the block to the left of the gap.
	expectedTopLevel := testFileDataLevelFromData(
		t, maxBlockSize, maxPtrsPerBlock, levels, fullDataLen,
		finalHoles, existingLen, fullDataLen, 0, false)

	extendedBytes := fullDataLen - existingLen
	// Round up to find out the number of dirty bytes.
	dirtiedBytes := fullDataLen - startWrite
	remainder := dirtiedBytes % maxBlockSize
	if remainder > 0 {
		dirtiedBytes += (maxBlockSize - remainder)
	}
	// Dirty the current last block as well, if needed.
	if existingLen%maxBlockSize > 0 {
		dirtiedBytes += maxBlockSize
	}
	// Add a block's worth of dirty bytes if we're extending past the
	// first full level, because the original block still gets dirtied
	// because it needs to be inserted under a new ID.
	if existingLen == maxBlockSize {
		dirtiedBytes += maxBlockSize
	}
	testFileDataCheckWrite(
		t, fd, dirtyBcache, df, data[startWrite:], startWrite,
		topBlock, de, uint64(fullDataLen),
		nil, int64(dirtiedBytes), int64(extendedBytes), expectedTopLevel)

	// Make sure we can read back the complete data.
	gotData := make([]byte, fullDataLen)
	nRead, err := fd.Read(context.Background(), gotData, 0)
	require.NoError(t, err)
	require.Equal(t, nRead, int64(fullDataLen))
	require.True(t, bytes.Equal(data, gotData))
}

// Test that we can write past the end of the last block of a file,
// leaving a gap.  Regression tests for KBFS-1915.
func TestFileDataWriteExtendExistingFileWithGap(t *testing.T) {
	type test struct {
		name       string
		currLen    Int64Offset
		newSize    Int64Offset
		startWrite Int64Offset
		finalHoles []testFileDataHole
	}

	tests := []test{
		{"SwitchToIndirect", 1, 16, 10, []testFileDataHole{{2, 10}}},
		{"FullExistingBlock", 6, 16, 10, []testFileDataHole{{6, 10}}},
		{"FillExistingBlock", 5, 16, 10, []testFileDataHole{{6, 10}}},
	}

	for _, test := range tests {
		// capture range variable.
		test := test
		t.Run(test.name, func(t *testing.T) {
			testFileDataWriteExtendExistingFileWithGap(
				t, 2, 2, test.currLen, test.newSize, test.startWrite,
				test.finalHoles)
		})
	}
}
