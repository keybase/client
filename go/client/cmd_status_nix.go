// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build dragonfly freebsd linux netbsd openbsd solaris

package client

import "strings"

func (c *CmdStatus) osSpecific(status *fstatus) error {
	// TODO: on darwin, install.KeybaseServiceStatus() is implemented to get pid for service and kbfs.
	// This is currently the best way to determine if KBFS is running, so other OS's should implement
	// it.
	productVersion, buildVersion, err := c.osVersionAndBuild()
	if err != nil {
		c.G().Log.Debug("Error determining OS version: %s", err)
	}
	status.OSVersion = strings.Join([]string{productVersion, buildVersion}, "-")

	return nil
}

// osVersionAndBuild returns OS version, and build too on some platforms
func (c *CmdStatus) osVersionAndBuild() (string, string, error) {
	productVersion, err := c.execToString("uname", []string{"-mrs"})
	if err != nil {
		return "", "", err
	}

	buildVersion, err := c.execToString("lsb_release", []string{"-sd"})
	if err != nil {
		return productVersion, "", err
	}

	return productVersion, buildVersion, nil
}
