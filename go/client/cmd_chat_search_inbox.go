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

type CmdChatSearchInbox struct {
	libkb.Contextified
	query  string
	opts   chat1.SearchOpts
	hasTTY bool
}

func NewCmdChatSearchInboxRunner(g *libkb.GlobalContext) *CmdChatSearchInbox {
	return &CmdChatSearchInbox{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatSearchInbox(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "search",
		Usage:        "Search full inbox",
		ArgumentHelp: "<query>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatSearchInboxRunner(g), "search", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: append(chatSearchFlags,
			cli.BoolFlag{
				Name:  "force-reindex",
				Usage: "Ensure inbox is fully indexed before executing the search.",
			},
			cli.IntFlag{
				Name:  "max-convs",
				Usage: fmt.Sprintf("Specify the maximum number conversations to find matches is. Default is all conversations."),
			},
		),
	}
}

func (c *CmdChatSearchInbox) Run() (err error) {
	ui := NewChatCLIUI(c.G())
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

	arg := chat1.SearchInboxArg{
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_SKIP,
		Query:            c.query,
		Opts:             c.opts,
	}
	_, err = resolver.ChatClient.SearchInbox(ctx, arg)
	return err
}

func (c *CmdChatSearchInbox) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return errors.New("usage: keybase chat search <query>")
	}
	c.query = ctx.Args().Get(0)
	c.opts.ForceReindex = ctx.Bool("force-reindex")
	c.opts.SentBy = ctx.String("sent-by")
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
	c.opts.MaxConvs = ctx.Int("max-convs")

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

func (c *CmdChatSearchInbox) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
