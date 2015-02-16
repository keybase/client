package engine

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/go/libkb"
	keybase_1 "github.com/keybase/protocol/go"
)

func TestLoginNewDevice(t *testing.T) {
	kexTimeout = 1 * time.Second
	// fake kex server implementation
	ksrv := &kexsrv{}

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
		KexSrv:   ksrv,
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

// select the first device
func (l *ldocuiDevice) SelectSigner(arg keybase_1.SelectSignerArg) (res keybase_1.SelectSignerRes, err error) {
	l.selectSignerCount++
	if len(arg.Devices) == 0 {
		return res, fmt.Errorf("expected len(devices) > 0")
	}
	res.Action = keybase_1.SelectSignerAction_SIGN
	devid := arg.Devices[0].DeviceID
	res.Signer = &keybase_1.DeviceSigner{Kind: keybase_1.DeviceSignerKind_DEVICE, DeviceID: &devid}
	return
}

type kexsrv struct{}

func (k *kexsrv) StartKexSession(id KexStrongID, context *KexContext) error     { return nil }
func (k *kexsrv) StartReverseKexSession(context *KexContext) error              { return nil }
func (k *kexsrv) Hello(context *KexContext) error                               { return nil }
func (k *kexsrv) PleaseSign(context *KexContext) error                          { return nil }
func (k *kexsrv) Done(context *KexContext) error                                { return nil }
func (k *kexsrv) RegisterTestDevice(srv KexServer, device libkb.DeviceID) error { return nil }
