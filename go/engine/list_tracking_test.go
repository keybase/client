// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	if len(alice.Proofs.Social) != 2 {
		return fmt.Errorf("Num social proofs: %d, expected 2", len(alice.Proofs.Social))
	}
	if len(alice.Proofs.Web) != 0 {
		return fmt.Errorf("Num web proofs: %d, expected 0", len(alice.Proofs.Web))
	}
	if len(alice.Proofs.PublicKeys) != 1 {
		return fmt.Errorf("Num pub keys: %d, expected 1", len(alice.Proofs.PublicKeys))
	}

	expectedFp := "2373fd089f28f328916b88f99c7927c0bdfdadf9"
	foundFp := alice.Proofs.PublicKeys[0].PGPFingerprint
	if foundFp != expectedFp {
		return fmt.Errorf("fp: %q, expected %q", foundFp, expectedFp)
	}

	bob := entries[1]
	if bob.Username != "t_bob" {
		return fmt.Errorf("Username: %q, Expected t_bob.", bob.Username)
	}
	if len(bob.Proofs.Social) != 2 {
		return fmt.Errorf("Num social proofs: %d, expected 2", len(bob.Proofs.Social))
	}
	if len(bob.Proofs.Web) != 0 {
		return fmt.Errorf("Num web proofs: %d, expected 0", len(bob.Proofs.Web))
	}
	if len(bob.Proofs.PublicKeys) != 1 {
		return fmt.Errorf("Num pub keys: %d, expected 1", len(bob.Proofs.PublicKeys))
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
	if err := _verifyListTrackingEntries(eng.TableResult()); err != nil {
		t.Fatal("Error in tracking engine result entries verification:", err)
	}

	// We're running this again using a different, non-signed-in cache to test
	// the manual stubbing override.
	tc2 := SetupEngineTest(t, "track-anonymous")
	defer tc2.Cleanup()

	eng = NewListTrackingEngine(tc2.G, &ListTrackingEngineArg{
		ForAssertion: fu.Username,
	})
	if err := RunEngine2(NewMetaContextForTest(tc2), eng); err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}
	if err := _verifyListTrackingEntries(eng.TableResult()); err != nil {
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

	jw, err := jsonw.Unmarshal([]byte(eng.JSONResult()))
	if err != nil {
		t.Fatal(err)
	}
	pgpKeys := jw.AtIndex(0).AtPath("body.track.pgp_keys")
	n, err := pgpKeys.Len()
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("num pgp_keys: %d, expected 1", n)
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

	entries := eng.TableResult()
	if len(entries) != 2 {
		t.Errorf("Num tracks: %d, exected 2", len(entries))
	}

	// they are sorted so can use indices.
	for _, entry := range entries {
		if entry.Username == "t_alice" {
			if len(entry.Proofs.Social) != 2 {
				t.Errorf("Num social proofs: %d, expected 2", len(entry.Proofs.Social))
			}
			if len(entry.Proofs.Web) != 0 {
				t.Errorf("Num web proofs: %d, expected 0", len(entry.Proofs.Web))
			}
			if len(entry.Proofs.PublicKeys) != 1 {
				t.Fatalf("Num pub keys: %d, expected 1", len(entry.Proofs.PublicKeys))
			}

			expectedFp := "2373fd089f28f328916b88f99c7927c0bdfdadf9"
			foundFp := entry.Proofs.PublicKeys[0].PGPFingerprint
			if foundFp != expectedFp {
				t.Errorf("fp: %q, expected %q", foundFp, expectedFp)
			}
		}
	}
}
