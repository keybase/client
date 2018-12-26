// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"reflect"
	"strconv"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func setupDirDataTest(t *testing.T, maxPtrsPerBlock, numDirEntries int) (
	*dirData, BlockCache, DirtyBlockCache) {
	// Make a fake dir.
	ptr := BlockPointer{
		ID:         kbfsblock.FakeID(42),
		DirectType: DirectBlock,
	}
	id := tlf.FakeID(1, tlf.Private)
	dir := path{FolderBranch{Tlf: id}, []pathNode{{ptr, "dir"}}}
	chargedTo := keybase1.MakeTestUID(1).AsUserOrTeam()
	crypto := MakeCryptoCommon(kbfscodec.NewMsgpack(), makeBlockCryptV1())
	bsplit := &BlockSplitterSimple{10, maxPtrsPerBlock, 10, numDirEntries}
	kmd := emptyKeyMetadata{id, 1}

	cleanCache := NewBlockCacheStandard(1<<10, 1<<20)
	dirtyBcache := simpleDirtyBlockCacheStandard()
	getter := func(ctx context.Context, _ KeyMetadata, ptr BlockPointer,
		_ path, _ blockReqType) (*DirBlock, bool, error) {
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
		dblock, ok := block.(*DirBlock)
		if !ok {
			return nil, false,
				fmt.Errorf("Block for %s is not a dir block", ptr)
		}
		return dblock, isDirty, nil
	}
	cacher := func(ctx context.Context, ptr BlockPointer, block Block) error {
		return dirtyBcache.Put(ctx, id, ptr, MasterBranch, block)
	}

	dd := newDirData(
		dir, chargedTo, crypto, bsplit, kmd, getter, cacher,
		logger.NewTestLogger(t))
	return dd, cleanCache, dirtyBcache
}

func addFakeDirDataEntryToBlock(dblock *DirBlock, name string, size uint64) {
	dblock.Children[name] = DirEntry{
		EntryInfo: EntryInfo{
			Size: size,
		},
	}
}

func TestDirDataGetChildren(t *testing.T) {
	dd, cleanBcache, _ := setupDirDataTest(t, 2, 2)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry)

	t.Log("No entries, direct block")
	children, err := dd.getChildren(ctx)
	require.NoError(t, err)
	require.Len(t, children, 0)

	t.Log("Single entry, direct block")
	addFakeDirDataEntryToBlock(topBlock, "a", 1)
	children, err = dd.getChildren(ctx)
	require.NoError(t, err)
	require.Len(t, children, 1)
	require.Equal(t, uint64(1), children["a"].Size)

	t.Log("Two entries, direct block")
	addFakeDirDataEntryToBlock(topBlock, "b", 2)
	children, err = dd.getChildren(ctx)
	require.NoError(t, err)
	require.Len(t, children, 2)
	require.Equal(t, uint64(1), children["a"].Size)
	require.Equal(t, uint64(2), children["b"].Size)

	t.Log("Indirect blocks")
	dd.tree.file.path[len(dd.tree.file.path)-1].DirectType = IndirectBlock
	newTopBlock := NewDirBlock().(*DirBlock)
	newTopBlock.IsInd = true
	ptr1 := BlockPointer{
		ID:         kbfsblock.FakeID(43),
		DirectType: DirectBlock,
	}
	newTopBlock.IPtrs = append(newTopBlock.IPtrs, IndirectDirPtr{
		BlockInfo: BlockInfo{ptr1, 0},
		Off:       "",
	})
	ptr2 := BlockPointer{
		ID:         kbfsblock.FakeID(44),
		DirectType: DirectBlock,
	}
	newTopBlock.IPtrs = append(newTopBlock.IPtrs, IndirectDirPtr{
		BlockInfo: BlockInfo{ptr2, 0},
		Off:       "m",
	})
	block2 := NewDirBlock().(*DirBlock)
	addFakeDirDataEntryToBlock(block2, "z1", 3)
	addFakeDirDataEntryToBlock(block2, "z2", 4)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, newTopBlock, TransientEntry)
	cleanBcache.Put(ptr1, dd.tree.file.Tlf, topBlock, TransientEntry)
	cleanBcache.Put(ptr2, dd.tree.file.Tlf, block2, TransientEntry)
	children, err = dd.getChildren(ctx)
	require.NoError(t, err)
	require.Len(t, children, 4)
	require.Equal(t, uint64(1), children["a"].Size)
	require.Equal(t, uint64(2), children["b"].Size)
	require.Equal(t, uint64(3), children["z1"].Size)
	require.Equal(t, uint64(4), children["z2"].Size)

}

