// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	isatty "github.com/mattn/go-isatty"
)

type CmdChatSend struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	// Only one of these should be set
	message       string
	setHeadline   string
	clearHeadline bool
	hasTTY        bool
	nonBlock      bool
	team          bool
}

func NewCmdChatSendRunner(g *libkb.GlobalContext) *CmdChatSend {
	return &CmdChatSend{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdChatSend) SetTeamChatForTest(n string) {
	c.team = true
	c.resolvingRequest = chatConversationResolvingRequest{
		TlfName:     n,
		TopicName:   chat.DefaultTeamTopic,
		MembersType: chat1.ConversationMembersType_TEAM,
		TopicType:   chat1.TopicType_CHAT,
		Visibility:  chat1.TLFVisibility_PRIVATE,
	}
}

func (c *CmdChatSend) SetMessage(m string) {
	c.message = m
}

func newCmdChatSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "send",
		Usage:        "Send a message to a conversation",
		ArgumentHelp: "[conversation [message]]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatSendRunner(g), "send", c)
		},
		Flags: append(getConversationResolverFlags(),
			mustGetChatFlags("set-headline", "clear-headline", "nonblock")...,
		),
	}
}

func (c *CmdChatSend) Run() (err error) {
	err = annotateResolvingRequest(c.G(), &c.resolvingRequest)
	if err != nil {
		return err
	}
	// TLFVisibility_ANY doesn't make any sense for send, so switch that to PRIVATE:
	if c.resolvingRequest.Visibility == chat1.TLFVisibility_ANY {
		c.resolvingRequest.Visibility = chat1.TLFVisibility_PRIVATE
	}

	if c.G().Standalone {
		if c.resolvingRequest.MembersType == chat1.ConversationMembersType_KBFS {
			err = fmt.Errorf("Can't run command in standalone mode")
			return err
		} else if c.resolvingRequest.MembersType == chat1.ConversationMembersType_TEAM {
			c.G().StartStandaloneChat()
		}
	}

	return chatSend(context.TODO(), c.G(), ChatSendArg{
		resolvingRequest: c.resolvingRequest,
		message:          c.message,
		setHeadline:      c.setHeadline,
		clearHeadline:    c.clearHeadline,
		hasTTY:           c.hasTTY,
		nonBlock:         c.nonBlock,
		team:             c.team,
		setTopicName:     "",
	})
}

func (c *CmdChatSend) ParseArgv(ctx *cli.Context) (err error) {
	c.setHeadline = ctx.String("set-headline")
	c.clearHeadline = ctx.Bool("clear-headline")
	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())
	c.nonBlock = ctx.Bool("nonblock")

	var tlfName string
	// Get the TLF name from the first position arg
	if len(ctx.Args()) >= 1 {
		tlfName = ctx.Args().Get(0)
	}
	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}

	nActions := 0

	if c.setHeadline != "" {
		nActions++
		if !c.hasTTY {
			return fmt.Errorf("stdin not supported with --set-headline")
		}
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and set headline name simultaneously")
		}
	}

	if c.clearHeadline {
		nActions++
		if !c.hasTTY {
			return fmt.Errorf("stdin not supported with --clear-headline")
		}
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and clear headline name simultaneously")
		}
	}

	// Send a normal message.
	if nActions == 0 {
		nActions++
		switch len(ctx.Args()) {
		case 2:
			// message is supplied, so stdin is ignored even if piped
			c.message = ctx.Args().Get(1)
		case 1:
			if !c.hasTTY {
				bytes, err := ioutil.ReadAll(io.LimitReader(os.Stdin, msgchecker.TextMessageMaxLength))
				if err != nil {
					return err
				}
				c.message = string(bytes)
			} else {
				c.message = "" // get message through prompt later
			}
		case 0:
			if !c.hasTTY {
				return fmt.Errorf("need exactly 1 argument to send from stdin")
			}
			c.message = "" // get message through prompt later
		default:
			cli.ShowCommandHelp(ctx, "send")
			return fmt.Errorf("chat send takes 0, 1 or 2 args")
		}
	}

	if nActions < 1 {
		cli.ShowCommandHelp(ctx, "send")
		return fmt.Errorf("Incorrect Usage.")
	}
	if nActions > 1 {
		cli.ShowCommandHelp(ctx, "send")
		return fmt.Errorf("only one of message, --set-headline, --clear-headline allowed")
	}

	return nil
}

func (c *CmdChatSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
