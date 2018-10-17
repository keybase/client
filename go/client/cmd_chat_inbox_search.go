// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"os"

	"github.com/araddon/dateparse"
	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/search"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	isatty "github.com/mattn/go-isatty"
	"golang.org/x/net/context"
)

type CmdChatInboxSearch struct {
	libkb.Contextified
	query  string
	opts   chat1.SearchOpts
	hasTTY bool
}

func NewCmdChatInboxSearchRunner(g *libkb.GlobalContext) *CmdChatInboxSearch {
	return &CmdChatInboxSearch{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatInboxSearchDev(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "inbox-search",
		Usage:        "Search full inbox",
		ArgumentHelp: "<query>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatInboxSearchRunner(g), "inbox-search", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "force-reindex",
				Usage: "Ensure inbox is fully indexed before executing the search.",
			},
			cli.IntFlag{
				Name:  "max-hits",
				Value: 10,
				Usage: fmt.Sprintf("Specify the maximum number of search hits to get. Maximum value is %d.", search.MaxAllowedSearchHits),
			},
			cli.StringFlag{
				Name:  "sent-by",
				Value: "",
				Usage: "Filter search results by the username of the sender.",
			},
			cli.StringFlag{
				Name:  "sent-before",
				Value: "",
				Usage: "Filter search results by the message creation time. Mutually exclusive with sent-after.",
			},
			cli.StringFlag{
				Name:  "sent-after",
				Value: "",
				Usage: "Filter search results by the message creation time. Mutually exclusive with sent-before.",
			},
			cli.IntFlag{
				Name:  "B, before-context",
				Value: 0,
				Usage: "Print number messages of leading context before each match.",
			},
			cli.IntFlag{
				Name:  "A, after-context",
				Value: 0,
				Usage: "Print number of messages of trailing context after each match.",
			},
			cli.IntFlag{
				Name:  "C, context",
				Value: 2,
				Usage: "Print number of messages of leading and trailing context surrounding each match.",
			},
		},
	}
}

func (c *CmdChatInboxSearch) Run() (err error) {
	ui := &ChatUI{
		Contextified: libkb.NewContextified(c.G()),
		terminal:     c.G().UI.GetTerminalUI(),
	}
	protocols := []rpc.Protocol{
		chat1.ChatUiProtocol(ui),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}

	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}
	ctx := context.TODO()

	arg := chat1.InboxSearchArg{
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		Query:            c.query,
		Opts:             c.opts,
	}
	_, err = resolver.ChatClient.InboxSearch(ctx, arg)
	return err
}

func (c *CmdChatInboxSearch) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return errors.New("usage: keybase chat inbox-search <query>")
	}
	c.query = ctx.Args().Get(0)
	c.opts.SentBy = ctx.String("sent-by")
	c.opts.ForceReindex = ctx.Bool("force-reindex")
	sentBeforeStr := ctx.String("sent-before")
	sentAfterStr := ctx.String("sent-after")
	if sentBeforeStr != "" && sentAfterStr != "" {
		return fmt.Errorf("Only one of sent-before and sent-after can be specified")
	}
	if sentBeforeStr != "" {
		sentBefore, err := dateparse.ParseAny(sentBeforeStr)
		if err != nil {
			return err
		}
		c.opts.SentBefore = gregor1.ToTime(sentBefore)
	}
	if sentAfterStr != "" {
		sentAfter, err := dateparse.ParseAny(sentAfterStr)
		if err != nil {
			return err
		}
		c.opts.SentAfter = gregor1.ToTime(sentAfter)
	}

	c.opts.MaxHits = ctx.Int("max-hits")
	if c.opts.MaxHits > search.MaxAllowedSearchHits {
		return fmt.Errorf("max-hits cannot exceed %d.", search.MaxAllowedSearchHits)
	}
	c.opts.MaxMessages = ctx.Int("max-messages")
	if c.opts.MaxMessages > search.MaxAllowedSearchMessages {
		return fmt.Errorf("max-messages cannot exceed %d.", search.MaxAllowedSearchMessages)
	}

	c.opts.AfterContext = ctx.Int("after-context")
	c.opts.BeforeContext = ctx.Int("before-context")
	if c.opts.AfterContext == 0 && c.opts.BeforeContext == 0 {
		context := ctx.Int("context")
		c.opts.BeforeContext = context
		c.opts.AfterContext = context
	}

	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())
	return nil
}

func (c *CmdChatInboxSearch) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
