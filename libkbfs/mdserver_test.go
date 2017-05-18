// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

func makeBRMDForTest(t *testing.T, codec kbfscodec.Codec, crypto cryptoPure,
	id tlf.ID, h tlf.Handle, revision kbfsmd.Revision, uid keybase1.UID,
	prevRoot kbfsmd.ID) *BareRootMetadataV2 {
	var md BareRootMetadataV2
	// MDv3 TODO: uncomment the below when we're ready for MDv3
	// md := &BareRootMetadataV3{}
	md.SetTlfID(id)
	md.SetSerializedPrivateMetadata([]byte{0x1})
	md.SetRevision(revision)
	md.SetLastModifyingWriter(uid)
	md.SetLastModifyingUser(uid)
	FakeInitialRekey(&md, h, kbfscrypto.TLFPublicKey{})
	md.SetPrevRoot(prevRoot)
	return &md
}

func signRMDSForTest(
	t *testing.T, codec kbfscodec.Codec, signer kbfscrypto.Signer,
	brmd *BareRootMetadataV2) *RootMetadataSigned {
	ctx := context.Background()

	// Encode and sign writer metadata.
	err := brmd.SignWriterMetadataInternally(ctx, codec, signer)
	require.NoError(t, err)

	rmds, err := SignBareRootMetadata(
		ctx, codec, signer, signer, brmd, time.Time{})
	require.NoError(t, err)

	return rmds
}

// This should pass for both local and remote servers.
func TestMDServerBasics(t *testing.T) {
	// setup
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "test_user")
	defer config.Shutdown(ctx)
	mdServer := config.MDServer()

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	uid := session.UID

	// (1) get metadata -- allocates an ID
	h, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	id, rmds, err := mdServer.GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Nil(t, rmds)

	// (2) push some new metadata blocks
	prevRoot := kbfsmd.ID{}
	middleRoot := kbfsmd.ID{}
	for i := kbfsmd.Revision(1); i <= 10; i++ {
		brmd := makeBRMDForTest(t, config.Codec(), config.Crypto(), id, h, i, uid, prevRoot)
		rmds := signRMDSForTest(t, config.Codec(), config.Crypto(), brmd)
		// MDv3 TODO: pass actual key bundles
		err = mdServer.Put(ctx, rmds, nil)
		require.NoError(t, err)
		prevRoot, err = kbfsmd.MakeID(config.Codec(), rmds.MD)
		require.NoError(t, err)
		if i == 5 {
			middleRoot = prevRoot
		}
	}

	// (3) trigger a conflict
	brmd := makeBRMDForTest(t, config.Codec(), config.Crypto(), id, h, 10, uid, prevRoot)
	rmds = signRMDSForTest(t, config.Codec(), config.Crypto(), brmd)
	// MDv3 TODO: pass actual key bundles
	err = mdServer.Put(ctx, rmds, nil)
	require.IsType(t, kbfsmd.ServerErrorConflictRevision{}, err)

	// (4) push some new unmerged metadata blocks linking to the
	//     middle merged block.
	prevRoot = middleRoot
	bid, err := config.Crypto().MakeRandomBranchID()
	require.NoError(t, err)
	for i := kbfsmd.Revision(6); i < 41; i++ {
		brmd := makeBRMDForTest(t, config.Codec(), config.Crypto(), id, h, i, uid, prevRoot)
		brmd.SetUnmerged()
		brmd.SetBranchID(bid)
		rmds := signRMDSForTest(t, config.Codec(), config.Crypto(), brmd)
		// MDv3 TODO: pass actual key bundles
		err = mdServer.Put(ctx, rmds, nil)
		require.NoError(t, err)
		prevRoot, err = kbfsmd.MakeID(config.Codec(), rmds.MD)
		require.NoError(t, err)
	}

	// (5) check for proper unmerged head
	head, err := mdServer.GetForTLF(ctx, id, bid, Unmerged)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, kbfsmd.Revision(40), head.MD.RevisionNumber())

	// (6a) try to get unmerged range
	rmdses, err := mdServer.GetRange(ctx, id, bid, Unmerged, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 35, len(rmdses))
	for i := kbfsmd.Revision(6); i < 41; i++ {
		require.Equal(t, i, rmdses[i-6].MD.RevisionNumber())
	}

	// (6b) try to get unmerged range subset.
	rmdses, err = mdServer.GetRange(ctx, id, bid, Unmerged, 7, 14)
	require.NoError(t, err)
	require.Equal(t, 8, len(rmdses))
	for i := kbfsmd.Revision(7); i <= 14; i++ {
		require.Equal(t, i, rmdses[i-7].MD.RevisionNumber())
	}

	// (7) prune unmerged
	err = mdServer.PruneBranch(ctx, id, bid)
	require.NoError(t, err)

	// (8) verify head is pruned
	head, err = mdServer.GetForTLF(ctx, id, NullBranchID, Unmerged)
	require.NoError(t, err)
	require.Nil(t, head)

	// (9) verify revision history is pruned
	rmdses, err = mdServer.GetRange(ctx, id, NullBranchID, Unmerged, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 0, len(rmdses))

	// (10) check for proper merged head
	head, err = mdServer.GetForTLF(ctx, id, NullBranchID, Merged)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, kbfsmd.Revision(10), head.MD.RevisionNumber())

	// (11) try to get merged range
	rmdses, err = mdServer.GetRange(ctx, id, NullBranchID, Merged, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 10, len(rmdses))
	for i := kbfsmd.Revision(1); i <= 10; i++ {
		require.Equal(t, i, rmdses[i-1].MD.RevisionNumber())
	}
}

// This should pass for both local and remote servers. Make sure that
// registering multiple TLFs for updates works. This is a regression
// test for https://keybase.atlassian.net/browse/KBFS-467 .
func TestMDServerRegisterForUpdate(t *testing.T) {
	// setup
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "test_user")
	defer config.Shutdown(ctx)
	mdServer := config.MDServer()

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	id := session.UID.AsUserOrTeam()

	// Create first TLF.
	h1, err := tlf.MakeHandle([]keybase1.UserOrTeamID{id}, nil, nil, nil, nil)
	require.NoError(t, err)

	id1, _, err := mdServer.GetForHandle(ctx, h1, Merged)
	require.NoError(t, err)

	// Create second TLF, which should end up being different from
	// the first one.
	h2, err := tlf.MakeHandle([]keybase1.UserOrTeamID{id},
		[]keybase1.UserOrTeamID{keybase1.UserOrTeamID(keybase1.PUBLIC_UID)},
		nil, nil, nil)
	require.NoError(t, err)

	id2, _, err := mdServer.GetForHandle(ctx, h2, Merged)
	require.NoError(t, err)
	require.NotEqual(t, id1, id2)

	_, err = mdServer.RegisterForUpdate(ctx, id1, kbfsmd.RevisionInitial)
	require.NoError(t, err)

	_, err = mdServer.RegisterForUpdate(ctx, id2, kbfsmd.RevisionInitial)
	require.NoError(t, err)
}
