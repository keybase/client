// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type cmdChatList struct {
	libkb.Contextified

	fetcher inboxFetcher
}

func newCmdChatList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list",
		Usage:        "Show new messages in inbox.",
		Aliases:      []string{"ls"},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatList{Contextified: libkb.NewContextified(g)}, "list", c)
		},
		Flags:       makeChatListAndReadFlags(nil),
		Description: `"keybase chat list" display an inbox view of chat messages. --time/--since can be used to specify a time range of messages displayed. Duration (e.g. "2d" meaning 2 days ago) and RFC3339 Time (e.g. "2006-01-02T15:04:05Z07:00") are both supported.`,
	}
}

func (c *cmdChatList) Run() error {
	ui := c.G().UI.GetTerminalUI()

	conversations, _, _, err := c.fetcher.fetch(context.TODO(), c.G())
	if err != nil {
		return err
	}

	if len(conversations) == 0 {
		ui.Printf("no conversation is found\n")
		return nil
	}

	conversationListView(conversations).show(c.G(), ui)
	// TODO: print summary of inbox. e.g.
	//		+44 older chats (--time=7d to see 25 more)

	return nil
}

func (c *cmdChatList) ParseArgv(ctx *cli.Context) (err error) {
	if c.fetcher, err = makeInboxFetcherFromCli(ctx); err != nil {
		return err
	}
	return nil
}

func (c *cmdChatList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
