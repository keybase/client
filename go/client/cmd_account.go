// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdAccount(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		NewCmdAccountDelete(cl, g),
		NewCmdAccountLockdown(cl, g),
		NewCmdAccountRecoverUsername(cl, g),
		NewCmdEmail(cl, g),
		NewCmdPhoneNumber(cl, g),
		newCmdUploadAvatar(cl, g, false /* hidden */),
	}
	subcommands = append(subcommands, getBuildSpecificAccountCommands(cl, g)...)
	return cli.Command{
		Name:         "account",
		Usage:        "Modify your account",
		ArgumentHelp: "[arguments...]",
		Subcommands:  subcommands,
	}
}
