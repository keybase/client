// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

// this is the list of commands for the devel version of the
// client.
package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func getBuildSpecificCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return []cli.Command{
		NewCmdCheckTracking(cl, g),
		NewCmdDecrypt(cl, g),
		NewCmdEncrypt(cl, g),
		NewCmdFavorite(cl),
		NewCmdFakeTrackingChanged(cl, g),
		NewCmdShowNotifications(cl, g),
		NewCmdStress(cl),
		NewCmdTestPassphrase(cl, g),
		NewCmdTestFSNotify(cl, g),
	}
}

var extraSignupFlags = []cli.Flag{
	cli.StringFlag{
		Name:  "p, passphrase",
		Usage: "Specify a passphrase",
	},
	cli.StringFlag{
		Name:  "d, device",
		Usage: "Specify a device name",
	},
	cli.BoolFlag{
		Name:  "b, batch",
		Usage: "Batch mode (don't prompt, use all defaults)",
	},
	cli.BoolFlag{
		Name:  "devel",
		Usage: "Run the client in development mode",
	},
}
