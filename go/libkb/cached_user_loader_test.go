// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// There are two test files by this name. One in libkb, one in engine.

package libkb

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	"time"
)

func TestCachedUserLoad(t *testing.T) {
	tc := SetupTest(t, "CachedUserLoader", 1)
	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)

	// Load t_alice a few different ways
	arg := LoadUserArg{
		UID: keybase1.UID("295a7eea607af32040647123732bc819"),
	}
	var info CachedUserLoadInfo
	upk, user, err := tc.G.CachedUserLoader.loadWithInfo(arg, &info)

	checkLoad := func(upk *keybase1.UserPlusAllKeys, err error) {
		if err != nil {
			t.Fatal(err)
		}
		if upk == nil {
			t.Fatal("expected a UPK back")
		}
		if upk.GetName() != "t_alice" {
			t.Fatalf("expected %s but got %s", "t_alice", upk.GetName())
		}
	}
	if info.InCache || info.TimedOut || info.StaleVersion || info.LoadedLeaf || !info.LoadedUser {
		t.Fatalf("wrong info: %+v", info)
	}

	fakeClock.Advance(CachedUserTimeout / 100)
	info = CachedUserLoadInfo{}
	upk, user, err = tc.G.CachedUserLoader.loadWithInfo(arg, &info)
	checkLoad(upk, err)
	if user != nil {
		t.Fatal("expected no full user load")
	}

	if !info.InCache || info.TimedOut || info.StaleVersion || info.LoadedLeaf || info.LoadedUser {
		t.Fatalf("wrong info: %+v", info)
	}

	fakeClock.Advance(2 * CachedUserTimeout)
	info = CachedUserLoadInfo{}
	upk, user, err = tc.G.CachedUserLoader.loadWithInfo(arg, &info)
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

	found, revokedAt, err := tc.G.CachedUserLoader.CheckKIDForUID(georgeUID, georgeKIDSibkey)
	if !found || (revokedAt != nil) || (err != nil) {
		t.Fatalf("bad CheckKIDForUID response")
	}
	found, revokedAt, err = tc.G.CachedUserLoader.CheckKIDForUID(georgeUID, georgeKIDSubkey)
	if !found || (revokedAt != nil) || (err != nil) {
		t.Fatalf("bad CheckKIDForUID response")
	}
	found, revokedAt, err = tc.G.CachedUserLoader.CheckKIDForUID(georgeUID, kbKIDSibkey)
	if found || (revokedAt != nil) || (err != nil) {
		t.Fatalf("bad CheckKIDForUID response")
	}

	found, revokedAt, err = tc.G.CachedUserLoader.CheckKIDForUID(rebeccaUID, rebeccaKIDRevoked)
	if !found || (revokedAt == nil) || (err != nil) {
		t.Fatalf("bad CheckKIDForUID response")
	}
}

func TestLookupUsernameAndDevice(t *testing.T) {
	tc := SetupTest(t, "LookupUsernameAndDevice", 1)
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)

	test := func() {
		uid := keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")
		did := keybase1.DeviceID("e5f7f7ca6b6277de4d2c45f57b767f18")
		un, name, typ, err := tc.G.CachedUserLoader.LookupUsernameAndDevice(uid, did)
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
		tc.G.CachedUserLoader.ClearMemory()
	}
}
