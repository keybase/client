package engine

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase1 "github.com/keybase/client/go/protocol"
	jsonw "github.com/keybase/go-jsonw"
)

// KexNewDevice is an engine for running the Device Key Exchange
// Protocol, forward version.  It should be called on the new
// device (referred to as device Y in comments).
type KexNewDevice struct {
	KexCommon
	args    *KexNewDeviceArgs
	secret  *kex.Secret
	lks     *libkb.LKSec
	xDevKey libkb.GenericKey
}

type KexNewDeviceArgs struct {
	User    *libkb.User       // the user who owns device Y and device X
	DevType string            // type of this new device Y (e.g. desktop, mobile)
	DevDesc string            // description of this new device Y
	Dst     keybase1.DeviceID // device ID of existing provisioned device (device X)
	DstName string            // device name of the existing provisioned device (device X)
}

// NewKexNewDevice creates a KexNewDevice engine.
func NewKexNewDevice(pps *libkb.PassphraseStream, args *KexNewDeviceArgs, gc *libkb.GlobalContext) *KexNewDevice {
	kc := newKexCommon(gc)
	kf := &KexNewDevice{KexCommon: *kc, args: args}
	kf.debugName = "KexNewDevice"
	if pps != nil {
		kf.lks = libkb.NewLKSec(pps, kf.args.User.GetUID(), gc)
	}
	return kf
}

func (k *KexNewDevice) Name() string {
	return "KexNewDevice"
}

func (k *KexNewDevice) Prereqs() Prereqs {
	return Prereqs{Session: true}
}

func (k *KexNewDevice) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LocksmithUIKind, libkb.LogUIKind}
}

func (k *KexNewDevice) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&DeviceRegister{}}
}

// Run starts the engine.
func (k *KexNewDevice) Run(ctx *Context) error {
	k.G().Log.Debug("KexNewDevice: run starting")
	defer k.G().Log.Debug("KexNewDevice: run finished")
	k.user = k.args.User

	if k.args.DevDesc == "" {
		return errors.New("Empty device description passed to kex")
	}

	// register a new device
	ndarg := &DeviceRegisterArgs{
		Me:   k.user,
		Name: k.args.DevDesc,
		Lks:  k.lks,
	}
	devreg := NewDeviceRegister(ndarg, k.G())
	if err := RunEngine(devreg, ctx); err != nil {
		return err
	}
	k.deviceID = devreg.DeviceID()

	token, csrf := k.sessionArgs(ctx)

	// make random secret S, session id I
	sec, err := kex.NewSecret(k.user.GetName())
	if err != nil {
		return err
	}
	k.secret = sec
	k.serverMu.Lock()
	k.server = kex.NewSender(kex.DirectionYtoX, k.secret.Secret(), token, csrf, k.G())
	k.serverMu.Unlock()

	// create the kex meta data
	m := kex.NewMeta(k.args.User.GetUID(), k.secret.StrongID(), k.deviceID, k.args.Dst, kex.DirectionXtoY)

	// start message receive loop
	k.poll(ctx, m, sec)

	// tell user the command to enter on existing device (X)
	// note: this has to happen before StartKexSession call for tests to work.
	k.G().Log.Debug("KexNewDevice: displaying sibkey command")
	darg := keybase1.DisplaySecretWordsArg{
		DeviceNameToAdd:    k.args.DevDesc,
		DeviceNameExisting: k.args.DstName,
		Secret:             sec.Phrase(),
	}
	if err := ctx.LocksmithUI.DisplaySecretWords(context.TODO(), darg); err != nil {
		return err
	}
	// start the kex session with X
	k.G().Log.Debug("KexNewDevice: sending StartKexSession to X")
	k.kexStatus(ctx, "sending StartKexSession to X", keybase1.KexStatusCode_START_SEND)
	if err := k.server.StartKexSession(m, k.secret.StrongID()); err != nil {
		return err
	}

	// wait for Hello() from X
	k.kexStatus(ctx, "waiting for Hello from X", keybase1.KexStatusCode_HELLO_WAIT)
	if err := k.next(ctx, kex.HelloMsg, kex.HelloTimeout, k.handleHello); err != nil {
		return err
	}
	k.kexStatus(ctx, "received Hello from X", keybase1.KexStatusCode_HELLO_RECEIVED)

	dkargs := &DeviceKeygenArgs{
		Me:         k.user,
		DeviceID:   k.deviceID,
		DeviceName: k.args.DevDesc,
		DeviceType: libkb.DeviceTypeDesktop,
		Lks:        k.lks,
	}
	dkeng := NewDeviceKeygen(dkargs, k.G())
	if err := RunEngine(dkeng, ctx); err != nil {
		return err
	}

	signerPub, err := dkeng.SigningKeyPublic()
	if err != nil {
		return err
	}

	// get reverse signature of X's device key
	rsig, err := k.revSig(dkeng.SigningKey())
	if err != nil {
		return err
	}

	// send PleaseSign message to X
	m.Sender = k.deviceID
	m.Receiver = k.args.Dst
	k.G().Log.Debug("KexNewDevice: sending PleaseSign to X")
	k.kexStatus(ctx, "sending PleaseSign to X", keybase1.KexStatusCode_PLEASE_SIGN_SEND)
	if err := k.server.PleaseSign(m, signerPub, rsig, k.args.DevType, k.args.DevDesc); err != nil {
		return err
	}

	// wait for Done() from X
	k.kexStatus(ctx, "waiting for Done from X", keybase1.KexStatusCode_DONE_WAIT)
	if err := k.next(ctx, kex.DoneMsg, kex.IntraTimeout, k.handleDone); err != nil {
		return err
	}
	k.kexStatus(ctx, "received Done from X", keybase1.KexStatusCode_DONE_RECEIVED)

	// push the dh key as a subkey to the server
	k.G().Log.Debug("KexNewDevice: pushing subkey")
	pargs := &DeviceKeygenPushArgs{
		SkipSignerPush: true,
		Signer:         dkeng.SigningKey(),
		EldestKID:      k.user.GetEldestKID(),
		User:           k.user,
	}
	if err := dkeng.Push(ctx, pargs); err != nil {
		k.G().Log.Debug("error running dkeng.Push(): %s", err)
		k.G().Log.Debug("push args: %+v", pargs)
		return err
	}

	k.wg.Wait()

	k.kexStatus(ctx, "kexfwd complete on new device Y", keybase1.KexStatusCode_END)

	return nil
}

