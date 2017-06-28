package client

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// ChatServiceHandler can call the service.
type ChatServiceHandler interface {
	ListV1(context.Context, listOptionsV1) Reply
	ReadV1(context.Context, readOptionsV1) Reply
	SendV1(context.Context, sendOptionsV1) Reply
	EditV1(context.Context, editOptionsV1) Reply
	DeleteV1(context.Context, deleteOptionsV1) Reply
	AttachV1(context.Context, attachOptionsV1) Reply
	DownloadV1(context.Context, downloadOptionsV1) Reply
	SetStatusV1(context.Context, setStatusOptionsV1) Reply
	MarkV1(context.Context, markOptionsV1) Reply
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
func (c *chatServiceHandler) ListV1(ctx context.Context, opts listOptionsV1) Reply {
	var rlimits []chat1.RateLimit
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	topicType, err := TopicTypeFromStrDefault(opts.TopicType)
	if err != nil {
		return c.errReply(err)
	}

	res, err := client.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			Status:            utils.VisibleChatConversationStatuses(),
			TopicType:         &topicType,
			UnreadOnly:        opts.UnreadOnly,
			OneChatTypePerTLF: new(bool),
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return c.errReply(err)
	}
	rlimits = utils.AggRateLimits(res.RateLimits)

	// Check to see if this should fail offline
	if opts.FailOffline && res.Offline {
		return c.errReply(chat.OfflineError{})
	}

	cl := ChatList{
		Offline:          res.Offline,
		IdentifyFailures: res.IdentifyFailures,
	}
	for _, conv := range res.Conversations {
		var convSummary ConvSummary
		convSummary.ID = conv.GetConvID().String()
		if conv.Error != nil {
			// Handle error case
			if opts.ShowErrors {
				convSummary.Error = conv.Error.Message
				cl.Conversations = append(cl.Conversations, convSummary)
			}
			continue
		}

		readerInfo := conv.ReaderInfo
		convSummary.Unread = readerInfo.ReadMsgid < readerInfo.MaxMsgid
		convSummary.ActiveAt = readerInfo.Mtime.UnixSeconds()
		convSummary.ActiveAtMs = readerInfo.Mtime.UnixMilliseconds()
		convSummary.FinalizeInfo = conv.Info.FinalizeInfo
		for _, super := range conv.Supersedes {
			convSummary.Supersedes = append(convSummary.Supersedes,
				super.ConversationID.String())
		}
		for _, super := range conv.SupersededBy {
			convSummary.SupersededBy = append(convSummary.SupersededBy,
				super.ConversationID.String())
		}
		convSummary.Channel = ChatChannel{
			Name:        conv.Info.TlfName,
			Public:      conv.Info.Visibility == chat1.TLFVisibility_PUBLIC,
			TopicType:   strings.ToLower(conv.Info.Triple.TopicType.String()),
			MembersType: strings.ToLower(conv.Info.MembersType.String()),
			TopicName:   conv.Info.TopicName,
		}

		cl.Conversations = append(cl.Conversations, convSummary)
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

	conv, rlimits, err := c.findConversation(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	arg := chat1.GetThreadLocalArg{
		ConversationID: conv.Info.Id,
		Query: &chat1.GetThreadQuery{
			MarkAsRead: !opts.Peek,
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}
	threadView, err := client.GetThreadLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}
	rlimits = append(rlimits, threadView.RateLimits...)

	// Check to see if this was fetched offline and we should fail
	if opts.FailOffline && threadView.Offline {
		return c.errReply(chat.OfflineError{})
	}

	// This could be lower than the truth if any messages were
	// posted between the last two gregor rpcs.
	readMsgID := conv.ReaderInfo.ReadMsgid

	selfUID := c.G().Env.GetUID()
	if selfUID.IsNil() {
		c.G().Log.Warning("Could not get self UID for api")
	}

	thread := Thread{
		Offline:          threadView.Offline,
		IdentifyFailures: threadView.IdentifyFailures,
	}
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

		unread := mv.ServerHeader.MessageID > readMsgID
		if opts.UnreadOnly && !unread {
			continue
		}
		if !selfUID.IsNil() {
			fromSelf := (mv.ClientHeader.Sender.String() == selfUID.String())
			unread = unread && (!fromSelf)
			if opts.UnreadOnly && fromSelf {
				continue
			}
		}

		prev := mv.ClientHeader.Prev
		// Avoid having null show up in the output JSON.
		if prev == nil {
			prev = []chat1.MessagePreviousPointer{}
		}

		msg := MsgSummary{
			ID: mv.ServerHeader.MessageID,
			Channel: ChatChannel{
				Name:        mv.ClientHeader.TlfName,
				Public:      mv.ClientHeader.TlfPublic,
				TopicType:   strings.ToLower(mv.ClientHeader.Conv.TopicType.String()),
				MembersType: strings.ToLower(conv.GetMembersType().String()),
			},
			Sender: MsgSender{
				UID:      mv.ClientHeader.Sender.String(),
				DeviceID: mv.ClientHeader.SenderDevice.String(),
			},
			SentAt:        mv.ServerHeader.Ctime.UnixSeconds(),
			SentAtMs:      mv.ServerHeader.Ctime.UnixMilliseconds(),
			Prev:          prev,
			Unread:        unread,
			RevokedDevice: mv.SenderDeviceRevokedAt != nil,
		}

		msg.Content = c.convertMsgBody(mv.MessageBody)
		msg.Sender.Username = mv.SenderUsername
		msg.Sender.DeviceName = mv.SenderDeviceName

		thread.Messages = append(thread.Messages, Message{
			Msg: &msg,
		})
	}

	// Avoid having null show up in the output JSON.
	if thread.Messages == nil {
		thread.Messages = []Message{}
	}

	thread.RateLimits.RateLimits = c.aggRateLimits(rlimits)
	return Reply{Result: thread}
}

// SendV1 implements ChatServiceHandler.SendV1.
func (c *chatServiceHandler) SendV1(ctx context.Context, opts sendOptionsV1) Reply {
	convID, err := chat1.MakeConvID(opts.ConversationID)
	if err != nil {
		return c.errReply(fmt.Errorf("invalid conv ID: %s", opts.ConversationID))
	}
	arg := sendArgV1{
		conversationID: convID,
		channel:        opts.Channel,
		body:           chat1.NewMessageBodyWithText(chat1.MessageText{Body: opts.Message.Body}),
		mtype:          chat1.MessageType_TEXT,
		response:       "message sent",
		nonblock:       opts.Nonblock,
	}
	return c.sendV1(ctx, arg)
}

// DeleteV1 implements ChatServiceHandler.DeleteV1.
func (c *chatServiceHandler) DeleteV1(ctx context.Context, opts deleteOptionsV1) Reply {

	convID, _, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(fmt.Errorf("invalid conv ID: %s", opts.ConversationID))
	}

	messages := []chat1.MessageID{opts.MessageID}
	arg := sendArgV1{
		conversationID: convID,
		channel:        opts.Channel,
		mtype:          chat1.MessageType_DELETE,
		supersedes:     opts.MessageID,
		deletes:        messages,
		response:       "message deleted",

		// NOTE: The service will fill in the IDs of edit messages that also need to be deleted.
		body: chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageIDs: messages}),
	}
	return c.sendV1(ctx, arg)
}

