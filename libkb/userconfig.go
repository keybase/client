package libkb

import (
	"encoding/hex"
	"github.com/keybase/go-jsonw"
)

//==================================================================

type UserConfig struct {
	Id          string  `json:"id"`
	Name        string  `json:"name"`
	Salt        string  `json:"salt"`
	Device      *string `json:"device"`
	UidVerified bool    `json:"uid_verified"`

	importedId       UID
	importedSalt     []byte
	importedDeviceId *DeviceID
}

//==================================================================

func (u UserConfig) GetUID() UID                  { return u.importedId }
func (u UserConfig) GetUsername() string          { return u.Name }
func (u UserConfig) GetSalt() []byte              { return u.importedSalt }
func (d UserConfig) GetDeviceID() (ret *DeviceID) { u.importedDeviceId }

func (u UserConfig) GetVerifiedUID() *UID {
	if u.UidVerified {
		return u.importedId
	} else {
		return nil
	}
}

//==================================================================

func NewUserConfig(id UID, name string, salt []byte, dev *DeviceID) *UserConfig {
	ret := &UserConfig{
		Id:               id.String(),
		Name:             name,
		Salt:             hex.EncodeToString(salt),
		Device:           nil,
		importedId:       id,
		importedSalt:     salt,
		importedDeviceId: dev,
	}
	if dev != nil {
		ret.Device = dev.String()
	}
	return
}

//==================================================================

func (u *UserConfig) Import() (err error) {
	if u.importedId, err = UidFromHex(u.Id); err != nil {
		return
	}
	if u.importSalt, err = hex.DecodeString(u.Salt); err != nil {
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
		ret = &tmp
	}
	return
}

//==================================================================
