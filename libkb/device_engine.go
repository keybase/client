package libkb

type DeviceEngine struct {
	deviceName  string
	deviceID    DeviceId
	localEncKey []byte
	me          *User
	rootKey     NaclKeyPair
	logui       LogUI
}

func NewDeviceEngine(me *User, logui LogUI) *DeviceEngine {
	return &DeviceEngine{me: me, logui: logui}
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

	G.Log.Debug("Device name:   %s", d.deviceName)
	G.Log.Debug("Device ID:     %x", d.deviceID)
	// G.Log.Info("Local Enc Key: %x", d.localEncKey)

	if err := d.pushRootSigningKey(); err != nil {
		return err
	}
	if err := d.pushDHKey(); err != nil {
		return err
	}
	return nil
}

func (d *DeviceEngine) RootSigningKey() GenericKey {
	return d.rootKey
}

func (d *DeviceEngine) pushRootSigningKey() error {
	eddsaPair, err := GenerateNaclSigningKeyPair()
	if err != nil {
		return err
	}
	G.Log.Debug("EdDSA: %s", eddsaPair.VerboseDescription())

	// copying stuff from keygen.go/GeneratePost
	fokid := GenericKeyToFOKID(eddsaPair)
	jw, err := d.me.SelfProof(eddsaPair, &fokid)
	if err != nil {
		return err
	}
	G.Log.Debug("self proof json: %s", jw.MarshalPretty())

	sig, sigid, linkid, err := SignJson(jw, eddsaPair)
	if err != nil {
		return err
	}

	pubkey, err := eddsaPair.Encode()
	if err != nil {
		return err
	}

	// save it to local keyring:
	_, err = WriteP3SKBToKeyring(eddsaPair, nil, d.logui)
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

func (d *DeviceEngine) device() *Device {
	s := 1
	return &Device{
		Id:          d.deviceID.String(),
		Description: &d.deviceName,
		Type:        "desktop", // XXX always desktop?
		Status:      &s,
	}
}

func (d *DeviceEngine) pushDHKey() error {
	gen := NewNaclKeyGen(NaclKeyGenArg{
		Signer:    d.rootKey,
		Primary:   d.rootKey,
		Generator: GenerateNaclDHKeyPair,
		Type:      SUBKEY_TYPE,
		Me:        d.me,
		ExpireIn:  NACL_DH_EXPIRE_IN,
		Device:    d.device(),
		LogUI:     d.logui,
	})

	return gen.Run()
}
