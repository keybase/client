package engine

import (
	"github.com/keybase/client/go/libkb"
)

// Unlock is an engine.
type Unlock struct {
	libkb.Contextified
}

// NewUnlock creates a Unlock engine.
func NewUnlock(g *libkb.GlobalContext) *Unlock {
	return &Unlock{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *Unlock) Name() string {
	return "Unlock"
}

// GetPrereqs returns the engine prereqs.
func (e *Unlock) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (e *Unlock) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.SecretUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Unlock) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Unlock) Run(ctx *Context) error {
	_, err := e.G().LoginState().GetPassphraseStream(ctx.SecretUI)
	return err
}
