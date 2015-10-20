package engine

import "testing"

func TestXLogin(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewXLogin(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}
