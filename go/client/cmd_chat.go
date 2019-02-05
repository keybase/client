// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdChat(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	subcommands := []cli.Command{
		newCmdChatAPI(cl, g),
		newCmdChatAPIListen(cl, g),
		newCmdChatDeleteChannel(cl, g),
		newCmdChatDeleteHistory(cl, g),
		newCmdChatDownload(cl, g),
		newCmdChatHide(cl, g),
		newCmdChatJoinChannel(cl, g),
		newCmdChatLeaveChannel(cl, g),
		newCmdChatRenameChannel(cl, g),
		newCmdChatCreateChannel(cl, g),
		newCmdChatList(cl, g),
		newCmdChatListChannels(cl, g),
		newCmdChatListMembers(cl, g),
		newCmdChatListUnread(cl, g),
		newCmdChatMute(cl, g),
		newCmdChatRead(cl, g),
		newCmdChatReAddMember(cl, g),
		newCmdChatReport(cl, g),
		newCmdChatSetRetention(cl, g),
		newCmdChatSetConvMinWriterRole(cl, g),
		newCmdChatSetNotificationSettings(cl, g),
		newCmdChatSearchInbox(cl, g),
		newCmdChatSearchRegexp(cl, g),
		newCmdChatSend(cl, g),
		newCmdChatUpload(cl, g),
	}
	subcommands = append(subcommands, getBuildSpecificChatCommands(cl, g)...)
	return cli.Command{
		Name:         "chat",
		Usage:        "Chat securely with keybase users",
		ArgumentHelp: "[arguments...]",
		Subcommands:  subcommands,
	}
}
