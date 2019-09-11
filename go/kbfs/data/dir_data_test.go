// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"fmt"
	"reflect"
	"strconv"
	"testing"

	"github.com/keybase/client/go/kbfs/idutil"
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

func setupDirDataTest(t *testing.T, maxPtrsPerBlock, numDirEntries int) (
	*DirData, BlockCache, DirtyBlockCache) {
	// Make a fake dir.
	ptr := BlockPointer{
		ID:         kbfsblock.FakeID(42),
		DirectType: DirectBlock,
	}
	id := tlf.FakeID(1, tlf.Private)
	dir := Path{
		FolderBranch{Tlf: id},
		[]PathNode{{ptr, NewPathPartString("dir", nil)}},
		nil,
	}
	chargedTo := keybase1.MakeTestUID(1).AsUserOrTeam()
	bsplit := &BlockSplitterSimple{10, maxPtrsPerBlock, 10, numDirEntries}
	kmd := libkeytest.NewEmptyKeyMetadata(id, 1)

	cleanCache := NewBlockCacheStandard(1<<10, 1<<20)
	dirtyBcache := SimpleDirtyBlockCacheStandard()
	getter := func(ctx context.Context, _ libkey.KeyMetadata, ptr BlockPointer,
		_ Path, _ BlockReqType) (*DirBlock, bool, error) {
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

	log := logger.NewTestLogger(t)
	dd := NewDirData(
		dir, chargedTo, bsplit, kmd, getter, cacher, log,
		libkb.NewVDebugLog(log))
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
	err := cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry,
		SkipCacheHash)
	require.NoError(t, err)

	t.Log("No entries, direct block")
	children, err := dd.GetChildren(ctx)
	require.NoError(t, err)
	require.Len(t, children, 0)

	t.Log("Single entry, direct block")
	addFakeDirDataEntryToBlock(topBlock, "a", 1)
	children, err = dd.GetChildren(ctx)
	require.NoError(t, err)
	require.Len(t, children, 1)
	require.Equal(t, uint64(1), children[NewPathPartString("a", nil)].Size)

	t.Log("Two entries, direct block")
	addFakeDirDataEntryToBlock(topBlock, "b", 2)
	children, err = dd.GetChildren(ctx)
	require.NoError(t, err)
	require.Len(t, children, 2)
	require.Equal(t, uint64(1), children[NewPathPartString("a", nil)].Size)
	require.Equal(t, uint64(2), children[NewPathPartString("b", nil)].Size)

	t.Log("Indirect blocks")
	dd.tree.file.Path[len(dd.tree.file.Path)-1].DirectType = IndirectBlock
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
	err = cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, newTopBlock, TransientEntry,
		SkipCacheHash)
	require.NoError(t, err)
	err = cleanBcache.Put(
		ptr1, dd.tree.file.Tlf, topBlock, TransientEntry, SkipCacheHash)
	require.NoError(t, err)
	err = cleanBcache.Put(
		ptr2, dd.tree.file.Tlf, block2, TransientEntry, SkipCacheHash)
	require.NoError(t, err)
	children, err = dd.GetChildren(ctx)
	require.NoError(t, err)
	require.Len(t, children, 4)
	require.Equal(t, uint64(1), children[NewPathPartString("a", nil)].Size)
	require.Equal(t, uint64(2), children[NewPathPartString("b", nil)].Size)
	require.Equal(t, uint64(3), children[NewPathPartString("z1", nil)].Size)
	require.Equal(t, uint64(4), children[NewPathPartString("z2", nil)].Size)

}

func testDirDataCheckLookup(
	ctx context.Context, t *testing.T, dd *DirData, name string, size uint64) {
	de, err := dd.Lookup(ctx, NewPathPartString(name, nil))
	require.NoError(t, err)
	require.Equal(t, size, de.Size)
}

func TestDirDataLookup(t *testing.T) {
	dd, cleanBcache, _ := setupDirDataTest(t, 2, 2)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	err := cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry,
		SkipCacheHash)
	require.NoError(t, err)

	t.Log("No entries, direct block")
	_, err = dd.Lookup(ctx, NewPathPartString("a", nil))
	require.Equal(t, idutil.NoSuchNameError{Name: "a"}, err)

	t.Log("Single entry, direct block")
	addFakeDirDataEntryToBlock(topBlock, "a", 1)
	testDirDataCheckLookup(ctx, t, dd, "a", 1)
	_, err = dd.Lookup(ctx, NewPathPartString("b", nil))
	require.Equal(t, idutil.NoSuchNameError{Name: "b"}, err)

	t.Log("Indirect blocks")
	addFakeDirDataEntryToBlock(topBlock, "b", 2)
	dd.tree.file.Path[len(dd.tree.file.Path)-1].DirectType = IndirectBlock
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
	err = cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, newTopBlock, TransientEntry,
		SkipCacheHash)
	require.NoError(t, err)
	err = cleanBcache.Put(
		ptr1, dd.tree.file.Tlf, topBlock, TransientEntry, SkipCacheHash)
	require.NoError(t, err)
	err = cleanBcache.Put(
		ptr2, dd.tree.file.Tlf, block2, TransientEntry, SkipCacheHash)
	require.NoError(t, err)

	testDirDataCheckLookup(ctx, t, dd, "a", 1)
	testDirDataCheckLookup(ctx, t, dd, "b", 2)
	testDirDataCheckLookup(ctx, t, dd, "z1", 3)
	testDirDataCheckLookup(ctx, t, dd, "z2", 4)
}

