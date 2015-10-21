package engine

import (
	"github.com/keybase/client/go/libkb"
)

// DeviceAdd is an engine.
type DeviceAdd struct {
	libkb.Contextified
}

// NewDeviceAdd creates a DeviceAdd engine.
func NewDeviceAdd(g *libkb.GlobalContext) *DeviceAdd {
	return &DeviceAdd{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *DeviceAdd) Name() string {
	return "DeviceAdd"
}

// GetPrereqs returns the engine prereqs.
func (e *DeviceAdd) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *DeviceAdd) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *DeviceAdd) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *DeviceAdd) Run(ctx *Context) error {
	panic("Run not yet implemented")
}
