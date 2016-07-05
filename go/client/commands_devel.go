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
		NewCmdAPICall(cl, g),
		NewCmdCheckTracking(cl, g),
		NewCmdFavorite(cl, g),
		NewCmdFakeTrackingChanged(cl, g),
		newCmdFS(cl, g),
		NewCmdSecretKey(cl, g),
		NewCmdShowNotifications(cl, g),
		NewCmdStress(cl),
		NewCmdTestPassphrase(cl, g),
		NewCmdTestFSNotify(cl, g),
		NewCmdPaperProvision(cl, g),
		NewCmdPGPProvision(cl, g),
	}
}

var restrictedSignupFlags = []cli.Flag{
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
		Name:  "pgp",
		Usage: "Add a server-synced pgp key",
	},
}

var restrictedProveFlags = []cli.Flag{
	cli.BoolFlag{
		Name:  "auto",
		Usage: "[rooter only] Automatically make the rooter toot proof",
	},
}

const develUsage = true
