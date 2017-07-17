// Copyright 2017 Keybase. Inc. All rights reserved. Use of
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

	fetcher chatCLIInboxFetcher

	showDeviceName bool
}

func newCmdChatList(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list",
		Usage:        "List conversations, sorted by activity.",
		Aliases:      []string{"ls"},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatList{Contextified: libkb.NewContextified(g)}, "list", c)
		},
		Flags: getInboxFetcherActivitySortedFlags(),
	}
}

func (c *cmdChatList) Run() error {
	conversations, err := c.fetcher.fetch(context.TODO(), c.G())
	if err != nil {
		return err
	}

	if !c.fetcher.async {
		if err = conversationListView(conversations).show(c.G(), string(c.G().Env.GetUsername()), c.showDeviceName); err != nil {
			return err
		}
	}

	// TODO: print summary of inbox. e.g.
	//		+44 older chats (--time=7d to see 25 more)

	return nil
}

func (c *cmdChatList) ParseArgv(ctx *cli.Context) (err error) {
	if c.fetcher, err = makeChatCLIInboxFetcherActivitySorted(ctx); err != nil {
		return err
	}
	c.showDeviceName = ctx.Bool("show-device-name")
	return nil
}

func (c *cmdChatList) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
