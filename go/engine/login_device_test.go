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
	kex.HelloTimeout = 5 * time.Second
	kex.IntraTimeout = 5 * time.Second
	kex.PollDuration = 1 * time.Second

	// test context for device X
	tcX := SetupEngineTest(t, "loginX")
	defer tcX.Cleanup()

	// sign up with device X
	u := CreateAndSignupFakeUser(tcX, "login")
	docuiShared := lockuiDeviceShared{}
	docui := &lockuiDevice{lockui: &lockui{deviceName: "device X"}, shared: &docuiShared}
	secui := &libkb.TestSecretUI{Passphrase: u.Passphrase}

	// test that we can get the secret key:
	// XXX this is necessary for the test to pass once the goroutine starts
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	arg := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	_, _, err = tcX.G.Keyrings.GetSecretKeyWithPrompt(nil, arg, secui, "new device install")
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

	if tcY.G == tcX.G {
		t.Fatalf("tcY.G == tcX.G")
	}

	// log in with device Y
	li := NewLoginWithPromptEngine(u.Username, tcY.G)

	docui = &lockuiDevice{lockui: &lockui{deviceName: "device Y"}, shared: &docuiShared}

	ctx := &Context{LogUI: tcY.G.UI.GetLogUI(), LocksmithUI: docui, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}

	testUserHasDeviceKey(t)
	wg.Wait()
}

// issue #408, cancel login before device provisioning finishes.
// user should not be logged in.
func TestLoginNewDeviceCancel(t *testing.T) {
	// test context for device X
	tcX := SetupEngineTest(t, "loginX")
	defer tcX.Cleanup()

	// sign up with device X
	u := CreateAndSignupFakeUser(tcX, "login")

	docuiShared := lockuiDeviceShared{}
	docui := &lockuiDevice{lockui: &lockui{deviceName: "device X"}, shared: &docuiShared}

	// test context for device Y
	tcY := SetupEngineTest(t, "loginY")
	defer tcY.Cleanup()

	// log in with device Y
	li := NewLoginWithPromptEngine(u.Username, tcY.G)
	ctx := &Context{
		LogUI:       tcY.G.UI.GetLogUI(),
		LocksmithUI: docui,
		GPGUI:       &gpgtestui{},
		SecretUI:    u.NewSecretUI(),
		LoginUI:     &libkb.TestLoginUI{},
	}
	err := RunEngine(li, ctx)
	if err == nil {
		t.Fatal("expected cancel err, got nil err")
	}

	loggedIn, err := tcY.G.LoginState().LoggedInProvisionedLoad()
	if err != nil {
		t.Fatal(err)
	}
	if loggedIn {
		t.Errorf("user on device Y is logged in even though they canceled device provisioning")
	}

	// issue #408 refers to GetCurrentStatus, so check that:
	status, err := libkb.GetCurrentStatus()
	if err != nil {
		t.Fatal(err)
	}
	if status.LoggedIn {
		t.Errorf("user on device Y is logged in according to GetCurrentStatus even though they canceled device provisioning")

	}
}

