// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type cmdChatListUnread struct {
	libkb.Contextified

	fetcher chatCLIInboxFetcher

	showDeviceName bool
}

func newCmdChatListUnread(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list-unread",
		Usage:        "List conversations, with unread messages at the top.",
		Aliases:      []string{"lsur"},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatListUnread{Contextified: libkb.NewContextified(g)}, "list-unread", c)
		},
		Flags: getInboxFetcherUnreadFirstFlags(),
	}
}

func (c *cmdChatListUnread) Run() error {
	ui := c.G().UI.GetTerminalUI()

	conversations, err := c.fetcher.fetch(context.TODO(), c.G())
	if err != nil {
		return err
	}

	if len(conversations) == 0 {
		ui.Printf("no conversations\n")
		return nil
	}

	conversationListView(conversations).show(c.G(), string(c.G().Env.GetUsername()), c.showDeviceName)
	// TODO: print summary of inbox. e.g.
	//		+44 older chats (--time=7d to see 25 more)

	if len(conversations) == c.fetcher.query.UnreadFirstLimit.AtMost {
		ui.Printf("\nNumber of conversations is capped by --at-most, so there might be more unread ones. Specify --at-most to a large number to fetch more.\n")
	}

	return nil
}

func (c *cmdChatListUnread) ParseArgv(ctx *cli.Context) (err error) {
	if c.fetcher, err = makeChatCLIInboxFetcherUnreadFirst(ctx); err != nil {
		return err
	}
	c.showDeviceName = ctx.Bool("show-device-name")

	return nil
}

func (c *cmdChatListUnread) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
