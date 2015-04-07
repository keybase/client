package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
	keybase_1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type KexSib struct {
	KexCom
	secretPhrase string
	engctx       *Context
	deviceSibkey libkb.GenericKey
	sigKey       libkb.GenericKey
	devidY       libkb.DeviceID
	sec          *kex.Secret
}

// NewKexSib creates a sibkey add engine.
// This runs on device X to provision device Y in forward kex.
// The secretPhrase is needed before this engine can run because
// the weak id used in receive() is based on it.
func NewKexSib(g *libkb.GlobalContext, secretPhrase string) *KexSib {
	kc := newKexCom(g)
	return &KexSib{
		KexCom:       *kc,
		secretPhrase: secretPhrase,
	}
}

func (k *KexSib) Name() string {
	return "KexSib"
}

func (k *KexSib) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

func (k *KexSib) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.SecretUIKind}
}

func (k *KexSib) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (k *KexSib) Run(ctx *Context) error {
	k.engctx = ctx

	var err error
	k.user, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		return err
	}

	dp := k.G().Env.GetDeviceID()
	if dp == nil {
		return libkb.ErrNoDevice
	}
	k.deviceID = *dp
	G.Log.Debug("device id: %s", k.deviceID)

	if k.user.GetComputedKeyFamily() == nil {
		return libkb.KeyFamilyError{Msg: "nil ckf"}
	}

	k.deviceSibkey, err = k.user.GetComputedKeyFamily().GetSibkeyForDevice(k.deviceID)
	if err != nil {
		k.G().Log.Warning("KexSib.Run: error getting device sibkey: %s", err)
		return err
	}

	k.sec, err = kex.SecretFromPhrase(k.user.GetName(), k.secretPhrase)
	if err != nil {
		return err
	}
	k.server = kex.NewSender(kex.DirectionXtoY, k.sec.Secret())

	arg := libkb.SecretKeyArg{
		DeviceKey: true,
		Reason:    "new device install",
		Ui:        ctx.SecretUI,
		Me:        k.user,
	}
	k.sigKey, _, err = k.G().Keyrings.GetSecretKey(arg)
	if err != nil {
		k.G().Log.Warning("KexSib.Run: GetSecretKey error: %s", err)
		return err
	}

	G.Log.Debug("KexSib: starting receive loop")
	m := kex.NewMeta(k.user.GetUid(), k.sec.StrongID(), libkb.DeviceID{}, k.deviceID, kex.DirectionYtoX)
	err = k.loopReceives(ctx, m, k.sec)
	if err != nil {
		G.Log.Warning("Error in KEX receive: %s", err.Error())
	}
	return err
}

func (k *KexSib) Cancel() error {
	m := kex.NewMeta(k.user.GetUid(), k.sec.StrongID(), libkb.DeviceID{}, k.deviceID, kex.DirectionYtoX)
	return k.cancel(m)
}

