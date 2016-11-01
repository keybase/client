// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/stretchr/testify/require"
)

// Test verification of finalized metadata blocks.
func testRootMetadataFinalVerify(t *testing.T, ver MetadataVer) {
	tlfID := FakeTlfID(1, false)

	uid := keybase1.MakeTestUID(1)
	bh, err := MakeBareTlfHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	brmd, err := MakeInitialBareRootMetadata(ver, tlfID, bh)

	ctx := context.Background()
	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(kbfscodec.NewMsgpack())
	signer := kbfscrypto.SigningKeySigner{
		Key: kbfscrypto.MakeFakeSigningKeyOrBust("key"),
	}

	extra, err := FakeInitialRekey(
		brmd, crypto, bh, kbfscrypto.TLFPublicKey{})
	require.NoError(t, err)

	brmd.SetLastModifyingWriter(uid)
	brmd.SetLastModifyingUser(uid)
	brmd.SetSerializedPrivateMetadata([]byte{42})
	err = brmd.SignWriterMetadataInternally(ctx, codec, signer)
	require.NoError(t, err)

	rmds, err := SignBareRootMetadata(
		ctx, codec, signer, signer, brmd, time.Time{})
	require.NoError(t, err)

	// verify it
	err = rmds.IsValidAndSigned(codec, crypto, extra)
	require.NoError(t, err)

	ext, err := NewTlfHandleExtension(
		TlfHandleExtensionFinalized, 1, "fake user")
	require.NoError(t, err)

	// make a final copy
	rmds2, err := rmds.MakeFinalCopy(codec, time.Now(), ext)
	require.NoError(t, err)

	// verify the finalized copy
	err = rmds2.IsValidAndSigned(codec, crypto, extra)
	require.NoError(t, err)

	// touch something the server shouldn't be allowed to edit for
	// finalized metadata and verify verification failure.
	md3, err := rmds2.MD.DeepCopy(codec)
	require.NoError(t, err)
	md3.SetRekeyBit()
	rmds3 := rmds2
	rmds2.MD = md3
	err = rmds3.IsValidAndSigned(codec, crypto, extra)
	require.NotNil(t, err)
}

func TestRootMetadataFinalVerifyV2(t *testing.T) {
	testRootMetadataFinalVerify(t, InitialExtraMetadataVer)
}

func TestRootMetadataFinalVerifyV3(t *testing.T) {
	testRootMetadataFinalVerify(t, SegregatedKeyBundlesVer)
}
