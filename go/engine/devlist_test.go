package engine

import "testing"

func TestDeviceList(t *testing.T) {
	tc := SetupEngineTest(t, "devicelist")
	defer tc.Cleanup()

	CreateAndSignupFakeUser(tc, "login")

	ctx := &Context{LogUI: tc.G.UI.GetLogUI()}
	eng := NewDevList(tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	if len(eng.List(true)) != 1 {
		for i, d := range eng.List(true) {
			t.Logf("%d: %+v", i, d)
		}
		t.Errorf("devices: %d, expected 1", len(eng.List(true)))
	}
}
