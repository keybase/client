// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// TestTrackerList2 creates a new fake user and has that user track
// t_alice. It then uses the TrackerList engine to get the
// t_alice's trackers and makes sure that the new fake user is in
// the list.
func TestListTrackers2(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testListTrackers2(t, sigVersion)
	})
}

func _testListTrackers2(t *testing.T, sigVersion libkb.SigVersion) {
	tc := SetupEngineTest(t, "trackerlist")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")
	trackAlice(tc, fu, sigVersion)
	defer untrackAlice(tc, fu, sigVersion)

	e := NewListTrackers2(tc.G, keybase1.ListTrackers2Arg{Assertion: "t_alice"})
	m := NewMetaContextForTestWithLogUI(tc)
	if err := RunEngine2(m, e); err != nil {
		t.Fatal(err)
	}
	res := e.GetResults()
	if len(res.Users) == 0 {
		t.Errorf("t_alice tracker count: 0. expected > 0.")
	}

	found := false
	for _, x := range res.Users {
		if x.Username == fu.Username {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("fake user %q not included in list of t_alice trackers.", fu.Username)
		t.Logf("tracker list:")
		for i, x := range res.Users {
			t.Logf("%d: %s (%s)", i, x.Username, x.FullName)
		}
	}
}
