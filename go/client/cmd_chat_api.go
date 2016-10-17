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
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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
	cl.Conversations = make([]ConvSummary, len(inbox.ConversationsUnverified))
	for i, conv := range inbox.ConversationsUnverified {
		maxID := chat1.MessageID(0)
		for _, msg := range conv.MaxMsgs {
			if msg.ServerHeader.MessageID > maxID {
				tlf := msg.ClientHeader.TlfName
				pub := msg.ClientHeader.TlfPublic
				cl.Conversations[i] = ConvSummary{
					ID: conv.Metadata.ConversationID,
					Channel: ChatChannel{
						Name:      tlf,
						Public:    pub,
						TopicType: strings.ToLower(conv.Metadata.IdTriple.TopicType.String()),
					},
				}
				maxID = msg.ServerHeader.MessageID
			}
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
	ID       chat1.MessageID                `json:"id"`
	Channel  ChatChannel                    `json:"channel"`
	Sender   MsgSender                      `json:"sender"`
	SentAt   int64                          `json:"sent_at"`
	SentAtMs int64                          `json:"sent_at_ms"`
	Content  MsgContent                     `json:"content"`
	Prev     []chat1.MessagePreviousPointer `json:"prev"`
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
		query := c.getInboxLocalQuery(opts.ConversationID, opts.Channel)
		gilres, err := client.GetInboxLocal(ctx, chat1.GetInboxLocalArg{
			Query: &query,
		})
		if err != nil {
			return c.errReply(err)
		}
		rlimits = append(rlimits, gilres.RateLimits...)
		existing := gilres.ConversationsUnverified
		if len(existing) > 1 {
			return c.errReply(fmt.Errorf("multiple conversations matched %q", opts.Channel.Name))
		}
		if len(existing) == 0 {
			return c.errReply(fmt.Errorf("no conversations matched %q", opts.Channel.Name))
		}
		opts.ConversationID = existing[0].Metadata.ConversationID
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
		st, err := m.State()
		if err != nil {
			return c.errReply(errors.New("invalid message: unknown state"))
		}

		if st == chat1.MessageUnboxedState_ERROR {
			em := m.Error().ErrMsg
			thread.Messages = append(thread.Messages, MsgFromServer{
				Error: &em,
			})
			continue
		}

		mv := m.Valid()
		if mv.ClientHeader.MessageType == chat1.MessageType_TLFNAME {
			// skip TLFNAME messages
			continue
		}
		prev := mv.ClientHeader.Prev
		// Avoid having null show up in the output JSON.
		if prev == nil {
			prev = []chat1.MessagePreviousPointer{}
		}
		msg := MsgSummary{
			ID: mv.ServerHeader.MessageID,
			Channel: ChatChannel{
				Name:      mv.ClientHeader.TlfName,
				Public:    mv.ClientHeader.TlfPublic,
				TopicType: strings.ToLower(mv.ClientHeader.Conv.TopicType.String()),
			},
			Sender: MsgSender{
				UID:      mv.ClientHeader.Sender.String(),
				DeviceID: mv.ClientHeader.SenderDevice.String(),
			},
			SentAt:   mv.ServerHeader.Ctime.UnixSeconds(),
			SentAtMs: mv.ServerHeader.Ctime.UnixMilliseconds(),
			Prev:     prev,
		}
		msg.Content = c.convertMsgBody(mv.MessageBody)

		msg.Sender.Username = mv.SenderUsername
		msg.Sender.DeviceName = mv.SenderDeviceName

		thread.Messages = append(thread.Messages, MsgFromServer{
			Msg: &msg,
		})
		continue

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
		convQuery: c.getInboxLocalQuery(opts.ConversationID, opts.Channel),
		body:      chat1.NewMessageBodyWithText(chat1.MessageText{Body: opts.Message.Body}),
		mtype:     chat1.MessageType_TEXT,
		response:  "message sent",
	}
	return c.sendV1(ctx, arg)
}

