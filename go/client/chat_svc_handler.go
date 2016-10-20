package client

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// ChatServiceHandler can call the service.
type ChatServiceHandler interface {
	ListV1(context.Context) Reply
	ReadV1(context.Context, readOptionsV1) Reply
	SendV1(context.Context, sendOptionsV1) Reply
	EditV1(context.Context, editOptionsV1) Reply
	DeleteV1(context.Context, deleteOptionsV1) Reply
	AttachV1(context.Context, attachOptionsV1) Reply
	DownloadV1(context.Context, downloadOptionsV1) Reply
}

// chatServiceHandler implements ChatServiceHandler.
type chatServiceHandler struct {
	libkb.Contextified
}

func newChatServiceHandler(g *libkb.GlobalContext) *chatServiceHandler {
	return &chatServiceHandler{
		Contextified: libkb.NewContextified(g),
	}
}

// ListV1 implements ChatServiceHandler.ListV1.
func (c *chatServiceHandler) ListV1(ctx context.Context) Reply {
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

// ReadV1 implements ChatServiceHandler.ReadV1.
func (c *chatServiceHandler) ReadV1(ctx context.Context, opts readOptionsV1) Reply {
	var rlimits []chat1.RateLimit
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	if opts.ConversationID.IsNil() {
		// resolve conversation id
		query, err := c.getInboxLocalQuery(ctx, opts.ConversationID, opts.Channel)
		if err != nil {
			return c.errReply(err)
		}
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
			thread.Messages = append(thread.Messages, Message{
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

		thread.Messages = append(thread.Messages, Message{
			Msg: &msg,
		})
		continue

	}

	thread.RateLimits.RateLimits = c.aggRateLimits(rlimits)
	return Reply{Result: thread}
}

// SendV1 implements ChatServiceHandler.SendV1.
func (c *chatServiceHandler) SendV1(ctx context.Context, opts sendOptionsV1) Reply {
	arg := sendArgV1{
		conversationID: opts.ConversationID,
		channel:        opts.Channel,
		body:           chat1.NewMessageBodyWithText(chat1.MessageText{Body: opts.Message.Body}),
		mtype:          chat1.MessageType_TEXT,
		response:       "message sent",
	}
	return c.sendV1(ctx, arg)
}

// DeleteV1 implements ChatServiceHandler.DeleteV1.
func (c *chatServiceHandler) DeleteV1(ctx context.Context, opts deleteOptionsV1) Reply {
	arg := sendArgV1{
		conversationID: opts.ConversationID,
		channel:        opts.Channel,
		body:           chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageID: opts.MessageID}),
		mtype:          chat1.MessageType_DELETE,
		supersedes:     opts.MessageID,
		response:       "message deleted",
	}
	return c.sendV1(ctx, arg)
}

// EditV1 implements ChatServiceHandler.EditV1.
func (c *chatServiceHandler) EditV1(ctx context.Context, opts editOptionsV1) Reply {
	arg := sendArgV1{
		conversationID: opts.ConversationID,
		channel:        opts.Channel,
		body:           chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: opts.MessageID, Body: opts.Message.Body}),
		mtype:          chat1.MessageType_EDIT,
		supersedes:     opts.MessageID,
		response:       "message edited",
	}
	return c.sendV1(ctx, arg)
}

