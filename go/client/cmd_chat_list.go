// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

type cmdChatInbox struct {
	libkb.Contextified

	fetcher messageFetcher
}

func newCmdChatInbox(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "list",
		Usage:        "Show new messages in inbox.",
		Aliases:      []string{"ls"},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatInbox{Contextified: libkb.NewContextified(g)}, "inbox", c)
		},
		Flags:       makeChatInboxAndReadFlags(nil),
		Description: `"keybase chat inbox" display an inbox view of chat messages. --time/--since can be used to specify a time range of messages displayed. Duration (e.g. "2d" meaning 2 days ago) and RFC3339 Time (e.g. "2006-01-02T15:04:05Z07:00") are both supported.`,
	}
}

func (c *cmdChatInbox) Run() error {
	messages, err := c.fetcher.fetch(context.TODO(), c.G())
	if err != nil {
		return err
	}
	messages.printByUnreadThenLatest(c.G().UI.GetTerminalUI())

	return nil
}

func (c *cmdChatInbox) ParseArgv(ctx *cli.Context) (err error) {
	if c.fetcher, err = makeMessageFetcherFromCliCtx(ctx, "", false); err != nil {
		return err
	}
	return nil
}

func (c *cmdChatInbox) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
