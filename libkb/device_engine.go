package libkb

type DeviceEngine struct {
	deviceName  string
	deviceID    []byte
	localEncKey []byte
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
	d.deviceID, err = RandBytes(32)
	if err != nil {
		return err
	}
	d.localEncKey, err = RandBytes(32)
	if err != nil {
		return err
	}

	G.Log.Info("Device name:   %s", d.deviceName)
	G.Log.Info("Device ID:     %x", d.deviceID)
	G.Log.Info("Local Enc Key: %x", d.localEncKey)

	// XXX once api endpoint for adding a device ready, add call to it here
	G.Log.Info("(waiting for api endpoint implementation...)")

	return nil
}

// post makes the api call to api.keybase.io.
// Waiting for an endpoint for this.
func (d *DeviceEngine) post() error {
	// example from signup engine:
	/*
		var res *ApiRes
		res, err = G.API.Post(ApiArg{
			Endpoint: "signup",
			Args: HttpArgs{
				"salt":          S{hex.EncodeToString(s.salt)},
				"pwh":           S{hex.EncodeToString(s.pwh)},
				"username":      S{arg.Username},
				"email":         S{arg.Email},
				"invitation_id": S{arg.InviteCode},
				"pwh_version":   I{int(triplesec.Version)},
			}})
		if err == nil {
			s.username = arg.Username
			GetUidVoid(res.Body.AtKey("uid"), &s.uid, &err)
			res.Body.AtKey("session").GetStringVoid(&s.session, &err)
			res.Body.AtKey("csrf_token").GetStringVoid(&s.csrf, &err)
		}
	*/
	return nil
}
