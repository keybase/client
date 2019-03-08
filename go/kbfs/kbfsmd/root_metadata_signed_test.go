// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func testRootMetadataSignedFinalVerify(t *testing.T, ver MetadataVer) {
	tlfID := tlf.FakeID(1, tlf.Private)

	uid := keybase1.MakeTestUID(1)
	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{uid.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	brmd, err := MakeInitialRootMetadata(ver, tlfID, bh)
	require.NoError(t, err)

	ctx := context.Background()
	codec := kbfscodec.NewMsgpack()
	signer := kbfscrypto.SigningKeySigner{
		Key: kbfscrypto.MakeFakeSigningKeyOrBust("key"),
	}

	extra := FakeInitialRekey(brmd, bh, kbfscrypto.TLFPublicKey{})

	brmd.SetLastModifyingWriter(uid)
	brmd.SetLastModifyingUser(uid)
	brmd.SetSerializedPrivateMetadata([]byte{42})
	err = brmd.SignWriterMetadataInternally(ctx, codec, signer)
	require.NoError(t, err)

	rmds, err := SignRootMetadata(ctx, codec, signer, signer, brmd)
	require.NoError(t, err)

	// verify it
	err = rmds.IsValidAndSigned(
		ctx, codec, nil, extra, keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)

	ext, err := tlf.NewHandleExtension(
		tlf.HandleExtensionFinalized, 1, "fake user", time.Now())
	require.NoError(t, err)

	// make a final copy
	rmds2, err := rmds.MakeFinalCopy(codec, ext)
	require.NoError(t, err)

	// verify the finalized copy
	err = rmds2.IsValidAndSigned(
		ctx, codec, nil, extra, keybase1.OfflineAvailability_NONE)
	require.NoError(t, err)

	// touch something the server shouldn't be allowed to edit for
	// finalized metadata and verify verification failure.
	md3, err := rmds2.MD.DeepCopy(codec)
	require.NoError(t, err)
	md3.SetRekeyBit()
	rmds3 := rmds2
	rmds2.MD = md3
	err = rmds3.IsValidAndSigned(
		ctx, codec, nil, extra, keybase1.OfflineAvailability_NONE)
	require.NotNil(t, err)
}

func TestRootMetadataSigned(t *testing.T) {
	tests := []func(*testing.T, MetadataVer){
		testRootMetadataSignedFinalVerify,
	}
	runTestsOverMetadataVers(t, "testRootMetadataSigned", tests)
}
