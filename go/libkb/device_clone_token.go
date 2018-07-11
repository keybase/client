// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import "fmt"

const (
	DefaultCloneTokenValue string = "00000000000000000000000000000000"
)

type DeviceCloneToken struct {
	Prior  string
	Stage  string
	Clones int
}

func deviceCloneTokenPaths(un NormalizedUsername) (p, s, c string) {
	basePath := fmt.Sprintf("users.%s.device_clone_token", un)
	p = fmt.Sprintf("%s.prior", basePath)
	s = fmt.Sprintf("%s.stage", basePath)
	c = fmt.Sprintf("%s.clones", basePath)
	return
}

func (f JSONConfigFile) GetDeviceCloneToken(un NormalizedUsername) DeviceCloneToken {
	pPath, sPath, cPath := deviceCloneTokenPaths(un)
	p, _ := f.GetStringAtPath(pPath)
	s, _ := f.GetStringAtPath(sPath)
	c, _ := f.GetIntAtPath(cPath)
	return DeviceCloneToken{Prior: p, Stage: s, Clones: c}
}

func (f *JSONConfigFile) SetDeviceCloneToken(un NormalizedUsername, d DeviceCloneToken) error {
	pPath, sPath, cPath := deviceCloneTokenPaths(un)

	err := f.SetStringAtPath(pPath, d.Prior)
	if err == nil {
		err = f.SetStringAtPath(sPath, d.Stage)
	}
	if err == nil {
		err = f.SetIntAtPath(cPath, d.Clones)
	}
	return err
}
