package libkb

type DeviceEngine struct {
	deviceName string
}

func NewDeviceEngine() *DeviceEngine {
	return &DeviceEngine{}
}

func (d *DeviceEngine) Run(deviceName string) error {
	d.deviceName = deviceName
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
