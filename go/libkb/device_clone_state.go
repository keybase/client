// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	jsonw "github.com/keybase/go-jsonw"
)

const (
	DefaultCloneTokenValue string = "00000000000000000000000000000000"
)

type DeviceCloneState struct {
	Prior  string
	Stage  string
	Clones int
}

type DeviceCloneStateJSONFile struct {
	*JSONFile
}

func UpdateDeviceCloneState(m *MetaContext) (before int, after int, err error) {
	d, err := GetDeviceCloneState(m)
	before = d.Clones

	p, s := d.Prior, d.Stage
	if p == "" {
		//first run
		p = DefaultCloneTokenValue
	}
	if s == "" {
		buf := make([]byte, 16)
		rand.Read(buf)
		s = hex.EncodeToString(buf)
		tmp := DeviceCloneState{Prior: p, Stage: s, Clones: d.Clones}
		err := SetDeviceCloneState(m, tmp)
		if err != nil {
			return 0, 0, err
		}
	}

	// POST these tokens to the server
	arg := APIArg{
		Endpoint:    "device/clone_detection_token",
		SessionType: APISessionTypeREQUIRED,
		Args: HTTPArgs{
			"device_id": m.G().ActiveDevice.DeviceID(),
			"prior":     S{Val: p},
			"stage":     S{Val: s},
		},
		MetaContext:    *m,
		AppStatusCodes: []int{SCOk},
	}
	res, err := m.G().API.Post(arg)
	if err != nil {
		return 0, 0, err
	}
	persistedToken, err := res.Body.AtKey("token").GetString()
	if err != nil {
		return 0, 0, err
	}
	clones, err := res.Body.AtKey("clones").GetInt()
	if err != nil {
		return 0, 0, err
	}
	tmp := DeviceCloneState{Prior: persistedToken, Stage: "", Clones: clones}

	err = SetDeviceCloneState(m, tmp)

	after = tmp.Clones
	return
}

func configPaths(m *MetaContext) (p, s, c string) {
	deviceID := m.G().ActiveDevice.deviceID
	p = fmt.Sprintf("%s.prior", deviceID)
	s = fmt.Sprintf("%s.stage", deviceID)
	c = fmt.Sprintf("%s.clones", deviceID)
	return
}

func GetDeviceCloneState(m *MetaContext) (DeviceCloneState, error) {
	reader, err := deviceCloneStateReader(m)
	pPath, sPath, cPath := configPaths(m)
	p, _ := reader.GetStringAtPath(pPath)
	s, _ := reader.GetStringAtPath(sPath)
	c, _ := reader.GetIntAtPath(cPath)
	return DeviceCloneState{Prior: p, Stage: s, Clones: c}, err
}

func SetDeviceCloneState(m *MetaContext, d DeviceCloneState) error {
	writer, err := deviceCloneStateWriter(m)
	if err != nil {
		return err
	}

	pPath, sPath, cPath := configPaths(m)

	err = writer.SetStringAtPath(pPath, d.Prior)

	if err == nil {
		err = writer.SetStringAtPath(sPath, d.Stage)
	}
	if err == nil {
		err = writer.SetIntAtPath(cPath, d.Clones)
	}
	return err
}

func NewDeviceCloneStateJSONFile(g *GlobalContext) *DeviceCloneStateJSONFile {
	return &DeviceCloneStateJSONFile{NewJSONFile(g, g.Env.GetDeviceCloneStateFilename(), "device clone state")}
}

func deviceCloneStateReader(m *MetaContext) (DeviceCloneStateJSONFile, error) {
	f := NewDeviceCloneStateJSONFile(m.G())
	err := f.Load(false)
	return *f, err
}

func deviceCloneStateWriter(m *MetaContext) (*DeviceCloneStateJSONFile, error) {
	f := NewDeviceCloneStateJSONFile(m.G())
	err := f.Load(false)
	return f, err
}

func (f DeviceCloneStateJSONFile) GetStringAtPath(p string) (ret string, isSet bool) {
	i, isSet := f.getValueAtPath(p, getString)
	if isSet {
		ret = i.(string)
	}
	return
}

func (f DeviceCloneStateJSONFile) GetIntAtPath(p string) (ret int, isSet bool) {
	i, isSet := f.getValueAtPath(p, getInt)
	if isSet {
		ret = i.(int)
	}
	return
}

func (f DeviceCloneStateJSONFile) getValueAtPath(p string, getter valueGetter) (ret interface{}, isSet bool) {
	var err error
	ret, err = getter(f.jw.AtPath(p))
	if err == nil {
		isSet = true
	}
	return
}

func (f *DeviceCloneStateJSONFile) SetStringAtPath(p string, v string) error {
	return f.setValueAtPath(p, getString, v)
}

func (f *DeviceCloneStateJSONFile) SetIntAtPath(p string, v int) error {
	return f.setValueAtPath(p, getInt, v)
}

func (f *DeviceCloneStateJSONFile) setValueAtPath(p string, getter valueGetter, v interface{}) error {
	existing, err := getter(f.jw.AtPath(p))

	if err != nil || existing != v {
		err = f.jw.SetValueAtPath(p, jsonw.NewWrapper(v))
		if err == nil {
			return f.Save()
		}
	}
	return err
}