// DeleteV1 implements ChatServiceHandler.DeleteV1.
func (c *CmdChatAPI) DeleteV1(ctx context.Context, opts deleteOptionsV1) Reply {
	arg := sendArgV1{
		convQuery:  c.getInboxLocalQuery(opts.ConversationID, opts.Channel),
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
		convQuery:  c.getInboxLocalQuery(opts.ConversationID, opts.Channel),
		body:       chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: opts.MessageID, Body: opts.Message.Body}),
		mtype:      chat1.MessageType_EDIT,
		supersedes: opts.MessageID,
		response:   "message edited",
	}
	return c.sendV1(ctx, arg)
}

// AttachV1 implements ChatServiceHandler.AttachV1.
func (c *CmdChatAPI) AttachV1(ctx context.Context, opts attachOptionsV1) Reply {
	sarg := sendArgV1{
		convQuery: c.getInboxLocalQuery(opts.ConversationID, opts.Channel),
		mtype:     chat1.MessageType_ATTACHMENT,
	}
	header, err := c.makePostHeader(ctx, sarg)
	if err != nil {
		return c.errReply(err)
	}

	info, fsource, err := c.fileInfo(opts.Filename)
	if err != nil {
		return c.errReply(err)
	}
	defer fsource.Close()
	src := c.G().XStreams.ExportReader(fsource)

	arg := chat1.PostAttachmentLocalArg{
		ConversationID: header.conversationID,
		ClientHeader:   header.clientHeader,
		Attachment: chat1.LocalSource{
			Filename: info.Name(),
			Size:     int(info.Size()),
			Source:   src,
		},
	}

	// check for preview
	if len(opts.Preview) > 0 {
		pinfo, psource, err := c.fileInfo(opts.Preview)
		if err != nil {
			return c.errReply(err)
		}
		defer psource.Close()
		psrc := c.G().XStreams.ExportReader(psource)
		plocal := chat1.LocalSource{
			Filename: pinfo.Name(),
			Size:     int(pinfo.Size()),
			Source:   psrc,
		}
		arg.Preview = &plocal
	}

	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return c.errReply(err)
	}
	pres, err := client.PostAttachmentLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}
	header.rateLimits = append(header.rateLimits, pres.RateLimits...)

	res := SendRes{
		Message: "attachment sent",
		RateLimits: RateLimits{
			RateLimits: c.aggRateLimits(header.rateLimits),
		},
	}

	return Reply{Result: res}
}

// DownloadV1 implements ChatServiceHandler.DownloadV1.
func (c *CmdChatAPI) DownloadV1(ctx context.Context, opts downloadOptionsV1) Reply {
	var fsink Sink
	if opts.Output == "-" {
		fsink = &StdoutSink{}
	} else {
		fsink = NewFileSink(opts.Output)
	}
	defer fsink.Close()
	sink := c.G().XStreams.ExportWriter(fsink)

	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return c.errReply(err)
	}

	var rlimits []chat1.RateLimit
	if opts.ConversationID == 0 {
		// resolve conversation id
		query := c.getInboxLocalQuery(opts.ConversationID, opts.Channel)
		gilres, err := client.GetInboxLocal(ctx, chat1.GetInboxLocalArg{
			Query: &query,
		})
		if err != nil {
			return c.errReply(err)
		}
		rlimits = append(rlimits, gilres.RateLimits...)
		existing := gilres.ConversationsUnverified
		if len(existing) > 1 {
			return c.errReply(fmt.Errorf("multiple conversations matched %q", opts.Channel.Name))
		}
		if len(existing) == 0 {
			return c.errReply(fmt.Errorf("no conversations matched %q", opts.Channel.Name))
		}
		opts.ConversationID = existing[0].Metadata.ConversationID
	}

	arg := chat1.DownloadAttachmentLocalArg{
		ConversationID: opts.ConversationID,
		MessageID:      opts.MessageID,
		Sink:           sink,
		Preview:        opts.Preview,
	}

	dres, err := client.DownloadAttachmentLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}
	rlimits = append(rlimits, dres.RateLimits...)

	res := SendRes{
		Message: fmt.Sprintf("attachment downloaded to %s", opts.Output),
		RateLimits: RateLimits{
			RateLimits: c.aggRateLimits(rlimits),
		},
	}

	return Reply{Result: res}
}

