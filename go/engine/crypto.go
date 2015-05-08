package engine

import (
	"errors"
	"github.com/keybase/client/go/libkb"
)

type SignEngine struct {
	libkb.Contextified
	msg       []byte
	reason    string
	signature []byte
}

func NewSignEngine(ctx *libkb.GlobalContext, msg []byte, reason string) *SignEngine {
	engine := &SignEngine{msg: msg, reason: reason}
	engine.SetGlobalContext(ctx)
	return engine
}

func (e *SignEngine) Name() string {
	return "Sign"
}

func (e *SignEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (e *SignEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

func (e *SignEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *SignEngine) Run(ctx *Context) (err error) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}

	sigKey, _, err := e.G().Keyrings.GetSecretKeyWithPrompt(libkb.SecretKeyArg{
		DeviceKey: true,
		Me:        me,
	}, ctx.SecretUI, e.reason)
	if sigKey == nil {
		return errors.New("Signing key is nil.")
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}
	if !sigKey.CanSign() {
		return errors.New("Signing key cannot sign.")
	}

	signature, _, err := sigKey.SignToString(e.msg)
	if err != nil {
		return err
	}

	e.signature = []byte(signature)
	return nil
}

func (e *SignEngine) GetSignature() []byte {
	return e.signature
}
