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
		NewCmdFakeTrackingChanged(cl, g),
		NewCmdFavorite(cl, g),
		NewCmdPaperProvision(cl, g),
		NewCmdPGPProvision(cl, g),
		NewCmdSecretKey(cl, g),
		NewCmdShowNotifications(cl, g),
		NewCmdStress(cl, g),
		NewCmdTestPassphrase(cl, g),
		NewCmdTestFSNotify(cl, g),
		newCmdTlf(cl, g),
		NewCmdScanProofs(cl, g),
		newCmdTeamGenerateSeitan(cl, g),
		newCmdTeamRotateKey(cl, g),
		newCmdTeamDebug(cl, g),
		newCmdWallet(cl, g),
	}
}

func getBuildSpecificChatCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return []cli.Command{
		newCmdChatDeleteHistoryDev(cl, g),
		newCmdChatSetRetention(cl, g),
		newCmdChatSetRetentionDev(cl, g),
		newCmdChatKBFSUpgrade(cl, g),
	}
}

func getBuildSpecificAccountCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return []cli.Command{
		NewCmdAccountReset(cl, g),
	}
}

func getBuildSpecificWalletCommands(cl *libcmdline.CommandLine, g *libkb.GlobalContext) []cli.Command {
	return []cli.Command{
		newCmdWalletInit(cl, g),
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
