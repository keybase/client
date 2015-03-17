package engine

import "testing"

func TestIdentify(t *testing.T) {
	t.Skip()
	tc := SetupEngineTest(t, "Identify")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewIdentify(nil)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}
