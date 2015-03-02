package engine

import (
	"fmt"
	"sync"
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
	kex.StartTimeout = 5 * time.Second
	kex.IntraTimeout = 5 * time.Second
	kex.PollDuration = 1 * time.Second

	// test context for device X
	tcX := SetupEngineTest(t, "loginX")
	defer tcX.Cleanup()

	// sign up with device X
	G = &tcX.G
	u := CreateAndSignupFakeUser(t, "login")
	docui := &ldocuiDevice{ldocui: &ldocui{}}
	secui := libkb.TestSecretUI{u.Passphrase}

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		// authorize on device X
		ctx := &Context{LogUI: tcX.G.UI.GetLogUI(), DoctorUI: docui, SecretUI: secui}

		// wait for docui to know the secret
		for len(docui.secretPhrase()) == 0 {
			time.Sleep(50 * time.Millisecond)
		}

		kx := NewKexSib(&tcX.G, docui.secretPhrase())
		if err := RunEngine(kx, ctx, nil, nil); err != nil {
			t.Fatal(err)
		}
		wg.Done()
	}()

	// test context for device Y
	tcY := SetupEngineTest(t, "loginY")
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
	}

	li := NewLoginEngine()
	ctx := &Context{LogUI: G.UI.GetLogUI(), DoctorUI: docui, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx, larg, nil); err != nil {
		t.Fatal(err)
	}

	testUserHasDeviceKey(t)
	wg.Wait()
}

type ldocuiDevice struct {
	*ldocui
	secret string
	sync.Mutex
}

func (l *ldocuiDevice) secretPhrase() string {
	l.Lock()
	defer l.Unlock()
	return l.secret
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
	l.Lock()
	l.secret = arg.Secret
	l.Unlock()
	G.Log.Info("secret words: %s", arg.Secret)
	return nil
}
