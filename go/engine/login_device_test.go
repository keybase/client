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
	devX := tcX.G.Env.GetDeviceID()
	docui := &ldocuiDevice{&ldocui{}, ""}
	secui := libkb.TestSecretUI{u.Passphrase}
	G.Log.Warning("devx G value: %v", tcX.G)

	// test that we can get the secret key:
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	arg := libkb.SecretKeyArg{
		DeviceKey: true,
		Reason:    "new device install",
		Ui:        secui,
		Me:        me,
	}
	key, err := G.Keyrings.GetSecretKey(arg)
	if err != nil {
		t.Fatal(err)
	}
	G.Log.Info("device X: have secret key: %v", key)

	go func() {
		// authorize on device X
		kx := NewKex(kex.NewSender(kex.DirectionXtoY), nil, SetDebugName("dev X"))

		// is this going to mess everything up?
		me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
		if err != nil {
			t.Fatal(err)
		}
		ctx := &Context{LogUI: tcX.G.UI.GetLogUI(), DoctorUI: docui, SecretUI: secui}

		// wait for docui to know the secret
		for len(docui.secret) == 0 {
			time.Sleep(50 * time.Millisecond)
		}

		if err := kx.StartAccept(ctx, me, *devX, docui.secret, &tcX.G); err != nil {
			t.Fatal(err)
		}
	}()

	// test context for device Y
	tcY := libkb.SetupTest(t, "loginY")
	defer tcY.Cleanup()

	// log in with device Y
	G = &tcY.G
	G.Log.Warning("devy G value: %v", tcY.G)
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

}

// TestLoginNewDeviceFakeComm is a device provisioning test.  It
// simulates the scenario where a user logs in to a new device and
// uses an existing device to provision it.  This test bypasses
// the api server for all kex communication, so it's basically
// testing the logic in the engine.
//
// It's possible we can get rid of this test when
// TestLoginNewDeviceKex works.
func TestLoginNewDeviceFakeComm(t *testing.T) {
	kexTimeout = 1 * time.Second
	// fake kex server implementation
	ksrv := newKexsrv()

	tc := libkb.SetupTest(t, "login")
	u1 := CreateAndSignupFakeUser(t, "login")
	devX := G.Env.GetDeviceID()

	docui := &ldocuiDevice{&ldocui{}, ""}

	// this is all pretty hacky to get kex running on device X...
	secui := libkb.TestSecretUI{u1.Passphrase}
	xctx := &Context{DoctorUI: docui, SecretUI: secui, LogUI: G.UI.GetLogUI()}
	kexX := NewKex(ksrv, nil, SetDebugName("device x"))
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	kexX.getSecret = func() string {
		return docui.secret
	}
	kexX.Listen(xctx, me, *devX)
	ksrv.RegisterTestDevice(kexX, *devX)

	G.LoginState.Logout()
	tc.Cleanup()

	// redo SetupTest to get a new home directory...should look like a new device.
	tc2 := libkb.SetupTest(t, "login")
	defer tc2.Cleanup()

	larg := LoginEngineArg{
		Login: libkb.LoginArg{
			Force:      true,
			Prompt:     false,
			Username:   u1.Username,
			Passphrase: u1.Passphrase,
			NoUi:       true,
		},
		KexSrv: ksrv,
	}

	before := docui.selectSignerCount

	li := NewLoginEngine()
	ctx := &Context{LogUI: G.UI.GetLogUI(), DoctorUI: docui, GPGUI: &gpgtestui{}, SecretUI: secui, LoginUI: &libkb.TestLoginUI{}}
	if err := RunEngine(li, ctx, larg, nil); err != nil {
		t.Fatal(err)
	}

	after := docui.selectSignerCount
	if after-before != 1 {
		t.Errorf("doc ui SelectSigner called %d times, expected 1", after-before)
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

type kexsrv struct {
	devices map[libkb.DeviceID]kex.Handler
}

func newKexsrv() *kexsrv {
	return &kexsrv{devices: make(map[libkb.DeviceID]kex.Handler)}
}

func (k *kexsrv) StartKexSession(ctx *kex.Context, id kex.StrongID) error {
	s, err := k.findDevice(ctx.Receiver)
	if err != nil {
		return err
	}
	f := func() error {
		return s.StartKexSession(ctx, id)
	}
	return k.gocall(f)
}

func (k *kexsrv) StartReverseKexSession(ctx *kex.Context) error { return nil }

func (k *kexsrv) Hello(ctx *kex.Context, devID libkb.DeviceID, devKeyID libkb.KID) error {
	s, err := k.findDevice(ctx.Receiver)
	if err != nil {
		return err
	}
	f := func() error {
		return s.Hello(ctx, devID, devKeyID)
	}
	return k.gocall(f)
}

func (k *kexsrv) PleaseSign(ctx *kex.Context, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	s, err := k.findDevice(ctx.Receiver)
	if err != nil {
		return err
	}
	f := func() error {
		return s.PleaseSign(ctx, eddsa, sig, devType, devDesc)
	}
	return k.gocall(f)
}

func (k *kexsrv) Done(ctx *kex.Context, mt libkb.MerkleTriple) error {
	s, err := k.findDevice(ctx.Receiver)
	if err != nil {
		return err
	}
	f := func() error {
		return s.Done(ctx, mt)
	}
	return k.gocall(f)
}

func (k *kexsrv) RegisterTestDevice(srv kex.Handler, device libkb.DeviceID) error {
	k.devices[device] = srv
	return nil
}

func (k *kexsrv) gocall(fn func() error) error {
	ch := make(chan error)
	go func() {
		err := fn()
		ch <- err
	}()
	return <-ch
}

func (k *kexsrv) findDevice(id libkb.DeviceID) (kex.Handler, error) {
	s, ok := k.devices[id]
	if !ok {
		return nil, fmt.Errorf("device %x not registered", id)
	}
	return s, nil
}
