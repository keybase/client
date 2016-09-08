// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"os"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type CmdChatAPI struct {
	libkb.Contextified
	indent bool
}

func newCmdChatAPI(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:  "api",
		Usage: "JSON api",
		Action: func(c *cli.Context) {
			cmd := &CmdChatAPI{Contextified: libkb.NewContextified(g)}
			cl.ChooseCommand(cmd, "api", c)
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "p, pretty",
				Usage: "Output pretty (indented) JSON.",
			},
		},
	}
}

func (c *CmdChatAPI) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("api takes no arguments")
	}
	c.indent = ctx.Bool("pretty")
	return nil
}

func (c *CmdChatAPI) Run() error {
	d := NewChatAPIDecoder(&ChatAPI{svcHandler: c, indent: c.indent})

	// TODO: flags for not using stdin, stdout

	if err := d.Decode(os.Stdin, os.Stdout); err != nil {
		return err
	}

	return nil
}

func (c *CmdChatAPI) GetUsage() libkb.Usage {
	return libkb.Usage{
		API:       true,
		KbKeyring: true,
		Config:    true,
	}
}

type ConvSummary struct {
	ID        chat1.ConversationID `json:"id"`
	Channel   ChatChannel          `json:"channel"`
	TopicType string               `json:"topic_type"`
	TopicID   string               `json:"topic_id"`
}

type ChatList struct {
	Status        string        `json:"status"`
	Conversations []ConvSummary `json:"conversations"`
}

func (c *CmdChatAPI) ListV1() Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	// XXX plumb context through?
	inbox, err := client.GetInboxLocal(context.Background(), nil)
	if err != nil {
		return c.errReply(err)
	}

	fmt.Printf("inbox: %+v\n", inbox)

	var cl ChatList
	cl.Status = "ok"
	cl.Conversations = make([]ConvSummary, len(inbox.Conversations))
	for i, conv := range inbox.Conversations {
		cl.Conversations[i] = ConvSummary{
			ID:        conv.Metadata.ConversationID,
			Channel:   ChatChannel{},
			TopicType: conv.Metadata.IdTriple.TopicType.String(),
			TopicID:   conv.Metadata.IdTriple.TopicID.String(),
		}
	}

	return Reply{Result: cl}
}

func (c *CmdChatAPI) ReadV1(opts readOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	if opts.ConversationID == 0 {
		// XXX resolve conversation id
	}

	arg := keybase1.GetThreadLocalArg{
		ConversationID: opts.ConversationID,
		MarkAsRead:     true,
	}
	// XXX plumb context through?
	thread, err := client.GetThreadLocal(context.Background(), arg)
	if err != nil {
		return c.errReply(err)
	}

	// XXX convert thread to something else...
	fmt.Printf("thread: %+v\n", thread)

	return Reply{}
}

func (c *CmdChatAPI) SendV1(opts sendOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	// XXX plumb context through?
	ctx := context.Background()

	// XXX support other topic types
	// XXX support conversation id
	// XXX support topic name
	// XXX add sender name to channel name?
	// XXX add public, private
	cinfo := keybase1.ConversationInfoLocal{
		TlfName:   opts.Channel.Name,
		TopicType: chat1.TopicType_CHAT,
	}

	// find the conversation
	existing, err := client.ResolveConversationLocal(ctx, cinfo)
	if err != nil {
		return c.errReply(err)
	}
	if len(existing) > 1 {
		return c.errReply(fmt.Errorf("multiple conversations matched"))
	}
	var conversation keybase1.ConversationInfoLocal
	switch len(existing) {
	case 0:
		conversation, err = client.NewConversationLocal(ctx, cinfo)
		if err != nil {
			return c.errReply(err)
		}
	case 1:
		conversation = existing[0]
	default:
		return c.errReply(fmt.Errorf("multiple conversations matched"))
	}

	postArg := keybase1.PostLocalArg{
		ConversationID: conversation.Id,
		MessagePlaintext: keybase1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				TlfName:     conversation.TlfName,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBodies: []keybase1.MessageBody{
				keybase1.NewMessageBodyWithText(keybase1.MessageText{Body: opts.Message.Body}),
			},
		},
	}
	if err := client.PostLocal(ctx, postArg); err != nil {
		return c.errReply(err)
	}

	return Reply{Result: "ok"}
}

func (c *CmdChatAPI) errReply(err error) Reply {
	return Reply{Error: &CallError{Message: err.Error()}}
}
