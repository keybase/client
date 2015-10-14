package engine

import "testing"

func TestKex2Provisionee(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewKex2Provisionee(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}
