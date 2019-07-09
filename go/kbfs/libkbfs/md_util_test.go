// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type testBlockCache struct {
	b data.Block
}

func (c testBlockCache) Get(ptr data.BlockPointer) (data.Block, error) {
	return c.b, nil
}

func (testBlockCache) Put(ptr data.BlockPointer, tlf tlf.ID, block data.Block,
	lifetime data.BlockCacheLifetime, _ data.BlockCacheHashBehavior) error {
	return errors.New("Shouldn't be called")
}

type blockChangesNoInfo struct {
	// An ordered list of operations completed in this update
	Ops opsList `codec:"o,omitempty"`
	// Estimate the number of bytes that this set of changes will take to encode
	sizeEstimate uint64
}

func TestReembedBlockChanges(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	RegisterOps(codec)

	oldDir := data.BlockPointer{ID: kbfsblock.FakeID(1)}
	co, err := newCreateOp("file", oldDir, data.File)
	require.NoError(t, err)

	changes := blockChangesNoInfo{
		Ops: opsList{co},
	}

	encodedChanges, err := codec.Encode(changes)
	require.NoError(t, err)
	block := &data.FileBlock{Contents: encodedChanges}

	ctx := context.Background()
	bcache := testBlockCache{block}
	tlfID := tlf.FakeID(1, tlf.Private)
	mode := modeTest{NewInitModeFromType(InitDefault)}

	ptr := data.BlockPointer{ID: kbfsblock.FakeID(2)}
	pmd := PrivateMetadata{
		Changes: BlockChanges{
			Info: data.BlockInfo{
				BlockPointer: ptr,
			},
		},
	}

	// We make the cache always return a block, so we can pass in
	// nil for bops and rmdWithKeys.
	err = reembedBlockChanges(
		ctx, codec, bcache, nil, mode, tlfID, &pmd, nil,
		logger.NewTestLogger(t))
	require.NoError(t, err)

	// We expect to get changes back, except with the implicit ref
	// block added.
	expectedCO, err := newCreateOp("file", oldDir, data.File)
	require.NoError(t, err)
	expectedCO.AddRefBlock(ptr)
	expectedChanges := BlockChanges{
		Ops: opsList{expectedCO},
	}

	// In particular, Info should be empty.
	expectedPmd := PrivateMetadata{
		Changes: expectedChanges,

		cachedChanges: BlockChanges{
			Info: data.BlockInfo{
				BlockPointer: ptr,
			},
		},
	}
	require.Equal(t, expectedPmd, pmd)
}

func TestGetRevisionByTime(t *testing.T) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, u1)
	defer kbfsTestShutdownNoMocks(ctx, t, config, cancel)

	clock, t1 := clocktest.NewTestClockAndTimeNow()
	config.SetClock(clock)

	t.Log("Create revision 1")
	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, string(u1), tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, data.MasterBranch)
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Create revision 2")
	t2 := t1.Add(1 * time.Minute)
	clock.Set(t2)
	nodeA, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	data := []byte{1}
	err = kbfsOps.Write(ctx, nodeA, data, 0)
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Clear the MD cache, to make sure it gets repopulated")
	config.ResetCaches()

	t.Log(ctx, "Check exact times")
	rev, err := GetMDRevisionByTime(ctx, config, h, t2)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.Revision(2), rev)
	_, err = config.MDCache().Get(h.TlfID(), rev, kbfsmd.NullBranchID)
	require.NoError(t, err)
	rev, err = GetMDRevisionByTime(ctx, config, h, t1)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.Revision(1), rev)
	_, err = config.MDCache().Get(h.TlfID(), rev, kbfsmd.NullBranchID)
	require.NoError(t, err)

	t.Log(ctx, "Check in-between times")
	rev, err = GetMDRevisionByTime(ctx, config, h, t2.Add(30*time.Second))
	require.NoError(t, err)
	require.Equal(t, kbfsmd.Revision(2), rev)
	rev, err = GetMDRevisionByTime(ctx, config, h, t1.Add(30*time.Second))
	require.NoError(t, err)
	require.Equal(t, kbfsmd.Revision(1), rev)

	t.Log(ctx, "Check too-early time")
	_, err = GetMDRevisionByTime(ctx, config, h, t1.Add(-30*time.Second))
	require.Error(t, err)
}
