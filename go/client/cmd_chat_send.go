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
	message      string
	resolver     conversationResolver
	setTopicName string
}

func newCmdChatSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "send",
		Usage:        "Send a message to a conversation",
		ArgumentHelp: "[conversation [message]]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatSend{Contextified: libkb.NewContextified(g)}, "send", c)
		},
		Flags: mustGetChatFlags("topic-type", "topic-name", "set-topic-name", "stdin"),
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
	resolved, userChosen, err := c.resolver.Resolve(context.TODO(), c.G(), chatClient, tlfClient)
	if err != nil {
		return err
	}

	if resolved == nil {
		ncres, err := chatClient.NewConversationLocal(ctx, chat1.ConversationInfoLocal{
			TlfName:   c.resolver.TlfName,
			TopicName: c.resolver.TopicName,
			TopicType: c.resolver.TopicType,
		})
		if err != nil {
			return fmt.Errorf("creating conversation error: %v\n", err)
		}
		conversationInfo = ncres.Conv
	} else {
		conversationInfo = *resolved
	}

	switch {
	case userChosen && len(c.message) == 0:
		c.message, err = c.G().UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, fmt.Sprintf("Send to [%s]? Hit Ctrl-C to cancel, or enter message content to send: ", conversationInfo.TlfName))
		if err != nil {
			return err
		}
	case userChosen:
		return errors.New("potential command line argument parsing error: we had a message before letting user choose a conversation")
	case len(c.message) == 0:
		c.message, err = c.G().UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, "Please enter message content: ")
		if err != nil {
			return err
		}
	default:
	}

	var args chat1.PostLocalArg
	args.ConversationID = conversationInfo.Id

	var msgV1 chat1.MessagePlaintextV1
	// msgV1.ClientHeader.{Sender,SenderDevice} are filled by service
	msgV1.ClientHeader.Conv = conversationInfo.Triple
	msgV1.ClientHeader.TlfName = conversationInfo.TlfName
	msgV1.ClientHeader.MessageType = chat1.MessageType_TEXT
	msgV1.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{Body: c.message})

	args.MessagePlaintext = chat1.NewMessagePlaintextWithV1(msgV1)

	if _, err = chatClient.PostLocal(ctx, args); err != nil {
		return err
	}

	if len(c.setTopicName) > 0 {
		if conversationInfo.TopicType == chat1.TopicType_CHAT {
			c.G().UI.GetTerminalUI().Printf("We are not supporting setting topic name for chat conversations yet. Ignoring --set-topic-name >.<")
		}
		msgV1.ClientHeader.MessageType = chat1.MessageType_METADATA
		msgV1.ClientHeader.Prev = nil // TODO
		msgV1.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: c.setTopicName})
		args.MessagePlaintext = chat1.NewMessagePlaintextWithV1(msgV1)
		if _, err := chatClient.PostLocal(ctx, args); err != nil {
			return err
		}
	}

	return nil
}

func (c *cmdChatSend) ParseArgv(ctx *cli.Context) (err error) {
	switch len(ctx.Args()) {
	case 2:
		c.message = ctx.Args().Get(1)
		fallthrough
	case 1:
		tlfName := ctx.Args().Get(0)
		if c.resolver, err = parseConversationResolver(ctx, tlfName); err != nil {
			return err
		}
	case 0:
		if ctx.Bool("stdin") {
			return fmt.Errorf("--stdin requires 1 argument [conversation]")
		}
		if c.resolver, err = parseConversationResolver(ctx, ""); err != nil {
			return err
		}
	default:
		return fmt.Errorf("keybase chat send takes 1 or 2 args")
	}

	if ctx.Bool("stdin") {
		bytes, err := ioutil.ReadAll(os.Stdin)
		if err != nil {
			return err
		}
		c.message = string(bytes)
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
