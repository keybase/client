// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build dragonfly freebsd linux netbsd openbsd solaris

package client

func (c *CmdNStatus) osSpecific(status *fstatus) error {
	return nil
}

func (c *CmdNStatus) serviceLogFilename() string {
	return "keybase.service.log"
}

func (c *CmdNStatus) kbfsLogFilename() string {
	return "keybase.service.log"
}