func testDirDataCheckLookup(
	t *testing.T, ctx context.Context, dd *dirData, name string, size uint64) {
	de, err := dd.lookup(ctx, name)
	require.NoError(t, err)
	require.Equal(t, size, de.Size)
}

func TestDirDataLookup(t *testing.T) {
	dd, cleanBcache, _ := setupDirDataTest(t, 2, 2)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry)

	t.Log("No entries, direct block")
	_, err := dd.lookup(ctx, "a")
	require.Equal(t, NoSuchNameError{"a"}, err)

	t.Log("Single entry, direct block")
	addFakeDirDataEntryToBlock(topBlock, "a", 1)
	testDirDataCheckLookup(t, ctx, dd, "a", 1)
	_, err = dd.lookup(ctx, "b")
	require.Equal(t, NoSuchNameError{"b"}, err)

	t.Log("Indirect blocks")
	addFakeDirDataEntryToBlock(topBlock, "b", 2)
	dd.tree.file.path[len(dd.tree.file.path)-1].DirectType = IndirectBlock
	newTopBlock := NewDirBlock().(*DirBlock)
	newTopBlock.IsInd = true
	ptr1 := BlockPointer{
		ID:         kbfsblock.FakeID(43),
		DirectType: DirectBlock,
	}
	newTopBlock.IPtrs = append(newTopBlock.IPtrs, IndirectDirPtr{
		BlockInfo: BlockInfo{ptr1, 0},
		Off:       "",
	})
	ptr2 := BlockPointer{
		ID:         kbfsblock.FakeID(44),
		DirectType: DirectBlock,
	}
	newTopBlock.IPtrs = append(newTopBlock.IPtrs, IndirectDirPtr{
		BlockInfo: BlockInfo{ptr2, 0},
		Off:       "m",
	})
	block2 := NewDirBlock().(*DirBlock)
	addFakeDirDataEntryToBlock(block2, "z1", 3)
	addFakeDirDataEntryToBlock(block2, "z2", 4)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, newTopBlock, TransientEntry)
	cleanBcache.Put(ptr1, dd.tree.file.Tlf, topBlock, TransientEntry)
	cleanBcache.Put(ptr2, dd.tree.file.Tlf, block2, TransientEntry)

	testDirDataCheckLookup(t, ctx, dd, "a", 1)
	testDirDataCheckLookup(t, ctx, dd, "b", 2)
	testDirDataCheckLookup(t, ctx, dd, "z1", 3)
	testDirDataCheckLookup(t, ctx, dd, "z2", 4)
}

func addFakeDirDataEntry(
	t *testing.T, ctx context.Context, dd *dirData, name string, size uint64) {
	_, err := dd.addEntry(ctx, name, DirEntry{
		EntryInfo: EntryInfo{
			Size: size,
		},
	})
	require.NoError(t, err)
}

type testDirDataLeaf struct {
	off        StringOffset
	numEntries int
	dirty      bool
}

