package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
)

type DeviceRegisterArgs struct {
	Me   *libkb.User
	Name string
	Lks  *libkb.LKSec
}

type DeviceRegister struct {
	args     *DeviceRegisterArgs
	deviceID libkb.DeviceID
}

var ErrDeviceAlreadyRegistered = errors.New("Device already registered (device id exists in config)")

func NewDeviceRegister(args *DeviceRegisterArgs) *DeviceRegister {
	return &DeviceRegister{args: args}
}

func (d *DeviceRegister) Name() string {
	return "DeviceRegister"
}

func (d *DeviceRegister) RequiredUIs() []libkb.UIKind {
	return nil
}

func (d *DeviceRegister) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (d *DeviceRegister) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

// Run
// when device is the eldest key:
//    use args Name, LksClientHalf
// when you have a key that can sign already but need a device
// key:
//    use args Name, LksClientHalf, Signer, and EldestKID
func (d *DeviceRegister) Run(ctx *Context) error {
	if d.args.Me.HasDeviceInCurrentInstall() {
		return ErrDeviceAlreadyRegistered
	}

	var err error
	if d.deviceID, err = libkb.NewDeviceID(); err != nil {
		return err
	}

	if err := d.args.Lks.GenerateServerHalf(); err != nil {
		return err
	}

	G.Log.Debug("Device name:   %s", d.args.Name)
	G.Log.Debug("Device ID:     %x", d.deviceID)

	if wr := G.Env.GetConfigWriter(); wr != nil {
		if err := wr.SetDeviceID(&d.deviceID); err != nil {
			return err
		}
		if err := wr.Write(); err != nil {
			return err
		}
		G.Log.Info("Setting Device ID to %s", d.deviceID)
	}

	return nil
}

func (d *DeviceRegister) DeviceID() libkb.DeviceID {
	return d.deviceID
}
