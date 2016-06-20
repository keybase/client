// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package client

import "github.com/keybase/client/go/install"

func (c *CmdStatus) osSpecific(status *fstatus) error {
	serviceStatus := install.KeybaseServiceStatus(c.G(), "service", c.G().Log)
	kbfsStatus := install.KeybaseServiceStatus(c.G(), "kbfs", c.G().Log)

	if len(serviceStatus.Pid) > 0 {
		status.Service.Running = true
		status.Service.Pid = serviceStatus.Pid
	}

	if len(kbfsStatus.Pid) > 0 {
		status.KBFS.Running = true
		status.KBFS.Pid = kbfsStatus.Pid
	}

	return nil
}
