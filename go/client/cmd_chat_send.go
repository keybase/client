// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	isatty "github.com/mattn/go-isatty"
)

// NOTE if you change these values you should change them in
// go/chatbase/storage/ephemeral.go as well.
const maxEphemeralLifetime = time.Hour * 24 * 7
const minEphemeralLifetime = time.Second * 30

type CmdChatSend struct {
	libkb.Contextified
	resolvingRequest chatConversationResolvingRequest
	// Only one of these should be set
	message           string
	setHeadline       string
	ephemeralLifetime time.Duration
	clearHeadline     bool
	hasTTY            bool
	nonBlock          bool
	team              bool
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
		TopicName:   globals.DefaultTeamTopic,
		MembersType: chat1.ConversationMembersType_TEAM,
		TopicType:   chat1.TopicType_CHAT,
		Visibility:  keybase1.TLFVisibility_PRIVATE,
	}
}

func (c *CmdChatSend) SetMessage(m string) {
	c.message = m
}

func newCmdChatSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	flags := append(getConversationResolverFlags(),
		mustGetChatFlags("set-headline", "clear-headline", "nonblock")...,
	)
	if g.Env.GetRunMode() == libkb.DevelRunMode {
		flags = append(flags, cli.DurationFlag{
			Name: "exploding-lifetime",
			Usage: `Make this message an exploding message and set the
				lifetime for the given duration.  The maximum lifetime is 168h
				(one week) and the minimum lifetime is 5s.`,
		})
	}
	return cli.Command{
		Name:         "send",
		Usage:        "Send a message to a conversation",
		ArgumentHelp: "[conversation [message]]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(NewCmdChatSendRunner(g), "send", c)
			cl.SetNoStandalone()
		},
		Flags: flags,
	}
}

func (c *CmdChatSend) Run() (err error) {
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

	return chatSend(context.TODO(), c.G(), ChatSendArg{
		resolvingRequest:  c.resolvingRequest,
		message:           c.message,
		setHeadline:       c.setHeadline,
		clearHeadline:     c.clearHeadline,
		hasTTY:            c.hasTTY,
		nonBlock:          c.nonBlock,
		team:              c.team,
		setTopicName:      "",
		ephemeralLifetime: c.ephemeralLifetime,
	})
}

func (c *CmdChatSend) ParseArgv(ctx *cli.Context) (err error) {
	c.setHeadline = ctx.String("set-headline")
	c.clearHeadline = ctx.Bool("clear-headline")
	c.hasTTY = isatty.IsTerminal(os.Stdin.Fd())
	c.nonBlock = ctx.Bool("nonblock")
	c.ephemeralLifetime = ctx.Duration("exploding-lifetime")

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

	if c.ephemeralLifetime != 0 {
		if c.ephemeralLifetime > maxEphemeralLifetime {
			return fmt.Errorf("ephemeral lifetime cannot exceed %v", maxEphemeralLifetime)
		}
		if c.ephemeralLifetime < minEphemeralLifetime {
			return fmt.Errorf("ephemeral lifetime must be at least %v", minEphemeralLifetime)
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
		return fmt.Errorf("incorrect usage")
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
