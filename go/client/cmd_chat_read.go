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

	fetcher chatConversationFetcher

	showDeviceName bool
}

func newCmdChatRead(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "read",
		Usage:        "Show new messages in a conversation and mark as read.",
		ArgumentHelp: "<conversation>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatRead{Contextified: libkb.NewContextified(g)}, "read", c)
		},
		Flags:       getMessageFetcherFlags(),
		Description: `"keybase chat read" displays shows and read chat messages from a conversation. --time/--since can be used to specify a time range of messages displayed. Duration (e.g. "2d" meaning 2 days ago) and RFC3339 Time (e.g. "2006-01-02T15:04:05Z07:00") are both supported.`,
	}
}

func (c *cmdChatRead) Run() error {
	ui := c.G().UI.GetTerminalUI()

	convLocal, messages, err := c.fetcher.fetch(context.TODO(), c.G())
	if err != nil {
		return err
	}

	if convLocal.Error != nil {
		ui.Printf("proccessing conversation error: %s\n", *convLocal.Error)
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
	if c.fetcher, err = makeMessageFetcherFromCliCtx(ctx, tlfName, true); err != nil {
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
