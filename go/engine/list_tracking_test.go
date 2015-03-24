package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	jsonw "github.com/keybase/go-jsonw"
)

func TestListTracking(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(t, "track")
	fu.LoginOrBust(t)

	_, _, err := runTrack(fu, "t_alice")
	if err != nil {
		t.Fatal("Error while tracking t_alice:", err)
	}

	arg := ListTrackingEngineArg{}
	eng := NewListTrackingEngine(&arg)
	ctx := Context{}
	err = RunEngine(eng, &ctx)
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
	foundFp := libkb.ImportPgpFingerprint(entry.Proofs.PublicKeys[0].Fokid).String()
	if foundFp != expectedFp {
		t.Errorf("fp: %q, expected %q", foundFp, expectedFp)
	}
}

func TestListTrackingJSON(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(t, "track")
	fu.LoginOrBust(t)

	_, _, err := runTrack(fu, "t_alice")
	if err != nil {
		t.Fatal("Error while tracking t_alice:", err)
	}

	arg := ListTrackingEngineArg{Json: true, Verbose: true}
	eng := NewListTrackingEngine(&arg)
	ctx := Context{}
	err = RunEngine(eng, &ctx)
	if err != nil {
		t.Fatal("Error in ListTrackingEngine:", err)
	}

	jw, err := jsonw.Unmarshal([]byte(eng.JsonResult()))
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
