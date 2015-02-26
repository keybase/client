package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/kex"
)

type Sibkey struct {
	KexCom
	secretPhrase string
}

// NewSibkey creates a sibkey add engine.
// The secretPhrase is needed before this engine can run because
// the weak id used in receive() is based on it.
func NewSibkey(secretPhrase string) *Sibkey {
	return &Sibkey{
		secretPhrase: secretPhrase,
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
func (k *Sibkey) Run(ectx *Context, args, reply interface{}) error {
	k.engctx = ectx
	k.server = kex.NewSender(kex.DirectionXtoY)

	var err error
	k.user, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		return err
	}

	dp := G.Env.GetDeviceID()
	if dp == nil {
		return libkb.ErrNoDevice
	}
	k.deviceID = *dp

	k.deviceSibkey, err = k.user.GetComputedKeyFamily().GetSibkeyForDevice(k.deviceID)
	if err != nil {
		G.Log.Warning("StartAccept: error getting device sibkey: %s", err)
		return err
	}
	arg := libkb.SecretKeyArg{
		DeviceKey: true,
		Reason:    "new device install",
		Ui:        ectx.SecretUI,
		Me:        k.user,
		DeviceID:  &k.deviceID,
	}
	k.sigKey, err = G.Keyrings.GetSecretKey(arg)
	if err != nil {
		G.Log.Warning("GetSecretKey error: %s", err)
		//return err
	}

	id, err := k.wordsToID(k.secretPhrase)
	if err != nil {
		return err
	}
	k.sessionID = id

	ctx := kex.NewContext(kex.Meta{UID: k.user.GetUid(), Receiver: k.deviceID, StrongID: id})
	k.receive(ctx, kex.DirectionYtoX)
	return nil
}
