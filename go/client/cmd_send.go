// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bytes"
	"encoding/hex"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/gregor/protocol/chat1"
	"github.com/keybase/gregor/protocol/gregor1"
)

type cmdSend struct {
	libkb.Contextified
	tlfName string
	message string
}

func newCmdSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "send",
		Usage:        "Send a message to a conversation",
		ArgumentHelp: "<conversation> <message>",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdSend{Contextified: libkb.NewContextified(g)}, "send", c)
		},
	}
}

// getConversationID returns the most recent conversation's ConversationID for
// given TLF ID, or creates a new conversation and returns its ID if none
// exists yet.
//
// TODO: after we implement multiple conversations per TLF and topic names,
// replace this with something that looks up by topic name
func (c *cmdSend) getConversationID(ctx context.Context, tlfID chat1.TLFID, chatClient keybase1.ChatLocalClient) (id chat1.ConversationID, err error) {
	ipagination := &chat1.Pagination{}
getinbox:
	for {
		ipagination.Num = 32
		iview, err := chatClient.GetInboxLocal(context.TODO(), ipagination)
		if err != nil {
			return id, err
		}
		for _, conv := range iview.Conversations {
			if bytes.Equal(conv.Metadata.IdTriple.Tlfid, tlfID) {
				return conv.Metadata.ConversationID, nil
			}
		}

		if iview.Pagination == nil || iview.Pagination.Last != 0 {
			break getinbox
		} else {
			ipagination = iview.Pagination
		}
	}

	id, err = chatClient.NewConversationLocal(ctx, chat1.ConversationIDTriple{
		Tlfid:     tlfID,
		TopicType: chat1.TopicType_CHAT,
		// TopicID filled by server?
	})
	if err != nil {
		return id, err
	}

	return id, nil
}

func (c *cmdSend) Run() (err error) {
	uid := c.G().Env.GetUID()
	if uid.IsNil() {
		return fmt.Errorf("No current UID")
	}
	did := c.G().Env.GetDeviceID()
	if did.IsNil() {
		return fmt.Errorf("No current DeviceID")
	}

	var tlfID []byte
	if tlfClient, err := GetTlfClient(c.G()); err != nil {
		return err
	} else if res, err := tlfClient.CryptKeys(context.TODO(), c.tlfName); err != nil {
		return err
	} else if tlfID, err = hex.DecodeString(string(res.TlfID)); err != nil {
		return err
	}

	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	var args keybase1.PostLocalArg
	if args.ConversationID, err = c.getConversationID(context.TODO(), chat1.TLFID(tlfID), chatClient); err != nil {
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

func (c *cmdSend) ParseArgv(ctx *cli.Context) error {
	c.tlfName = ctx.Args().Get(0)
	c.message = ctx.Args().Get(1)
	return nil
}

func (c *cmdSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
