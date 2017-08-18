// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

func (c *CmdStatus) osSpecific(status *fstatus) error {
	// TODO: on darwin, install.KeybaseServiceStatus() is implemented to get pid for service and kbfs.
	// This is currently the best way to determine if KBFS is running, so other OS's should implement
	// it.
	productVersion, _, err := c.osVersionAndBuild()
	if err != nil {
		c.G().Log.Warning("Error determining OS version: %s", err)
	}
	status.OSVersion = productVersion

	return nil
}

// osVersionAndBuild returns OS version, and build too on some platforms
func (c *CmdStatus) osVersionAndBuild() (string, string, error) {
	productVersion, err := c.execToString("cmd", []string{"/c", "ver"})
	if err != nil {
		return "", "", err
	}

	return productVersion, "", nil
}
