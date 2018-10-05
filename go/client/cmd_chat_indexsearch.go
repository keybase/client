// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package client

import (
	"encoding/json"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	isatty "github.com/mattn/go-isatty"
	"golang.org/x/net/context"
)

type CmdChatIndexSearch struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	hasTTY           bool
}

func NewCmdChatIndexSearchRunner(g *libkb.GlobalContext) *CmdChatIndexSearch {
	return &CmdChatIndexSearch{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatIndexSearchDev(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "index",
		Usage:        "Index the inbox or a particular conversation",
		ArgumentHelp: "<conversation>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatIndexSearchRunner(g), "index", c)
			cl.SetNoStandalone()
		},
		Flags: getConversationResolverFlags(),
	}
}

func (c *CmdChatIndexSearch) Run() (err error) {
	terminal := c.G().UI.GetTerminalUI()

	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}
	ctx := context.TODO()

	var convID *chat1.ConversationID
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
		convID = &conversation.Info.Id
	}

	// Nil convID means index entire inbox
	arg := chat1.IndexChatSearchArg{
		ConvID:           convID,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}

	res, err := resolver.ChatClient.IndexChatSearch(ctx, arg)
	if err != nil {
		return err
	}
	b, err := json.MarshalIndent(res, "", "    ")
	if err != nil {
		return err
	}
	terminal.Printf("%s\n", string(b))
	return nil
}

func (c *CmdChatIndexSearch) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) == 1 {
		// Get the TLF name from the first position arg
		tlfName := ctx.Args().Get(0)
		if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
			return err
		}
	}
	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())
	return nil
}

func (c *CmdChatIndexSearch) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
