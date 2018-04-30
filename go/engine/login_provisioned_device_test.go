package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestLoginDeviceIDConfigIssues(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	// create a user to fill up config with something
	fu := CreateAndSignupFakeUser(tc, "fake")
	Logout(tc)

	// remove device id from config file
	tc.G.Env.GetConfigWriter().SetDeviceID("")

	// now try to log in on current device
	uis := libkb.UIs{
		LoginUI:  &libkb.TestLoginUI{Username: fu.Username},
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewLoginProvisionedDevice(tc.G, fu.Username)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, eng)
	if err != errNoDevice {
		t.Errorf("run error: %v, expected %v", err, errNoDevice)
	}

	// put a device id into config file that is not this user's device
	tc.G.Env.GetConfigWriter().SetDeviceID("31a7669bfa163eed3619780ebac8ee18")
	eng = NewLoginProvisionedDevice(tc.G, fu.Username)
	err = RunEngine2(m, eng)
	if err != errNoDevice {
		t.Errorf("run error: %v, expected %v", err, errNoDevice)
	}
}
