package engine

import (
	"github.com/keybase/client/go/libkb"
)

type ResetEngine struct {
	libkb.Contextified
}

func NewResetEngine(g *libkb.GlobalContext) *ResetEngine {
	return &ResetEngine{
		Contextified: libkb.NewContextified(g),
	}
}

func (e *ResetEngine) Name() string {
	return "Reset"
}

func (e *ResetEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *ResetEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

func (e *ResetEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *ResetEngine) Run(ctx *Context) (err error) {
	username := e.G().Env.GetUsername()
	if clearSecretErr := libkb.ClearStoredSecret(username); clearSecretErr != nil {
		e.G().Log.Warning("ClearStoredSecret error: %s", clearSecretErr)
	}
	if err = e.G().Logout(); err != nil {
		return
	}
	if err = e.G().LocalDb.Nuke(); err != nil {
		return
	}
	return
}
