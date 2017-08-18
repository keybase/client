// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

// NewCmdDevice creates the device command, which is just a holder
// for subcommands.
func NewCmdDevice(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "device",
		Usage:        "Manage your devices",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdDeviceRemove(cl, g),
			NewCmdDeviceList(cl, g),
			NewCmdDeviceAdd(cl, g),
		},
	}
}
