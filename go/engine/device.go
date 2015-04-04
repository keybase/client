package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
)

var ErrDeviceAlreadyRegistered = errors.New("Device already registered (device id exists in config)")

// when device is the eldest key:
//    use args Name, LksClientHalf
// when you have a key that can sign already but need a device
// key:
//    use args Name, LksClientHalf, Signer, and EldestKID
type DeviceEngineArgs struct {
	Name          string
	LksClientHalf []byte
	Signer        libkb.GenericKey
	EldestKID     libkb.KID
}

type DeviceEngine struct {
	deviceName    string
	deviceID      libkb.DeviceID
	lksEncKey     []byte
	lksClientHalf []byte
	lks           *libkb.LKSec
	me            *libkb.User
	eldestKey     libkb.NaclKeyPair
	args          *DeviceEngineArgs
	newSibkey     libkb.NaclKeyPair
	libkb.Contextified
}

func NewDeviceEngine(me *libkb.User, args *DeviceEngineArgs, gc *libkb.GlobalContext) *DeviceEngine {
	return &DeviceEngine{me: me, args: args, Contextified: libkb.NewContextified(gc)}
}

func (d *DeviceEngine) Name() string {
	return "Device"
}

func (d *DeviceEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LogUIKind}
}

func (d *DeviceEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (d *DeviceEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (d *DeviceEngine) Init() error {
	return nil
}

// Run
// when device is the eldest key:
//    use args Name, LksClientHalf
// when you have a key that can sign already but need a device
// key:
//    use args Name, LksClientHalf, Signer, and EldestKID
func (d *DeviceEngine) Run(ctx *Context) error {
	return d.run(ctx, d.args.Name, d.args.LksClientHalf, d.args.Signer, d.args.EldestKID)
}

func (d *DeviceEngine) run(ctx *Context, deviceName string, lksClientHalf []byte, signer libkb.GenericKey, eldestKID libkb.KID) (err error) {
	if d.me.HasDeviceInCurrentInstall() {
		return ErrDeviceAlreadyRegistered
	}

	d.deviceName = deviceName
	d.lksClientHalf = lksClientHalf
	if d.deviceID, err = libkb.NewDeviceID(); err != nil {
		return
	}

	d.lks = libkb.NewLKSec(lksClientHalf, d.G())
	if d.lks.GenerateServerHalf(); err != nil {
		return err
	}

	d.G().Log.Debug("Device name:   %s", d.deviceName)
	d.G().Log.Debug("Device ID:     %x", d.deviceID)
	d.G().Log.Debug("Eldest FOKID:  %s", eldestKID)

	if signer == nil {
		if err = d.pushEldestKey(ctx); err != nil {
			return err
		}
		signer = d.eldestKey
		eldestKID = d.eldestKey.GetKid()
	} else {
		if signer, err = d.pushSibKey(ctx, signer, eldestKID); err != nil {
			return err
		}
	}

	if wr := d.G().Env.GetConfigWriter(); wr != nil {
		if err := wr.SetDeviceID(&d.deviceID); err != nil {
			return err
		} else if err := wr.Write(); err != nil {
			return err
		} else {
			d.G().Log.Info("Setting Device ID to %s", d.deviceID)
		}
	}

	if err = d.pushDHKey(ctx, signer, eldestKID); err != nil {
		return
	}

	if err = d.pushLocalKeySec(); err != nil {
		return
	}

	// Sync the LKS stuff back from the server, so that subsequent
	// attempts to use public key login will work.
	err = libkb.RunSyncer(d.G().SecretSyncer, d.me.GetUid().P())

	return
}

func (d *DeviceEngine) EldestKey() libkb.GenericKey {
	return d.eldestKey
}

func (d *DeviceEngine) GetNewSibkey() libkb.GenericKey {
	return d.newSibkey
}

func (d *DeviceEngine) LKSKey() []byte {
	return d.lksEncKey
}

func (d *DeviceEngine) pushEldestKey(ctx *Context) error {
	gen := libkb.NewNaclKeyGen(libkb.NaclKeyGenArg{
		Generator: libkb.GenerateNaclSigningKeyPair,
		Me:        d.me,
		ExpireIn:  libkb.NACL_EDDSA_EXPIRE_IN,
		Device:    d.device(),
		LogUI:     ctx.LogUI,
	})
	err := gen.RunLKS(d.lks)
	if err != nil {
		return err
	}
	d.eldestKey = gen.GetKeyPair()
	return nil
}

func (d *DeviceEngine) pushSibKey(ctx *Context, signer libkb.GenericKey, eldestKID libkb.KID) (libkb.GenericKey, error) {
	gen := libkb.NewNaclKeyGen(libkb.NaclKeyGenArg{
		Signer:      signer,
		EldestKeyID: eldestKID,
		Generator:   libkb.GenerateNaclSigningKeyPair,
		Sibkey:      true,
		Me:          d.me,
		ExpireIn:    libkb.NACL_EDDSA_EXPIRE_IN,
		Device:      d.device(),
		LogUI:       ctx.LogUI,
	})
	err := gen.RunLKS(d.lks)
	if err != nil {
		return nil, err
	}
	d.newSibkey = gen.GetNewKeyPair()
	return d.newSibkey, nil
}

func (d *DeviceEngine) pushDHKey(ctx *Context, signer libkb.GenericKey, eldestKID libkb.KID) error {
	gen := libkb.NewNaclKeyGen(libkb.NaclKeyGenArg{
		Signer:      signer,
		EldestKeyID: eldestKID,
		Generator:   libkb.GenerateNaclDHKeyPair,
		Sibkey:      false,
		Me:          d.me,
		ExpireIn:    libkb.NACL_DH_EXPIRE_IN,
		Device:      d.device(),
		LogUI:       ctx.LogUI,
	})

	return gen.RunLKS(d.lks)
}

func (d *DeviceEngine) pushLocalKeySec() error {
	if len(d.lksClientHalf) == 0 {
		return fmt.Errorf("no local key security client half key set")
	}

	// xor d.lksEncKey with LksClientHalf bytes from tspasskey
	serverHalf := d.lks.GetServerHalf()
	if serverHalf == nil {
		return fmt.Errorf("LKS server half is nil, and should not be")
	}

	// send it to api server
	return libkb.PostDeviceLKS(d.deviceID.String(), libkb.DEVICE_TYPE_DESKTOP, serverHalf)
}

func (d *DeviceEngine) device() *libkb.Device {
	s := libkb.DEVICE_STATUS_ACTIVE
	return &libkb.Device{
		Id:          d.deviceID.String(),
		Description: &d.deviceName,
		Type:        libkb.DEVICE_TYPE_DESKTOP,
		Status:      &s,
	}
}
