package engine

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase_1 "github.com/keybase/client/protocol/go"
)

// TestLoginNewDeviceKex is a device provisioning test.  It
// simulates the scenario where a user logs in to a new device and
// uses an existing device to provision it.  This test uses
// the api server for all kex communication.
func TestLoginNewDeviceKex(t *testing.T) {
	kexTimeout = time.Second

	// test context for device X
	tcX := libkb.SetupTest(t, "loginX")
	defer tcX.Cleanup()

	// sign up with device X
	G = &tcX.G
	u := CreateAndSignupFakeUser(t, "login")
	// devX := tcX.G.Env.GetDeviceID()
	docui := &ldocuiDevice{&ldocui{}, ""}
	secui := libkb.TestSecretUI{u.Passphrase}

	// test that we can get the secret key:
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	arg := libkb.SecretKeyArg{
		DeviceKey: true,
		Reason:    "new device install",
		Ui:        secui,
		Me:        me,
	}
	_, err = G.Keyrings.GetSecretKey(arg)
	if err != nil {
		t.Fatal(err)
	}

	go func() {
		// authorize on device X
		ctx := &Context{LogUI: tcX.G.UI.GetLogUI(), DoctorUI: docui, SecretUI: secui}

		// wait for docui to know the secret
		for len(docui.secret) == 0 {
			time.Sleep(50 * time.Millisecond)
		}

		kx := NewSibkey(&tcX.G, docui.secret)
		if err := RunEngine(kx, ctx, nil, nil); err != nil {
			t.Fatal(err)
		}
	}()

	// test context for device Y
	tcY := libkb.SetupTest(t, "loginY")
	defer tcY.Cleanup()

	// log in with device Y
	G = &tcY.G
	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   u.Username,
			Passphrase: u.Passphrase,
			NoUi:       true,
		},
		KexSrv: kex.NewSender(kex.DirectionYtoX),
	}

	li := NewLoginEngine()
	ctx := &Context{LogUI: G.UI.GetLogUI(), DoctorUI: docui, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx, larg, nil); err != nil {
		t.Fatal(err)
	}

	testUserHasDeviceKey(t)
}

type ldocuiDevice struct {
	*ldocui
	secret string
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

func (l *ldocuiDevice) DisplaySecretWords(arg keybase_1.DisplaySecretWordsArg) error {
	l.secret = arg.Secret
	G.Log.Info("secret words: %s", arg.Secret)
	return nil
}