func testDirDataCheckLeafs(
	t *testing.T, dd *dirData, cleanBcache BlockCache,
	dirtyBcache DirtyBlockCache, expectedLeafs []testDirDataLeaf,
	maxPtrsPerBlock, numDirEntries int) {
	// Top block should always be dirty.
	ctx := context.Background()
	cacheBlock, err := dirtyBcache.Get(
		ctx, dd.tree.file.Tlf, dd.tree.rootBlockPointer(), MasterBranch)
	require.NoError(t, err)
	topBlock := cacheBlock.(*DirBlock)
	require.True(t, topBlock.IsIndirect())

	dirtyBlocks := make(map[*DirBlock]bool)
	dirtyBlocks[topBlock] = true

	var leafs []testDirDataLeaf
	// Iterate and collect leafs.
	indBlocks := []*DirBlock{topBlock}
	for len(indBlocks) > 0 {
		var newIndBlocks []*DirBlock
		for i, iptr := range indBlocks[0].IPtrs {
			var nextOff *StringOffset
			if i+1 < len(indBlocks[0].IPtrs) {
				nextOff = &indBlocks[0].IPtrs[i+1].Off
			}

			cacheBlock, err = dirtyBcache.Get(
				ctx, dd.tree.file.Tlf, iptr.BlockPointer, MasterBranch)
			wasDirty := err == nil
			if wasDirty {
				dirtyBlocks[cacheBlock.(*DirBlock)] = true
				// Parent must have also been dirty.
				require.Contains(t, dirtyBlocks, indBlocks[0])
			} else {
				cacheBlock, err = cleanBcache.Get(iptr.BlockPointer)
				require.NoError(t, err)
			}
			dblock := cacheBlock.(*DirBlock)
			if dblock.IsIndirect() {
				require.True(t, len(dblock.IPtrs) <= maxPtrsPerBlock)
				// Make sure all the offsets are between the two
				// parent offsets.
				for _, childIPtr := range dblock.IPtrs {
					require.True(t, childIPtr.Off >= iptr.Off,
						fmt.Sprintf("Child off %s comes before iptr off %s",
							childIPtr.Off, iptr.Off))
					if nextOff != nil {
						require.True(t, childIPtr.Off < *nextOff,
							fmt.Sprintf("Child off %s comes after next off %s",
								childIPtr.Off, *nextOff))
					}
				}
				newIndBlocks = append(newIndBlocks, dblock)
			} else {
				require.True(t, len(dblock.Children) <= numDirEntries)
				// Make sure all the children are between the two
				// parent offsets.
				for name := range dblock.Children {
					require.True(t, name >= string(iptr.Off))
					if nextOff != nil {
						require.True(t, name < string(*nextOff))
					}
				}
				leafs = append(leafs, testDirDataLeaf{
					iptr.Off, len(dblock.Children), wasDirty})
			}
		}
		indBlocks = append(newIndBlocks, indBlocks[1:]...)
	}

	require.True(t, reflect.DeepEqual(leafs, expectedLeafs),
		fmt.Sprintf("leafs=%v, expectedLeafs=%v", leafs, expectedLeafs))
}

func testDirDataCleanCache(
	dd *dirData, cleanBCache BlockCache, dirtyBCache DirtyBlockCache) {
	dbc := dirtyBCache.(*DirtyBlockCacheStandard)
	for id, block := range dbc.cache {
		ptr := BlockPointer{ID: id.id}
		cleanBCache.Put(ptr, dd.tree.file.Tlf, block, TransientEntry)
	}
	dbc.cache = make(map[dirtyBlockID]Block)
}

