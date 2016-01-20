// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

func (c *CmdNStatus) osSpecific(status *fstatus) error {
	return nil
}

// TODO: check with steve about this
func (c *CmdNStatus) serviceLogFilename() string {
	return "keybase.service.log"
}

// TODO: check with steve about this
func (c *CmdNStatus) kbfsLogFilename() string {
	return "keybase.service.log"
}
