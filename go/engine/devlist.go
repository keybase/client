package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

// DevList is an engine that gets a list of all the user's
// devices.
type DevList struct {
	devices []keybase_1.Device
	libkb.Contextified
}

// NewDevList creates a DevList engine.
func NewDevList() *DevList {
	return &DevList{}
}

func (d *DevList) Name() string {
	return "DevList"
}

func (d *DevList) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

func (d *DevList) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LogUIKind}
}

func (d *DevList) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (d *DevList) Run(ctx *Context) error {
	if err := d.G().LoginState.RunSecretSyncer(); err != nil {
		return err
	}

	ss := d.G().LoginState.SecretSyncer()

	devs, err := ss.ActiveDevices()
	if err != nil {
		return err
	}
	var pdevs []keybase_1.Device
	for k, v := range devs {
		pdevs = append(pdevs, keybase_1.Device{Type: v.Type, Name: v.Description, DeviceID: k})
	}
	d.devices = pdevs

	return nil
}

func (d *DevList) List() []keybase_1.Device {
	return d.devices
}