func TestDirDataAddEntry(t *testing.T) {
	dd, cleanBcache, dirtyBcache := setupDirDataTest(t, 2, 2)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry)

	t.Log("Add first entry")
	addFakeDirDataEntry(t, ctx, dd, "a", 1)
	require.True(t, dirtyBcache.IsDirty(
		dd.tree.file.Tlf, dd.rootBlockPointer(), MasterBranch))
	require.Len(t, topBlock.Children, 1)

	t.Log("Force a split")
	addFakeDirDataEntry(t, ctx, dd, "b", 2)
	addFakeDirDataEntry(t, ctx, dd, "c", 3)
	expectedLeafs := []testDirDataLeaf{
		{"", 1, true},
		{"b", 2, true},
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)

	t.Log("Fill in the first block")
	addFakeDirDataEntry(t, ctx, dd, "a1", 4)
	expectedLeafs = []testDirDataLeaf{
		{"", 2, true},
		{"b", 2, true},
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)

	t.Log("Shift a block over")
	addFakeDirDataEntry(t, ctx, dd, "a2", 5)
	expectedLeafs = []testDirDataLeaf{
		{"", 1, true},
		{"a1", 2, true},
		{"b", 2, true},
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)

	t.Log("Clean up the cache and dirty just one leaf")
	testDirDataCleanCache(dd, cleanBcache, dirtyBcache)
	addFakeDirDataEntry(t, ctx, dd, "a0", 6)
	expectedLeafs = []testDirDataLeaf{
		{"", 2, true},
		{"a1", 2, false},
		{"b", 2, false},
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)

	t.Log("Expand a bunch more")
	addFakeDirDataEntry(t, ctx, dd, "a00", 7)
	addFakeDirDataEntry(t, ctx, dd, "b1", 8)
	addFakeDirDataEntry(t, ctx, dd, "d", 9)
	addFakeDirDataEntry(t, ctx, dd, "a000", 10)
	addFakeDirDataEntry(t, ctx, dd, "z", 11)
	addFakeDirDataEntry(t, ctx, dd, "q", 12)
	addFakeDirDataEntry(t, ctx, dd, "b2", 13)
	addFakeDirDataEntry(t, ctx, dd, " 1", 14)
	expectedLeafs = []testDirDataLeaf{
		{"", 2, true},    // " 1" and "a"
		{"a0", 1, true},  // "a0"
		{"a00", 2, true}, // "a00" and "a000"
		{"a1", 2, true},  // "a1" and "a2"
		{"b", 1, true},   // "b"
		{"b1", 2, true},  // "b1" and "b2"
		{"c", 1, true},   // "c"
		{"d", 1, true},   // "d"
		{"q", 2, true},   // "q" and "z"
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)

	t.Log("Verify lookups")
	testDirDataCheckLookup(t, ctx, dd, "a", 1)
	testDirDataCheckLookup(t, ctx, dd, "b", 2)
	testDirDataCheckLookup(t, ctx, dd, "c", 3)
	testDirDataCheckLookup(t, ctx, dd, "a1", 4)
	testDirDataCheckLookup(t, ctx, dd, "a2", 5)
	testDirDataCheckLookup(t, ctx, dd, "a0", 6)
	testDirDataCheckLookup(t, ctx, dd, "a00", 7)
	testDirDataCheckLookup(t, ctx, dd, "b1", 8)
	testDirDataCheckLookup(t, ctx, dd, "d", 9)
	testDirDataCheckLookup(t, ctx, dd, "a000", 10)
	testDirDataCheckLookup(t, ctx, dd, "z", 11)
	testDirDataCheckLookup(t, ctx, dd, "q", 12)
	testDirDataCheckLookup(t, ctx, dd, "b2", 13)
	testDirDataCheckLookup(t, ctx, dd, " 1", 14)

	t.Log("Adding an existing name should error")
	_, err := dd.addEntry(ctx, "a", DirEntry{
		EntryInfo: EntryInfo{
			Size: 100,
		},
	})
	require.Equal(t, NameExistsError{"a"}, err)
}

func TestDirDataRemoveEntry(t *testing.T) {
	dd, cleanBcache, dirtyBcache := setupDirDataTest(t, 2, 2)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry)

	t.Log("Make a simple dir and remove one entry")
	addFakeDirDataEntry(t, ctx, dd, "a", 1)
	addFakeDirDataEntry(t, ctx, dd, "z", 2)
	_, err := dd.removeEntry(ctx, "z")
	require.NoError(t, err)
	require.Len(t, topBlock.Children, 1)
	testDirDataCheckLookup(t, ctx, dd, "a", 1)
	_, err = dd.lookup(ctx, "z")
	require.Equal(t, NoSuchNameError{"z"}, err)

	t.Log("Make a big complicated tree and remove an entry")
	addFakeDirDataEntry(t, ctx, dd, "b", 2)
	addFakeDirDataEntry(t, ctx, dd, "c", 3)
	addFakeDirDataEntry(t, ctx, dd, "a1", 4)
	addFakeDirDataEntry(t, ctx, dd, "a2", 5)
	addFakeDirDataEntry(t, ctx, dd, "a0", 6)
	addFakeDirDataEntry(t, ctx, dd, "a00", 7)
	addFakeDirDataEntry(t, ctx, dd, "b1", 8)
	addFakeDirDataEntry(t, ctx, dd, "d", 9)
	addFakeDirDataEntry(t, ctx, dd, "a000", 10)
	addFakeDirDataEntry(t, ctx, dd, "z", 11)
	addFakeDirDataEntry(t, ctx, dd, "q", 12)
	addFakeDirDataEntry(t, ctx, dd, "b2", 13)
	addFakeDirDataEntry(t, ctx, dd, " 1", 14)
	testDirDataCleanCache(dd, cleanBcache, dirtyBcache)

	_, err = dd.removeEntry(ctx, "c")
	require.NoError(t, err)
	expectedLeafs := []testDirDataLeaf{
		{"", 2, false},    // " 1" and "a"
		{"a0", 1, false},  // "a0"
		{"a00", 2, false}, // "a00" and "a000"
		{"a1", 2, false},  // "a1" and "a2"
		{"b", 1, false},   // "b"
		{"b1", 2, false},  // "b1" and "b2"
		{"c", 0, true},    // now empty
		{"d", 1, false},   // "d"
		{"q", 2, false},   // "q" and "z"
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)
}

