// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/launchd"
	keybase1 "github.com/keybase/client/go/protocol"
)

// Stop is called on the rpc keybase.1.ctl.stop, which shuts down the service.
func (c *CtlHandler) Stop(_ context.Context, args keybase1.StopArg) error {
	c.G().Log.Debug("Received stop(%d) RPC; shutting down", args.ExitCode)

	// see if launchd service is running:
	status := install.KeybaseServiceStatus(c.G(), "")
	if status.Pid != "" {
		c.G().Log.Debug("Removing %s from launchd", status.Label)
		svc := launchd.NewService(status.Label)
		go svc.Stop(false)
	} else {
		c.G().Log.Debug("service does not appear to be running via launchd")
	}

	go c.service.Stop(args.ExitCode)

	return nil
}
