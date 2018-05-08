// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

// TestTrackerList creates a new fake user and has that user track
// t_alice.  It then uses the TrackerList engine to get the
// t_alice's trackers and makes sure that the new fake user is in
// the list.
func TestListTrackers(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testListTrackers(t, sigVersion)
	})
}

func _testListTrackers(t *testing.T, sigVersion libkb.SigVersion) {
	tc := SetupEngineTest(t, "trackerlist")
	defer tc.Cleanup()

	fu := CreateAndSignupFakeUser(tc, "login")
	trackAlice(tc, fu, sigVersion)
	defer untrackAlice(tc, fu, sigVersion)

	uid := libkb.UsernameToUID("t_alice")
	e := NewListTrackers(tc.G, uid)
	m := NewMetaContextForTestWithLogUI(tc)
	if err := RunEngine2(m, e); err != nil {
		t.Fatal(err)
	}
	buid := libkb.UsernameToUID(fu.Username)
	trackers := e.List()
	if len(trackers) == 0 {
		t.Errorf("t_alice tracker count: 0.  expected > 0.")
	}

	found := false
	for _, x := range trackers {
		if x.GetUID().Equal(buid) {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("fake user %q (%s) not included in list of t_alice trackers.", fu.Username, buid)
		t.Logf("tracker list:")
		for i, x := range trackers {
			t.Logf("%d: %s, %d, %d", i, x.Tracker, x.Status, x.MTime)
		}
	}
}
