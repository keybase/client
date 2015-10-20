package engine

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func TestXLogin(t *testing.T) {
	tc := SetupEngineTest(t, "template")
	defer tc.Cleanup()

	ctx := &Context{
		ProvisionUI: &testProvisionUI{},
	}
	eng := NewXLogin(tc.G, libkb.DeviceTypeDesktop, "")
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
}

type testProvisionUI struct{}

func (u *testProvisionUI) ChooseProvisioningMethod(_ context.Context, _ keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	return keybase1.ProvisionMethod_DEVICE, nil
}

func (u *testProvisionUI) ChooseProvisionerDeviceType(_ context.Context, _ int) (keybase1.DeviceType, error) {
	return keybase1.DeviceType_DESKTOP, nil
}
