package libkb

import (
	"encoding/hex"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

//==================================================================

type UserConfig struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Salt   string  `json:"salt"`
	Device *string `json:"device"`

	importedID       keybase1.UID
	importedSalt     []byte
	importedDeviceID keybase1.DeviceID
}

//==================================================================

func (u UserConfig) GetUID() keybase1.UID           { return u.importedID }
func (u UserConfig) GetUsername() string            { return u.Name }
func (u UserConfig) GetSalt() []byte                { return u.importedSalt }
func (u UserConfig) GetDeviceID() keybase1.DeviceID { return u.importedDeviceID }

//==================================================================

func NewUserConfig(id keybase1.UID, name string, salt []byte, dev keybase1.DeviceID) *UserConfig {
	ret := &UserConfig{
		ID:               id.String(),
		Name:             UsernameNormalize(name),
		Salt:             hex.EncodeToString(salt),
		Device:           nil,
		importedID:       id,
		importedSalt:     salt,
		importedDeviceID: dev,
	}
	if dev.Exists() {
		tmp := dev.String()
		ret.Device = &tmp
	}
	return ret
}

//==================================================================

func (u *UserConfig) Import() (err error) {
	var tmp keybase1.UID
	if tmp, err = UIDFromHex(u.ID); err != nil {
		return
	}
	u.importedID = tmp
	if u.importedSalt, err = hex.DecodeString(u.Salt); err != nil {
		return
	}
	if u.Device != nil {
		if u.importedDeviceID, err = keybase1.DeviceIDFromString(*u.Device); err != nil {
			return
		}
	}
	return
}

//==================================================================

func ImportUserConfigFromJSONWrapper(jw *jsonw.Wrapper) (ret *UserConfig, err error) {
	var tmp UserConfig
	if jw == nil {
		return
	}
	if err = jw.UnmarshalAgain(&tmp); err != nil {
		return
	}
	if err = tmp.Import(); err != nil {
		return
	}
	ret = &tmp
	return
}

//==================================================================

func (u *UserConfig) SetDevice(d keybase1.DeviceID) {
	u.importedDeviceID = d
	var s *string
	if d.Exists() {
		tmp := d.String()
		s = &tmp
	}
	u.Device = s
	return
}

//==================================================================
