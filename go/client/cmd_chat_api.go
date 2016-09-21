// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type CmdChatAPI struct {
	libkb.Contextified
	indent     bool
	inputFile  string
	outputFile string
	message    string
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
			cli.StringFlag{
				Name:  "m",
				Usage: "Specify JSON as string instead of stdin",
			},
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify JSON input file (stdin default)",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify output file (stdout default)",
			},
		},
	}
}

func (c *CmdChatAPI) ParseArgv(ctx *cli.Context) error {
	if len(ctx.Args()) != 0 {
		return errors.New("api takes no arguments")
	}
	c.indent = ctx.Bool("pretty")
	c.inputFile = ctx.String("infile")
	c.outputFile = ctx.String("outfile")
	c.message = ctx.String("m")

	if len(c.message) > 0 && len(c.inputFile) > 0 {
		return errors.New("specify -m or -i, but not both")
	}

	return nil
}

func (c *CmdChatAPI) Run() error {
	d := NewChatAPIDecoder(&ChatAPI{svcHandler: c, indent: c.indent})

	var r io.Reader
	r = os.Stdin
	if len(c.message) > 0 {
		r = strings.NewReader(c.message)
	} else if len(c.inputFile) > 0 {
		f, err := os.Open(c.inputFile)
		if err != nil {
			return err
		}
		defer f.Close()
		r = f
	}

	var w io.Writer
	w = os.Stdout
	if len(c.outputFile) > 0 {
		f, err := os.Create(c.outputFile)
		if err != nil {
			return err
		}
		defer f.Close()
		w = f
	}

	if err := d.Decode(context.Background(), r, w); err != nil {
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
	ID      chat1.ConversationID `json:"id"`
	Channel ChatChannel          `json:"channel"`
}

type ChatList struct {
	Conversations []ConvSummary `json:"conversations"`
}

// ListV1 implements ChatServiceHandler.ListV1.
func (c *CmdChatAPI) ListV1(ctx context.Context) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	inbox, err := client.GetInboxLocal(ctx, chat1.GetInboxLocalArg{})
	if err != nil {
		return c.errReply(err)
	}

	var cl ChatList
	cl.Conversations = make([]ConvSummary, len(inbox.Conversations))
	for i, conv := range inbox.Conversations {
		if len(conv.MaxMsgs) == 0 {
			return c.errReply(fmt.Errorf("conversation %d had no max msgs", conv.Metadata.ConversationID))
		}
		tlf := conv.MaxMsgs[0].ClientHeader.TlfName
		pub := conv.MaxMsgs[0].ClientHeader.TlfPublic
		cl.Conversations[i] = ConvSummary{
			ID: conv.Metadata.ConversationID,
			Channel: ChatChannel{
				Name:      tlf,
				Public:    pub,
				TopicType: strings.ToLower(conv.Metadata.IdTriple.TopicType.String()),
			},
		}
	}

	return Reply{Result: cl}
}

type MsgSender struct {
	UID        string `json:"uid"`
	Username   string `json:"username,omitempty"`
	DeviceID   string `json:"device_id"`
	DeviceName string `json:"device_name,omitempty"`
}

// unfortunately need this...
type MsgContent struct {
	TypeName   string                             `json:"type"`
	Text       *chat1.MessageText                 `json:"text,omitempty"`
	Attachment *chat1.MessageAttachment           `json:"attachment,omitempty"`
	Edit       *chat1.MessageEdit                 `json:"edit,omitempty"`
	Delete     *chat1.MessageDelete               `json:"delete,omitempty"`
	Metadata   *chat1.MessageConversationMetadata `json:"metadata,omitempty"`
}

type MsgSummary struct {
	ID       chat1.MessageID `json:"id"`
	Channel  ChatChannel     `json:"channel"`
	Sender   MsgSender       `json:"sender"`
	SentAt   int64           `json:"sent_at"`
	SentAtMs int64           `json:"sent_at_ms"`
	Content  MsgContent      `json:"content"`
}

type Thread struct {
	Messages []MsgSummary `json:"messages"`
}