func TestDirDataUpdateEntry(t *testing.T) {
	dd, cleanBcache, dirtyBcache := setupDirDataTest(t, 2, 2)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry)

	t.Log("Make a simple dir and update one entry")
	addFakeDirDataEntry(t, ctx, dd, "a", 1)
	_, err := dd.updateEntry(ctx, "a", DirEntry{
		EntryInfo: EntryInfo{
			Size: 100,
		},
	})
	require.NoError(t, err)
	testDirDataCheckLookup(t, ctx, dd, "a", 100)

	t.Log("Make a big complicated tree and update an entry")
	addFakeDirDataEntry(t, ctx, dd, "b", 2)
	addFakeDirDataEntry(t, ctx, dd, "c", 3)
	addFakeDirDataEntry(t, ctx, dd, "a1", 4)
	addFakeDirDataEntry(t, ctx, dd, "a2", 5)
	addFakeDirDataEntry(t, ctx, dd, "a0", 6)
	addFakeDirDataEntry(t, ctx, dd, "a00", 7)
	addFakeDirDataEntry(t, ctx, dd, "b1", 8)
	addFakeDirDataEntry(t, ctx, dd, "d", 9)
	addFakeDirDataEntry(t, ctx, dd, "a000", 10)
	addFakeDirDataEntry(t, ctx, dd, "z", 11)
	addFakeDirDataEntry(t, ctx, dd, "q", 12)
	addFakeDirDataEntry(t, ctx, dd, "b2", 13)
	addFakeDirDataEntry(t, ctx, dd, " 1", 14)
	testDirDataCleanCache(dd, cleanBcache, dirtyBcache)

	_, err = dd.updateEntry(ctx, "c", DirEntry{
		EntryInfo: EntryInfo{
			Size: 1000,
		},
	})
	require.NoError(t, err)
	testDirDataCheckLookup(t, ctx, dd, "c", 1000)
	expectedLeafs := []testDirDataLeaf{
		{"", 2, false},    // " 1" and "a"
		{"a0", 1, false},  // "a0"
		{"a00", 2, false}, // "a00" and "a000"
		{"a1", 2, false},  // "a1" and "a2"
		{"b", 1, false},   // "b"
		{"b1", 2, false},  // "b1" and "b2"
		{"c", 1, true},    // "c"
		{"d", 1, false},   // "d"
		{"q", 2, false},   // "q" and "z"
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)
	t.Log("Updating an non-existing name should error")
	_, err = dd.updateEntry(ctx, "foo", DirEntry{
		EntryInfo: EntryInfo{
			Size: 100,
		},
	})
	require.Equal(t, NoSuchNameError{"foo"}, err)

}

func TestDirDataShifting(t *testing.T) {
	dd, cleanBcache, dirtyBcache := setupDirDataTest(t, 2, 1)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry)

	for i := 0; i <= 10; i++ {
		addFakeDirDataEntry(t, ctx, dd, strconv.Itoa(i), uint64(i+1))
	}
	testDirDataCheckLookup(t, ctx, dd, "10", 11)
	expectedLeafs := []testDirDataLeaf{
		{"", 1, true},
		{"1", 1, true},
		{"10", 1, true},
		{"2", 1, true},
		{"3", 1, true},
		{"4", 1, true},
		{"5", 1, true},
		{"6", 1, true},
		{"7", 1, true},
		{"8", 1, true},
		{"9", 1, true},
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 1)
}
