// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
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

type DeviceCloneStateJSONFile struct {
	*JSONFile
}

type cloneDetectionResponse struct {
	AppStatusEmbed
	Token  string `json:"token"`
	Clones int    `json:"clones"`
}

func (d DeviceCloneState) IsClone() bool {
	return d.Clones > 1
}

func UpdateDeviceCloneState(m MetaContext) (before, after int, err error) {
	d, err := GetDeviceCloneState(m)
	if err != nil {
		return 0, 0, err
	}
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
		if err = SetDeviceCloneState(m, DeviceCloneState{Prior: prior, Stage: stage, Clones: d.Clones}); err != nil {
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
	}
	var res cloneDetectionResponse
	if err = m.G().API.PostDecode(m, arg, &res); err != nil {
		return 0, 0, err
	}

	after = res.Clones
	err = SetDeviceCloneState(m, DeviceCloneState{Prior: res.Token, Stage: "", Clones: after})
	return before, after, err
}

func deviceCloneJSONPaths(m MetaContext) (string, string, string) {
	deviceID := m.G().ActiveDevice.DeviceID()
	p := fmt.Sprintf("%s.prior", deviceID)
	s := fmt.Sprintf("%s.stage", deviceID)
	c := fmt.Sprintf("%s.clones", deviceID)
	return p, s, c
}

func GetDeviceCloneState(m MetaContext) (state DeviceCloneState, err error) {
	reader, err := newDeviceCloneStateReader(m)
	if err != nil {
		return state, err
	}
	pPath, sPath, cPath := deviceCloneJSONPaths(m)
	p, _ := reader.GetStringAtPath(pPath)
	s, _ := reader.GetStringAtPath(sPath)
	c, _ := reader.GetIntAtPath(cPath)
	if c < 1 {
		c = 1
	}
	state = DeviceCloneState{Prior: p, Stage: s, Clones: c}
	m.Debug("GetDeviceCloneState: %+v", state)
	return state, nil
}

func SetDeviceCloneState(m MetaContext, d DeviceCloneState) error {
	m.Debug("SetDeviceCloneState: %+v", d)
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
			tx.Rollback()
			tx.Abort()
		}
	}()

	pPath, sPath, cPath := deviceCloneJSONPaths(m)
	if err = writer.SetStringAtPath(pPath, d.Prior); err != nil {
		return err
	}
	if err = writer.SetStringAtPath(sPath, d.Stage); err != nil {
		return err
	}
	if err = writer.SetIntAtPath(cPath, d.Clones); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}

	// Zero out the TX so that we don't abort it in the defer()
	tx = nil
	return nil
}

func newDeviceCloneStateReader(m MetaContext) (*DeviceCloneStateJSONFile, error) {
	f := DeviceCloneStateJSONFile{NewJSONFile(m.G(), m.G().Env.GetDeviceCloneStateFilename(), "device clone state")}
	err := f.Load(false)
	return &f, err
}

func newDeviceCloneStateWriter(m MetaContext) (*DeviceCloneStateJSONFile, error) {
	f := DeviceCloneStateJSONFile{NewJSONFile(m.G(), m.G().Env.GetDeviceCloneStateFilename(), "device clone state")}
	err := f.Load(false)
	return &f, err
}
