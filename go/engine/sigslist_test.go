package engine

import "testing"

func TestSigsList(t *testing.T) {
	tc := SetupEngineTest(t, "sigslist")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewSigsList()
	if err := RunEngine(eng, ctx, nil, nil); err != nil {
		t.Fatal(err)
	}
}
