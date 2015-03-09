package engine

import (
	"testing"
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
	err = RunEngine(eng, &ctx, nil, nil)
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
}