// EditV1 implements ChatServiceHandler.EditV1.
func (c *chatServiceHandler) EditV1(ctx context.Context, opts editOptionsV1) Reply {
	convID, err := chat1.MakeConvID(opts.ConversationID)
	if err != nil {
		return c.errReply(fmt.Errorf("invalid conv ID: %s", opts.ConversationID))
	}
	arg := sendArgV1{
		conversationID: convID,
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
	var rl []chat1.RateLimit
	if opts.NoStream {
		return c.attachV1NoStream(ctx, opts)
	}
	convID, err := chat1.MakeConvID(opts.ConversationID)
	if err != nil {
		return c.errReply(fmt.Errorf("invalid conv ID: %s", opts.ConversationID))
	}
	sarg := sendArgV1{
		conversationID: convID,
		channel:        opts.Channel,
		mtype:          chat1.MessageType_ATTACHMENT,
	}

	existing, existingRl, err := c.getExistingConvs(ctx, sarg.conversationID, sarg.channel)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, existingRl...)
	header, err := c.makePostHeader(ctx, sarg, existing)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, header.rateLimits...)

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
		Title: opts.Title,
	}

	// check for preview
	if len(opts.Preview) > 0 {
		arg.Preview = &chat1.MakePreviewRes{
			Filename: &opts.Preview,
		}
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
	rl = append(rl, pres.RateLimits...)

	res := SendRes{
		Message: "attachment sent",
		RateLimits: RateLimits{
			RateLimits: c.aggRateLimits(rl),
		},
	}

	return Reply{Result: res}
}

