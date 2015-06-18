package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

// KexFwd is an engine for running the Device Key Exchange
// Protocol, forward version.  It should be called on the new
// device (referred to as device Y in comments).
type KexFwd struct {
	KexCom
	args      *KexFwdArgs
	secret    *kex.Secret
	lks       *libkb.LKSec
	xDevKeyID libkb.KID
}

type KexFwdArgs struct {
	User    *libkb.User    // the user who owns device Y and device X
	DevType string         // type of this new device Y (e.g. desktop, mobile)
	DevDesc string         // description of this new device Y
	Dst     libkb.DeviceID // device ID of existing provisioned device (device X)
	DstName string         // device name of the existing provisioned device (device X)
}

// NewKexFwd creates a KexFwd engine.
func NewKexFwd(lksClientHalf []byte, args *KexFwdArgs, gc *libkb.GlobalContext) *KexFwd {
	kc := newKexCom(gc)
	kf := &KexFwd{KexCom: *kc, args: args}
	kf.debugName = "KexFwd"
	if lksClientHalf != nil {
		kf.lks = libkb.NewLKSec(lksClientHalf, kf.args.User.GetUID(), gc)
	}
	return kf
}

func (k *KexFwd) Name() string {
	return "KexFwd"
}

func (k *KexFwd) Prereqs() Prereqs {
	return Prereqs{Session: true}
}

func (k *KexFwd) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LocksmithUIKind, libkb.LogUIKind}
}

func (k *KexFwd) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&DeviceRegister{}}
}

// Run starts the engine.
func (k *KexFwd) Run(ctx *Context) error {
	k.G().Log.Debug("KexFwd: run starting")
	defer k.G().Log.Debug("KexFwd: run finished")
	k.user = k.args.User

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
	k.G().Log.Debug("KexFwd: displaying sibkey command")
	darg := keybase1.DisplaySecretWordsArg{
		DeviceNameToAdd:    k.args.DevDesc,
		DeviceNameExisting: k.args.DstName,
		Secret:             sec.Phrase(),
	}
	if err := ctx.LocksmithUI.DisplaySecretWords(darg); err != nil {
		return err
	}
	// start the kex session with X
	k.G().Log.Debug("KexFwd: sending StartKexSession to X")
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
	k.G().Log.Debug("KexFwd: sending PleaseSign to X")
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
	k.G().Log.Debug("KexFwd: pushing subkey")
	pargs := &DeviceKeygenPushArgs{
		SkipSignerPush: true,
		Signer:         dkeng.SigningKey(),
		EldestKID:      k.user.GetEldestFOKID().Kid,
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

func (k *KexFwd) Cancel() error {
	k.G().Log.Debug("canceling KexFwd")
	m := kex.NewMeta(k.args.User.GetUID(), k.secret.StrongID(), k.deviceID, k.args.Dst, kex.DirectionXtoY)
	if err := k.cancel(m); err != nil {
		return err
	}
	k.wg.Wait()
	k.G().Log.Debug("done canceling KexFwd")
	return nil
}

func (k *KexFwd) handleHello(ctx *Context, m *kex.Msg) error {
	k.xDevKeyID = m.Args().DevKeyID
	return nil
}

func (k *KexFwd) handleDone(ctx *Context, m *kex.Msg) error {
	// device X changed the sigchain, so reload the user to get the latest sigchain.
	var err error
	k.user, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true, LoginContext: ctx.LoginContext, Contextified: libkb.NewContextified(k.G())})
	if err != nil {
		return err
	}
	return nil
}

// revSig generates a reverse signature using X's device key id.
func (k *KexFwd) revSig(eddsa libkb.NaclKeyPair) (sig string, err error) {
	delg := libkb.Delegator{
		ExistingFOKID: &libkb.FOKID{Kid: k.xDevKeyID},
		NewKey:        eddsa,
		Me:            k.args.User,
		Sibkey:        true,
		Expire:        libkb.NACL_EDDSA_EXPIRE_IN,
		Device:        k.GetDevice(),
	}
	var jw *jsonw.Wrapper
	if jw, _, err = k.args.User.KeyProof(delg); err != nil {
		return
	}
	sig, _, _, err = libkb.SignJSON(jw, eddsa)
	return
}

func (k *KexFwd) GetDevice() *libkb.Device {
	s := libkb.DEVICE_STATUS_ACTIVE
	return &libkb.Device{
		ID:          k.deviceID.String(),
		Type:        k.args.DevType,
		Description: &k.args.DevDesc,
		Status:      &s,
	}
}
