package engine

import (
	"github.com/keybase/client/go/libkb"
)

// XLoginProvision is an engine that will provision the current
// device.
type XLoginProvision struct {
	libkb.Contextified
}

// NewXLoginProvision creates a XLoginProvision engine.
func NewXLoginProvision(g *libkb.GlobalContext) *XLoginProvision {
	return &XLoginProvision{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *XLoginProvision) Name() string {
	return "XLoginProvision"
}

// GetPrereqs returns the engine prereqs.
func (e *XLoginProvision) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *XLoginProvision) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *XLoginProvision) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *XLoginProvision) Run(ctx *Context) error {
	return nil
}
