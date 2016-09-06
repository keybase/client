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
	tlfName string
	message string
}

func newCmdChatSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "send",
		Usage:        "Send a message to a conversation",
		ArgumentHelp: "<conversation> <message>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatSend{Contextified: libkb.NewContextified(g)}, "send", c)
		},
	}
}

func (c *cmdChatSend) Run() (err error) {
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	if cName, err := chatClient.CompleteAndCanonicalizeTlfName(ctx, c.tlfName); err != nil {
		return err
	} else if c.tlfName != string(cName) {
		c.G().UI.GetTerminalUI().Printf("Using TLF name %s instead of %s ...\n", cName, c.tlfName)
		c.tlfName = string(cName)
	}

	var args keybase1.PostLocalArg
	conversationIDs, err := chatClient.ResolveConversationLocal(ctx, keybase1.ConversationInfoLocal{
		TlfName:   c.tlfName,
		TopicType: chat1.TopicType_CHAT,
	})
	if err != nil {
		return err
	}
	if len(conversationIDs) == 0 {
		return errors.New("empty response from ResolveConversationLocal. This must be a bug")
	}
	// TODO: prompt user to choose one if multiple exist
	args.ConversationID = conversationIDs[0]
	// args.MessagePlaintext.ClientHeader.Conv omitted
	// args.MessagePlaintext.ClientHeader.{Sender,SenderDevice} are filled by service
	args.MessagePlaintext.ClientHeader.MessageType = chat1.MessageType_TEXT
	args.MessagePlaintext.ClientHeader.TlfName = c.tlfName
	args.MessagePlaintext.ClientHeader.Prev = nil

	body := keybase1.NewMessageBodyWithText(keybase1.MessageText{Body: c.message})

	args.MessagePlaintext.MessageBodies = append(args.MessagePlaintext.MessageBodies, body)

	if chatClient, err := GetChatLocalClient(c.G()); err != nil {
		return err
	} else if err = chatClient.PostLocal(ctx, args); err != nil {
		return err
	}

	return nil
}

func (c *cmdChatSend) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return fmt.Errorf("keybase chat send takes 2 args")
	}
	c.tlfName = ctx.Args().Get(0)
	c.message = ctx.Args().Get(1)
	return nil
}

func (c *cmdChatSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
