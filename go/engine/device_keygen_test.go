package engine

import "testing"

func TestDeviceKeygen(t *testing.T) {
	tc := SetupEngineTest(t, "DeviceKeygen")
	defer tc.Cleanup()

	ctx := &Context{}
	eng := NewDeviceKeygen()
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}
