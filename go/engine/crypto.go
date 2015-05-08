package engine

import (
	"errors"
	"github.com/keybase/client/go/libkb"
)

type SignEngine struct {
	libkb.Contextified
	msg       []byte
	signature []byte
}

func NewSignEngine(ctx *libkb.GlobalContext, msg []byte) *SignEngine {
	engine := &SignEngine{msg: msg}
	engine.SetGlobalContext(ctx)
	return engine
}

func (e *SignEngine) Name() string {
	return "Sign"
}

func (e *SignEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (e *SignEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
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
	}, ctx.SecretUI, "to access kbfs") // TODO: Figure out a better message.
	if sigKey == nil {
		return errors.New("Signing key is nil.")
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return err
	}
	if !sigKey.CanSign() {
		return errors.New("Signing key cannot sign.")
	}

	// TODO: Figure out what to do with ID.
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
