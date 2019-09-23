// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdBot(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		newCmdBotSignup(cl, g),
		newCmdBotToken(cl, g),
	}
	return cli.Command{
		Name:         "bot",
		Usage:        "Manage bot accounts",
		ArgumentHelp: "[arguments...]",
		Subcommands:  subcommands,
	}
}

func newCmdBotToken(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		newCmdBotTokenCreate(cl, g),
		newCmdBotTokenList(cl, g),
		newCmdBotTokenDelete(cl, g),
	}
	return cli.Command{
		Name:        "token",
		Usage:       "Manage bot tokens",
		Subcommands: subcommands,
	}
}
