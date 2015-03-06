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
	if len(entries) == 0 {
		t.Fatal("No tracks listed. Expected t_alice.")
	}
	if len(entries) > 1 {
		t.Fatal("Too many tracks listed.", entries)
	}
	entry := entries[0]
	if entry.Username != "t_alice" {
		t.Fatal("Wrong user. Expected t_alice.", entry)
	}
	if len(entry.Proofs) != 2 {
		t.Fatal("Expected 2 proofs.", entry.Proofs)
	}
}
