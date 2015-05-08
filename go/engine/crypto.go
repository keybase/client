package engine

import (
	"errors"
	"github.com/keybase/client/go/libkb"
)

type SignEngine struct {
	libkb.Contextified
	buf []byte
}

func NewSignEngine(ctx *libkb.GlobalContext, buf []byte) *SignEngine {
	engine := &SignEngine{buf: buf}
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
	return errors.New("Not implemented")
}

func (e *SignEngine) GetSignature() []byte {
	return nil
}
