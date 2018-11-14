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
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	isatty "github.com/mattn/go-isatty"
	"golang.org/x/net/context"
)

type CmdChatProfileSearch struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	hasTTY           bool
}

func NewCmdChatProfileSearchRunner(g *libkb.GlobalContext) *CmdChatProfileSearch {
	return &CmdChatProfileSearch{
		Contextified: libkb.NewContextified(g),
	}
}

func newCmdChatProfileSearchDev(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "search-profile",
		Usage:        "Index the inbox or a particular conversation, profiling the results.",
		ArgumentHelp: "<conversation>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatProfileSearchRunner(g), "search-profile", c)
			cl.SetNoStandalone()
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
		Flags: getConversationResolverFlags(),
	}
}

func (c *CmdChatProfileSearch) Run() (err error) {
	terminal := c.G().UI.GetTerminalUI()

	resolver, err := newChatConversationResolver(c.G())
	if err != nil {
		return err
	}
	res, err := resolver.ChatClient.ProfileChatSearch(context.TODO(), keybase1.TLFIdentifyBehavior_CHAT_CLI)
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

func (c *CmdChatProfileSearch) ParseArgv(ctx *cli.Context) (err error) {
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

func (c *CmdChatProfileSearch) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
