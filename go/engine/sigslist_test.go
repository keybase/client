package engine

import "testing"

func TestSigsList(t *testing.T) {
	tc := SetupEngineTest(t, "sigslist")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewSigsList("t_alice", false, nil, "")
	if err := RunEngine(eng, ctx, nil, nil); err != nil {
		t.Fatal(err)
	}

	s := eng.Sigs()
	if len(s) != 3 {
		t.Errorf("t_alice sig count: %d, expected 3", len(s))
		for _, s := range eng.Sigs() {
			t.Logf("sig: %+v\n", s)
		}
	}
}