// TestLoginNewDeviceKexBadPhrase is a device provisioning test.
// It simulates the scenario where a user logs in to a new device and
// uses an existing device to provision it, but a bad secret
// phrase is entered on the existing device.
func TestLoginNewDeviceKexBadPhrase(t *testing.T) {
	kex.HelloTimeout = 5 * time.Second
	kex.IntraTimeout = 5 * time.Second
	kex.PollDuration = 1 * time.Second

	// test context for device X
	tcX := SetupEngineTest(t, "loginX")
	defer tcX.Cleanup()

	// sign up with device X
	u := CreateAndSignupFakeUser(tcX, "login")
	docuiShared := lockuiDeviceShared{}
	docui := &lockuiDevice{lockui: &lockui{deviceName: "device X"}, shared: &docuiShared}
	secui := &libkb.TestSecretUI{Passphrase: u.Passphrase}

	// test that we can get the secret key:
	// XXX this is necessary for the test to pass once the goroutine starts
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	arg := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	_, _, err = tcX.G.Keyrings.GetSecretKeyWithPrompt(nil, arg, secui, "new device install")
	if err != nil {
		t.Fatal(err)
	}

	var li *LoginEngine
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer func() {
			// cancel the login engine when this is done.
			if li != nil {
				li.Cancel()
			}
		}()

		// authorize on device X
		ctx := &Context{LogUI: tcX.G.UI.GetLogUI(), LocksmithUI: docui, SecretUI: secui}

		// wait for docui to know the secret
		for len(docui.secretPhrase()) == 0 {
			time.Sleep(50 * time.Millisecond)
		}

		// ok, we know the secret phrase, but will enter it incorrectly:
		kx := NewKexSib(tcX.G, docui.secretPhrase()+" gibberish")
		err := RunEngine(kx, ctx)
		if err != libkb.ErrInvalidKexPhrase {
			t.Fatal(err)
		}

		wg.Done()
	}()

	// test context for device Y
	tcY := SetupEngineTest(t, "loginY")
	defer tcY.Cleanup()

	if tcY.G == tcX.G {
		t.Fatalf("tcY.G == tcX.G")
	}

	// log in with device Y
	li = NewLoginWithPromptEngine(u.Username, tcY.G)

	docui = &lockuiDevice{lockui: &lockui{deviceName: "device Y"}, shared: &docuiShared}

	ctx := &Context{LogUI: tcY.G.UI.GetLogUI(), LocksmithUI: docui, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	err = RunEngine(li, ctx)
	if err != nil {
		if _, ok := err.(libkb.CanceledError); !ok {
			t.Fatal(err)
		}
	} else {
		t.Fatal("login on device Y should have returned error")
	}

	wg.Wait()
}

// TestLoginNewDeviceKexRetryPhrase is a device provisioning test.  It
// simulates the scenario where a user logs in to a new device and
// uses an existing device to provision it.  This test checks that
// provisioning works if the user eventually enters the correct secret
// phrase after incorrectly entering it.
func TestLoginNewDeviceKexRetryPhrase(t *testing.T) {
	kex.HelloTimeout = 5 * time.Second
	kex.IntraTimeout = 5 * time.Second
	kex.PollDuration = 1 * time.Second

	// test context for device X
	tcX := SetupEngineTest(t, "loginX")
	defer tcX.Cleanup()

	// sign up with device X
	// G = tcX.G
	u := CreateAndSignupFakeUser(tcX, "login")
	docuiShared := lockuiDeviceShared{}
	docui := &lockuiDevice{lockui: &lockui{deviceName: "device X"}, shared: &docuiShared}
	secui := &libkb.TestSecretUI{Passphrase: u.Passphrase}

	// test that we can get the secret key:
	// XXX this is necessary for the test to pass once the goroutine starts
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	arg := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	_, _, err = tcX.G.Keyrings.GetSecretKeyWithPrompt(nil, arg, secui, "new device install")
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

		// first time, enter bad phrase:
		kx := NewKexSib(tcX.G, docui.secretPhrase()+"gibberish")
		if err := RunEngine(kx, ctx); err == nil {
			t.Fatal("kexsib worked with invalid phrase")
		}

		// second time, enter correct phrase:
		kx = NewKexSib(tcX.G, docui.secretPhrase())
		if err := RunEngine(kx, ctx); err != nil {
			t.Fatal(err)
		}

		wg.Done()
	}()

	// test context for device Y
	tcY := SetupEngineTest(t, "loginY")
	defer tcY.Cleanup()

	if tcY.G == tcX.G {
		t.Fatalf("tcY.G == tcX.G")
	}

	// log in with device Y
	li := NewLoginWithPromptEngine(u.Username, tcY.G)

	docui = &lockuiDevice{lockui: &lockui{deviceName: "device Y"}, shared: &docuiShared}

	ctx := &Context{LogUI: tcY.G.UI.GetLogUI(), LocksmithUI: docui, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != nil {
		t.Fatal(err)
	}

	testUserHasDeviceKey(t)
	wg.Wait()
}

