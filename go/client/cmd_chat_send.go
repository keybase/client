// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type cmdChatSend struct {
	libkb.Contextified
	resolvingRequest ChatConversationResolvingRequest
	// Only one of these should be set
	message       string
	setTopicName  string
	setHeadline   string
	clearHeadline bool
	useStdin      bool
	nonBlock      bool
}

func newCmdChatSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "send",
		Usage:        "Send a message to a conversation",
		ArgumentHelp: "[conversation [message]]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatSend{Contextified: libkb.NewContextified(g)}, "send", c)
		},
		Flags: append(getConversationResolverFlags(),
			mustGetChatFlags("set-topic-name", "set-headline", "clear-headline", "nonblock")...,
		),
	}
}

func (c *cmdChatSend) Run() (err error) {
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}
	tlfClient, err := GetTlfClient(c.G())
	if err != nil {
		return err
	}
	resolver := &ChatConversationResolver{ChatClient: chatClient, TlfClient: tlfClient}

	ctx := context.TODO()
	conversationInfo, err := resolver.ResolveOrCreate(ctx, c.resolvingRequest, c.G().UI.GetTerminalUI())
	if err != nil {
		return err
	}

	var args chat1.PostLocalArg
	args.ConversationID = conversationInfo.Id

	var msg chat1.MessagePlaintext
	// msgV1.ClientHeader.{Sender,SenderDevice} are filled by service
	msg.ClientHeader.Conv = conversationInfo.Triple
	msg.ClientHeader.TlfName = conversationInfo.TlfName

	// Do one of set topic name, set headline, or send message
	switch {
	case c.setTopicName != "":
		if conversationInfo.Triple.TopicType == chat1.TopicType_CHAT {
			c.G().UI.GetTerminalUI().Printf("We are not supporting setting topic name for chat conversations yet. Ignoring --set-topic-name >.<\n")
			return nil
		}
		msg.ClientHeader.MessageType = chat1.MessageType_METADATA
		msg.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: c.setTopicName})
	case c.setHeadline != "":
		msg.ClientHeader.MessageType = chat1.MessageType_HEADLINE
		msg.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: c.setHeadline})
	case c.clearHeadline:
		msg.ClientHeader.MessageType = chat1.MessageType_HEADLINE
		msg.MessageBody = chat1.NewMessageBodyWithHeadline(chat1.MessageHeadline{Headline: ""})
	default:
		if len(c.message) == 0 {
			return errors.New("message content required")
		}

		msg.ClientHeader.MessageType = chat1.MessageType_TEXT
		msg.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{Body: c.message})
	}

	args.Msg = msg

	if c.nonBlock {
		var nbarg chat1.PostLocalNonblockArg
		nbarg.ConversationID = args.ConversationID
		nbarg.Msg = args.Msg
		if _, err = chatClient.PostLocalNonblock(ctx, nbarg); err != nil {
			return err
		}
	} else {
		if _, err = chatClient.PostLocal(ctx, args); err != nil {
			return err
		}
	}

	return nil
}

func (c *cmdChatSend) ParseArgv(ctx *cli.Context) (err error) {
	c.setTopicName = ctx.String("set-topic-name")
	c.setHeadline = ctx.String("set-headline")
	c.clearHeadline = ctx.Bool("clear-headline")
	c.nonBlock = ctx.Bool("nonblock")

	var tlfName string
	if len(ctx.Args()) < 1 {
		return errors.New("conversation participants empty")
	}
	// Get the TLF name from the first position arg
	tlfName = ctx.Args().Get(0)

	if c.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return err
	}

	nActions := 0

	if c.setTopicName != "" {
		nActions++
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and set topic name simultaneously")
		}
	}

	if c.setHeadline != "" {
		nActions++
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and set headline name simultaneously")
		}
	}

	if c.clearHeadline {
		nActions++
		if len(ctx.Args()) > 1 {
			return fmt.Errorf("cannot send message and clear headline name simultaneously")
		}
	}

	// Send a normal message.
	if nActions == 0 {
		nActions++
		switch len(ctx.Args()) {
		case 1:
			bytes, err := ioutil.ReadAll(os.Stdin)
			if err != nil {
				return err
			}
			c.message = string(bytes)
		case 2:
			c.message = ctx.Args().Get(1)
		default:
			cli.ShowCommandHelp(ctx, "send")
			return fmt.Errorf("chat send takes 1 or 2 args")
		}
	}

	if nActions < 1 {
		cli.ShowCommandHelp(ctx, "send")
		return fmt.Errorf("Incorrect Usage.")
	}
	if nActions > 1 {
		cli.ShowCommandHelp(ctx, "send")
		return fmt.Errorf("only one of message, --set-headline, --clear-headline, or --set-topic-name allowed")
	}

	return nil
}

func (c *cmdChatSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