type sendArgV1 struct {
	convQuery  chat1.GetInboxLocalQuery
	body       chat1.MessageBody
	mtype      chat1.MessageType
	supersedes chat1.MessageID
	response   string
}

func (c *CmdChatAPI) sendV1(ctx context.Context, arg sendArgV1) Reply {
	header, err := c.makePostHeader(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}

	postArg := chat1.PostLocalArg{
		ConversationID: header.conversationID,
		MessagePlaintext: chat1.NewMessagePlaintextWithV1(chat1.MessagePlaintextV1{
			ClientHeader: header.clientHeader,
			MessageBody:  arg.body,
		}),
	}
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	plres, err := client.PostLocal(ctx, postArg)
	if err != nil {
		return c.errReply(err)
	}
	header.rateLimits = append(header.rateLimits, plres.RateLimits...)

	res := SendRes{
		Message: arg.response,
		RateLimits: RateLimits{
			RateLimits: c.aggRateLimits(header.rateLimits),
		},
	}

	return Reply{Result: res}
}

type postHeader struct {
	conversationID chat1.ConversationID
	clientHeader   chat1.MessageClientHeader
	rateLimits     []chat1.RateLimit
}

func (c *CmdChatAPI) makePostHeader(ctx context.Context, arg sendArgV1) (*postHeader, error) {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return nil, err
	}

	// find the conversation
	gilres, err := client.GetInboxLocal(ctx, chat1.GetInboxLocalArg{Query: &arg.convQuery})
	if err != nil {
		return nil, err
	}
	var header postHeader
	header.rateLimits = append(header.rateLimits, gilres.RateLimits...)

	var convTriple chat1.ConversationIDTriple
	existing := gilres.ConversationsUnverified
	switch len(existing) {
	case 0:
		ncres, err := client.NewConversationLocal(ctx, chat1.NewConversationLocalArg{
			TlfName:       *arg.convQuery.TlfName,
			TlfVisibility: *arg.convQuery.TlfVisibility,
			TopicName:     arg.convQuery.TopicName,
			TopicType:     *arg.convQuery.TopicType,
		})
		if err != nil {
			return nil, err
		}
		header.rateLimits = append(header.rateLimits, ncres.RateLimits...)
		convTriple, header.conversationID = ncres.Conv.Info.Triple, ncres.Conv.Info.Id
	case 1:
		convTriple, header.conversationID = existing[0].Metadata.IdTriple, existing[0].Metadata.ConversationID
	default:
		return nil, fmt.Errorf("multiple conversations matched")
	}

	header.clientHeader = chat1.MessageClientHeader{
		Conv:        convTriple,
		TlfName:     *arg.convQuery.TlfName,
		TlfPublic:   *arg.convQuery.TlfVisibility == chat1.TLFVisibility_PUBLIC,
		MessageType: arg.mtype,
		Supersedes:  arg.supersedes,
	}

	return &header, nil
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

func (c *CmdChatAPI) getInboxLocalQuery(id chat1.ConversationID, channel ChatChannel) chat1.GetInboxLocalQuery {
	if id > 0 {
		return chat1.GetInboxLocalQuery{ConvID: &id}
	}

	vis := chat1.TLFVisibility_PRIVATE
	if channel.Public {
		vis = chat1.TLFVisibility_PUBLIC
	}
	tt := channel.TopicTypeEnum()
	return chat1.GetInboxLocalQuery{
		TlfName:       &channel.Name,
		TlfVisibility: &vis,
		TopicType:     &tt,
		TopicName:     &channel.TopicName,
	}
}

func (c *CmdChatAPI) fileInfo(filename string) (os.FileInfo, *FileSource, error) {
	info, err := os.Stat(filename)
	if err != nil {
		return nil, nil, err
	}
	if info.IsDir() {
		return nil, nil, fmt.Errorf("%s is a directory", filename)
	}

	fsource := NewFileSource(filename)
	if err := fsource.Open(); err != nil {
		return nil, nil, err
	}

	return info, fsource, nil
}
