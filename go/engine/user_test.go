// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestLoadUserPlusKeysHasKeys(t *testing.T) {
	tc := SetupEngineTest(t, "user")
	defer tc.Cleanup()

	CreateAndSignupFakeUserPaper(tc, "login")
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}
	up, err := libkb.LoadUserPlusKeys(nil, tc.G, me.GetUID(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(up.DeviceKeys) != 4 {
		t.Errorf("num device keys: %d, expected 4", len(up.DeviceKeys))
	}
}

func TestLoadUserPlusKeysRevoked(t *testing.T) {
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc := SetupEngineTest(t, "login")
	tc.G.SetClock(fakeClock)
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUserPaper(tc, "login")
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}
	up, err := libkb.LoadUserPlusKeys(nil, tc.G, me.GetUID(), "")
	if err != nil {
		t.Fatal(err)
	}

	if len(up.DeviceKeys) != 4 {
		t.Errorf("device keys: %d, expected 4", len(up.DeviceKeys))
	}
	if len(up.RevokedDeviceKeys) != 0 {
		t.Errorf("revoked keys: %d, expected 0", len(up.RevokedDeviceKeys))
	}

	devices, _ := getActiveDevicesAndKeys(tc, fu)
	var paper *libkb.Device
	for _, device := range devices {
		if device.Type == libkb.DeviceTypePaper {
			paper = device
			break
		}
	}

	if err := doRevokeDevice(tc, fu, paper.ID, false); err != nil {
		t.Fatal(err)
	}
	fakeClock.Advance(libkb.CachedUserTimeout + 2*time.Second)

	up2, err := libkb.LoadUserPlusKeys(nil, tc.G, me.GetUID(), "")
	if err != nil {
		t.Fatal(err)
	}

	if len(up2.DeviceKeys) != 2 {
		t.Errorf("device keys: %d, expected 2", len(up2.DeviceKeys))
	}
	if len(up2.RevokedDeviceKeys) != 2 {
		t.Errorf("revoked keys: %d, expected 2", len(up2.RevokedDeviceKeys))
	}
}

// TestMerkleHashMetaAndFirstAppearedInKeyFamily tests new user & key family features:
//   * FirstAppearedMerkleSeqnoUnverified in sig chain links
//   * EldestSeqno in sig chain links
//   * HashMeta in sig chain links
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
		require.Equal(t, len(cki.DelegatedAtHashMeta), 32, "needed a SHA256 hash for merkle hash_meta")
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
