// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

func TestListTracking(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")
	fu.LoginOrBust(tc)

	trackAlice(tc, fu)
	defer untrackAlice(tc, fu)

	arg := ListTrackingEngineArg{}
	eng := NewListTrackingEngine(&arg, tc.G)
	ctx := Context{}
	err := RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}

	entries := eng.TableResult()
	if len(entries) != 1 {
		t.Errorf("Num tracks: %d, exected 1.", len(entries))
	}

	entry := entries[0]
	if entry.Username != "t_alice" {
		t.Errorf("Username: %q, Expected t_alice.", entry.Username)
	}
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

func TestListTrackingJSON(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")
	fu.LoginOrBust(tc)

	trackAlice(tc, fu)
	defer untrackAlice(tc, fu)

	arg := ListTrackingEngineArg{JSON: true, Verbose: true}
	eng := NewListTrackingEngine(&arg, tc.G)
	ctx := Context{}
	err := RunEngine(eng, &ctx)
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
	fu := CreateAndSignupFakeUser(tc, "track")

	trackAlice(tc, fu)
	defer untrackAlice(tc, fu)

	trackBobWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: true}, fu.NewSecretUI())
	defer untrackBob(tc, fu)

	arg := ListTrackingEngineArg{}
	eng := NewListTrackingEngine(&arg, tc.G)
	ctx := Context{}
	err := RunEngine(eng, &ctx)
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
