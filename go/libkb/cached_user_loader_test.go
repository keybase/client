// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"github.com/jonboulle/clockwork"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"testing"
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
	if info.InCache || info.TimedOut || info.StaleVersion {
		t.Fatalf("wrong info: %+v", info)
	}

	fakeClock.Advance(CachedUserTimeout / 100)
	upk, user, err = tc.G.CachedUserLoader.loadWithInfo(arg, &info)
	checkLoad(upk, err)
	if user != nil {
		t.Fatal("expected no full user load")
	}

	if !info.InCache || info.TimedOut || info.StaleVersion {
		t.Fatalf("wrong info: %+v", info)
	}

	fakeClock.Advance(2 * CachedUserTimeout)
	upk, user, err = tc.G.CachedUserLoader.loadWithInfo(arg, &info)
	checkLoad(upk, err)
	if user != nil {
		t.Fatal("expected no full user load")
	}
	if !info.InCache || !info.TimedOut || info.StaleVersion {
		t.Fatalf("wrong info: %+v", info)
	}
}
