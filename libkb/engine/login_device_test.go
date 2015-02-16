package engine

import (
	"testing"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

func TestLoginNewDevice(t *testing.T) {
	tc := libkb.SetupTest(t, "login")
	u1 := CreateAndSignupFakeUser(t, "login")
	G.LoginState.Logout()
	tc.Cleanup()

	// redo SetupTest to get a new home directory...should look like a new device.
	tc2 := libkb.SetupTest(t, "login")
	defer tc2.Cleanup()

	docui := &ldocuiDevice{&ldocui{}}

	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   u1.Username,
			Passphrase: u1.Passphrase,
			NoUi:       true,
		},
		LogUI:    G.UI.GetLogUI(),
		DoctorUI: docui,
	}

	before := docui.selectSignerCount

	li := NewLoginEngine()

	if err := li.Run(larg); err != ErrNotYetImplemented {
		t.Fatal(err)
	}

	after := docui.selectSignerCount
	if after-before != 1 {
		t.Errorf("doc ui SelectSigner called %d times, expected 1", after-before)
	}
}

type ldocuiDevice struct {
	*ldocui
}

func (l *ldocuiDevice) SelectSigner(arg keybase_1.SelectSignerArg) (res keybase_1.SelectSignerRes, err error) {
	l.selectSignerCount++
	res.Action = keybase_1.SelectSignerAction_SIGN
	devid := "xxxxxxxxxxxxxxxxxxxxxxxxxxx"
	res.Signer = &keybase_1.DeviceSigner{Kind: keybase_1.DeviceSignerKind_DEVICE, DeviceID: &devid}
	return
}
