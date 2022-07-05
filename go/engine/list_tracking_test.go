// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/stretchr/testify/require"
)

func TestListTracking(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testListTracking(t, sigVersion)
	})
}

func _verifyListTrackingEntries(entries []keybase1.UserSummary) error {
	if len(entries) != 2 {
		return fmt.Errorf("Num tracks: %d, exected 2.", len(entries))
	}

	alice := entries[0]
	if alice.Username != "t_alice" {
		return fmt.Errorf("Username: %q, Expected t_alice.", alice.Username)
	}
	bob := entries[1]
	if bob.Username != "t_bob" {
		return fmt.Errorf("Username: %q, Expected t_bob.", bob.Username)
	}

	return nil
}

func _testListTracking(t *testing.T, sigVersion libkb.SigVersion) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")
	fu.LoginOrBust(tc)

	trackAlice(tc, fu, sigVersion)
	trackBob(tc, fu, sigVersion)
	defer untrackAlice(tc, fu, sigVersion)
	defer untrackBob(tc, fu, sigVersion)

	// Perform a proof to make sure that the last item of the chain isn't a track
	proveUI, _, err := proveRooter(tc.G, fu, sigVersion)
	require.NoError(t, err)
	require.False(t, proveUI.overwrite)
	require.False(t, proveUI.warning)
	require.False(t, proveUI.recheck)
	require.True(t, proveUI.checked)

	eng := NewListTrackingEngine(tc.G, &ListTrackingEngineArg{})
	if err := RunEngine2(NewMetaContextForTest(tc), eng); err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}
	if err := _verifyListTrackingEntries(eng.TableResult().Users); err != nil {
		t.Fatal("Error in tracking engine result entries verification:", err)
	}

	// We're running this again using a different, non-signed-in cache to test
	// the manual stubbing override.
	tc2 := SetupEngineTest(t, "track-anonymous")
	defer tc2.Cleanup()

	eng = NewListTrackingEngine(tc2.G, &ListTrackingEngineArg{
		Assertion: fu.Username,
	})
	if err := RunEngine2(NewMetaContextForTest(tc2), eng); err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}
	if err := _verifyListTrackingEntries(eng.TableResult().Users); err != nil {
		t.Fatal("Error in tracking engine result entries verification:", err)
	}
}

func TestListTrackingJSON(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	fu := CreateAndSignupFakeUser(tc, "track")
	fu.LoginOrBust(tc)

	trackAlice(tc, fu, sigVersion)
	defer untrackAlice(tc, fu, sigVersion)

	arg := ListTrackingEngineArg{JSON: true, Verbose: true}
	eng := NewListTrackingEngine(tc.G, &arg)
	m := NewMetaContextForTest(tc)
	err := RunEngine2(m, eng)
	if err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}

	_, err = jsonw.Unmarshal([]byte(eng.JSONResult()))
	if err != nil {
		t.Fatal(err)
	}
}

func TestListTrackingLocal(t *testing.T) {
	t.Skip("Skipping test for local tracks in list tracking (milestone 2)")
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	fu := CreateAndSignupFakeUser(tc, "track")

	trackAlice(tc, fu, sigVersion)
	defer untrackAlice(tc, fu, sigVersion)

	sv := keybase1.SigVersion(sigVersion)
	trackBobWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: true, SigVersion: &sv}, fu.NewSecretUI())
	defer untrackBob(tc, fu, sigVersion)

	arg := ListTrackingEngineArg{}
	eng := NewListTrackingEngine(tc.G, &arg)
	m := NewMetaContextForTest(tc)
	err := RunEngine2(m, eng)
	if err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}

	entries := eng.TableResult().Users
	if len(entries) != 2 {
		t.Errorf("Num tracks: %d, exected 2", len(entries))
	}
}