func addFakeDirDataEntry(
	ctx context.Context, t *testing.T, dd *DirData, name string, size uint64) {
	_, err := dd.AddEntry(ctx, NewPathPartString(name, nil), DirEntry{
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
	t *testing.T, dd *DirData, cleanBcache BlockCache,
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
	t *testing.T, dd *DirData, cleanBCache BlockCache,
	dirtyBCache DirtyBlockCache) {
	dbc := dirtyBCache.(*DirtyBlockCacheStandard)
	for id, block := range dbc.cache {
		ptr := BlockPointer{ID: id.id}
		err := cleanBCache.Put(
			ptr, dd.tree.file.Tlf, block, TransientEntry, SkipCacheHash)
		require.NoError(t, err)
	}
	dbc.cache = make(map[dirtyBlockID]Block)
}

func TestDirDataAddEntry(t *testing.T) {
	dd, cleanBcache, dirtyBcache := setupDirDataTest(t, 2, 2)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	err := cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry,
		SkipCacheHash)
	require.NoError(t, err)

	t.Log("Add first entry")
	addFakeDirDataEntry(ctx, t, dd, "a", 1)
	require.True(t, dirtyBcache.IsDirty(
		dd.tree.file.Tlf, dd.rootBlockPointer(), MasterBranch))
	require.Len(t, topBlock.Children, 1)

	t.Log("Force a split")
	addFakeDirDataEntry(ctx, t, dd, "b", 2)
	addFakeDirDataEntry(ctx, t, dd, "c", 3)
	expectedLeafs := []testDirDataLeaf{
		{"", 1, true},
		{"b", 2, true},
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)

	t.Log("Fill in the first block")
	addFakeDirDataEntry(ctx, t, dd, "a1", 4)
	expectedLeafs = []testDirDataLeaf{
		{"", 2, true},
		{"b", 2, true},
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)

	t.Log("Shift a block over")
	addFakeDirDataEntry(ctx, t, dd, "a2", 5)
	expectedLeafs = []testDirDataLeaf{
		{"", 1, true},
		{"a1", 2, true},
		{"b", 2, true},
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)

	t.Log("Clean up the cache and dirty just one leaf")
	testDirDataCleanCache(t, dd, cleanBcache, dirtyBcache)
	addFakeDirDataEntry(ctx, t, dd, "a0", 6)
	expectedLeafs = []testDirDataLeaf{
		{"", 2, true},
		{"a1", 2, false},
		{"b", 2, false},
	}
	testDirDataCheckLeafs(t, dd, cleanBcache, dirtyBcache, expectedLeafs, 2, 2)

	t.Log("Expand a bunch more")
	addFakeDirDataEntry(ctx, t, dd, "a00", 7)
	addFakeDirDataEntry(ctx, t, dd, "b1", 8)
	addFakeDirDataEntry(ctx, t, dd, "d", 9)
	addFakeDirDataEntry(ctx, t, dd, "a000", 10)
	addFakeDirDataEntry(ctx, t, dd, "z", 11)
	addFakeDirDataEntry(ctx, t, dd, "q", 12)
	addFakeDirDataEntry(ctx, t, dd, "b2", 13)
	addFakeDirDataEntry(ctx, t, dd, " 1", 14)
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
	testDirDataCheckLookup(ctx, t, dd, "a", 1)
	testDirDataCheckLookup(ctx, t, dd, "b", 2)
	testDirDataCheckLookup(ctx, t, dd, "c", 3)
	testDirDataCheckLookup(ctx, t, dd, "a1", 4)
	testDirDataCheckLookup(ctx, t, dd, "a2", 5)
	testDirDataCheckLookup(ctx, t, dd, "a0", 6)
	testDirDataCheckLookup(ctx, t, dd, "a00", 7)
	testDirDataCheckLookup(ctx, t, dd, "b1", 8)
	testDirDataCheckLookup(ctx, t, dd, "d", 9)
	testDirDataCheckLookup(ctx, t, dd, "a000", 10)
	testDirDataCheckLookup(ctx, t, dd, "z", 11)
	testDirDataCheckLookup(ctx, t, dd, "q", 12)
	testDirDataCheckLookup(ctx, t, dd, "b2", 13)
	testDirDataCheckLookup(ctx, t, dd, " 1", 14)

	t.Log("Adding an existing name should error")
	_, err = dd.AddEntry(ctx, NewPathPartString("a", nil), DirEntry{
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
	err := cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry,
		SkipCacheHash)
	require.NoError(t, err)

	t.Log("Make a simple dir and remove one entry")
	addFakeDirDataEntry(ctx, t, dd, "a", 1)
	addFakeDirDataEntry(ctx, t, dd, "z", 2)
	_, err = dd.RemoveEntry(ctx, NewPathPartString("z", nil))
	require.NoError(t, err)
	require.Len(t, topBlock.Children, 1)
	testDirDataCheckLookup(ctx, t, dd, "a", 1)
	_, err = dd.Lookup(ctx, NewPathPartString("z", nil))
	require.Equal(t, idutil.NoSuchNameError{Name: "z"}, err)

	t.Log("Make a big complicated tree and remove an entry")
	addFakeDirDataEntry(ctx, t, dd, "b", 2)
	addFakeDirDataEntry(ctx, t, dd, "c", 3)
	addFakeDirDataEntry(ctx, t, dd, "a1", 4)
	addFakeDirDataEntry(ctx, t, dd, "a2", 5)
	addFakeDirDataEntry(ctx, t, dd, "a0", 6)
	addFakeDirDataEntry(ctx, t, dd, "a00", 7)
	addFakeDirDataEntry(ctx, t, dd, "b1", 8)
	addFakeDirDataEntry(ctx, t, dd, "d", 9)
	addFakeDirDataEntry(ctx, t, dd, "a000", 10)
	addFakeDirDataEntry(ctx, t, dd, "z", 11)
	addFakeDirDataEntry(ctx, t, dd, "q", 12)
	addFakeDirDataEntry(ctx, t, dd, "b2", 13)
	addFakeDirDataEntry(ctx, t, dd, " 1", 14)
	testDirDataCleanCache(t, dd, cleanBcache, dirtyBcache)

	_, err = dd.RemoveEntry(ctx, NewPathPartString("c", nil))
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
	err := cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry,
		SkipCacheHash)
	require.NoError(t, err)

	t.Log("Make a simple dir and update one entry")
	addFakeDirDataEntry(ctx, t, dd, "a", 1)
	_, err = dd.UpdateEntry(ctx, NewPathPartString("a", nil), DirEntry{
		EntryInfo: EntryInfo{
			Size: 100,
		},
	})
	require.NoError(t, err)
	testDirDataCheckLookup(ctx, t, dd, "a", 100)

	t.Log("Make a big complicated tree and update an entry")
	addFakeDirDataEntry(ctx, t, dd, "b", 2)
	addFakeDirDataEntry(ctx, t, dd, "c", 3)
	addFakeDirDataEntry(ctx, t, dd, "a1", 4)
	addFakeDirDataEntry(ctx, t, dd, "a2", 5)
	addFakeDirDataEntry(ctx, t, dd, "a0", 6)
	addFakeDirDataEntry(ctx, t, dd, "a00", 7)
	addFakeDirDataEntry(ctx, t, dd, "b1", 8)
	addFakeDirDataEntry(ctx, t, dd, "d", 9)
	addFakeDirDataEntry(ctx, t, dd, "a000", 10)
	addFakeDirDataEntry(ctx, t, dd, "z", 11)
	addFakeDirDataEntry(ctx, t, dd, "q", 12)
	addFakeDirDataEntry(ctx, t, dd, "b2", 13)
	addFakeDirDataEntry(ctx, t, dd, " 1", 14)
	testDirDataCleanCache(t, dd, cleanBcache, dirtyBcache)

	_, err = dd.UpdateEntry(ctx, NewPathPartString("c", nil), DirEntry{
		EntryInfo: EntryInfo{
			Size: 1000,
		},
	})
	require.NoError(t, err)
	testDirDataCheckLookup(ctx, t, dd, "c", 1000)
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
	_, err = dd.UpdateEntry(ctx, NewPathPartString("foo", nil), DirEntry{
		EntryInfo: EntryInfo{
			Size: 100,
		},
	})
	require.Equal(t, idutil.NoSuchNameError{Name: "foo"}, err)

}

func TestDirDataShifting(t *testing.T) {
	dd, cleanBcache, dirtyBcache := setupDirDataTest(t, 2, 1)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	err := cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry,
		SkipCacheHash)
	require.NoError(t, err)

	for i := 0; i <= 10; i++ {
		addFakeDirDataEntry(ctx, t, dd, strconv.Itoa(i), uint64(i+1))
	}
	testDirDataCheckLookup(ctx, t, dd, "10", 11)
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
