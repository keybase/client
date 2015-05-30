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
	libkb.Contextified
}

var ErrDeviceAlreadyRegistered = errors.New("Device already registered (device id exists in config)")

func NewDeviceRegister(args *DeviceRegisterArgs, g *libkb.GlobalContext) *DeviceRegister {
	return &DeviceRegister{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
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

	d.G().Log.Debug("Device name:   %s", d.args.Name)
	d.G().Log.Debug("Device ID:     %s", d.deviceID)

	if wr := d.G().Env.GetConfigWriter(); wr != nil {
		if err := wr.SetDeviceID(&d.deviceID); err != nil {
			return err
		}
		if err := wr.Write(); err != nil {
			return err
		}
		ctx.LogUI.Debug("Setting Device ID to %s", d.deviceID)
	}

	return nil
}

func (d *DeviceRegister) DeviceID() libkb.DeviceID {
	return d.deviceID
}
