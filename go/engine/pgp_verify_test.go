package engine

import "testing"

func TestPGPVerify(t *testing.T) {
	tc := SetupEngineTest(t, "PGPVerify")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewPGPVerify()
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}
