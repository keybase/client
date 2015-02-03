package engine

import (
	"github.com/keybase/go/libkb"
)

type DeviceEngine struct {
	deviceName  string
	deviceID    libkb.DeviceId
	localEncKey []byte
	me          *libkb.User
	eldestKey   libkb.NaclKeyPair
	logui       libkb.LogUI
}

func NewDeviceEngine(me *libkb.User, logui libkb.LogUI) *DeviceEngine {
	return &DeviceEngine{me: me, logui: logui}
}

func (d *DeviceEngine) Init() error {
	return nil
}

func (d *DeviceEngine) Run(deviceName string) (err error) {
	d.deviceName = deviceName
	if d.deviceID, err = libkb.NewDeviceId(); err != nil {
		return
	}
	// do we need this?
	/*
		d.localEncKey, err = RandBytes(32)
		if err != nil {
			return err
		}
	*/

	G.Log.Debug("Device name:   %s", d.deviceName)
	G.Log.Debug("Device ID:     %x", d.deviceID)
	// G.Log.Info("Local Enc Key: %x", d.localEncKey)

	if err = d.pushEldestKey(); err != nil {
		return err
	}

	if wr := G.Env.GetConfigWriter(); wr != nil {
		if wr.SetDeviceId(&d.deviceID); err != nil {
			return
		} else if err = wr.SetPerDeviceKID(d.EldestKey().GetKid()); err != nil {
			return
		} else if err = wr.Write(); err != nil {
			return
		} else {
			G.Log.Info("Setting Device ID to %s", d.deviceID)
		}
	}

	if err = d.pushDHKey(); err != nil {
		return
	}

	return
}

func (d *DeviceEngine) EldestKey() libkb.GenericKey {
	return d.eldestKey
}

func (d *DeviceEngine) pushEldestKey() error {
	gen := libkb.NewNaclKeyGen(libkb.NaclKeyGenArg{
		Generator: libkb.GenerateNaclSigningKeyPair,
		Me:        d.me,
		ExpireIn:  libkb.NACL_DH_EXPIRE_IN,
		Device:    d.device(),
		LogUI:     d.logui,
	})
	err := gen.Run()
	if err != nil {
		return err
	}
	d.eldestKey = gen.GetKeyPair()
	return nil
}

func (d *DeviceEngine) pushDHKey() error {
	gen := libkb.NewNaclKeyGen(libkb.NaclKeyGenArg{
		Signer:    d.eldestKey,
		Primary:   d.eldestKey,
		Generator: libkb.GenerateNaclDHKeyPair,
		Type:      libkb.SUBKEY_TYPE,
		Me:        d.me,
		ExpireIn:  libkb.NACL_DH_EXPIRE_IN,
		Device:    d.device(),
		LogUI:     d.logui,
	})

	return gen.Run()
}

func (d *DeviceEngine) device() *libkb.Device {
	s := 1
	return &libkb.Device{
		Id:          d.deviceID.String(),
		Description: &d.deviceName,
		Type:        "desktop", // XXX always desktop?
		Status:      &s,
	}
}
