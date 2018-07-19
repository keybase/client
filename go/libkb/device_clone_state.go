// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
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
type cloneDetectionResponse struct {
	AppStatusEmbed
	Token  string `json:"token"`
	Clones int    `json:"clones"`
}

func UpdateDeviceCloneState(m MetaContext) (before int, after int, err error) {
	d, err := GetDeviceCloneState(m)
	before = d.Clones

	prior, stage := d.Prior, d.Stage
	if prior == "" {
		//first run
		prior = DefaultCloneTokenValue
	}
	if stage == "" {
		stage, err = RandHexString("", 16)
		if err != nil {
			return 0, 0, err
		}
		err = SetDeviceCloneState(m, DeviceCloneState{Prior: prior, Stage: stage, Clones: d.Clones})
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
			"prior":     S{Val: prior},
			"stage":     S{Val: stage},
		},
		MetaContext: m,
	}
	var res cloneDetectionResponse
	err = m.G().API.PostDecode(arg, &res)
	if err != nil {
		return 0, 0, err
	}

	err = SetDeviceCloneState(m, DeviceCloneState{Prior: res.Token, Stage: "", Clones: res.Clones})
	after = res.Clones
	return before, after, err
}

func deviceCloneJSONPaths(m MetaContext) (string, string, string) {
	deviceID := m.G().ActiveDevice.DeviceID()
	p := fmt.Sprintf("%s.prior", deviceID)
	s := fmt.Sprintf("%s.stage", deviceID)
	c := fmt.Sprintf("%s.clones", deviceID)
	return p, s, c
}

func GetDeviceCloneState(m MetaContext) (DeviceCloneState, error) {
	reader, err := newDeviceCloneStateReader(m)
	pPath, sPath, cPath := deviceCloneJSONPaths(m)
	p, _ := reader.GetStringAtPath(pPath)
	s, _ := reader.GetStringAtPath(sPath)
	c, _ := reader.GetIntAtPath(cPath)
	if c < 1 {
		c = 1
	}
	return DeviceCloneState{Prior: p, Stage: s, Clones: c}, err
}

func SetDeviceCloneState(m MetaContext, d DeviceCloneState) error {
	writer, err := newDeviceCloneStateWriter(m)
	if err != nil {
		return err
	}
	tx, err := writer.BeginTransaction()
	if err != nil {
		return err
	}
	// From this point on, if there's an error, we abort the
	// transaction.
	defer func() {
		if tx != nil {
			tx.Abort()
		}
	}()

	pPath, sPath, cPath := deviceCloneJSONPaths(m)
	err = writer.SetStringAtPath(pPath, d.Prior)
	if err != nil {
		return err
	}
	err = writer.SetStringAtPath(sPath, d.Stage)
	if err != nil {
		return err
	}
	err = writer.SetIntAtPath(cPath, d.Clones)
	if err != nil {
		return err
	}
	err = tx.Commit()
	if err != nil {
		return err
	}

	// Zero out the TX so that we don't abort it in the defer()
	tx = nil
	return nil
}

func newDeviceCloneStateReader(m MetaContext) (DeviceCloneStateJSONFile, error) {
	f := DeviceCloneStateJSONFile{NewJSONFile(m.G(), m.G().Env.GetDeviceCloneStateFilename(), "device clone state")}
	err := f.Load(false)
	return f, err
}

func newDeviceCloneStateWriter(m MetaContext) (*DeviceCloneStateJSONFile, error) {
	f := DeviceCloneStateJSONFile{NewJSONFile(m.G(), m.G().Env.GetDeviceCloneStateFilename(), "device clone state")}
	err := f.Load(false)
	return &f, err
}

func (f DeviceCloneStateJSONFile) GetStringAtPath(p string) (ret string, isSet bool) {
	i, isSet := f.getValueAtPath(p, getString)
	if isSet {
		ret = i.(string)
	}
	return ret, isSet
}

func (f DeviceCloneStateJSONFile) GetIntAtPath(p string) (ret int, isSet bool) {
	i, isSet := f.getValueAtPath(p, getInt)
	if isSet {
		ret = i.(int)
	}
	return ret, isSet
}

func (f DeviceCloneStateJSONFile) getValueAtPath(p string, getter valueGetter) (ret interface{}, isSet bool) {
	var err error
	ret, err = getter(f.jw.AtPath(p))
	if err == nil {
		isSet = true
	}
	return ret, isSet
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
