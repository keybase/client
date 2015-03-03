package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
)

type KexSib struct {
	KexCom
	secretPhrase string
	engctx       *Context
	deviceSibkey libkb.GenericKey
	sigKey       libkb.GenericKey
	devidY       libkb.DeviceID
	libkb.Contextified
}

// NewKexSib creates a sibkey add engine.
// This runs on device X to provision device Y in forward kex.
// The secretPhrase is needed before this engine can run because
// the weak id used in receive() is based on it.
func NewKexSib(g *libkb.GlobalContext, secretPhrase string) *KexSib {
	kc := newKexCom()
	return &KexSib{
		KexCom:       *kc,
		secretPhrase: secretPhrase,
		Contextified: libkb.NewContextified(g),
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
func (k *KexSib) Run(ctx *Context, args, reply interface{}) error {
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

	sec, err := kex.SecretFromPhrase(k.user.GetName(), k.secretPhrase)
	if err != nil {
		return err
	}
	k.server = kex.NewSender(kex.DirectionXtoY, sec.Secret())

	arg := libkb.SecretKeyArg{
		DeviceKey: true,
		Reason:    "new device install",
		Ui:        ctx.SecretUI,
		Me:        k.user,
	}
	k.sigKey, err = k.G().Keyrings.GetSecretKey(arg)
	if err != nil {
		k.G().Log.Warning("KexSib.Run: GetSecretKey error: %s", err)
		return err
	}

	G.Log.Debug("KexSib: starting receive loop")
	m := kex.NewMeta(k.user.GetUid(), sec.StrongID(), libkb.DeviceID{}, k.deviceID, kex.DirectionYtoX)
	return k.loopReceives(m, sec)
}

func (k *KexSib) loopReceives(m *kex.Meta, sec *kex.Secret) error {
	// start receive loop
	k.poll(m, sec)

	// wait for StartKex() from Y
	if err := k.next(kex.StartKexMsg, kex.IntraTimeout, k.handleStart); err != nil {
		return err
	}

	pair, ok := k.deviceSibkey.(libkb.NaclSigningKeyPair)
	if !ok {
		return libkb.BadKeyError{Msg: fmt.Sprintf("invalid device sibkey type %T", k.deviceSibkey)}
	}
	m.Sender = k.deviceID
	m.Receiver = k.devidY
	if err := k.server.Hello(m, m.Sender, pair.GetKid()); err != nil {
		return err
	}

	// wait for PleaseSign() from Y
	if err := k.next(kex.PleaseSignMsg, kex.IntraTimeout, k.handlePleaseSign); err != nil {
		return err
	}

	m.Sender = k.deviceID
	m.Receiver = k.devidY
	if err := k.server.Done(m); err != nil {
		return err
	}

	G.Log.Debug("KexSib: finished with messages, waiting for receive to end.")
	k.wg.Wait()
	G.Log.Debug("KexSib: done.")
	return nil
}

func (k *KexSib) handleStart(m *kex.Msg) error {
	k.devidY = m.Sender
	return nil
}

func (k *KexSib) handlePleaseSign(m *kex.Msg) error {
	eddsa := m.Args.SigningKey
	sig := m.Args.Sig
	devType := m.Args.DevType
	devDesc := m.Args.DevDesc

	rs := &libkb.ReverseSig{Sig: sig, Type: "kb"}

	// make device object for Y
	s := libkb.DEVICE_STATUS_ACTIVE
	devY := libkb.Device{
		Id:          m.Sender.String(),
		Type:        devType,
		Description: &devDesc,
		Status:      &s,
	}

	// generator function that just copies the public eddsa key into a
	// NaclKeyPair (which implements GenericKey).
	g := func() (libkb.NaclKeyPair, error) {
		var ret libkb.NaclSigningKeyPair
		copy(ret.Public[:], eddsa[:])
		return ret, nil
	}

	// need the private device sibkey
	// k.deviceSibkey is public only
	if k.sigKey == nil {
		var err error
		arg := libkb.SecretKeyArg{
			DeviceKey: true,
			Reason:    "new device install",
			Ui:        k.engctx.SecretUI,
			Me:        k.user,
		}
		k.sigKey, err = k.G().Keyrings.GetSecretKey(arg)
		if err != nil {
			return err
		}
	}

	// use naclkeygen to sign eddsa with device X (this device) sibkey
	// and push it to the server
	arg := libkb.NaclKeyGenArg{
		Signer:      k.sigKey,
		ExpireIn:    libkb.NACL_EDDSA_EXPIRE_IN,
		Sibkey:      true,
		Me:          k.user,
		Device:      &devY,
		EldestKeyID: k.user.GetEldestFOKID().Kid,
		RevSig:      rs,
		Generator:   g,
	}
	gen := libkb.NewNaclKeyGen(arg)
	if err := gen.Generate(); err != nil {
		return err
	}
	_, err := gen.Push()
	if err != nil {
		return err
	}
	return nil
}
