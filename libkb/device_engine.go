package libkb

import (
	"fmt"
)

type DeviceEngine struct {
	deviceName  string
	deviceID    DeviceId
	localEncKey []byte
	me          *User
	rootKey     NaclKeyPair
}

func NewDeviceEngine() *DeviceEngine {
	return &DeviceEngine{}
}

func (d *DeviceEngine) Init() error {
	return nil
}

func (d *DeviceEngine) Run(deviceName string) error {
	d.deviceName = deviceName
	var err error
	d.deviceID, err = NewDeviceId()
	if err != nil {
		return err
	}
	// do we need this?
	/*
		d.localEncKey, err = RandBytes(32)
		if err != nil {
			return err
		}
	*/
	G.Log.Info("Device name:   %s", d.deviceName)
	G.Log.Info("Device ID:     %x", d.deviceID)
	// G.Log.Info("Local Enc Key: %x", d.localEncKey)

	d.me, err = LoadMe(LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		fmt.Printf("LoadMe error: %s\n", err)
		return err
	}

	if err := d.pushRootSigningKey(); err != nil {
		return err
	}
	if err := d.pushDHKey(); err != nil {
		return err
	}
	return nil
}

func (d *DeviceEngine) pushRootSigningKey() error {
	eddsaPair, err := GenerateNaclSigningKeyPair()
	if err != nil {
		return err
	}
	G.Log.Info("EdDSA: %s", eddsaPair.VerboseDescription())

	// copying stuff from keygen.go/GeneratePost
	fokid := GenericKeyToFOKID(eddsaPair)
	jw, err := d.me.SelfProof(eddsaPair, &fokid)
	if err != nil {
		return err
	}
	G.Log.Info("self proof json: %s", jw)

	sig, sigid, linkid, err := SignJson(jw, eddsaPair)
	if err != nil {
		return err
	}
	G.Log.Info("sig: %v, sigid: %v, linkid: %v", sig, sigid, linkid)

	pubkey, err := eddsaPair.Encode()
	if err != nil {
		return err
	}

	args := HttpArgs{
		"sig_id_base":  S{sigid.ToString(false)},
		"sig_id_short": S{sigid.ToShortId()},
		"sig":          S{sig},
		"public_key":   S{pubkey},
		"is_primary":   I{1},
	}

	_, err = G.API.Post(ApiArg{
		Endpoint:    "key/add",
		NeedSession: true,
		Args:        args,
	})
	if err != nil {
		return err
	}

	d.rootKey = eddsaPair
	d.me.sigChain.Bump(MerkleTriple{linkId: linkid, sigId: sigid})

	return nil
}

func (d *DeviceEngine) pushDHKey() error {
	gen := NewNaclKeyGen(NaclKeyGenArg{
		Signer:    d.rootKey,
		Primary:   d.rootKey,
		Generator: GenerateNaclDHKeyPair,
		Type:      "subkey",
		Me:        d.me,
		ExpireIn:  NACL_DH_EXPIRE_IN,
		// LogUI:     s.arg.LogUI,
		Device: &Device{Id: d.deviceID.String(), Description: &d.deviceName},
	})

	// XXX haven't implemented saving yet...when that's ready, this should work:
	// return gen.Run()
	// XXX but for now, generate and push:

	if err := gen.Generate(); err != nil {
		return err
	}
	return gen.Push()
}
