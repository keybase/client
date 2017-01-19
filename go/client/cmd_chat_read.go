// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type cmdChatRead struct {
	libkb.Contextified

	fetcher chatCLIConversationFetcher

	showDeviceName bool
}

func newCmdChatRead(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "read",
		Usage:        "Show new messages in a conversation and mark them as read.",
		ArgumentHelp: "<conversation>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatRead{Contextified: libkb.NewContextified(g)}, "read", c)
		},
		Flags: getMessageFetcherFlags(),
	}
}

func (c *cmdChatRead) Run() error {
	ui := c.G().UI.GetTerminalUI()

	convLocal, messages, err := c.fetcher.fetch(context.TODO(), c.G())
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

func (c *cmdChatRead) ParseArgv(ctx *cli.Context) (err error) {
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

func (c *cmdChatRead) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
