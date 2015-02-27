package engine

import (
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
)

type KexSib struct {
	KexCom
	secretPhrase string
	libkb.Contextified
}

// NewKexSib creates a sibkey add engine.
// This runs on device X to provision device Y in forward kex.
// The secretPhrase is needed before this engine can run because
// the weak id used in receive() is based on it.
func NewKexSib(g *libkb.GlobalContext, secretPhrase string) *KexSib {
	return &KexSib{
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

	if k.user.GetComputedKeyFamily() == nil {
		return libkb.KeyFamilyError{Msg: "nil ckf"}
	}
	k.deviceSibkey, err = k.user.GetComputedKeyFamily().GetSibkeyForDevice(k.deviceID)
	if err != nil {
		k.G().Log.Warning("KexSib.Run: error getting device sibkey: %s", err)
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
		k.G().Log.Warning("KexSib.Run: GetSecretKey error: %s", err)
		return err
	}

	id, err := k.wordsToID(k.secretPhrase)
	if err != nil {
		return err
	}
	k.sessionID = id

	G.Log.Debug("KexSib: starting receive loop")
	m := kex.NewMeta(k.user.GetUid(), id, libkb.DeviceID{}, k.deviceID, kex.DirectionYtoX)
	return k.loopReceives(m)
}

func (k *KexSib) loopReceives(m *kex.Meta) error {
	// start receive loop
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		k.receive(m, kex.DirectionYtoX)
		wg.Done()
	}()

	G.Log.Debug("KexSib: waiting for startkex message")
	if err := k.waitStartKex(); err != nil {
		return err
	}
	G.Log.Debug("KexSib: waiting for pleasesign message")
	if err := k.waitPleaseSign(); err != nil {
		return err
	}
	G.Log.Debug("KexSib: finished with messages, waiting for receive to end.")
	k.msgReceiveComplete <- true
	wg.Wait()
	G.Log.Debug("KexSib: done.")
	return nil
}
