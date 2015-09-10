package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
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
	Description *string           `json:"name,omitempty"`
	Status      *int              `json:"status,omitempty"`
}

// NewPaperDevice creates a new paper backup key device
func NewPaperDevice(passphrasePrefix string) (*Device, error) {
	did, err := NewDeviceID()
	if err != nil {
		return nil, err
	}
	s := DeviceStatusActive
	desc := passphrasePrefix

	d := &Device{
		ID:          did,
		Type:        DeviceTypePaper,
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
