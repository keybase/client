package engine

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase1 "github.com/keybase/client/protocol/go"
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
	G = tcX.G
	u := CreateAndSignupFakeUser(t, "login")
	docui := &lockuiDevice{lockui: &lockui{}}
	secui := libkb.TestSecretUI{Passphrase: u.Passphrase}

	// test that we can get the secret key:
	// XXX this is necessary for the test to pass once the goroutine starts
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	arg := libkb.SecretKeyArg{
		DeviceKey: true,
		Me:        me,
	}
	_, _, err = G.Keyrings.GetSecretKeyWithPrompt(arg, secui, "new device install")
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		// authorize on device X
		ctx := &Context{LogUI: tcX.G.UI.GetLogUI(), LocksmithUI: docui, SecretUI: secui}

		// wait for docui to know the secret
		for len(docui.secretPhrase()) == 0 {
			time.Sleep(50 * time.Millisecond)
		}

		kx := NewKexSib(tcX.G, docui.secretPhrase())
		if err := RunEngine(kx, ctx); err != nil {
			t.Fatal(err)
		}
		wg.Done()
	}()

	// test context for device Y
	tcY := SetupEngineTest(t, "loginY")
	defer tcY.Cleanup()

	// log in with device Y
	G = tcY.G
	li := NewLoginWithPromptEngine(u.Username)
	ctx := &Context{LogUI: G.UI.GetLogUI(), LocksmithUI: docui, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}

	testUserHasDeviceKey(t)
	wg.Wait()
}

type lockuiDevice struct {
	*lockui
	secret string
	sync.Mutex
}

func (l *lockuiDevice) secretPhrase() string {
	l.Lock()
	defer l.Unlock()
	return l.secret
}

// select the first device
func (l *lockuiDevice) SelectSigner(arg keybase1.SelectSignerArg) (res keybase1.SelectSignerRes, err error) {
	l.selectSignerCount++
	if len(arg.Devices) == 0 {
		return res, fmt.Errorf("expected len(devices) > 0")
	}
	res.Action = keybase1.SelectSignerAction_SIGN
	devid := arg.Devices[0].DeviceID
	devname := arg.Devices[0].Name
	res.Signer = &keybase1.DeviceSigner{Kind: keybase1.DeviceSignerKind_DEVICE, DeviceID: &devid, DeviceName: &devname}
	return
}

func (l *lockuiDevice) DisplaySecretWords(arg keybase1.DisplaySecretWordsArg) error {
	l.Lock()
	l.secret = arg.Secret
	l.Unlock()
	G.Log.Info("secret words: %s", arg.Secret)
	return nil
}
