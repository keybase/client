package libkb

import (
	"encoding/hex"

	jsonw "github.com/keybase/go-jsonw"
)

//==================================================================

type UserConfig struct {
	Id     string  `json:"id"`
	Name   string  `json:"name"`
	Salt   string  `json:"salt"`
	Device *string `json:"device"`

	importedId       UID
	importedSalt     []byte
	importedDeviceId *DeviceID
}

//==================================================================

func (u UserConfig) GetUID() UID                  { return u.importedId }
func (u UserConfig) GetUsername() string          { return u.Name }
func (u UserConfig) GetSalt() []byte              { return u.importedSalt }
func (u UserConfig) GetDeviceID() (ret *DeviceID) { return u.importedDeviceId }

//==================================================================

func NewUserConfig(id UID, name string, salt []byte, dev *DeviceID) *UserConfig {
	ret := &UserConfig{
		Id:               string(id),
		Name:             name,
		Salt:             hex.EncodeToString(salt),
		Device:           nil,
		importedId:       id,
		importedSalt:     salt,
		importedDeviceId: dev,
	}
	if dev != nil {
		tmp := dev.String()
		ret.Device = &tmp
	}
	return ret
}

//==================================================================

func (u *UserConfig) Import() (err error) {
	var tmp UID
	if tmp, err = UidFromHex(u.Id); err != nil {
		return
	}
	u.importedId = tmp
	if u.importedSalt, err = hex.DecodeString(u.Salt); err != nil {
		return
	}
	if u.Device != nil {
		if u.importedDeviceId, err = ImportDeviceID(*u.Device); err != nil {
			return
		}
	}
	return
}

//==================================================================

func ImportUserConfigFromJsonWrapper(jw *jsonw.Wrapper) (ret *UserConfig, err error) {
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

func (u *UserConfig) SetDevice(d *DeviceID) {
	u.importedDeviceId = d
	var s *string
	if d != nil {
		tmp := d.String()
		s = &tmp
	}
	u.Device = s
	return
}

//==================================================================
