// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/gregor/protocol/chat1"
	"github.com/keybase/gregor/protocol/gregor1"
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
	uid := c.G().Env.GetUID()
	if uid.IsNil() {
		return fmt.Errorf("Can't send message without a current UID. Are you logged in?")
	}
	did := c.G().Env.GetDeviceID()
	if did.IsNil() {
		return fmt.Errorf("Can't send message without a current DeviceID. Are you logged in?")
	}

	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	var args keybase1.PostLocalArg
	if args.ConversationID, err = chatClient.GetOrCreateTextConversationLocal(context.TODO(), c.tlfName); err != nil {
		return err
	}
	// args.MessagePlaintext.ClientHeader.Conv omitted
	args.MessagePlaintext.ClientHeader.MessageType = chat1.MessageType_TEXT
	args.MessagePlaintext.ClientHeader.TlfName = c.tlfName
	args.MessagePlaintext.ClientHeader.Prev = nil
	args.MessagePlaintext.ClientHeader.Sender = gregor1.UID(uid)
	args.MessagePlaintext.ClientHeader.SenderDevice = gregor1.DeviceID(did)
	args.MessagePlaintext.MessageBodies = append(args.MessagePlaintext.MessageBodies, keybase1.MessageBody{
		Type: chat1.MessageType_TEXT,
		Text: &keybase1.MessageText{Body: c.message},
	})

	if chatClient, err := GetChatLocalClient(c.G()); err != nil {
		return err
	} else if err = chatClient.PostLocal(context.TODO(), args); err != nil {
		return err
	}

	return nil
}

func (c *cmdChatSend) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 2 {
		return fmt.Errorf("chat send takes 2 arg")
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
