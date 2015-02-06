package engine

import (
	"fmt"

	"github.com/keybase/go/libkb"
)

// XXX this probably shouldn't be a constant...
const deviceType = "desktop"

type DeviceEngine struct {
	deviceName    string
	deviceID      libkb.DeviceId
	lksEncKey     []byte
	lksClientHalf []byte
	lks           *libkb.LKSec
	me            *libkb.User
	eldestKey     libkb.NaclKeyPair
	logui         libkb.LogUI
}

func NewDeviceEngine(me *libkb.User, logui libkb.LogUI) *DeviceEngine {
	return &DeviceEngine{me: me, logui: logui}
}

func (d *DeviceEngine) Init() error {
	return nil
}

func (d *DeviceEngine) Run(deviceName string, lksClientHalf []byte) (err error) {
	d.deviceName = deviceName
	d.lksClientHalf = lksClientHalf
	if d.deviceID, err = libkb.NewDeviceId(); err != nil {
		return
	}
	d.lksEncKey, err = libkb.RandBytes(len(d.lksClientHalf))
	if err != nil {
		return
	}
	d.lks = libkb.NewLKSecSecret(d.lksEncKey)

	G.Log.Debug("Device name:   %s", d.deviceName)
	G.Log.Debug("Device ID:     %x", d.deviceID)

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

	if err = d.pushLocalKeySec(); err != nil {
		return
	}

	// Sync the LKS stuff back from the server, so that subsequent
	// attempts to use public key login will work.
	err = G.SecretSyncer.Load(d.me.GetUid())

	return
}

func (d *DeviceEngine) EldestKey() libkb.GenericKey {
	return d.eldestKey
}

func (d *DeviceEngine) LKSKey() []byte {
	return d.lksEncKey
}

func (d *DeviceEngine) pushEldestKey() error {
	gen := libkb.NewNaclKeyGen(libkb.NaclKeyGenArg{
		Generator: libkb.GenerateNaclSigningKeyPair,
		Me:        d.me,
		ExpireIn:  libkb.NACL_DH_EXPIRE_IN,
		Device:    d.device(),
		LogUI:     d.logui,
	})
	err := gen.RunLKS(d.lks)
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

	return gen.RunLKS(d.lks)
}

func (d *DeviceEngine) pushLocalKeySec() error {
	if len(d.lksClientHalf) == 0 {
		return fmt.Errorf("no local key security client half key set")
	}

	// xor d.lksEncKey with LksClientHalf bytes from tspasskey
	serverHalf := make([]byte, len(d.lksClientHalf))
	libkb.XORBytes(serverHalf, d.lksEncKey, d.lksClientHalf)

	// send it to api server
	return libkb.PostDeviceLKS(d.deviceID.String(), deviceType, serverHalf)
}

func (d *DeviceEngine) device() *libkb.Device {
	s := 1
	return &libkb.Device{
		Id:          d.deviceID.String(),
		Description: &d.deviceName,
		Type:        deviceType,
		Status:      &s,
	}
}
