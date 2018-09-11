// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	isatty "github.com/mattn/go-isatty"
)

type CmdChatDeleteHistoryDev struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	upto             chat1.MessageID
	hasTTY           bool
}

func NewCmdChatDeleteHistoryDevRunner(g *libkb.GlobalContext) *CmdChatDeleteHistoryDev {
	return &CmdChatDeleteHistoryDev{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatDeleteHistoryDev(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "delete-history-dev",
		Usage:        "Delete chat history in a conversation up to a message ID",
		ArgumentHelp: "[conversation] --upto=<messageid>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatDeleteHistoryDevRunner(g), "delete-history-dev", c)
			cl.SetNoStandalone()
		},
		Flags: append(getConversationResolverFlags(), []cli.Flag{
			cli.IntFlag{
				Name:  "upto",
				Usage: `Up to this message ID (exclusive)`,
			},
		}...),
	}
}

func (c *CmdChatDeleteHistoryDev) Run() (err error) {
	if c.resolvingRequest.TlfName != "" {
		err = annotateResolvingRequest(c.G(), &c.resolvingRequest)
		if err != nil {
			return err
		}
	}
	// TLFVisibility_ANY doesn't make any sense for send, so switch that to PRIVATE:
	if c.resolvingRequest.Visibility == keybase1.TLFVisibility_ANY {
		c.resolvingRequest.Visibility = keybase1.TLFVisibility_PRIVATE
	}

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

	return chatSend(context.TODO(), c.G(), ChatSendArg{
		resolvingRequest: c.resolvingRequest,

		deleteHistory: &chat1.MessageDeleteHistory{
			Upto: c.upto,
		},

		hasTTY: c.hasTTY,
	})
}

func (c *CmdChatDeleteHistoryDev) ParseArgv(ctx *cli.Context) (err error) {
	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())

	var tlfName string
	// Get the TLF name from the first position arg
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}

	// Send a normal message.
	upto := ctx.Int("upto")
	if upto == 0 {
		return fmt.Errorf("upto must be > 0")
	}
	c.upto = chat1.MessageID(upto)

	return nil
}

func (c *CmdChatDeleteHistoryDev) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
