package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

type NDeviceEngineArgs struct {
	Name string
	Lks  *libkb.LKSec
}

type NDeviceEngine struct {
	deviceName string
	deviceID   libkb.DeviceID
	lks        *libkb.LKSec
	me         *libkb.User
	args       *NDeviceEngineArgs
}

func NewNDeviceEngine(me *libkb.User, args *NDeviceEngineArgs) *NDeviceEngine {
	return &NDeviceEngine{me: me, args: args}
}

func (d *NDeviceEngine) Name() string {
	return "NDevice"
}

func (d *NDeviceEngine) RequiredUIs() []libkb.UIKind {
	return nil
}

func (d *NDeviceEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (d *NDeviceEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

// Run
// when device is the eldest key:
//    use args Name, LksClientHalf
// when you have a key that can sign already but need a device
// key:
//    use args Name, LksClientHalf, Signer, and EldestKID
func (d *NDeviceEngine) Run(ctx *Context) error {
	return d.run(ctx, d.args.Name, d.args.Lks)
}

func (d *NDeviceEngine) DeviceID() libkb.DeviceID {
	return d.deviceID
}

func (d *NDeviceEngine) run(ctx *Context, deviceName string, lks *libkb.LKSec) (err error) {
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

func (d *NDeviceEngine) pushLocalKeySec() error {
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

func (d *NDeviceEngine) device() *libkb.Device {
	s := libkb.DEVICE_STATUS_ACTIVE
	return &libkb.Device{
		Id:          d.deviceID.String(),
		Description: &d.deviceName,
		Type:        libkb.DEVICE_TYPE_DESKTOP,
		Status:      &s,
	}
}
