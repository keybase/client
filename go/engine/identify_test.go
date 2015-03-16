package engine

import "testing"

func TestIdentify(t *testing.T) {
	tc := SetupEngineTest(t, "Identify")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewIdentify(nil)
	if err := RunEngine(eng, ctx, nil, nil); err != nil {
		t.Fatal(err)
	}
}