// ReadV1 implements ChatServiceHandler.ReadV1.
func (c *CmdChatAPI) ReadV1(ctx context.Context, opts readOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	if opts.ConversationID == 0 {
		// resolve conversation id
		cinfo := chat1.ConversationInfoLocal{
			TlfName:   opts.Channel.Name,
			TopicType: opts.Channel.TopicTypeEnum(),
			TopicName: opts.Channel.TopicName,
		}
		existing, err := client.ResolveConversationLocal(ctx, cinfo)
		if err != nil {
			return c.errReply(err)
		}
		if len(existing) > 1 {
			return c.errReply(fmt.Errorf("multiple conversations matched %q", opts.Channel.Name))
		}
		if len(existing) == 0 {
			return c.errReply(fmt.Errorf("no conversations matched %q", opts.Channel.Name))
		}
		opts.ConversationID = existing[0].Id
	}

	arg := chat1.GetThreadLocalArg{
		ConversationID: opts.ConversationID,
		Query: &chat1.GetThreadQuery{
			MarkAsRead: true,
		},
	}
	threadView, err := client.GetThreadLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}

	var thread Thread
	for _, m := range threadView.Messages {
		version, err := m.MessagePlaintext.Version()
		if err != nil {
			return c.errReply(err)
		}
		switch version {
		case chat1.MessagePlaintextVersion_V1:
			v1 := m.MessagePlaintext.V1()
			if v1.ClientHeader.MessageType == chat1.MessageType_TLFNAME {
				// skip TLFNAME messages
				continue
			}
			msg := MsgSummary{
				ID: m.ServerHeader.MessageID,
				Channel: ChatChannel{
					Name:      v1.ClientHeader.TlfName,
					Public:    v1.ClientHeader.TlfPublic,
					TopicType: strings.ToLower(v1.ClientHeader.Conv.TopicType.String()),
				},
				Sender: MsgSender{
					UID:      v1.ClientHeader.Sender.String(),
					DeviceID: v1.ClientHeader.SenderDevice.String(),
				},
				SentAt:   int64(m.ServerHeader.Ctime / 1000),
				SentAtMs: int64(m.ServerHeader.Ctime),
			}
			msg.Content = c.convertMsgBody(v1.MessageBody)
			if m.Info != nil {
				msg.Sender.Username = m.Info.SenderUsername
				msg.Sender.DeviceName = m.Info.SenderDeviceName
			}
			thread.Messages = append(thread.Messages, msg)
		default:
			return c.errReply(libkb.NewChatMessageVersionError(version))
		}
	}

	return Reply{Result: thread}
}

// SendV1 implements ChatServiceHandler.SendV1.
func (c *CmdChatAPI) SendV1(ctx context.Context, opts sendOptionsV1) Reply {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	var cinfo chat1.ConversationInfoLocal
	if opts.ConversationID > 0 {
		cinfo = chat1.ConversationInfoLocal{
			Id: opts.ConversationID,
		}
	} else {
		vis := chat1.TLFVisibility_PRIVATE
		if opts.Channel.Public {
			vis = chat1.TLFVisibility_PUBLIC
		}
		cinfo = chat1.ConversationInfoLocal{
			TlfName:    opts.Channel.Name,
			Visibility: vis,
			TopicType:  opts.Channel.TopicTypeEnum(),
			TopicName:  opts.Channel.TopicName,
		}
	}

	// find the conversation
	existing, err := client.ResolveConversationLocal(ctx, cinfo)
	if err != nil {
		return c.errReply(err)
	}
	var conversation chat1.ConversationInfoLocal
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

	// XXX ResolveConversationLocal, NewConversationLocal need to return
	// topic id and tlf id.  In order to fill in conversation id triple
	// below.
	// ticket CORE-3746

	postArg := chat1.PostLocalArg{
		ConversationID: conversation.Id,
		MessagePlaintext: chat1.NewMessagePlaintextWithV1(chat1.MessagePlaintextV1{
			ClientHeader: chat1.MessageClientHeader{
				Conv: chat1.ConversationIDTriple{
					TopicType: conversation.TopicType,
				},
				TlfName:     conversation.TlfName,
				TlfPublic:   conversation.Visibility == chat1.TLFVisibility_PUBLIC,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: opts.Message.Body}),
		}),
	}
	if err := client.PostLocal(ctx, postArg); err != nil {
		return c.errReply(err)
	}

	return Reply{Result: "message sent"}
}

func (c *CmdChatAPI) errReply(err error) Reply {
	return Reply{Error: &CallError{Message: err.Error()}}
}

// need this to get message type name
func (c *CmdChatAPI) convertMsgBody(mb chat1.MessageBody) MsgContent {
	return MsgContent{
		TypeName:   strings.ToLower(chat1.MessageTypeRevMap[mb.MessageType__]),
		Text:       mb.Text__,
		Attachment: mb.Attachment__,
		Edit:       mb.Edit__,
		Delete:     mb.Delete__,
		Metadata:   mb.Metadata__,
	}
}
