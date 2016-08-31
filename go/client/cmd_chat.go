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
		Usage:        "Chat securely with other Keybase users",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			newCmdChatAPI(cl, g),
			newCmdChatList(cl, g),
			newCmdChatRead(cl, g),
			newCmdChatSend(cl, g),
		},
	}
}
