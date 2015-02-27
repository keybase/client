package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
)

type Sibkey struct {
	KexCom
	secretPhrase string
	libkb.Contextified
}

// NewSibkey creates a sibkey add engine.
// The secretPhrase is needed before this engine can run because
// the weak id used in receive() is based on it.
func NewSibkey(g *libkb.GlobalContext, secretPhrase string) *Sibkey {
	return &Sibkey{
		secretPhrase: secretPhrase,
		Contextified: libkb.NewContextified(g),
	}
}

func (k *Sibkey) Name() string {
	return "Sibkey"
}

func (k *Sibkey) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

func (k *Sibkey) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.SecretUIKind}
}

func (k *Sibkey) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (k *Sibkey) Run(ctx *Context, args, reply interface{}) error {
	k.engctx = ctx
	kc := newKexCom(kex.NewSender(kex.DirectionXtoY), nil)
	k.KexCom = *kc

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

	k.deviceSibkey, err = k.user.GetComputedKeyFamily().GetSibkeyForDevice(k.deviceID)
	if err != nil {
		k.G().Log.Warning("Sibkey.Run: error getting device sibkey: %s", err)
		return err
	}
	arg := libkb.SecretKeyArg{
		DeviceKey: true,
		Reason:    "new device install",
		Ui:        ctx.SecretUI,
		Me:        k.user,
	}
	k.sigKey, err = k.G().Keyrings.GetSecretKey(arg)
	if err != nil {
		k.G().Log.Warning("Sibkey.Run: GetSecretKey error: %s", err)
		return err
	}

	id, err := k.wordsToID(k.secretPhrase)
	if err != nil {
		return err
	}
	k.sessionID = id

	m := kex.NewMeta(k.user.GetUid(), id, libkb.DeviceID{}, k.deviceID, kex.DirectionYtoX)
	return k.loopReceives(m)
}

func (k *Sibkey) individualReceives(m *kex.Meta) error {
	// create a message receiver
	rec := kex.NewReceiver(k, kex.DirectionYtoX)

	// receive StartKexSession
	if err := rec.ReceiveTimeout(m, kex.IntraTimeout); err != nil {
		return err
	}
	if err := k.waitStartKex(); err != nil {
		return err
	}

	// receive PleaseSign
	if err := rec.ReceiveTimeout(m, kex.IntraTimeout); err != nil {
		return err
	}
	if err := k.waitPleaseSign(); err != nil {
		return err
	}
	return nil
}

func (k *Sibkey) loopReceives(m *kex.Meta) error {
	// start receive loop
	go k.receive(m, kex.DirectionYtoX)
	if err := k.waitStartKex(); err != nil {
		return err
	}
	if err := k.waitPleaseSign(); err != nil {
		return err
	}
	k.msgReceiveComplete <- true
	return nil
}