// AttachV1 implements ChatServiceHandler.AttachV1.
func (c *chatServiceHandler) AttachV1(ctx context.Context, opts attachOptionsV1) Reply {
	sarg := sendArgV1{
		conversationID: opts.ConversationID,
		channel:        opts.Channel,
		mtype:          chat1.MessageType_ATTACHMENT,
	}
	query, err := c.getInboxLocalQuery(ctx, sarg.conversationID, sarg.channel)
	if err != nil {
		return c.errReply(err)
	}
	header, err := c.makePostHeader(ctx, sarg, query)
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

	ui := &ChatUI{
		Contextified: libkb.NewContextified(c.G()),
		terminal:     c.G().UI.GetTerminalUI(),
	}

	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		chat1.ChatUiProtocol(ui),
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
func (c *chatServiceHandler) DownloadV1(ctx context.Context, opts downloadOptionsV1) Reply {
	var fsink Sink
	if opts.Output == "-" {
		fsink = &StdoutSink{}
	} else {
		fsink = NewFileSink(opts.Output)
	}
	defer fsink.Close()
	sink := c.G().XStreams.ExportWriter(fsink)

	ui := &ChatUI{
		Contextified: libkb.NewContextified(c.G()),
		terminal:     c.G().UI.GetTerminalUI(),
	}
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	protocols := []rpc.Protocol{
		NewStreamUIProtocol(c.G()),
		chat1.ChatUiProtocol(ui),
	}
	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return c.errReply(err)
	}

	var rlimits []chat1.RateLimit
	if opts.ConversationID.IsNil() {
		// resolve conversation id
		query, err := c.getInboxLocalQuery(ctx, opts.ConversationID, opts.Channel)
		if err != nil {
			return c.errReply(err)
		}
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
	// convQuery  chat1.GetInboxLocalQuery
	conversationID chat1.ConversationID
	channel        ChatChannel
	body           chat1.MessageBody
	mtype          chat1.MessageType
	supersedes     chat1.MessageID
	response       string
}

func (c *chatServiceHandler) sendV1(ctx context.Context, arg sendArgV1) Reply {
	query, err := c.getInboxLocalQuery(ctx, arg.conversationID, arg.channel)
	if err != nil {
		return c.errReply(err)
	}
	header, err := c.makePostHeader(ctx, arg, query)
	if err != nil {
		return c.errReply(err)
	}

	postArg := chat1.PostLocalArg{
		ConversationID: header.conversationID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: header.clientHeader,
			MessageBody:  arg.body,
		},
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

func (c *chatServiceHandler) makePostHeader(ctx context.Context, arg sendArgV1, query chat1.GetInboxLocalQuery) (*postHeader, error) {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return nil, err
	}

	// find the conversation
	gilres, err := client.GetInboxLocal(ctx, chat1.GetInboxLocalArg{Query: &query})
	if err != nil {
		c.G().Log.Warning("GetInboxLocal error: %s", err)
		return nil, err
	}
	var header postHeader
	header.rateLimits = append(header.rateLimits, gilres.RateLimits...)

	var convTriple chat1.ConversationIDTriple
	existing := gilres.ConversationsUnverified
	switch len(existing) {
	case 0:
		ncres, err := client.NewConversationLocal(ctx, chat1.NewConversationLocalArg{
			TlfName:       *query.TlfName,
			TlfVisibility: *query.TlfVisibility,
			TopicName:     query.TopicName,
			TopicType:     *query.TopicType,
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
		TlfName:     *query.TlfName,
		TlfPublic:   *query.TlfVisibility == chat1.TLFVisibility_PUBLIC,
		MessageType: arg.mtype,
		Supersedes:  arg.supersedes,
	}

	return &header, nil
}

func (c *chatServiceHandler) getInboxLocalQuery(ctx context.Context, id chat1.ConversationID, channel ChatChannel) (chat1.GetInboxLocalQuery, error) {
	if !id.IsNil() {
		return chat1.GetInboxLocalQuery{ConvID: &id}, nil
	}

	// canonicalize the tlf name (no visibility necessary?)
	tlfClient, err := GetTlfClient(c.G())
	if err != nil {
		return chat1.GetInboxLocalQuery{}, err
	}

	var tlfName string
	tlfQ := keybase1.TLFQuery{
		TlfName:          channel.Name,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}
	if channel.Public {
		cname, err := tlfClient.PublicCanonicalTLFNameAndID(ctx, tlfQ)
		if err != nil {
			return chat1.GetInboxLocalQuery{}, err
		}
		tlfName = cname.CanonicalName.String()
	} else {
		cname, err := tlfClient.CompleteAndCanonicalizePrivateTlfName(ctx, tlfQ)
		if err != nil {
			return chat1.GetInboxLocalQuery{}, err
		}
		tlfName = cname.CanonicalName.String()
	}

	vis := chat1.TLFVisibility_PRIVATE
	if channel.Public {
		vis = chat1.TLFVisibility_PUBLIC
	}
	tt := channel.TopicTypeEnum()
	return chat1.GetInboxLocalQuery{
		TlfName:       &tlfName,
		TlfVisibility: &vis,
		TopicType:     &tt,
		TopicName:     &channel.TopicName,
	}, nil
}

// need this to get message type name
func (c *chatServiceHandler) convertMsgBody(mb chat1.MessageBody) MsgContent {
	return MsgContent{
		TypeName:   strings.ToLower(chat1.MessageTypeRevMap[mb.MessageType__]),
		Text:       mb.Text__,
		Attachment: mb.Attachment__,
		Edit:       mb.Edit__,
		Delete:     mb.Delete__,
		Metadata:   mb.Metadata__,
	}
}

func (c *chatServiceHandler) fileInfo(filename string) (os.FileInfo, *FileSource, error) {
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

func (c *chatServiceHandler) errReply(err error) Reply {
	if rlerr, ok := err.(libkb.ChatRateLimitError); ok {
		return Reply{Error: &CallError{Message: err.Error(), Data: rlerr.RateLimit}}
	}
	return Reply{Error: &CallError{Message: err.Error()}}
}

func (c *chatServiceHandler) aggRateLimits(rlimits []chat1.RateLimit) (res []RateLimit) {
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

// MsgSender is used for JSON output of the sender of a message.
type MsgSender struct {
	UID        string `json:"uid"`
	Username   string `json:"username,omitempty"`
	DeviceID   string `json:"device_id"`
	DeviceName string `json:"device_name,omitempty"`
}

// MsgContent is used to retrieve the type name in addition to one of
// Text, Attachment, Edit, Delete, Metadata depending on the type of message.
// It is included in MsgSummary.
type MsgContent struct {
	TypeName   string                             `json:"type"`
	Text       *chat1.MessageText                 `json:"text,omitempty"`
	Attachment *chat1.MessageAttachment           `json:"attachment,omitempty"`
	Edit       *chat1.MessageEdit                 `json:"edit,omitempty"`
	Delete     *chat1.MessageDelete               `json:"delete,omitempty"`
	Metadata   *chat1.MessageConversationMetadata `json:"metadata,omitempty"`
}

// MsgSummary is used to display JSON details for a message.
type MsgSummary struct {
	ID       chat1.MessageID                `json:"id"`
	Channel  ChatChannel                    `json:"channel"`
	Sender   MsgSender                      `json:"sender"`
	SentAt   int64                          `json:"sent_at"`
	SentAtMs int64                          `json:"sent_at_ms"`
	Content  MsgContent                     `json:"content"`
	Prev     []chat1.MessagePreviousPointer `json:"prev"`
}

// Message contains eiter a MsgSummary or an Error.  Used for JSON output.
type Message struct {
	Msg   *MsgSummary `json:"msg,omitempty"`
	Error *string     `json:"error,omitempty"`
}

// Thread is used for JSON output of a thread of messages.
type Thread struct {
	Messages []Message `json:"messages"`
	RateLimits
}

// ConvSummary is used for JSON output of a conversation in the inbox.
type ConvSummary struct {
	ID      chat1.ConversationID `json:"id"`
	Channel ChatChannel          `json:"channel"`
}

// ChatList is a list of conversations in the inbox.
type ChatList struct {
	Conversations []ConvSummary `json:"conversations"`
	RateLimits
}

// SendRes is the result of successfully sending a message.
type SendRes struct {
	Message string `json:"message"`
	RateLimits
}
