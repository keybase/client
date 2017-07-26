// Copyright 2016 Keybase, Inc. All rights reserved. Use of
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
		Usage:        "Chat securely with keybase users",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			newCmdChatAPI(cl, g),
			newCmdChatDownload(cl, g),
			newCmdChatHide(cl, g),
			newCmdChatJoinChannel(cl, g),
			newCmdChatLeaveChannel(cl, g),
			newCmdChatList(cl, g),
			newCmdChatListChannels(cl, g),
			newCmdChatListMembers(cl, g),
			newCmdChatListUnread(cl, g),
			newCmdChatMute(cl, g),
			newCmdChatRead(cl, g),
			newCmdChatReport(cl, g),
			newCmdChatSend(cl, g),
			newCmdChatUpload(cl, g),
		},
	}
}
