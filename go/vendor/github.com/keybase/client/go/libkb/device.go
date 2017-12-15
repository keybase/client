// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	Kid         keybase1.KID      `json:"kid,omitempty"`
	Description *string           `json:"name,omitempty"`
	Status      *int              `json:"status,omitempty"`
	Type        string            `json:"type"`
	CTime       keybase1.Time     `json:"ctime"`
	MTime       keybase1.Time     `json:"mtime"`
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

func ParseDevice(jw *jsonw.Wrapper, t time.Time) (ret *Device, err error) {
	var obj Device
	if err = jw.UnmarshalAgain(&obj); err == nil {
		ret = &obj
		ret.CTime = keybase1.ToTime(t)
		ret.MTime = keybase1.ToTime(t)
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
	if d2.CTime.Before(d.CTime) && !d2.CTime.IsZero() {
		d.CTime = d2.CTime
	}
	if d2.MTime.After(d.MTime) || d.MTime.IsZero() {
		d.MTime = d2.MTime
	}
}

func (d *Device) Export(lt LinkType) (*jsonw.Wrapper, error) {
	dw, err := jsonw.NewObjectWrapper(d)
	if err != nil {
		return nil, err
	}

	if lt == LinkType(DelegationTypeSubkey) {
		// subkeys shouldn't have name or type
		if err := dw.DeleteKey("name"); err != nil {
			return nil, err
		}
		if err := dw.DeleteKey("type"); err != nil {
			return nil, err
		}
	}

	// These were being set to 0, so don't include them
	dw.DeleteKey("mtime")
	dw.DeleteKey("ctime")

	return dw, nil
}

func (d *Device) ProtExport() *keybase1.Device {
	ex := &keybase1.Device{
		Type:     d.Type,
		DeviceID: d.ID,
		CTime:    d.CTime,
		MTime:    d.MTime,
	}
	if d.Description != nil {
		ex.Name = *d.Description
	}
	if d.Status != nil {
		ex.Status = *d.Status
	}
	if d.Kid.Exists() {
		ex.VerifyKey = d.Kid
	}
	return ex
}

func (d *Device) IsActive() bool {
	if d.Status == nil {
		return false
	}
	return *d.Status == DeviceStatusActive
}

func (d *Device) StatusString() string {
	return DeviceStatusToString(d.Status)
}

func DeviceStatusToString(i *int) string {
	if i == nil {
		return "<nil>"
	}
	switch *i {
	case DeviceStatusNone:
		return "none"
	case DeviceStatusActive:
		return "active"
	case DeviceStatusDefunct:
		return "revoked"
	}
	return "unknown"
}
