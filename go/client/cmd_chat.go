// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdChat(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "chat",
		Usage:        "Comandline interface to Keybase Chat",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			newCmdChatSend(cl, g),
			newCmdChatInbox(cl, g),
		},
	}
}
