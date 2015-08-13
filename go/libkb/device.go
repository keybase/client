package libkb

import (
	"errors"
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
	"strings"
)

const (
	DeviceIDLen    = 16
	DeviceIDSuffix = 0x18
)

func NewDeviceID() (keybase1.DeviceID, error) {
	var b []byte
	b, err := RandBytes(DeviceIDLen)
	if err != nil {
		return "", err
	}
	b[DeviceIDLen-1] = DeviceIDSuffix
	return keybase1.DeviceIDFromSlice(b)
}

type DeviceStatus struct {
	Provisioned  bool
	Keyed        bool
	KeyAvailable bool
}

type Device struct {
	ID          keybase1.DeviceID `json:"id"`
	Type        string            `json:"type"`
	Kid         keybase1.KID      `json:"kid,omitempty"`
	Description *string           `json:"description,omitempty"`
	Status      *int              `json:"status,omitempty"`
}

// IsWeb returns true if the device is a Web pseudo-device
func (d *Device) IsWeb() bool {
	return d.Type == DeviceTypeWeb
}

func genUniqueDeviceName(types *map[string]bool, prefix string, entropy int, retries int) string {
	if retries <= 0 {
		return ""
	}

	for i := 0; i < retries; i++ {
		words, err := SecWordList(entropy)
		if err != nil {
			return ""
		}
		possible := prefix + " " + strings.Join(words, " ")

		var taken = false
		err = G.LoginState().SecretSyncer(func(ss *SecretSyncer) {
			taken = ss.IsDeviceNameTaken(possible, types)
		}, "Device - genUniqueDeviceName")

		if err != nil {
			return ""
		}

		if taken == false {
			return possible
		}
	}

	return ""
}

func NewWebDevice() (ret *Device) {
	if did, err := NewDeviceID(); err != nil {
		G.Log.Errorf("In random new device ID: %s", err)
	} else {
		s := DeviceStatusActive

		desc := "Web Key " + did.String() // TODO maybe make a nice unique keyname, can't use getUniqueDeviceName if not logged in...

		ret = &Device{
			ID:          did,
			Type:        DeviceTypeWeb,
			Status:      &s,
			Description: &desc,
		}
	}
	return
}

func NewBackupDevice() (*Device, error) {
	did, err := NewDeviceID()
	if err != nil {
		return nil, err
	}
	s := DeviceStatusActive
	desc := genUniqueDeviceName(&map[string]bool{DeviceTypeBackup: true}, "Account Recover Keys", BackupKeyNameEntropy, 100)

	if desc == "" {
		return nil, errors.New("Can't find unique backup key description")
	}

	d := &Device{
		ID:          did,
		Type:        DeviceTypeBackup,
		Status:      &s,
		Description: &desc,
	}
	return d, nil
}

func ParseDevice(jw *jsonw.Wrapper) (ret *Device, err error) {
	var obj Device
	if err = jw.UnmarshalAgain(&obj); err == nil {
		ret = &obj
	}
	return
}

func (d *Device) Merge(d2 *Device) {
	d.Type = d2.Type
	if d2.Kid.Exists() {
		d.Kid = d2.Kid
	}
	if d2.Description != nil {
		d.Description = d2.Description
	}
	if d2.Status != nil {
		d.Status = d2.Status
	}
}

func (d *Device) Export() *jsonw.Wrapper {
	return jsonw.NewWrapper(d)
}

func (d *Device) ProtExport() *keybase1.Device {
	ex := &keybase1.Device{
		Type:     d.Type,
		DeviceID: d.ID,
	}
	if d.Description != nil {
		ex.Name = *d.Description
	}
	return ex
}

func (d *Device) IsActive() bool {
	if d.Status == nil {
		return false
	}
	return *d.Status == DeviceStatusActive
}
