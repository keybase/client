package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/go/libkb"
)

var ErrDeviceAlreadyRegistered = errors.New("Device already registered (device id exists in config)")

type DeviceEngine struct {
	deviceName    string
	deviceID      libkb.DeviceID
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

// Run is for when the device key will be the eldest key.
func (d *DeviceEngine) Run(deviceName string, lksClientHalf []byte) error {
	return d.run(deviceName, lksClientHalf, nil, nil)
}

// RunWithSigner is for when you have a key that can sign already,
// but need a device key.
func (d *DeviceEngine) RunWithSigner(deviceName string, lksClientHalf []byte, signer libkb.GenericKey, eldestKID libkb.KID) error {
	return d.run(deviceName, lksClientHalf, signer, eldestKID)
}

func (d *DeviceEngine) run(deviceName string, lksClientHalf []byte, signer libkb.GenericKey, eldestKID libkb.KID) (err error) {
	if d.me.HasDeviceInCurrentInstall() {
		return ErrDeviceAlreadyRegistered
	}

	d.deviceName = deviceName
	d.lksClientHalf = lksClientHalf
	if d.deviceID, err = libkb.NewDeviceID(); err != nil {
		return
	}
	d.lksEncKey, err = libkb.RandBytes(len(d.lksClientHalf))
	if err != nil {
		return
	}
	d.lks = libkb.NewLKSecSecret(d.lksEncKey)

	G.Log.Debug("Device name:   %s", d.deviceName)
	G.Log.Debug("Device ID:     %x", d.deviceID)
	G.Log.Debug("Eldest FOKID:  %s", eldestKID)

	if signer == nil {
		if err = d.pushEldestKey(); err != nil {
			return err
		}
		signer = d.eldestKey
		eldestKID = d.eldestKey.GetKid()
	} else {
		if err = d.pushSibKey(signer, eldestKID); err != nil {
			return err
		}
	}

	if wr := G.Env.GetConfigWriter(); wr != nil {
		if err := wr.SetDeviceID(&d.deviceID); err != nil {
			return err
		} else if err := wr.Write(); err != nil {
			return err
		} else {
			G.Log.Info("Setting Device ID to %s", d.deviceID)
		}
	}

	if err = d.pushDHKey(signer, eldestKID); err != nil {
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
		ExpireIn:  libkb.NACL_EDDSA_EXPIRE_IN,
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

func (d *DeviceEngine) pushSibKey(signer libkb.GenericKey, eldestKID libkb.KID) error {
	gen := libkb.NewNaclKeyGen(libkb.NaclKeyGenArg{
		Signer:      signer,
		EldestKeyID: eldestKID,
		Generator:   libkb.GenerateNaclSigningKeyPair,
		Sibkey:      true,
		Me:          d.me,
		ExpireIn:    libkb.NACL_EDDSA_EXPIRE_IN,
		Device:      d.device(),
		LogUI:       d.logui,
	})
	err := gen.RunLKS(d.lks)
	if err != nil {
		return err
	}
	return nil
}

func (d *DeviceEngine) pushDHKey(signer libkb.GenericKey, eldestKID libkb.KID) error {
	gen := libkb.NewNaclKeyGen(libkb.NaclKeyGenArg{
		Signer:      signer,
		EldestKeyID: eldestKID,
		Generator:   libkb.GenerateNaclDHKeyPair,
		Sibkey:      false,
		Me:          d.me,
		ExpireIn:    libkb.NACL_DH_EXPIRE_IN,
		Device:      d.device(),
		LogUI:       d.logui,
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