// attachV1NoStream uses PostFileAttachmentLocal instead of PostAttachmentLocal.
func (c *chatServiceHandler) attachV1NoStream(ctx context.Context, opts attachOptionsV1) Reply {
	var rl []chat1.RateLimit
	convID, err := chat1.MakeConvID(opts.ConversationID)
	if err != nil {
		return c.errReply(fmt.Errorf("invalid conv ID: %s", opts.ConversationID))
	}
	sarg := sendArgV1{
		conversationID: convID,
		channel:        opts.Channel,
		mtype:          chat1.MessageType_ATTACHMENT,
	}
	existing, existingRl, err := c.getExistingConvs(ctx, sarg.conversationID, sarg.channel)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, existingRl...)

	header, err := c.makePostHeader(ctx, sarg, existing)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, header.rateLimits...)

	arg := chat1.PostFileAttachmentLocalArg{
		ConversationID: header.conversationID,
		ClientHeader:   header.clientHeader,
		Attachment: chat1.LocalFileSource{
			Filename: opts.Filename,
		},
		Title: opts.Title,
	}

	// check for preview
	if len(opts.Preview) > 0 {
		arg.Preview = &chat1.MakePreviewRes{
			Filename: &opts.Preview,
		}
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
	pres, err := client.PostFileAttachmentLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, pres.RateLimits...)

	res := SendRes{
		Message: "attachment sent",
		RateLimits: RateLimits{
			RateLimits: c.aggRateLimits(rl),
		},
	}

	return Reply{Result: res}
}

// DownloadV1 implements ChatServiceHandler.DownloadV1.
func (c *chatServiceHandler) DownloadV1(ctx context.Context, opts downloadOptionsV1) Reply {
	if opts.NoStream && opts.Output != "-" {
		return c.downloadV1NoStream(ctx, opts)
	}
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

	convID, rlimits, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	arg := chat1.DownloadAttachmentLocalArg{
		ConversationID:   convID,
		MessageID:        opts.MessageID,
		Sink:             sink,
		Preview:          opts.Preview,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
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
		IdentifyFailures: dres.IdentifyFailures,
	}

	return Reply{Result: res}
}

// downloadV1NoStream uses DownloadFileAttachmentLocal instead of DownloadAttachmentLocal.
func (c *chatServiceHandler) downloadV1NoStream(ctx context.Context, opts downloadOptionsV1) Reply {
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

	convID, rlimits, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	arg := chat1.DownloadFileAttachmentLocalArg{
		ConversationID: convID,
		MessageID:      opts.MessageID,
		Preview:        opts.Preview,
		Filename:       opts.Output,
	}

	dres, err := client.DownloadFileAttachmentLocal(ctx, arg)
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

// SetStatusV1 implements ChatServiceHandler.SetStatusV1.
func (c *chatServiceHandler) SetStatusV1(ctx context.Context, opts setStatusOptionsV1) Reply {
	var rlimits []chat1.RateLimit

	// Unverified convID is ok here because status is completely server controlled anyway.
	convID, rlimits, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}
	status, ok := chat1.ConversationStatusMap[strings.ToUpper(opts.Status)]
	if !ok {
		return c.errReply(fmt.Errorf("unsupported status: '%v'", opts.Status))
	}

	setStatusArg := chat1.SetConversationStatusLocalArg{
		ConversationID:   convID,
		Status:           status,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}

	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}
	localRes, err := client.SetConversationStatusLocal(ctx, setStatusArg)
	if err != nil {
		return c.errReply(err)
	}
	rlimits = append(rlimits, localRes.RateLimits...)

	res := EmptyRes{
		RateLimits: RateLimits{
			c.aggRateLimits(rlimits),
		},
	}
	return Reply{Result: res}
}

