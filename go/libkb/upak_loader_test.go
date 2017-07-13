// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// There are two test files by this name. One in libkb, one in engine.

package libkb

import (
	context "golang.org/x/net/context"
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func TestCachedUserLoad(t *testing.T) {
	tc := SetupTest(t, "GetUPAKLoader()", 1)
	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)

	// Load t_alice a few different ways
	arg := LoadUserArg{
		UID: keybase1.UID("295a7eea607af32040647123732bc819"),
	}
	var info CachedUserLoadInfo
	upk, user, err := tc.G.GetUPAKLoader().(*CachedUPAKLoader).loadWithInfo(arg, &info, nil, true)

	checkLoad := func(upk *keybase1.UserPlusKeysV2AllIncarnations, err error) {
		if err != nil {
			t.Fatal(err)
		}
		if upk == nil {
			t.Fatal("expected a UPK back")
		}
		if upk.Current.Username != "t_alice" {
			t.Fatalf("expected %s but got %s", "t_alice", upk.Current.Username)
		}
	}
	if info.InCache || info.TimedOut || info.StaleVersion || info.LoadedLeaf || !info.LoadedUser {
		t.Fatalf("wrong info: %+v", info)
	}

	fakeClock.Advance(CachedUserTimeout / 100)
	info = CachedUserLoadInfo{}
	upk, user, err = tc.G.GetUPAKLoader().(*CachedUPAKLoader).loadWithInfo(arg, &info, nil, true)
	checkLoad(upk, err)
	if user != nil {
		t.Fatal("expected no full user load")
	}

	if !info.InCache || info.TimedOut || info.StaleVersion || info.LoadedLeaf || info.LoadedUser {
		t.Fatalf("wrong info: %+v", info)
	}

	fakeClock.Advance(2 * CachedUserTimeout)
	info = CachedUserLoadInfo{}
	upk, user, err = tc.G.GetUPAKLoader().(*CachedUPAKLoader).loadWithInfo(arg, &info, nil, true)
	checkLoad(upk, err)
	if user != nil {
		t.Fatal("expected no full user load")
	}
	if !info.InCache || !info.TimedOut || info.StaleVersion || !info.LoadedLeaf || info.LoadedUser {
		t.Fatalf("wrong info: %+v", info)
	}
}

func TestCheckKIDForUID(t *testing.T) {
	tc := SetupTest(t, "CheckKIDForUID", 1)
	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)

	georgeUID := keybase1.UID("9f9611a4b7920637b1c2a839b2a0e119")
	georgeKIDSibkey := keybase1.KID("01206f31b54690a95a1a60a0d8861c8ec27c322b49a93b475a631ee6a676018bfd140a")
	georgeKIDSubkey := keybase1.KID("0121d6543b431d9d3b7485cf23fd6d9fa719bbc2429141dcc44b94ebf4093c37aa5b0a")

	// The 't_kb' user's Sibkey for device named 'Computer'
	kbKIDSibkey := keybase1.KID("0120d2156264b9023ca1828a57e6e925cbb48f80e8e701fe036b1dfd50337d10d6db0a")

	rebeccaUID := keybase1.UID("99337e411d1004050e9e7ee2cf1a6219")
	rebeccaKIDRevoked := keybase1.KID("0120e177772304cd9ec833ceb88eeb6e32a667151d9e4fb09df433a846d05e6c40350a")

	found, revokedAt, deleted, err := tc.G.GetUPAKLoader().CheckKIDForUID(nil, georgeUID, georgeKIDSibkey)
	if !found || (revokedAt != nil) || deleted || (err != nil) {
		t.Fatalf("bad CheckKIDForUID response")
	}
	found, revokedAt, deleted, err = tc.G.GetUPAKLoader().CheckKIDForUID(nil, georgeUID, georgeKIDSubkey)
	if !found || (revokedAt != nil) || deleted || (err != nil) {
		t.Fatalf("bad CheckKIDForUID response")
	}
	found, revokedAt, deleted, err = tc.G.GetUPAKLoader().CheckKIDForUID(nil, georgeUID, kbKIDSibkey)
	if found || (revokedAt != nil) || deleted || (err != nil) {
		t.Fatalf("bad CheckKIDForUID response")
	}

	found, revokedAt, deleted, err = tc.G.GetUPAKLoader().CheckKIDForUID(nil, rebeccaUID, rebeccaKIDRevoked)
	if !found || (revokedAt == nil) || deleted || (err != nil) {
		t.Fatalf("bad CheckKIDForUID response")
	}
}