// TestLoginNewDeviceKexCancelOnY is a device provisioning test.  It
// simulates the scenario where a user logs in to a new device and
// uses an existing device to provision it.  This test checks that
// everything works ok if device Y cancels while waiting for
// device X to enter secret phrase.
func TestLoginNewDeviceKexCancelOnY(t *testing.T) {
	kex.HelloTimeout = 5 * time.Second
	kex.IntraTimeout = 5 * time.Second
	kex.PollDuration = 1 * time.Second

	// test context for device X
	tcX := SetupEngineTest(t, "loginX")
	defer tcX.Cleanup()

	// sign up with device X
	u := CreateAndSignupFakeUser(tcX, "login")
	docuiShared := lockuiDeviceShared{}
	docui := &lockuiDevice{lockui: &lockui{deviceName: "device X"}, shared: &docuiShared}

	secui := &libkb.TestSecretUI{Passphrase: u.Passphrase}

	// test that we can get the secret key:
	// XXX this is necessary for the test to pass once the goroutine starts
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	arg := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	_, _, err = tcX.G.Keyrings.GetSecretKeyWithPrompt(nil, arg, secui, "new device install")
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	var li *LoginEngine

	wg.Add(1)
	go func() {
		// authorize on device X
		ctx := &Context{LogUI: tcX.G.UI.GetLogUI(), LocksmithUI: docui, SecretUI: secui}

		// wait for docui to know the secret
		for len(docui.secretPhrase()) == 0 {
			time.Sleep(50 * time.Millisecond)
		}
		// wait a little longer for Y...
		time.Sleep(50 * time.Millisecond)

		// so device Y should be waiting for device X to enter the secret phrase.
		// cancel it here:
		li.Cancel()

		// and now enter the secret phrase on device X and see what happens
		kx := NewKexSib(tcX.G, docui.secretPhrase())
		err := RunEngine(kx, ctx)
		if err == nil {
			t.Error("kex sib succeeded, it should have failed.")
		}
		if _, ok := err.(libkb.CanceledError); !ok {
			t.Errorf("unexpected kex sib run error: %s", err)
		}

		wg.Done()
	}()

	// test context for device Y
	tcY := SetupEngineTest(t, "loginY")
	defer tcY.Cleanup()

	if tcY.G == tcX.G {
		t.Fatalf("tcY.G == tcX.G")
	}

	// log in with device Y
	li = NewLoginWithPromptEngine(u.Username, tcY.G)

	docui = &lockuiDevice{lockui: &lockui{deviceName: "device Y"}, shared: &docuiShared}

	ctx := &Context{LogUI: tcY.G.UI.GetLogUI(), LocksmithUI: docui, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	err = RunEngine(li, ctx)
	if err == nil {
		t.Fatal("device Y login should have failed")
	}
	if _, ok := err.(libkb.CanceledError); !ok {
		t.Errorf("device Y login err: %s (%T)", err, err)
	}

	wg.Wait()
}

// TestLoginNewDeviceDupName tests that a device name must be
// unique.
func TestLoginNewDeviceDupName(t *testing.T) {
	kex.HelloTimeout = 5 * time.Second
	kex.IntraTimeout = 5 * time.Second
	kex.PollDuration = 1 * time.Second

	// test context for device X
	tcX := SetupEngineTest(t, "loginX")
	defer tcX.Cleanup()

	// sign up with device X
	u := CreateAndSignupFakeUser(tcX, "login")
	docuiShared := lockuiDeviceShared{}
	docui := &lockuiDevice{lockui: &lockui{}, shared: &docuiShared}

	// set the device name to the same as the one used in CreateAndSignupFakeUser
	docui.setDeviceName(defaultDeviceName)

	secui := &libkb.TestSecretUI{Passphrase: u.Passphrase}

	// test context for device Y
	tcY := SetupEngineTest(t, "loginY")
	defer tcY.Cleanup()

	// log in with device Y
	li := NewLoginWithPromptEngine(u.Username, tcY.G)
	ctx := &Context{LogUI: tcY.G.UI.GetLogUI(), LocksmithUI: docui, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx); err != ErrDeviceMustBeUnique {
		t.Fatalf("expected ErrDeviceMustBeUnique, got %v", err)
	}
}

type lockuiDeviceShared struct {
	secret string
	sync.Mutex
}

type lockuiDevice struct {
	*lockui
	shared *lockuiDeviceShared
}

func (l *lockuiDevice) secretPhrase() string {
	l.shared.Lock()
	defer l.shared.Unlock()
	return l.shared.secret
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
	l.shared.Lock()
	l.shared.secret = arg.Secret
	l.shared.Unlock()
	return nil
}

type lockuiCancel struct {
	*lockui
}

func (l *lockuiCancel) SelectSigner(arg keybase1.SelectSignerArg) (res keybase1.SelectSignerRes, err error) {
	res.Action = keybase1.SelectSignerAction_CANCEL
	return
}