func (c *chatServiceHandler) MarkV1(ctx context.Context, opts markOptionsV1) Reply {
	convID, rlimits, err := c.resolveAPIConvID(ctx, opts.ConversationID, opts.Channel)
	if err != nil {
		return c.errReply(err)
	}

	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	arg := chat1.MarkAsReadLocalArg{
		ConversationID: convID,
		MsgID:          opts.MessageID,
	}

	res, err := client.MarkAsReadLocal(ctx, arg)
	if err != nil {
		return c.errReply(err)
	}

	allLimits := append(rlimits, res.RateLimits...)
	cres := EmptyRes{
		RateLimits: RateLimits{
			c.aggRateLimits(allLimits),
		},
	}
	return Reply{Result: cres}
}

type sendArgV1 struct {
	// convQuery  chat1.GetInboxLocalQuery
	conversationID chat1.ConversationID
	channel        ChatChannel
	body           chat1.MessageBody
	mtype          chat1.MessageType
	supersedes     chat1.MessageID
	deletes        []chat1.MessageID
	response       string
	nonblock       bool
}

func (c *chatServiceHandler) sendV1(ctx context.Context, arg sendArgV1) Reply {
	var rl []chat1.RateLimit
	existing, existingRl, err := c.getExistingConvs(ctx, arg.conversationID, arg.channel)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, existingRl...)

	header, err := c.makePostHeader(ctx, arg, existing)
	if err != nil {
		return c.errReply(err)
	}
	rl = append(rl, header.rateLimits...)

	postArg := chat1.PostLocalArg{
		ConversationID: header.conversationID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: header.clientHeader,
			MessageBody:  arg.body,
		},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return c.errReply(err)
	}

	var idFails []keybase1.TLFIdentifyFailure
	if arg.nonblock {
		var nbarg chat1.PostLocalNonblockArg
		nbarg.ConversationID = postArg.ConversationID
		nbarg.Msg = postArg.Msg
		nbarg.IdentifyBehavior = postArg.IdentifyBehavior
		plres, err := client.PostLocalNonblock(ctx, nbarg)
		if err != nil {
			return c.errReply(err)
		}
		rl = append(rl, plres.RateLimits...)
		idFails = plres.IdentifyFailures
	} else {
		plres, err := client.PostLocal(ctx, postArg)
		if err != nil {
			return c.errReply(err)
		}
		rl = append(rl, plres.RateLimits...)
		idFails = plres.IdentifyFailures
	}

	res := SendRes{
		Message: arg.response,
		RateLimits: RateLimits{
			RateLimits: c.aggRateLimits(rl),
		},
		IdentifyFailures: idFails,
	}

	return Reply{Result: res}
}

type postHeader struct {
	conversationID chat1.ConversationID
	clientHeader   chat1.MessageClientHeader
	rateLimits     []chat1.RateLimit
}

