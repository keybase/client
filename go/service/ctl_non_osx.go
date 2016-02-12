// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package service

import (
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol"
)

// Stop is called on the rpc keybase.1.ctl.stop, which shuts down the service.
func (c *CtlHandler) Stop(_ context.Context, args keybase1.StopArg) error {
	c.G().Log.Debug("Received stop(%d) RPC; shutting down", args.ExitCode)
	go c.service.Stop(args.ExitCode)
	return nil
}
