package engine

import (
	"fmt"

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

	if err = d.pushLocalKeySec(); err != nil {
		return err
	}

	// Sync the LKS stuff back from the server, so that subsequent
	// attempts to use public key login will work.
	if err := libkb.RunSyncer(G.SecretSyncer, d.args.Me.GetUid().P()); err != nil {
		return err
	}

	return nil
}

func (d *DeviceRegister) DeviceID() libkb.DeviceID {
	return d.deviceID
}

func (d *DeviceRegister) pushLocalKeySec() error {
	if d.args.Lks == nil {
		return fmt.Errorf("no local key security set")
	}

	serverHalf := d.args.Lks.GetServerHalf()
	if serverHalf == nil {
		return fmt.Errorf("LKS server half is nil, and should not be")
	}

	// send it to api server
	return libkb.PostDeviceLKS(d.deviceID.String(), libkb.DEVICE_TYPE_DESKTOP, serverHalf)
}
