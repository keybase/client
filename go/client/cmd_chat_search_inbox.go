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
	resolvingRequest chatConversationResolvingRequest
	tlfName          string
	query            string
	opts             chat1.SearchOpts
	namesOnly        bool
	hasTTY           bool
}

func NewCmdChatSearchInboxRunner(g *libkb.GlobalContext) *CmdChatSearchInbox {
	return &CmdChatSearchInbox{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatSearchInbox(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := append(getConversationResolverFlags(), chatSearchFlags...)
	return cli.Command{
		Name:         "search",
		Usage:        "Search full inbox",
		ArgumentHelp: "<query>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatSearchInboxRunner(g), "search", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: append(flags,
			cli.StringFlag{
				Name:  "conv",
				Usage: "Limit the search to a single conversation.",
			},
			cli.BoolFlag{
				Name:  "force-reindex",
				Usage: "Ensure inbox is fully indexed before executing the search.",
			},
			cli.IntFlag{
				Name:  "max-convs-searched",
				Usage: fmt.Sprintf("Specify the maximum number of conversations to search. Default is all conversations."),
			},
			cli.IntFlag{
				Name:  "max-convs-hit",
				Usage: fmt.Sprintf("Specify the maximum number conversations to return search hits from. Default is unlimited."),
			},
			cli.BoolFlag{
				Name:  "names-only",
				Usage: "Search only the names of conversations",
			},
		),
	}
}

func (c *CmdChatSearchInbox) Run() (err error) {
	ui := NewChatCLIUI(c.G())
	// hide duplicate output if we delegate the search to thread searcher.
	ui.noThreadSearch = true
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

	if c.resolvingRequest.TlfName != "" {
		if err = annotateResolvingRequest(c.G(), &c.resolvingRequest); err != nil {
			return err
		}

		// TODO: Right now this command cannot be run in standalone at
		// all, even though team chats should work, but there is a bug
		// in finding existing conversations.
		if c.G().Standalone {
			switch c.resolvingRequest.MembersType {
			case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAMNATIVE,
				chat1.ConversationMembersType_IMPTEAMUPGRADE:
				c.G().StartStandaloneChat()
			default:
				err = CantRunInStandaloneError{}
				return err
			}
		}

		conversation, _, err := resolver.Resolve(ctx, c.resolvingRequest, chatConversationResolvingBehavior{
			CreateIfNotExists: false,
			MustNotExist:      false,
			Interactive:       c.hasTTY,
			IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		if err != nil {
			return err
		}
		c.opts.ConvID = &conversation.Info.Id
	}

	arg := chat1.SearchInboxArg{
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_SKIP,
		Query:            c.query,
		Opts:             c.opts,
		NamesOnly:        c.namesOnly,
	}
	_, err = resolver.ChatClient.SearchInbox(ctx, arg)
	return err
}

func (c *CmdChatSearchInbox) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 1 {
		return errors.New("usage: keybase chat search <query>")
	}
	if tlfName := ctx.String("conv"); tlfName != "" {
		if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
			return err
		}
	}
	reindexMode := chat1.ReIndexingMode_NONE
	if ctx.Bool("force-reindex") {
		reindexMode = chat1.ReIndexingMode_PRESEARCH_SYNC
	}
	c.query = ctx.Args().Get(0)
	c.opts.ReindexMode = reindexMode
	c.opts.SentBy = ctx.String("sent-by")
	c.opts.SentTo = ctx.String("sent-to")
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
		return fmt.Errorf("max-hits cannot exceed %d", search.MaxAllowedSearchHits)
	}
	c.opts.MaxConvsSearched = ctx.Int("max-convs-searched")
	c.opts.MaxConvsHit = ctx.Int("max-convs-hit")

	c.opts.AfterContext = ctx.Int("after-context")
	c.opts.BeforeContext = ctx.Int("before-context")
	if c.opts.AfterContext == 0 && c.opts.BeforeContext == 0 {
		context := ctx.Int("context")
		c.opts.BeforeContext = context
		c.opts.AfterContext = context
	}

	c.namesOnly = ctx.Bool("names-only")
	c.opts.MaxNameConvs = 10

	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())
	return nil
}

func (c *CmdChatSearchInbox) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