func (k *KexNewDevice) Cancel() error {
	k.G().Log.Debug("canceling KexNewDevice")
	m := kex.NewMeta(k.args.User.GetUID(), k.secret.StrongID(), k.deviceID, k.args.Dst, kex.DirectionXtoY)
	if err := k.cancel(m); err != nil {
		return err
	}
	k.wg.Wait()
	k.G().Log.Debug("done canceling KexNewDevice")
	return nil
}

func (k *KexNewDevice) handleHello(ctx *Context, m *kex.Msg) (err error) {
	k.xDevKey, err = libkb.ImportKeypairFromKID(m.Args().DevKeyID)
	return
}

func (k *KexNewDevice) handleDone(ctx *Context, m *kex.Msg) error {
	// device X changed the sigchain, so reload the user to get the latest sigchain.
	var err error
	k.user, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true, LoginContext: ctx.LoginContext, Contextified: libkb.NewContextified(k.G())})
	if err != nil {
		return err
	}
	return nil
}

// revSig generates a reverse signature using X's device key id.
func (k *KexNewDevice) revSig(eddsa libkb.NaclKeyPair) (sig string, err error) {
	delg := libkb.Delegator{
		ExistingKey:    k.xDevKey,
		NewKey:         eddsa,
		Me:             k.args.User,
		DelegationType: libkb.SibkeyType,
		Expire:         libkb.NaclEdDSAExpireIn,
		Device:         k.GetDevice(),
	}
	var jw *jsonw.Wrapper
	if jw, err = libkb.KeyProof(delg); err != nil {
		return
	}
	sig, _, _, err = libkb.SignJSON(jw, eddsa)
	return
}

func (k *KexNewDevice) GetDevice() *libkb.Device {
	s := libkb.DeviceStatusActive
	return &libkb.Device{
		ID:          k.deviceID,
		Type:        k.args.DevType,
		Description: &k.args.DevDesc,
		Status:      &s,
	}
}
