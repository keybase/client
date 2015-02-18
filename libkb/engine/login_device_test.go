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
	ksrv := newKexsrv()

	tc := libkb.SetupTest(t, "login")
	u1 := CreateAndSignupFakeUser(t, "login")
	devX := G.Env.GetDeviceID()

	secui := libkb.TestSecretUI{u1.Passphrase}
	// will this work???
	kexX := NewKex(ksrv, secui, SetDebugName("device x"))
	me, err := libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	kexX.Listen(me, *devX)
	ksrv.RegisterTestDevice(kexX, *devX)

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

	if err := li.Run(larg); err != nil {
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

type kexsrv struct {
	devices map[libkb.DeviceID]KexServer
}

func newKexsrv() *kexsrv {
	return &kexsrv{devices: make(map[libkb.DeviceID]KexServer)}
}

func (k *kexsrv) StartKexSession(ctx *KexContext, id KexStrongID) error {
	s, err := k.findDevice(ctx.Dst)
	if err != nil {
		return err
	}
	f := func() error {
		return s.StartKexSession(ctx, id)
	}
	return k.gocall(f)
}

func (k *kexsrv) StartReverseKexSession(ctx *KexContext) error { return nil }

func (k *kexsrv) Hello(ctx *KexContext, devID libkb.DeviceID, devKeyID libkb.KID) error {
	s, err := k.findDevice(ctx.Dst)
	if err != nil {
		return err
	}
	f := func() error {
		return s.Hello(ctx, devID, devKeyID)
	}
	return k.gocall(f)
}

func (k *kexsrv) PleaseSign(ctx *KexContext, eddsa libkb.NaclSigningKeyPublic, sig, devType, devDesc string) error {
	s, err := k.findDevice(ctx.Dst)
	if err != nil {
		return err
	}
	f := func() error {
		return s.PleaseSign(ctx, eddsa, sig, devType, devDesc)
	}
	return k.gocall(f)
}

func (k *kexsrv) Done(ctx *KexContext, mt libkb.MerkleTriple) error {
	s, err := k.findDevice(ctx.Dst)
	if err != nil {
		return err
	}
	f := func() error {
		return s.Done(ctx, mt)
	}
	return k.gocall(f)
}

func (k *kexsrv) RegisterTestDevice(srv KexServer, device libkb.DeviceID) error {
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

func (k *kexsrv) findDevice(id libkb.DeviceID) (KexServer, error) {
	s, ok := k.devices[id]
	if !ok {
		return nil, fmt.Errorf("device %x not registered", id)
	}
	return s, nil
}