func (c *chatServiceHandler) makePostHeader(ctx context.Context, arg sendArgV1, existing []chat1.ConversationLocal) (*postHeader, error) {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return nil, err
	}

	var header postHeader
	var convTriple chat1.ConversationIDTriple
	var tlfName string
	var visibility chat1.TLFVisibility
	switch len(existing) {
	case 0:
		visibility = chat1.TLFVisibility_PRIVATE
		if arg.channel.Public {
			visibility = chat1.TLFVisibility_PUBLIC
		}
		tt, err := TopicTypeFromStrDefault(arg.channel.TopicType)
		if err != nil {
			return nil, err
		}

		ncres, err := client.NewConversationLocal(ctx, chat1.NewConversationLocalArg{
			TlfName:          arg.channel.Name,
			TlfVisibility:    visibility,
			TopicName:        &arg.channel.TopicName,
			TopicType:        tt,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		if err != nil {
			return nil, err
		}
		header.rateLimits = append(header.rateLimits, ncres.RateLimits...)
		convTriple = ncres.Conv.Info.Triple
		tlfName = ncres.Conv.Info.TlfName
		visibility = ncres.Conv.Info.Visibility
		header.conversationID = ncres.Conv.Info.Id
	case 1:
		convTriple = existing[0].Info.Triple
		tlfName = existing[0].Info.TlfName
		visibility = existing[0].Info.Visibility
		header.conversationID = existing[0].Info.Id
	default:
		return nil, fmt.Errorf("multiple conversations matched")
	}

	header.clientHeader = chat1.MessageClientHeader{
		Conv:        convTriple,
		TlfName:     tlfName,
		TlfPublic:   visibility == chat1.TLFVisibility_PUBLIC,
		MessageType: arg.mtype,
		Supersedes:  arg.supersedes,
		Deletes:     arg.deletes,
	}

	return &header, nil
}

func (c *chatServiceHandler) getExistingConvs(ctx context.Context, id chat1.ConversationID, channel ChatChannel) ([]chat1.ConversationLocal, []chat1.RateLimit, error) {
	client, err := GetChatLocalClient(c.G())
	if err != nil {
		return nil, nil, err
	}

	if !id.IsNil() {
		gilres, err := client.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
			Query: &chat1.GetInboxLocalQuery{
				ConvIDs: []chat1.ConversationID{id},
			},
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		if err != nil {
			c.G().Log.Warning("GetInboxLocal error: %s", err)
			return nil, nil, err
		}
		return gilres.Conversations, gilres.RateLimits, nil
	}

	tlfClient, err := GetTlfClient(c.G())
	if err != nil {
		return nil, nil, err
	}

	var tlfName string
	if channel.GetMembersType() == chat1.ConversationMembersType_KBFS {
		tlfQ := keybase1.TLFQuery{
			TlfName:          channel.Name,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		if channel.Public {
			cname, err := tlfClient.PublicCanonicalTLFNameAndID(ctx, tlfQ)
			if err != nil {
				return nil, nil, err
			}
			tlfName = cname.CanonicalName.String()
		} else {
			cname, err := tlfClient.CompleteAndCanonicalizePrivateTlfName(ctx, tlfQ)
			if err != nil {
				return nil, nil, err
			}
			tlfName = cname.CanonicalName.String()
		}
	} else {
		tlfName = channel.Name
	}

	vis := chat1.TLFVisibility_PRIVATE
	if channel.Public {
		vis = chat1.TLFVisibility_PUBLIC
	}
	tt, err := TopicTypeFromStrDefault(channel.TopicType)
	if err != nil {
		return nil, nil, err
	}

	findRes, err := client.FindConversationsLocal(ctx, chat1.FindConversationsLocalArg{
		TlfName:          tlfName,
		MembersType:      channel.GetMembersType(),
		Visibility:       vis,
		TopicType:        tt,
		TopicName:        channel.TopicName,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return nil, nil, err
	}

	return findRes.Conversations, findRes.RateLimits, nil
}

// need this to get message type name
func (c *chatServiceHandler) convertMsgBody(mb chat1.MessageBody) MsgContent {
	return MsgContent{
		TypeName:           strings.ToLower(chat1.MessageTypeRevMap[mb.MessageType__]),
		Text:               mb.Text__,
		Attachment:         mb.Attachment__,
		Edit:               mb.Edit__,
		Delete:             mb.Delete__,
		Metadata:           mb.Metadata__,
		AttachmentUploaded: mb.Attachmentuploaded__,
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

// Resolve the ConvID of the specified conversation.
// Prefers using ChatChannel but if it is blank (default-valued) then uses ConvIDStr.
// Uses tlfclient and GetInboxAndUnboxLocal's ConversationsUnverified.
func (c *chatServiceHandler) resolveAPIConvID(ctx context.Context, convIDStr string, channel ChatChannel) (chat1.ConversationID, []chat1.RateLimit, error) {
	conv, limits, err := c.findConversation(ctx, convIDStr, channel)
	if err != nil {
		return chat1.ConversationID{}, nil, err
	}
	return conv.Info.Id, limits, nil
}

// findConversation finds a conversation.
// It prefers using ChatChannel but if it is blank (default-valued) then uses ConvIDStr.
// Uses tlfclient and GetInboxAndUnboxLocal's ConversationsUnverified.
func (c *chatServiceHandler) findConversation(ctx context.Context, convIDStr string, channel ChatChannel) (chat1.ConversationLocal, []chat1.RateLimit, error) {
	var conv chat1.ConversationLocal
	var rlimits []chat1.RateLimit

	if (channel == ChatChannel{}) && len(convIDStr) == 0 {
		return conv, rlimits, errors.New("missing conversation specificer")
	}

	var convID chat1.ConversationID
	if channel == (ChatChannel{}) {
		var err error
		convID, err = chat1.MakeConvID(convIDStr)
		if err != nil {
			return conv, rlimits, fmt.Errorf("invalid conversation ID: %s", convIDStr)
		}
	}

	existing, existingRl, err := c.getExistingConvs(ctx, convID, channel)
	if err != nil {
		return conv, rlimits, err
	}
	rlimits = append(rlimits, existingRl...)

	if len(existing) > 1 {
		return conv, rlimits, fmt.Errorf("multiple conversations matched %q", channel.Name)
	}
	if len(existing) == 0 {
		return conv, rlimits, fmt.Errorf("no conversations matched %q", channel.Name)
	}

	return existing[0], rlimits, nil
}

func TopicTypeFromStrDefault(str string) (chat1.TopicType, error) {
	if len(str) == 0 {
		return chat1.TopicType_CHAT, nil
	}
	tt, ok := chat1.TopicTypeMap[strings.ToUpper(str)]
	if !ok {
		return chat1.TopicType_NONE, fmt.Errorf("invalid topic type: '%v'", str)
	}
	return tt, nil
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
	TypeName           string                             `json:"type"`
	Text               *chat1.MessageText                 `json:"text,omitempty"`
	Attachment         *chat1.MessageAttachment           `json:"attachment,omitempty"`
	Edit               *chat1.MessageEdit                 `json:"edit,omitempty"`
	Delete             *chat1.MessageDelete               `json:"delete,omitempty"`
	Metadata           *chat1.MessageConversationMetadata `json:"metadata,omitempty"`
	AttachmentUploaded *chat1.MessageAttachmentUploaded   `json:"attachment_uploaded,omitempty"`
}

// MsgSummary is used to display JSON details for a message.
type MsgSummary struct {
	ID            chat1.MessageID                `json:"id"`
	Channel       ChatChannel                    `json:"channel"`
	Sender        MsgSender                      `json:"sender"`
	SentAt        int64                          `json:"sent_at"`
	SentAtMs      int64                          `json:"sent_at_ms"`
	Content       MsgContent                     `json:"content"`
	Prev          []chat1.MessagePreviousPointer `json:"prev"`
	Unread        bool                           `json:"unread"`
	RevokedDevice bool                           `json:"revoked_device,omitempty"`
	Offline       bool                           `json:"offline,omitempty"`
}

// Message contains eiter a MsgSummary or an Error.  Used for JSON output.
type Message struct {
	Msg   *MsgSummary `json:"msg,omitempty"`
	Error *string     `json:"error,omitempty"`
}

// Thread is used for JSON output of a thread of messages.
type Thread struct {
	Messages         []Message                     `json:"messages"`
	Offline          bool                          `json:"offline,omitempty"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `json:"identify_failures,omitempty"`
	RateLimits
}

// ConvSummary is used for JSON output of a conversation in the inbox.
type ConvSummary struct {
	ID           string                          `json:"id"`
	Channel      ChatChannel                     `json:"channel"`
	Unread       bool                            `json:"unread"`
	ActiveAt     int64                           `json:"active_at"`
	ActiveAtMs   int64                           `json:"active_at_ms"`
	FinalizeInfo *chat1.ConversationFinalizeInfo `json:"finalize_info,omitempty"`
	Supersedes   []string                        `json:"supersedes,omitempty"`
	SupersededBy []string                        `json:"superseded_by,omitempty"`
	Error        string                          `json:"error,omitempty"`
}

// ChatList is a list of conversations in the inbox.
type ChatList struct {
	Conversations    []ConvSummary                 `json:"conversations"`
	Offline          bool                          `json:"offline"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `json:"identify_failures,omitempty"`
	RateLimits
}

// SendRes is the result of successfully sending a message.
type SendRes struct {
	Message          string                        `json:"message"`
	IdentifyFailures []keybase1.TLFIdentifyFailure `json:"identify_failures,omitempty"`
	RateLimits
}

// EmptyRes is used for JSON output of a boring command.
type EmptyRes struct {
	RateLimits
}
