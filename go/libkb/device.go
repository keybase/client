package libkb

import (
	"encoding/hex"
	"fmt"

	jsonw "github.com/keybase/go-jsonw"
)

const (
	DeviceIDLen    = 16
	DeviceIDSuffix = 0x18
)

type DeviceID [DeviceIDLen]byte

func (d DeviceID) String() string {
	return hex.EncodeToString(d[:])
}

func NewDeviceID() (id DeviceID, err error) {
	var b []byte
	b, err = RandBytes(DeviceIDLen)
	if err != nil {
		return id, err
	}
	b[DeviceIDLen-1] = DeviceIDSuffix
	copy(id[:], b)
	return id, nil
}

func ImportDeviceID(s string) (d *DeviceID, err error) {
	if len(s) != 2*DeviceIDLen {
		err = fmt.Errorf("Bad Device ID length: %d", len(s))
		return
	}
	var tmp []byte
	tmp, err = hex.DecodeString(s)
	if err != nil {
		return
	}

	if c := tmp[DeviceIDLen-1]; c != DeviceIDSuffix {
		err = fmt.Errorf("Bad suffix byte: %02x", c)
		return
	}

	var ret DeviceID
	copy(ret[:], tmp)
	d = &ret
	return
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (d *DeviceID) UnmarshalJSON(b []byte) error {
	v, err := ImportDeviceID(Unquote(b))
	if err != nil {
		return err
	}
	*d = *v
	return nil
}

type DeviceStatus struct {
	Provisioned  bool
	Keyed        bool
	KeyAvailable bool
}

type Device struct {
	// TODO: Store this as a DeviceID instead.
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	Kid         KID     `json:"kid,omitempty"`
	Description *string `json:"description,omitempty"`
	Status      *int    `json:"status,omitempty"`
}

// IsWeb returns true if the device is a Web pseudo-device
func (d *Device) IsWeb() bool {
	return d.Type == DeviceTypeWeb
}

func NewWebDevice() (ret *Device) {
	if did, err := NewDeviceID(); err != nil {
		G.Log.Errorf("In random new device ID: %s", err.Error())
	} else {
		s := DeviceStatusActive
		ret = &Device{
			ID:     did.String(),
			Type:   DeviceTypeWeb,
			Status: &s,
		}
	}
	return
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
	if d2.Kid != nil {
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