func TestCacheFallbacks(t *testing.T) {
	tc := SetupTest(t, "LookupUsernameAndDevice", 1)
	defer tc.Cleanup()
	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)

	test := func() *CachedUserLoadInfo {
		var ret CachedUserLoadInfo
		uid := keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")
		var arg LoadUserArg
		arg.UID = uid
		upk, _, err := tc.G.GetUPAKLoader().(*CachedUPAKLoader).loadWithInfo(arg, &ret, nil, false)
		require.NoError(t, err)
		require.Equal(t, upk.Current.Username, "t_tracy", "tracy was right")
		return &ret
	}
	i := test()
	require.True(t, (!i.InCache && !i.InDiskCache && !i.TimedOut && !i.StaleVersion && !i.LoadedLeaf && i.LoadedUser))
	i = test()
	require.True(t, (i.InCache && !i.InDiskCache && !i.TimedOut && !i.StaleVersion && !i.LoadedLeaf && !i.LoadedUser))
	tc.G.GetUPAKLoader().ClearMemory()
	i = test()
	require.True(t, (!i.InCache && i.InDiskCache && !i.TimedOut && !i.StaleVersion && !i.LoadedLeaf && !i.LoadedUser))
	i = test()
	require.True(t, (i.InCache && !i.InDiskCache && !i.TimedOut && !i.StaleVersion && !i.LoadedLeaf && !i.LoadedUser))
	fakeClock.Advance(10 * time.Hour)
	i = test()
	require.True(t, (i.InCache && !i.InDiskCache && i.TimedOut && !i.StaleVersion && i.LoadedLeaf && !i.LoadedUser))
	tc.G.GetUPAKLoader().ClearMemory()
	i = test()
	require.True(t, (!i.InCache && i.InDiskCache && !i.TimedOut && !i.StaleVersion && !i.LoadedLeaf && !i.LoadedUser))
}

func TestLookupUsernameAndDevice(t *testing.T) {
	tc := SetupTest(t, "LookupUsernameAndDevice", 1)
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)

	test := func() {
		uid := keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")
		did := keybase1.DeviceID("e5f7f7ca6b6277de4d2c45f57b767f18")
		un, name, typ, err := tc.G.GetUPAKLoader().LookupUsernameAndDevice(nil, uid, did)
		require.NoError(t, err)
		require.Equal(t, un.String(), "t_tracy", "tracy was right")
		require.Equal(t, name, "work", "right device name")
		require.Equal(t, typ, "desktop", "right type")
	}

	for i := 0; i < 2; i++ {
		test()
		test()
		fakeClock.Advance(10 * time.Hour)
		test()
		test()
		tc.G.GetUPAKLoader().ClearMemory()
	}
}

func TestLookupUID(t *testing.T) {
	tc := SetupTest(t, "LookupUsernameAndDevice", 1)
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)

	test := func() {
		uid := keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")
		un := NewNormalizedUsername("t_tracy")
		uid2, err := tc.G.GetUPAKLoader().LookupUID(nil, un)
		require.NoError(t, err)
		require.Equal(t, uid, uid2)
	}

	for i := 0; i < 2; i++ {
		test()
		test()
		fakeClock.Advance(10 * time.Hour)
		test()
		test()
		tc.G.GetUPAKLoader().ClearMemory()
	}
}

func TestLookupUsername(t *testing.T) {
	tc := SetupTest(t, "LookupUsernameAndDevice", 1)
	defer tc.Cleanup()
	uid := keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")
	un, err := tc.G.GetUPAKLoader().LookupUsername(nil, uid)
	require.NoError(t, err)
	require.Equal(t, un, NewNormalizedUsername("t_tracy"), "tracy came back")
	badUID := keybase1.UID("eb72f49f2dde6429e5d78003dae0b919")
	_, err = tc.G.GetUPAKLoader().LookupUsername(nil, badUID)
	require.Error(t, err)
}

func TestLoadUPAK2(t *testing.T) {
	tc := SetupTest(t, "LookupUsernameAndDevice", 1)
	defer tc.Cleanup()

	load := func() {
		uid := keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")
		upak, _, err := tc.G.GetUPAKLoader().LoadV2(NewLoadUserByUIDArg(context.TODO(), tc.G, uid))
		require.NoError(t, err)
		key, ok := upak.Current.DeviceKeys[keybase1.KID("01204fbb0a8ee105c2732155bffd927a6f612b6a36c63c484e6290f6a7ac560a1a780a")]
		require.True(t, ok)
		require.Equal(t, key.Base.Provisioning.SigChainLocation.Seqno, keybase1.Seqno(3))
		require.Equal(t, key.Base.Provisioning.SigChainLocation.SeqType, keybase1.SeqType_PUBLIC)
		require.Nil(t, key.Base.Revocation)
	}

	load()
	load()
}