func (k *KexSib) loopReceives(ctx *Context, m *kex.Meta, sec *kex.Secret) error {
	// start receive loop
	k.poll(m, sec)

	// wait for StartKex() from Y
	k.kexStatus(ctx, "waiting for StartKex from Y", keybase_1.KexStatusCode_START_WAIT)
	if err := k.next(kex.StartKexMsg, kex.IntraTimeout, k.handleStart); err != nil {
		return err
	}
	k.kexStatus(ctx, "received StartKex from Y", keybase_1.KexStatusCode_START_RECEIVED)

	pair, ok := k.deviceSibkey.(libkb.NaclSigningKeyPair)
	if !ok {
		return libkb.BadKeyError{Msg: fmt.Sprintf("invalid device sibkey type %T", k.deviceSibkey)}
	}
	m.Sender = k.deviceID
	m.Receiver = k.devidY
	k.kexStatus(ctx, "sending Hello to Y", keybase_1.KexStatusCode_HELLO_SEND)
	if err := k.server.Hello(m, m.Sender, pair.GetKid()); err != nil {
		return err
	}

	// wait for PleaseSign() from Y
	k.kexStatus(ctx, "waiting for PleaseSign from Y", keybase_1.KexStatusCode_PLEASE_SIGN_WAIT)
	if err := k.next(kex.PleaseSignMsg, kex.IntraTimeout, k.handlePleaseSign); err != nil {
		return err
	}
	k.kexStatus(ctx, "received PleaseSign from Y", keybase_1.KexStatusCode_PLEASE_SIGN_RECEIVED)

	m.Sender = k.deviceID
	m.Receiver = k.devidY
	k.kexStatus(ctx, "sending Done to Y", keybase_1.KexStatusCode_DONE_SEND)
	if err := k.server.Done(m); err != nil {
		return err
	}

	G.Log.Debug("KexSib: finished with messages, waiting for receive to end.")
	k.wg.Wait()
	G.Log.Debug("KexSib: done.")
	k.kexStatus(ctx, "kexsib complete on existing device X ", keybase_1.KexStatusCode_END)
	return nil
}

func (k *KexSib) handleStart(m *kex.Msg) error {
	k.devidY = m.Sender
	return nil
}

func (k *KexSib) verifyPleaseSign(jw *jsonw.Wrapper, newKID libkb.KID) (err error) {
	jw.AssertEqAtPath("body.key.kid", k.sigKey.GetKid().ToJsonw(), &err)
	jw.AssertEqAtPath("body.key.uid", k.user.GetUid().ToJsonw(), &err)
	jw.AssertEqAtPath("body.key.eldest_kid", k.user.GetEldestFOKID().Kid.ToJsonw(), &err)
	jw.AssertEqAtPath("body.key.username", jsonw.NewString(k.user.GetName()), &err)
	jw.AssertEqAtPath("body.device.kid", newKID.ToJsonw(), &err)
	jw.AssertEqAtPath("body.type", jsonw.NewString("sibkey"), &err)
	return err
}

func (k *KexSib) handlePleaseSign(m *kex.Msg) error {
	eddsa := m.Args().SigningKey
	sig := m.Args().Sig

	keypair := libkb.NaclSigningKeyPair{Public: eddsa}
	sigPayload, _, err := keypair.VerifyAndExtract(sig)
	if err != nil {
		return err
	}

	G.Log.Debug("Got PleaseSign() on verified JSON blob %s\n", string(sigPayload))

	// k.deviceSibkey is public only
	if k.sigKey == nil {
		var err error
		arg := libkb.SecretKeyArg{
			DeviceKey: true,
			Reason:    "new device install",
			Ui:        k.engctx.SecretUI,
			Me:        k.user,
		}
		k.sigKey, _, err = k.G().Keyrings.GetSecretKey(arg)
		if err != nil {
			return err
		}
	}

	jw, err := jsonw.Unmarshal(sigPayload)
	if err != nil {
		return err
	}

	var newKID libkb.KID
	var newKey libkb.GenericKey

	if newKID, err = libkb.GetKID(jw.AtPath("body.sibkey.kid")); err != nil {
		return err
	}

	if newKey, err = libkb.ImportKeypairFromKID(newKID, k.G()); err != nil {
		return err
	}

	if k.verifyPleaseSign(jw, newKID); err != nil {
		return err
	}

	jw.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewString(sig))

	del := libkb.Delegator{
		NewKey:      newKey,
		ExistingKey: k.sigKey,
		Me:          k.user,
		Expire:      libkb.NACL_EDDSA_EXPIRE_IN,
		PushType:    libkb.SIBKEY_TYPE,
		EldestKID:   k.user.GetEldestFOKID().Kid,
	}

	if err = del.CheckArgs(); err != nil {
		return err
	}

	if err = del.SignAndPost(jw); err != nil {
		return err
	}

	return nil
}
