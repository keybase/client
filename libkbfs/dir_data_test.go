// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func setupDirDataTest(t *testing.T) (*dirData, BlockCache, DirtyBlockCache) {
	// Make a fake dir.
	ptr := BlockPointer{
		ID:         kbfsblock.FakeID(42),
		DirectType: DirectBlock,
	}
	id := tlf.FakeID(1, tlf.Private)
	dir := path{FolderBranch{Tlf: id}, []pathNode{{ptr, "dir"}}}
	chargedTo := keybase1.MakeTestUID(1).AsUserOrTeam()
	crypto := MakeCryptoCommon(kbfscodec.NewMsgpack())
	bsplit := &BlockSplitterSimple{10, 10, 10}
	kmd := emptyKeyMetadata{id, 1}

	cleanCache := NewBlockCacheStandard(1<<10, 1<<20)
	dirtyBcache := simpleDirtyBlockCacheStandard()
	getter := func(_ context.Context, _ KeyMetadata, ptr BlockPointer,
		_ path, _ blockReqType) (*DirBlock, bool, error) {
		isDirty := true
		block, err := dirtyBcache.Get(id, ptr, MasterBranch)
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
	cacher := func(ptr BlockPointer, block Block) error {
		return dirtyBcache.Put(id, ptr, MasterBranch, block)
	}

	dd := newDirData(
		dir, chargedTo, crypto, kmd, bsplit, getter, cacher,
		logger.NewTestLogger(t))
	return dd, cleanCache, dirtyBcache
}

func addFakeDirDataEntry(dblock *DirBlock, name string, size uint64) {
	dblock.Children[name] = DirEntry{
		EntryInfo: EntryInfo{
			Size: size,
		},
	}
}

func TestDirDataGetChildren(t *testing.T) {
	dd, cleanBcache, _ := setupDirDataTest(t)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry)

	t.Log("No entries, direct block")
	children, err := dd.getChildren(ctx)
	require.NoError(t, err)
	require.Len(t, children, 0)

	t.Log("Single entry, direct block")
	addFakeDirDataEntry(topBlock, "a", 1)
	children, err = dd.getChildren(ctx)
	require.NoError(t, err)
	require.Len(t, children, 1)
	require.Equal(t, uint64(1), children["a"].Size)

	t.Log("Two entries, direct block")
	addFakeDirDataEntry(topBlock, "b", 2)
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
	addFakeDirDataEntry(block2, "z1", 3)
	addFakeDirDataEntry(block2, "z2", 4)
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

func TestDirDataLookup(t *testing.T) {
	dd, cleanBcache, _ := setupDirDataTest(t)
	ctx := context.Background()
	topBlock := NewDirBlock().(*DirBlock)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, topBlock, TransientEntry)

	t.Log("No entries, direct block")
	_, err := dd.lookup(ctx, "a")
	require.Equal(t, NoSuchNameError{"a"}, err)

	t.Log("Single entry, direct block")
	addFakeDirDataEntry(topBlock, "a", 1)
	checkLookup := func(name string, size uint64) {
		de, err := dd.lookup(ctx, name)
		require.NoError(t, err)
		require.Equal(t, size, de.Size)
	}
	checkLookup("a", 1)
	_, err = dd.lookup(ctx, "b")
	require.Equal(t, NoSuchNameError{"b"}, err)

	t.Log("Indirect blocks")
	addFakeDirDataEntry(topBlock, "b", 2)
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
	addFakeDirDataEntry(block2, "z1", 3)
	addFakeDirDataEntry(block2, "z2", 4)
	cleanBcache.Put(
		dd.rootBlockPointer(), dd.tree.file.Tlf, newTopBlock, TransientEntry)
	cleanBcache.Put(ptr1, dd.tree.file.Tlf, topBlock, TransientEntry)
	cleanBcache.Put(ptr2, dd.tree.file.Tlf, block2, TransientEntry)

	checkLookup("a", 1)
	checkLookup("b", 2)
	checkLookup("z1", 3)
	checkLookup("z2", 4)
}
