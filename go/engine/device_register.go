package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

type DeviceRegisterArgs struct {
	Name string
	Lks  *libkb.LKSec
}

type DeviceRegister struct {
	deviceName string
	deviceID   libkb.DeviceID
	lks        *libkb.LKSec
	me         *libkb.User
	args       *DeviceRegisterArgs
}

func NewDeviceRegister(me *libkb.User, args *DeviceRegisterArgs) *DeviceRegister {
	return &DeviceRegister{me: me, args: args}
}

func (d *DeviceRegister) Name() string {
	return "NDevice"
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
	return d.run(ctx, d.args.Name, d.args.Lks)
}

func (d *DeviceRegister) DeviceID() libkb.DeviceID {
	return d.deviceID
}

func (d *DeviceRegister) run(ctx *Context, deviceName string, lks *libkb.LKSec) (err error) {
	if d.me.HasDeviceInCurrentInstall() {
		return ErrDeviceAlreadyRegistered
	}

	d.deviceName = deviceName
	if d.deviceID, err = libkb.NewDeviceID(); err != nil {
		return
	}

	d.lks = lks
	if d.lks.GenerateServerHalf(); err != nil {
		return err
	}

	G.Log.Debug("Device name:   %s", d.deviceName)
	G.Log.Debug("Device ID:     %x", d.deviceID)

	if wr := G.Env.GetConfigWriter(); wr != nil {
		if err := wr.SetDeviceID(&d.deviceID); err != nil {
			return err
		} else if err := wr.Write(); err != nil {
			return err
		} else {
			G.Log.Info("Setting Device ID to %s", d.deviceID)
		}
	}

	if err = d.pushLocalKeySec(); err != nil {
		return
	}

	// Sync the LKS stuff back from the server, so that subsequent
	// attempts to use public key login will work.
	err = libkb.RunSyncer(G.SecretSyncer, d.me.GetUid().P())

	return
}

func (d *DeviceRegister) pushLocalKeySec() error {
	if d.lks == nil {
		return fmt.Errorf("no local key security set")
	}

	serverHalf := d.lks.GetServerHalf()
	if serverHalf == nil {
		return fmt.Errorf("LKS server half is nil, and should not be")
	}

	// send it to api server
	return libkb.PostDeviceLKS(d.deviceID.String(), libkb.DEVICE_TYPE_DESKTOP, serverHalf)
}

func (d *DeviceRegister) device() *libkb.Device {
	s := libkb.DEVICE_STATUS_ACTIVE
	return &libkb.Device{
		Id:          d.deviceID.String(),
		Description: &d.deviceName,
		Type:        libkb.DEVICE_TYPE_DESKTOP,
		Status:      &s,
	}
}
