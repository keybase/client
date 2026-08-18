// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestLoadUserPlusKeysHasKeys(t *testing.T) {
	tc := SetupEngineTest(t, "user")
	defer tc.Cleanup()

	CreateAndSignupFakeUserPaper(tc, "login")
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(t, err)
	up, err := libkb.LoadUserPlusKeys(context.TODO(), tc.G, me.GetUID(), "")
	require.NoError(t, err)
	require.Len(t, up.DeviceKeys, 4, "num device keys: %d, expected 4", len(up.DeviceKeys))
}

func TestLoadUserPlusKeysRevoked(t *testing.T) {
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()
	tc.G.SetClock(fakeClock)

	fu := CreateAndSignupFakeUserPaper(tc, "login")
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(t, err)
	up, err := libkb.LoadUserPlusKeys(context.TODO(), tc.G, me.GetUID(), "")
	require.NoError(t, err)

	require.Len(t, up.DeviceKeys, 4, "device keys: %d, expected 4", len(up.DeviceKeys))
	require.Empty(t, up.RevokedDeviceKeys, "revoked keys: %d, expected 0", len(up.RevokedDeviceKeys))

	devices, _ := getActiveDevicesAndKeys(tc, fu)
	var paper *libkb.Device
	for _, device := range devices {
		if device.Type == keybase1.DeviceTypeV2_PAPER {
			paper = device.Device
			break
		}
	}

	if err := doRevokeDevice(tc, fu, paper.ID, false, false); err != nil {
		require.NoError(t, err)
	}
	fakeClock.Advance(libkb.CachedUserTimeout + 2*time.Second)

	up2, err := libkb.LoadUserPlusKeys(context.TODO(), tc.G, me.GetUID(), "")
	require.NoError(t, err)

	require.Len(t, up2.DeviceKeys, 2, "device keys: %d, expected 2", len(up2.DeviceKeys))
	require.Len(t, up2.RevokedDeviceKeys, 2, "revoked keys: %d, expected 2", len(up2.RevokedDeviceKeys))
}

// TestMerkleHashMetaAndFirstAppearedInKeyFamily tests new user & key family features:
//   - FirstAppearedMerkleSeqnoUnverified in sig chain links
//   - EldestSeqno in sig chain links
//   - HashMeta in sig chain links
//
// We should be able to see these fields in sigchains and also propagated through
// to the KeyFamilies
func TestMerkleHashMetaAndFirstAppearedInKeyFamily(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()
	CreateAndSignupFakeUser(tc, "login")
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	require.NoError(t, err)

	ckf := me.GetComputedKeyFamily()
	checkKey := func(key libkb.GenericKey, cki libkb.ComputedKeyInfo, err error) {
		require.NoError(t, err)
		require.NotNil(t, key, "non-nil key")
		require.Len(t, cki.DelegatedAtHashMeta, 32, "needed a SHA256 hash for merkle hash_meta")
		require.True(t, (cki.FirstAppearedUnverified > 0), "need a >0 merkle root first appeared in")
	}
	checkSibkey := func(kid keybase1.KID) {
		checkKey(ckf.FindActiveSibkey(kid))
	}
	checkSubkey := func(kid keybase1.KID) {
		checkKey(ckf.FindActiveEncryptionSubkey(kid))
	}

	for _, sibkey := range ckf.GetAllActiveSibkeys() {
		checkSibkey(sibkey.GetKID())
	}
	for _, subkey := range ckf.GetAllActiveSubkeys() {
		checkSubkey(subkey.GetKID())
	}
}

func assertPostedHighSkipSeqno(t *testing.T, tc libkb.TestContext, name string, seqno int) {
	u, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, name))
	require.NoError(t, err)

	highSkip := u.GetLastLink().GetHighSkip()
	require.Equal(t, highSkip.Seqno, keybase1.Seqno(seqno))
}

func TestBlankUserHighSkip(t *testing.T) {
	tc := SetupEngineTest(t, "user")
	defer tc.Cleanup()

	i := CreateAndSignupFakeUser(tc, "login")

	assertPostedHighSkipSeqno(t, tc, i.Username, 1)
}

func TestPaperUserHighSkip(t *testing.T) {
	tc := SetupEngineTest(t, "user")
	defer tc.Cleanup()
	them, _ := createFakeUserWithNoKeys(tc)

	i := CreateAndSignupFakeUserPaper(tc, "login")
	assertPostedHighSkipSeqno(t, tc, i.Username, 4)

	trackUser(tc, i, libkb.NewNormalizedUsername(them), libkb.GetDefaultSigVersion(tc.G))
	assertPostedHighSkipSeqno(t, tc, i.Username, 4)

	eng := NewPaperKey(tc.G)
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		require.NoError(t, err)
	}
	assertPostedHighSkipSeqno(t, tc, i.Username, 7)
}
