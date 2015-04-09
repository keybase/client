package engine

import "testing"

func TestDoctor(t *testing.T) {
	tc := SetupEngineTest(t, "Doctor")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewDoctor()
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}
