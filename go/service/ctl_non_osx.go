// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package service

import keybase1 "github.com/keybase/client/go/protocol"

// Stop is called on the rpc keybase.1.ctl.stop, which shuts down the service.
func (c *CtlHandler) stop(args keybase1.StopArg) error {
	go c.service.Stop(args.ExitCode)
	return nil
}
