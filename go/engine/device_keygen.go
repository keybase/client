package engine

import (
	"github.com/keybase/client/go/libkb"
)

// DeviceKeygen is an engine.
type DeviceKeygen struct{}

// NewDeviceKeygen creates a DeviceKeygen engine.
func NewDeviceKeygen() *DeviceKeygen {
	return &DeviceKeygen{}
}

// Name is the unique engine name.
func (e *DeviceKeygen) Name() string {
	return "DeviceKeygen"
}

// GetPrereqs returns the engine prereqs.
func (e *DeviceKeygen) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *DeviceKeygen) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *DeviceKeygen) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *DeviceKeygen) Run(ctx *Context) error {
	return nil
}
