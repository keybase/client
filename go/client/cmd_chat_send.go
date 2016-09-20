// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type cmdChatSend struct {
	libkb.Contextified
	message      string
	resolver     conversationResolver
	setTopicName string
}

func newCmdChatSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "send",
		Usage:        "Send a message to a conversation",
		ArgumentHelp: "<conversation> <message>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatSend{Contextified: libkb.NewContextified(g)}, "send", c)
		},
		Flags: makeChatFlags([]cli.Flag{
			cli.StringFlag{
				Name:  "topic-name",
				Usage: `Specify topic name of the conversation.`,
			},
			cli.StringFlag{
				Name:  "set-topic-name",
				Usage: `set topic name for the conversation`,
			},
		}),
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

	ctx := context.TODO()

	var conversationInfo chat1.ConversationInfoLocal
	resolved, err := c.resolver.Resolve(context.TODO(), c.G(), chatClient, tlfClient)
	if err != nil {
		return err
	}
	c.G().UI.GetTerminalUI().Printf("sending to %s ... ", resolved.TlfName)

	if resolved == nil {
		conversationInfo, err = chatClient.NewConversationLocal(ctx, chat1.ConversationInfoLocal{
			TlfName:   c.resolver.TlfName,
			TopicName: c.resolver.TopicName,
			TopicType: c.resolver.TopicType,
		})
		if err != nil {
			return fmt.Errorf("creating conversation error: %v\n", err)
		}
	} else {
		// TODO: prompt user to choose one
		conversationInfo = *resolved
	}

	var args chat1.PostLocalArg
	// TODO: prompt user to choose one if multiple exist
	args.ConversationID = conversationInfo.Id

	var msgV1 chat1.MessagePlaintextV1
	// msgV1.ClientHeader.Conv omitted
	// msgV1.ClientHeader.{Sender,SenderDevice} are filled by service
	msgV1.ClientHeader.TlfName = conversationInfo.TlfName
	msgV1.ClientHeader.MessageType = chat1.MessageType_TEXT
	msgV1.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{Body: c.message})

	args.MessagePlaintext = chat1.NewMessagePlaintextWithV1(msgV1)

	if err = chatClient.PostLocal(ctx, args); err != nil {
		return err
	}

	if len(c.setTopicName) > 0 {
		msgV1.ClientHeader.MessageType = chat1.MessageType_METADATA
		msgV1.ClientHeader.Prev = nil // TODO
		msgV1.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: c.setTopicName})
		args.MessagePlaintext = chat1.NewMessagePlaintextWithV1(msgV1)
		if err := chatClient.PostLocal(ctx, args); err != nil {
			return err
		}
	}

	c.G().UI.GetTerminalUI().Printf("done!\n")

	return nil
}

func (c *cmdChatSend) ParseArgv(ctx *cli.Context) (err error) {
	switch len(ctx.Args()) {
	case 2:
		tlfName := ctx.Args().Get(0)
		if c.resolver, err = parseConversationResolver(ctx, tlfName); err != nil {
			return err
		}
		c.message = ctx.Args().Get(1)
	case 1:
		if c.resolver, err = parseConversationResolver(ctx, ""); err != nil {
			return err
		}
		c.message = ctx.Args().Get(0)
	default:
		return fmt.Errorf("keybase chat send takes 1 or 2 args")
	}
	c.setTopicName = ctx.String("set-topic-name")

	return nil
}

func (c *cmdChatSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
