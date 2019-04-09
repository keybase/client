// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"testing"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func getMDStorageLength(t *testing.T, s *mdServerTlfStorage, bid kbfsmd.BranchID) int {
	len, err := s.journalLength(bid)
	require.NoError(t, err)
	return int(len)
}

// TestMDServerTlfStorageBasic copies TestMDServerBasics, but for a
// single mdServerTlfStorage.
func TestMDServerTlfStorageBasic(t *testing.T) {
	codec := kbfscodec.NewMsgpack()
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("test key")
	verifyingKey := kbfscrypto.MakeFakeVerifyingKeyOrBust("test key")
	signer := kbfscrypto.SigningKeySigner{Key: signingKey}

	tempdir, err := ioutil.TempDir(os.TempDir(), "mdserver_tlf_storage")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		require.NoError(t, err)
	}()

	tlfID := tlf.FakeID(1, tlf.Private)
	s := makeMDServerTlfStorage(tlfID, codec, data.WallClock{}, nil,
		defaultClientMetadataVer, tempdir)
	defer s.shutdown()

	require.Equal(t, 0, getMDStorageLength(t, s, kbfsmd.NullBranchID))

	uid := keybase1.MakeTestUID(1)
	h, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	// (1) Validate merged branch is empty.

	ctx := context.Background()
	head, err := s.getForTLF(ctx, uid, kbfsmd.NullBranchID)
	require.NoError(t, err)
	require.Nil(t, head)

	require.Equal(t, 0, getMDStorageLength(t, s, kbfsmd.NullBranchID))

	// (2) Push some new metadata blocks.

	prevRoot := kbfsmd.ID{}
	middleRoot := kbfsmd.ID{}
	for i := kbfsmd.Revision(1); i <= 10; i++ {
		brmd := makeBRMDForTest(t, codec, tlfID, h, i, uid, prevRoot)
		rmds := signRMDSForTest(t, codec, signer, brmd)
		// MDv3 TODO: pass extra metadata
		recordBranchID, err := s.put(ctx, uid, verifyingKey, rmds, nil)
		require.NoError(t, err)
		require.False(t, recordBranchID)
		prevRoot, err = kbfsmd.MakeID(codec, rmds.MD)
		require.NoError(t, err)
		if i == 5 {
			middleRoot = prevRoot
		}
	}

	require.Equal(t, 10, getMDStorageLength(t, s, kbfsmd.NullBranchID))

	// (3) Trigger a conflict.

	brmd := makeBRMDForTest(t, codec, tlfID, h, 10, uid, prevRoot)
	rmds := signRMDSForTest(t, codec, signer, brmd)
	// MDv3 TODO: pass extra metadata
	_, err = s.put(ctx, uid, verifyingKey, rmds, nil)
	require.IsType(t, kbfsmd.ServerErrorConflictRevision{}, err)

	require.Equal(t, 10, getMDStorageLength(t, s, kbfsmd.NullBranchID))

	// (4) Push some new unmerged metadata blocks linking to the
	// middle merged block.

	prevRoot = middleRoot
	bid := kbfsmd.FakeBranchID(1)
	for i := kbfsmd.Revision(6); i < 41; i++ {
		brmd := makeBRMDForTest(t, codec, tlfID, h, i, uid, prevRoot)
		brmd.SetUnmerged()
		brmd.SetBranchID(bid)
		rmds := signRMDSForTest(t, codec, signer, brmd)
		// MDv3 TODO: pass extra metadata
		recordBranchID, err := s.put(ctx, uid, verifyingKey, rmds, nil)
		require.NoError(t, err)
		require.Equal(t, i == kbfsmd.Revision(6), recordBranchID)
		prevRoot, err = kbfsmd.MakeID(codec, rmds.MD)
		require.NoError(t, err)
	}

	require.Equal(t, 10, getMDStorageLength(t, s, kbfsmd.NullBranchID))
	require.Equal(t, 35, getMDStorageLength(t, s, bid))

	// (5) Check for proper unmerged head.

	head, err = s.getForTLF(ctx, uid, bid)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, kbfsmd.Revision(40), head.MD.RevisionNumber())

	require.Equal(t, 10, getMDStorageLength(t, s, kbfsmd.NullBranchID))
	require.Equal(t, 35, getMDStorageLength(t, s, bid))

	// (6) Try to get unmerged range.

	rmdses, err := s.getRange(ctx, uid, bid, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 35, len(rmdses))
	for i := kbfsmd.Revision(6); i < 16; i++ {
		require.Equal(t, i, rmdses[i-6].MD.RevisionNumber())
	}

	// Nothing corresponds to (7) - (9) from MDServerTestBasics.

	// (10) Check for proper merged head.

	head, err = s.getForTLF(ctx, uid, kbfsmd.NullBranchID)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, kbfsmd.Revision(10), head.MD.RevisionNumber())

	// (11) Try to get merged range.

	rmdses, err = s.getRange(ctx, uid, kbfsmd.NullBranchID, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 10, len(rmdses))
	for i := kbfsmd.Revision(1); i <= 10; i++ {
		require.Equal(t, i, rmdses[i-1].MD.RevisionNumber())
	}

	require.Equal(t, 10, getMDStorageLength(t, s, kbfsmd.NullBranchID))
	require.Equal(t, 35, getMDStorageLength(t, s, bid))
}
