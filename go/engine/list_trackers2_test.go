// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"testing"
)

// TestTrackerList2 creates a new fake user and has that user track
// t_alice. It then uses the TrackerList engine to get the
// t_alice's trackers and makes sure that the new fake user is in
// the list.
func TestListTrackers2(t *testing.T) {
	tc := SetupEngineTest(t, "trackerlist")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")
	trackAlice(tc, fu)
	defer untrackAlice(tc, fu)

	e := NewListTrackers2(tc.G, keybase1.ListTrackers2Arg{Assertion: "t_alice"})
	ctx := &Context{LogUI: tc.G.UI.GetLogUI()}
	if err := RunEngine(e, ctx); err != nil {
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
