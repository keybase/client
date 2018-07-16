// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

const (
	DefaultCloneTokenValue string = "00000000000000000000000000000000"
)

type DeviceCloneState struct {
	Prior  string
	Stage  string
	Clones int
}

func UpdateDeviceCloneState(m *MetaContext) (before int, after int, err error) {
	d := GetDeviceCloneState(m)
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
	un := m.G().Env.GetUsername()
	basePath := fmt.Sprintf("users.%s.device_clone_token", un)
	p = fmt.Sprintf("%s.prior", basePath)
	s = fmt.Sprintf("%s.stage", basePath)
	c = fmt.Sprintf("%s.clones", basePath)
	return
}

func GetDeviceCloneState(m *MetaContext) DeviceCloneState {
	configReader := m.G().Env.GetConfig()

	pPath, sPath, cPath := configPaths(m)
	p, _ := configReader.GetStringAtPath(pPath)
	s, _ := configReader.GetStringAtPath(sPath)
	c, _ := configReader.GetIntAtPath(cPath)
	return DeviceCloneState{Prior: p, Stage: s, Clones: c}
}

func SetDeviceCloneState(m *MetaContext, d DeviceCloneState) error {
	configWriter := m.G().Env.GetConfigWriter()
	pPath, sPath, cPath := configPaths(m)

	err := configWriter.SetStringAtPath(pPath, d.Prior)
	if err == nil {
		err = configWriter.SetStringAtPath(sPath, d.Stage)
	}
	if err == nil {
		err = configWriter.SetIntAtPath(cPath, d.Clones)
	}
	return err
}
