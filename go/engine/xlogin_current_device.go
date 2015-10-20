package engine

import (
	"github.com/keybase/client/go/libkb"
)

// XLoginCurrentDevice is an engine that tries to login using the
// current device, if there is an existing provisioned device.
type XLoginCurrentDevice struct {
	libkb.Contextified
}

// NewXLoginCurrentDevice creates a XLoginCurrentDevice engine.
func NewXLoginCurrentDevice(g *libkb.GlobalContext) *XLoginCurrentDevice {
	return &XLoginCurrentDevice{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *XLoginCurrentDevice) Name() string {
	return "XLoginCurrentDevice"
}

// GetPrereqs returns the engine prereqs.
func (e *XLoginCurrentDevice) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *XLoginCurrentDevice) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *XLoginCurrentDevice) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *XLoginCurrentDevice) Run(ctx *Context) error {
	return nil
}
