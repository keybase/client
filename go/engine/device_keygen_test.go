package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestDeviceKeygen(t *testing.T) {
	t.Skip()
	tc := SetupEngineTest(t, "DeviceKeygen")
	defer tc.Cleanup()

	ctx := &Context{
		LogUI: G.UI.GetLogUI(),
	}
	args := NewDeviceKeygenArgsEldest(nil, nil, libkb.DeviceID{}, "")
	eng := NewDeviceKeygen(args)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}
