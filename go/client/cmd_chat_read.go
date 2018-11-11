// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type CmdChatRead struct {
	libkb.Contextified
	fetcher        chatCLIConvFetcher
	showDeviceName bool
}

func NewCmdChatReadRunner(g *libkb.GlobalContext) *CmdChatRead {
	return &CmdChatRead{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatRead(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "read",
		Usage:        "Show new messages in a conversation and mark them as read.",
		ArgumentHelp: "<conversation>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatReadRunner(g), "read", c)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: getMessageFetcherFlags(),
	}
}

func (c *CmdChatRead) Fetch() (conversations chat1.ConversationLocal, messages []chat1.MessageUnboxed, err error) {
	return c.fetcher.fetch(context.TODO(), c.G())
}

func (c *CmdChatRead) SetTeamChatForTest(n string) {
	c.fetcher = chatCLIConvFetcher{
		query: chat1.GetConversationForCLILocalQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			Limit: chat1.UnreadFirstNumLimit{
				NumRead: 1000,
				AtLeast: 100,
			},
			MarkAsRead: false,
		},
		resolvingRequest: chatConversationResolvingRequest{
			TlfName:     n,
			TopicName:   globals.DefaultTeamTopic,
			MembersType: chat1.ConversationMembersType_TEAM,
			TopicType:   chat1.TopicType_CHAT,
			Visibility:  keybase1.TLFVisibility_PRIVATE,
		},
	}
}

func (c *CmdChatRead) Run() error {
	ui := c.G().UI.GetTerminalUI()

	if c.fetcher.resolvingRequest.TlfName != "" {
		err := annotateResolvingRequest(c.G(), &c.fetcher.resolvingRequest)
		if err != nil {
			return err
		}
	}

	convLocal, messages, err := c.Fetch()
	if err != nil {
		return err
	}

	if convLocal.Error != nil {
		ui.Printf("proccessing conversation error: %s\n", convLocal.Error.Message)
		return nil
	}

	ui.Printf("\n")
	if err = (conversationView{
		conversation: convLocal,
		messages:     messages,
	}).show(c.G(), c.showDeviceName); err != nil {
		return err
	}
	ui.Printf("\n")

	return nil
}

func (c *CmdChatRead) ParseArgv(ctx *cli.Context) (err error) {
	var tlfName string
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	if c.fetcher, err = makeChatCLIConversationFetcher(ctx, tlfName, true); err != nil {
		return err
	}
	c.showDeviceName = ctx.Bool("show-device-name")
	return nil
}

func (c *CmdChatRead) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
