// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package service

import (
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/launchd"
	keybase1 "github.com/keybase/client/go/protocol"
)

// Stop is called on the rpc keybase.1.ctl.stop, which shuts down the service.
func (c *CtlHandler) stop(args keybase1.StopArg) error {
	if c.service.ForkType == keybase1.ForkType_LAUNCHD {
		c.stopLaunchd()
	}

	// do this no matter what happens above:
	go c.service.Stop(args.ExitCode)

	return nil
}

func (c *CtlHandler) stopLaunchd() {
	status := install.KeybaseServiceStatus(c.G(), c.G().Env.GetLabel())
	if status.Pid == "" {
		c.G().Log.Debug("Service does not appear to be running via launchd (label = %q)", c.G().Env.GetLabel())
		return
	}

	c.G().Log.Debug("Removing %s from launchd", status.Label)
	svc := launchd.NewService(status.Label)
	if err := svc.Stop(false); err != nil {
		c.G().Log.Warning("error stopping launchd service:", err)
	}
}
