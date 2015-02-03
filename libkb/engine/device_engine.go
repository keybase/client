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
	eddsaPair, err := libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		return err
	}
	G.Log.Debug("EdDSA: %s", eddsaPair.VerboseDescription())

	// copying stuff from keygen.go/GeneratePost
	fokid := libkb.GenericKeyToFOKID(eddsaPair)
	jw, err := d.me.SelfProof(eddsaPair, &fokid)
	if err != nil {
		return err
	}
	G.Log.Debug("self proof json: %s", jw.MarshalPretty())

	sig, sigid, linkid, err := libkb.SignJson(jw, eddsaPair)
	if err != nil {
		return err
	}

	pubkey, err := eddsaPair.Encode()
	if err != nil {
		return err
	}

	// save it to local keyring:
	_, err = libkb.WriteP3SKBToKeyring(eddsaPair, nil, d.logui)
	if err != nil {
		return err
	}

	args := libkb.HttpArgs{
		"sig_id_base":  libkb.S{Val: sigid.ToString(false)},
		"sig_id_short": libkb.S{Val: sigid.ToShortId()},
		"sig":          libkb.S{Val: sig},
		"public_key":   libkb.S{Val: pubkey},
		"is_primary":   libkb.I{Val: 1},
	}

	_, err = G.API.Post(libkb.ApiArg{
		Endpoint:    "key/add",
		NeedSession: true,
		Args:        args,
	})
	if err != nil {
		return err
	}

	d.eldestKey = eddsaPair
	d.me.SigChainBump(linkid, sigid)

	return nil
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