func TestListTrackingServerInterference(t *testing.T) {
	atc := SetupEngineTest(t, "track")
	defer atc.Cleanup()
	btc := SetupEngineTest(t, "track")
	defer btc.Cleanup()
	ctc := SetupEngineTest(t, "track")
	defer ctc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(atc.G)

	alice := CreateAndSignupFakeUser(atc, "track")
	bob := CreateAndSignupFakeUser(btc, "track")
	charlie := CreateAndSignupFakeUser(ctc, "track")
	alice.LoginOrBust(atc)

	_, _, err := runTrack(atc, alice, bob.Username, sigVersion)
	require.NoError(t, err)

	eng := NewListTrackingEngine(atc.G, &ListTrackingEngineArg{})
	if err := RunEngine2(NewMetaContextForTest(atc), eng); err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}
	found := false
	for _, user := range eng.TableResult().Users {
		if user.Username == bob.Username {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected to be following bob, but wasn't")
	}

	ResetAccount(btc, bob)

	// (MD/TRIAGE-1837) Due to a server bug, it seems the follow version doesn't
	// update immediately on resets, only on the next follow, so we're not
	// going to get the proper filtration until we bump it e.g. by following
	// another random user.
	_, _, err = runTrack(atc, alice, charlie.Username, sigVersion)
	require.NoError(t, err)

	eng = NewListTrackingEngine(atc.G, &ListTrackingEngineArg{})
	if err := RunEngine2(NewMetaContextForTest(atc), eng); err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}
	found = false
	for _, user := range eng.TableResult().Users {
		if user.Username == bob.Username {
			found = true
		}
	}
	if found {
		t.Fatalf("expected server to filter out reset bob, but didn't; still following after reset")
	}

	eng = NewListTrackingEngine(atc.G, &ListTrackingEngineArg{})
	eng.disableTrackerSyncerForTest = true
	if err := RunEngine2(NewMetaContextForTest(atc), eng); err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}
	found = false
	for _, user := range eng.TableResult().Users {
		if user.Username == bob.Username {
			found = true
		}
	}
	if !found {
		t.Fatalf("tracker syncer returned error; so we should still succeed but not filter")
	}
}

type errorAPIMock struct {
	*libkb.APIArgRecorder
	callCount int
}

func (r *errorAPIMock) GetDecode(mctx libkb.MetaContext, arg libkb.APIArg, w libkb.APIResponseWrapper) error {
	r.callCount++
	return errors.New("timeout or something")
}

func (r errorAPIMock) GetResp(mctx libkb.MetaContext, arg libkb.APIArg) (*http.Response, func(), error) {
	r.callCount++
	return nil, func() {}, errors.New("timeout or something")
}

func (r errorAPIMock) Get(mctx libkb.MetaContext, arg libkb.APIArg) (*libkb.APIRes, error) {
	r.callCount++
	return nil, errors.New("timeout or something")
}

func TestListTrackingOfflineBehavior(t *testing.T) {
	atc := SetupEngineTest(t, "track")
	defer atc.Cleanup()
	btc := SetupEngineTest(t, "track")
	defer btc.Cleanup()
	ctc := SetupEngineTest(t, "track")
	defer ctc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(atc.G)

	alice := CreateAndSignupFakeUser(atc, "track")
	bob := CreateAndSignupFakeUser(btc, "track")
	charlie := CreateAndSignupFakeUser(ctc, "track")
	alice.LoginOrBust(atc)

	_, _, err := runTrack(atc, alice, bob.Username, sigVersion)
	require.NoError(t, err)

	// Prime UPAK and TrackerSyncer caches when online
	eng := NewListTrackingEngine(atc.G, &ListTrackingEngineArg{})
	if err := RunEngine2(NewMetaContextForTest(atc), eng); err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}
	res1 := eng.TableResult()

	// realAPI := atc.G.API
	fakeAPI := &errorAPIMock{}
	atc.G.API = fakeAPI

	// We're offline now
	_, _, err = runTrack(atc, alice, charlie.Username, sigVersion)
	require.Error(t, err)
	require.Contains(t, err.Error(), "timeout or something")

	c := clockwork.NewFakeClockAt(atc.G.Clock().Now())
	atc.G.SetClock(c)

	t.Logf("Test CachedOnly")
	// But ListTracking with CachedOnly=true should still work.
	eng = NewListTrackingEngine(atc.G, &ListTrackingEngineArg{CachedOnly: true})
	err = RunEngine2(NewMetaContextForTest(atc), eng)
	require.NoError(t, err)
	res2 := eng.TableResult()
	require.Equal(t, res1, res2, "got same results even when offline")

	staleness := time.Hour * 24 * 7
	t.Logf("Test offline 1 day later")
	// Should work even if we're still offline 1 day later (longer than the 10
	// minute UPAK staleness window), if CachedOnlyStalenessWindow passed.
	stalenesseng := NewListTrackingEngine(atc.G, &ListTrackingEngineArg{CachedOnly: true, CachedOnlyStalenessWindow: &staleness})
	c.Advance(time.Hour * 24)
	err = RunEngine2(NewMetaContextForTest(atc), stalenesseng)
	require.NoError(t, err)

	t.Logf("Should return an error past the staleness window")
	c.Advance(time.Hour * 24 * 8)
	err = RunEngine2(NewMetaContextForTest(atc), stalenesseng)
	require.Error(t, err)
	require.IsType(t, err, libkb.UserNotFoundError{})
}
