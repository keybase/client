// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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

	ctx := context.TODO()

	conversationInfos, err := c.resolver.Resolve(context.TODO(), chatClient)
	if err != nil {
		return err
	}
	if len(conversationInfos) == 0 {
		return errors.New("empty response from ResolveConversationLocal. TODO: create new conversation here or new subcommand?")
	}

	var args keybase1.PostLocalArg
	// TODO: prompt user to choose one if multiple exist
	args.ConversationID = conversationInfos[0].Id
	// args.MessagePlaintext.ClientHeader.Conv omitted
	// args.MessagePlaintext.ClientHeader.{Sender,SenderDevice} are filled by service
	args.MessagePlaintext.ClientHeader.TlfName = conversationInfos[0].TlfName

	args.MessagePlaintext.ClientHeader.MessageType = chat1.MessageType_TEXT
	args.MessagePlaintext.ClientHeader.Prev = nil // TODO
	args.MessagePlaintext.MessageBodies = append([]keybase1.MessageBody(nil), keybase1.MessageBody{
		Type: chat1.MessageType_TEXT,
		Text: &keybase1.MessageText{Body: c.message},
	})
	if err = chatClient.PostLocal(ctx, args); err != nil {
		return err
	}

	if len(c.setTopicName) > 0 {
		args.MessagePlaintext.ClientHeader.MessageType = chat1.MessageType_METADATA
		args.MessagePlaintext.ClientHeader.Prev = nil // TODO
		args.MessagePlaintext.MessageBodies = append([]keybase1.MessageBody(nil), keybase1.MessageBody{
			Type: chat1.MessageType_METADATA,
			ConversationMetadata: &keybase1.MessageConversationMetadata{
				ConversationTitle: c.setTopicName,
			},
		})
		if err = chatClient.PostLocal(ctx, args); err != nil {
			return err
		}
	}

	return nil
}

func (c *cmdChatSend) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) != 2 {
		return fmt.Errorf("keybase chat send takes 2 args")
	}
	tlfName := ctx.Args().Get(0)
	if c.resolver, err = parseConversationResolver(ctx, tlfName); err != nil {
		return err
	}
	c.message = ctx.Args().Get(1)
	c.setTopicName = ctx.String("set-topic-name")
	return nil
}

func (c *cmdChatSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
