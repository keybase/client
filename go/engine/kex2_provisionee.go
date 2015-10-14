package engine

import (
	"github.com/keybase/client/go/libkb"
)

// Kex2Provisionee is an engine.
type Kex2Provisionee struct {
	libkb.Contextified
}

// NewKex2Provisionee creates a Kex2Provisionee engine.
func NewKex2Provisionee(g *libkb.GlobalContext) *Kex2Provisionee {
	return &Kex2Provisionee{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *Kex2Provisionee) Name() string {
	return "Kex2Provisionee"
}

// GetPrereqs returns the engine prereqs.
func (e *Kex2Provisionee) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Kex2Provisionee) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Kex2Provisionee) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Kex2Provisionee) Run(ctx *Context) error {
	return nil
}
