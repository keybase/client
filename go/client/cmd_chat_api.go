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
	RateLimits
}

func (c *CmdChatAPI) aggRateLimits(rlimits []chat1.RateLimit) (res []RateLimit) {
	m := make(map[string]chat1.RateLimit)
	for _, rl := range rlimits {
		m[rl.Name] = rl
	}
	for _, v := range m {
		res = append(res, RateLimit{
			Tank:     v.Name,
			Capacity: v.MaxCalls,
			Reset:    v.WindowReset,
			Gas:      v.CallsRemaining,
		})
	}
	return res
}

// ListV1 implements ChatServiceHandler.ListV1.
func (c *CmdChatAPI) ListV1(ctx context.Context) Reply {
	var rlimits []chat1.RateLimit
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	inbox, err := client.GetInboxLocal(ctx, chat1.GetInboxLocalArg{})
	if err != nil {
		return c.errReply(err)
	}
	rlimits = append(rlimits, inbox.RateLimits...)

	var cl ChatList
	cl.Conversations = make([]ConvSummary, len(inbox.Inbox.Conversations))
	for i, conv := range inbox.Inbox.Conversations {
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
	cl.RateLimits.RateLimits = c.aggRateLimits(rlimits)
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

type MsgFromServer struct {
	Msg   *MsgSummary `json:"msg,omitempty"`
	Error *string     `json:"error,omitempty"`
}

type Thread struct {
	Messages []MsgFromServer `json:"messages"`
	RateLimits
}

// ReadV1 implements ChatServiceHandler.ReadV1.
func (c *CmdChatAPI) ReadV1(ctx context.Context, opts readOptionsV1) Reply {
	var rlimits []chat1.RateLimit
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	if opts.ConversationID == 0 {
		// resolve conversation id
		cinfo := c.conversationInfo(opts.ConversationID, opts.Channel)
		rcres, err := client.ResolveConversationLocal(ctx, cinfo)
		if err != nil {
			return c.errReply(err)
		}
		rlimits = append(rlimits, rcres.RateLimits...)
		existing := rcres.Convs
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
	rlimits = append(rlimits, threadView.RateLimits...)

	var thread Thread
	for _, m := range threadView.Thread.Messages {
		if m.UnboxingError != nil {
			thread.Messages = append(thread.Messages, MsgFromServer{
				Error: m.UnboxingError,
			})
			continue
		}

		version, err := m.Message.MessagePlaintext.Version()
		if err != nil {
			return c.errReply(err)
		}
		switch version {
		case chat1.MessagePlaintextVersion_V1:
			v1 := m.Message.MessagePlaintext.V1()
			if v1.ClientHeader.MessageType == chat1.MessageType_TLFNAME {
				// skip TLFNAME messages
				continue
			}
			switch version {
			case chat1.MessagePlaintextVersion_V1:
				v1 := m.Message.MessagePlaintext.V1()
				if v1.ClientHeader.MessageType == chat1.MessageType_TLFNAME {
					// skip TLFNAME messages
					continue
				}
				msg := MsgSummary{
					ID: m.Message.ServerHeader.MessageID,
					Channel: ChatChannel{
						Name:      v1.ClientHeader.TlfName,
						Public:    v1.ClientHeader.TlfPublic,
						TopicType: strings.ToLower(v1.ClientHeader.Conv.TopicType.String()),
					},
					Sender: MsgSender{
						UID:      v1.ClientHeader.Sender.String(),
						DeviceID: v1.ClientHeader.SenderDevice.String(),
					},
					SentAt:   int64(m.Message.ServerHeader.Ctime / 1000),
					SentAtMs: int64(m.Message.ServerHeader.Ctime),
				}
				msg.Content = c.convertMsgBody(v1.MessageBody)

				msg.Sender.Username = m.Message.SenderUsername
				msg.Sender.DeviceName = m.Message.SenderDeviceName

				thread.Messages = append(thread.Messages, MsgFromServer{
					Msg: &msg,
				})
			default:
				return c.errReply(libkb.NewChatMessageVersionError(version))
			}

			continue
		}

		return c.errReply(errors.New("unexpected response from service: UnboxingError and Message are both empty"))
	}

	thread.RateLimits.RateLimits = c.aggRateLimits(rlimits)
	return Reply{Result: thread}
}

type SendRes struct {
	Message string `json:"message"`
	RateLimits
}

// SendV1 implements ChatServiceHandler.SendV1.
func (c *CmdChatAPI) SendV1(ctx context.Context, opts sendOptionsV1) Reply {
	arg := sendArgV1{
		cinfo:    c.conversationInfo(opts.ConversationID, opts.Channel),
		body:     chat1.NewMessageBodyWithText(chat1.MessageText{Body: opts.Message.Body}),
		mtype:    chat1.MessageType_TEXT,
		response: "message sent",
	}
	return c.sendV1(ctx, arg)
}

// DeleteV1 implements ChatServiceHandler.DeleteV1.
func (c *CmdChatAPI) DeleteV1(ctx context.Context, opts deleteOptionsV1) Reply {
	arg := sendArgV1{
		cinfo:      c.conversationInfo(opts.ConversationID, opts.Channel),
		body:       chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageID: opts.MessageID}),
		mtype:      chat1.MessageType_DELETE,
		supersedes: opts.MessageID,
		response:   "message deleted",
	}
	return c.sendV1(ctx, arg)
}

// EditV1 implements ChatServiceHandler.EditV1.
func (c *CmdChatAPI) EditV1(ctx context.Context, opts editOptionsV1) Reply {
	arg := sendArgV1{
		cinfo:      c.conversationInfo(opts.ConversationID, opts.Channel),
		body:       chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: opts.MessageID, Body: opts.Message.Body}),
		mtype:      chat1.MessageType_EDIT,
		supersedes: opts.MessageID,
		response:   "message edited",
	}
	return c.sendV1(ctx, arg)
}

type sendArgV1 struct {
	cinfo      chat1.ConversationInfoLocal
	body       chat1.MessageBody
	mtype      chat1.MessageType
	supersedes chat1.MessageID
	response   string
}

func (c *CmdChatAPI) sendV1(ctx context.Context, arg sendArgV1) Reply {
	var rlimits []chat1.RateLimit
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	// find the conversation
	rcres, err := client.ResolveConversationLocal(ctx, arg.cinfo)
	if err != nil {
		return c.errReply(err)
	}
	rlimits = append(rlimits, rcres.RateLimits...)

	var conversation chat1.ConversationInfoLocal
	existing := rcres.Convs
	switch len(existing) {
	case 0:
		ncres, err := client.NewConversationLocal(ctx, arg.cinfo)
		if err != nil {
			return c.errReply(err)
		}
		rlimits = append(rlimits, ncres.RateLimits...)
		conversation = ncres.Conv
	case 1:
		conversation = existing[0]
	default:
		return c.errReply(fmt.Errorf("multiple conversations matched"))
	}

	postArg := chat1.PostLocalArg{
		ConversationID: conversation.Id,
		MessagePlaintext: chat1.NewMessagePlaintextWithV1(chat1.MessagePlaintextV1{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conversation.Triple,
				TlfName:     conversation.TlfName,
				TlfPublic:   conversation.Visibility == chat1.TLFVisibility_PUBLIC,
				MessageType: arg.mtype,
				Supersedes:  arg.supersedes,
			},
			MessageBody: arg.body,
		}),
	}
	plres, err := client.PostLocal(ctx, postArg)
	if err != nil {
		return c.errReply(err)
	}
	rlimits = append(rlimits, plres.RateLimits...)

	res := SendRes{
		Message: arg.response,
		RateLimits: RateLimits{
			RateLimits: c.aggRateLimits(rlimits),
		},
	}

	return Reply{Result: res}
}

func (c *CmdChatAPI) errReply(err error) Reply {
	if rlerr, ok := err.(libkb.ChatRateLimitError); ok {
		return Reply{Error: &CallError{Message: err.Error(), Data: rlerr.RateLimit}}
	}
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

func (c *CmdChatAPI) conversationInfo(id chat1.ConversationID, channel ChatChannel) chat1.ConversationInfoLocal {
	if id > 0 {
		return chat1.ConversationInfoLocal{Id: id}
	}

	vis := chat1.TLFVisibility_PRIVATE
	if channel.Public {
		vis = chat1.TLFVisibility_PUBLIC
	}
	return chat1.ConversationInfoLocal{
		TlfName:    channel.Name,
		Visibility: vis,
		TopicType:  channel.TopicTypeEnum(),
		TopicName:  channel.TopicName,
	}
}
