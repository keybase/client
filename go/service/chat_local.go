// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

// chatLocalHandler implements keybase1.chatLocal.
type chatLocalHandler struct {
	*BaseHandler
	libkb.Contextified
	gh    *gregorHandler
	boxer *chatBoxer

	// for test only
	rc chat1.RemoteInterface
}

// newChatLocalHandler creates a chatLocalHandler.
func newChatLocalHandler(xp rpc.Transporter, g *libkb.GlobalContext, gh *gregorHandler) *chatLocalHandler {
	return &chatLocalHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		gh:           gh,
		boxer:        newChatBoxer(g),
	}
}

// aggregateRateLimits takes a list of rate limit responses and dedups then to the last one received
// of each category
func (h *chatLocalHandler) aggRateLimits(rlimits []*chat1.RateLimit) (res []chat1.RateLimit) {
	m := make(map[string]chat1.RateLimit)
	for _, l := range rlimits {
		if l != nil {
			m[l.Name] = *l
		}
	}
	for _, v := range m {
		res = append(res, v)
	}
	return res
}

// GetInboxLocal implements keybase.chatLocal.getInboxLocal protocol.
func (h *chatLocalHandler) GetInboxLocal(ctx context.Context, arg chat1.GetInboxLocalArg) (chat1.GetInboxLocalRes, error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.GetInboxLocalRes{}, err
	}
	ib, err := h.remoteClient().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      arg.Query,
		Pagination: arg.Pagination,
	})
	return chat1.GetInboxLocalRes{
		Inbox:      ib.Inbox,
		RateLimits: h.aggRateLimits([]*chat1.RateLimit{ib.RateLimit}),
	}, err
}

// GetThreadLocal implements keybase.chatLocal.getThreadLocal protocol.
func (h *chatLocalHandler) GetThreadLocal(ctx context.Context, arg chat1.GetThreadLocalArg) (chat1.GetThreadLocalRes, error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.GetThreadLocalRes{}, err
	}
	rarg := chat1.GetThreadRemoteArg{
		ConversationID: arg.ConversationID,
		Query:          arg.Query,
		Pagination:     arg.Pagination,
	}
	boxed, err := h.remoteClient().GetThreadRemote(ctx, rarg)
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	thread, err := h.unboxThread(ctx, boxed.Thread, arg.ConversationID)
	if err != nil {
		return chat1.GetThreadLocalRes{}, err
	}

	return chat1.GetThreadLocalRes{
		Thread:     thread,
		RateLimits: h.aggRateLimits([]*chat1.RateLimit{boxed.RateLimit}),
	}, nil
}

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
func (h *chatLocalHandler) NewConversationLocal(ctx context.Context, info chat1.ConversationInfoLocal) (fres chat1.NewConversationLocalRes, err error) {
	h.G().Log.Debug("NewConversationLocal: %+v", info)
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.NewConversationLocalRes{}, err
	}
	res, err := h.boxer.tlf.CryptKeys(ctx, info.TlfName)
	if err != nil {
		return chat1.NewConversationLocalRes{}, fmt.Errorf("error getting crypt keys %s", err)
	}
	tlfIDb := res.TlfID.ToBytes()
	if tlfIDb == nil {
		return chat1.NewConversationLocalRes{}, errors.New("invalid TlfID acquired")
	}
	tlfID := chat1.TLFID(tlfIDb)

	info.Triple = chat1.ConversationIDTriple{
		Tlfid:     tlfID,
		TopicType: info.TopicType,
		TopicID:   make(chat1.TopicID, 16),
	}
	info.TlfName = string(res.CanonicalName)

	for i := 0; i < 3; i++ {
		if info.Triple.TopicType != chat1.TopicType_CHAT {
			// We only set topic ID if it's not CHAT. We are supporting only one
			// conversation per TLF now. A topic ID of 0s is intentional as it would
			// cause insertion failure in database.

			if info.Triple.TopicID, err = libkb.NewChatTopicID(); err != nil {
				return chat1.NewConversationLocalRes{}, fmt.Errorf("error creating topic ID: %s", err)
			}
		}

		firstMessageBoxed, err := h.prepareMessageForRemote(ctx, makeFirstMessage(ctx, info))
		if err != nil {
			return chat1.NewConversationLocalRes{}, fmt.Errorf("error preparing message: %s", err)
		}

		var res chat1.NewConversationRemoteRes
		res, err = h.remoteClient().NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
			IdTriple:   info.Triple,
			TLFMessage: *firstMessageBoxed,
		})
		fres.RateLimits = h.aggRateLimits([]*chat1.RateLimit{res.RateLimit})
		if err != nil {
			if cerr, ok := err.(libkb.ChatConvExistsError); ok {
				if info.Triple.TopicType == chat1.TopicType_CHAT {
					// A chat conversation already exists; just reuse it.
					info.Id = cerr.ConvID
					fres.Conv = info
					return fres, nil
				}

				// Not a chat conversation. Multiples are fine. Just retry with a
				// different topic ID.
				continue
			}
		}

		info.Id = res.ConvID
		fres.Conv = info

		return fres, nil
	}

	return chat1.NewConversationLocalRes{}, err
}

// UpdateTopicNameLocal implements keybase.chatLocal.updateTopicNameLocal protocol.
func (h *chatLocalHandler) UpdateTopicNameLocal(ctx context.Context, arg chat1.UpdateTopicNameLocalArg) (chat1.UpdateTopicNameLocalRes, error) {
	var rlimits []*chat1.RateLimit
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.UpdateTopicNameLocalRes{}, err
	}
	info, _, err := h.getConversationInfoByID(ctx, arg.ConversationID, &rlimits)
	if err != nil {
		return chat1.UpdateTopicNameLocalRes{}, err
	}
	plres, err := h.PostLocal(ctx, chat1.PostLocalArg{
		ConversationID:   info.Id,
		MessagePlaintext: makeUnboxedMessageToUpdateTopicName(ctx, info),
	})
	for _, rl := range plres.RateLimits {
		rlimits = append(rlimits, &rl)
	}
	if err != nil {
		return chat1.UpdateTopicNameLocalRes{}, err
	}
	return chat1.UpdateTopicNameLocalRes{
		RateLimits: h.aggRateLimits(rlimits),
	}, nil
}

func makeFirstMessage(ctx context.Context, conversationInfo chat1.ConversationInfoLocal) chat1.MessagePlaintext {
	if len(conversationInfo.TopicName) > 0 {
		return makeUnboxedMessageToUpdateTopicName(ctx, conversationInfo)
	}
	v1 := chat1.MessagePlaintextV1{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conversationInfo.Triple,
			TlfName:     conversationInfo.TlfName,
			TlfPublic:   conversationInfo.Visibility == chat1.TLFVisibility_PUBLIC,
			MessageType: chat1.MessageType_TLFNAME,
			Prev:        nil, // TODO
			// Sender and SenderDevice filled by PostLocal
		},
	}
	return chat1.NewMessagePlaintextWithV1(v1)
}

func makeUnboxedMessageToUpdateTopicName(ctx context.Context, conversationInfo chat1.ConversationInfoLocal) (messagePlaintext chat1.MessagePlaintext) {
	v1 := chat1.MessagePlaintextV1{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conversationInfo.Triple,
			TlfName:     conversationInfo.TlfName,
			TlfPublic:   conversationInfo.Visibility == chat1.TLFVisibility_PUBLIC,
			MessageType: chat1.MessageType_METADATA,
			Prev:        nil, // TODO
			// Sender and SenderDevice filled by PostLocal
		},
		MessageBody: chat1.NewMessageBodyWithMetadata(
			chat1.MessageConversationMetadata{
				ConversationTitle: conversationInfo.TopicName,
			}),
	}
	return chat1.NewMessagePlaintextWithV1(v1)
}

// GetOrCreateTextConversationLocal implements
// keybase.chatLocal.GetOrCreateTextConversationLocal protocol.
func (h *chatLocalHandler) ResolveConversationLocal(ctx context.Context, arg chat1.ConversationInfoLocal) (chat1.ResolveConversationLocalRes, error) {
	var rlimits []*chat1.RateLimit
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.ResolveConversationLocalRes{}, err
	}
	if arg.Id != 0 {
		info, _, err := h.getConversationInfoByID(ctx, arg.Id, &rlimits)
		if err != nil {
			return chat1.ResolveConversationLocalRes{}, err
		}
		return chat1.ResolveConversationLocalRes{
			Convs:      []chat1.ConversationInfoLocal{info},
			RateLimits: h.aggRateLimits(rlimits),
		}, nil
	}
	rcres, err := h.resolveConversations(ctx, arg, &rlimits)
	if err != nil {
		return chat1.ResolveConversationLocalRes{}, err
	}
	return chat1.ResolveConversationLocalRes{
		Convs:      rcres,
		RateLimits: h.aggRateLimits(rlimits),
	}, nil
}

func (h *chatLocalHandler) GetInboxSummaryLocal(ctx context.Context, arg chat1.GetInboxSummaryLocalArg) (res chat1.GetInboxSummaryLocalRes, err error) {
	if err = h.assertLoggedIn(ctx); err != nil {
		return chat1.GetInboxSummaryLocalRes{}, err
	}

	var after time.Time
	if len(arg.After) > 0 {
		after, err = parseTimeFromRFC3339OrDurationFromPast(arg.After)
		if err != nil {
			return chat1.GetInboxSummaryLocalRes{}, fmt.Errorf("parsing time or duration (%s) error: %s", arg.After, err)
		}
	}
	var before time.Time
	if len(arg.Before) > 0 {
		before, err = parseTimeFromRFC3339OrDurationFromPast(arg.Before)
		if err != nil {
			return chat1.GetInboxSummaryLocalRes{}, fmt.Errorf("parsing time or duration (%s) error: %s", arg.Before, err)
		}
	}

	var rpcArg chat1.GetInboxLocalArg
	if arg.Limit != 0 {
		rpcArg.Pagination = &chat1.Pagination{Num: arg.Limit}
	}
	var query chat1.GetInboxQuery
	if !after.IsZero() {
		gafter := gregor1.ToTime(after)
		query.After = &gafter
	}
	if !before.IsZero() {
		gbefore := gregor1.ToTime(before)
		query.Before = &gbefore
	}
	if arg.TopicType != chat1.TopicType_NONE {
		query.TopicType = &arg.TopicType
	}
	if arg.Visibility != chat1.TLFVisibility_ANY {
		query.TlfVisibility = &arg.Visibility
	}
	rpcArg.Query = &query

	iview, err := h.GetInboxLocal(ctx, rpcArg)
	if err != nil {
		return chat1.GetInboxSummaryLocalRes{}, err
	}
	for _, conv := range iview.Inbox.Conversations {
		info, maxMessages, err := h.getConversationInfo(ctx, conv)
		if err != nil {
			return chat1.GetInboxSummaryLocalRes{}, err
		}
		c := chat1.ConversationLocal{
			Info:     &info,
			Messages: maxMessages,
			ReadUpTo: conv.ReaderInfo.ReadMsgid,
		}
		res.Conversations = append(res.Conversations, c)
	}

	res.MoreTotal = 1000 // TODO: implement this on server
	res.RateLimits = iview.RateLimits

	return res, nil
}

// resolveConversations gets conversations from inbox using tlfName, topicName,
// and topicType fields in criteria, and returns all matching conversations.
// Conversation IDs are populated in returned conversations.
func (h *chatLocalHandler) resolveConversations(ctx context.Context,
	criteria chat1.ConversationInfoLocal,
	rlimits *[]*chat1.RateLimit) (conversations []chat1.ConversationInfoLocal, err error) {

	appendMaybe := func(info chat1.ConversationInfoLocal) {
		if len(criteria.TopicName) > 0 && criteria.TopicName != info.TopicName {
			h.G().Log.Debug("+ resolveConversations: FAILED TOPIC NAME, %s != %s", criteria.TopicName, info.TopicName)
			return
		}
		if criteria.TopicType != chat1.TopicType_NONE && criteria.TopicType != info.TopicType {
			h.G().Log.Debug("+ resolveConversations: FAILED TOPIC TYPE, %d != %d", criteria.TopicType, info.TopicType)
			return
		}
		conversations = append(conversations, info)
	}

	query := &chat1.GetInboxQuery{}

	if len(criteria.TlfName) != 0 {
		// TODO: do some caching in boxer so we don't end up calling this RPC
		// unnecessarily too often
		resp, err := h.boxer.tlf.CryptKeys(ctx, criteria.TlfName)
		if err != nil {
			return nil, err
		}
		tlfIDb := resp.TlfID.ToBytes()
		if tlfIDb == nil {
			return nil, errors.New("invalid TLF ID acquired")
		}
		criteria.TlfName = string(resp.CanonicalName)

		tlfID := chat1.TLFID(tlfIDb)
		query.TlfID = &tlfID
	}

	if criteria.Visibility != chat1.TLFVisibility_ANY {
		query.TlfVisibility = &criteria.Visibility
	}

	conversationsRemote, err := h.remoteClient().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      query,
		Pagination: nil,
	})
	*rlimits = append(*rlimits, conversationsRemote.RateLimit)
	if err != nil {
		return nil, err
	}
	for _, cr := range conversationsRemote.Inbox.Conversations {
		info, _, err := h.getConversationInfo(ctx, cr)
		if err != nil {
			return nil, err
		}
		if len(criteria.TlfName) > 0 && info.TlfName != criteria.TlfName {
			// check again using signed information to make sure it's the correct
			// conversation
			return nil, libkb.UnexpectedChatDataFromServer{Msg: fmt.Sprintf("Unexpected data is returned from server. We asked for %v, but got conversation for %v. TODO: handle tlfName changes properly for SBS case", criteria.TlfName, info.TlfName)}
		}
		appendMaybe(info)
	}

	h.G().Log.Debug("- resolveConversations: returning: %d messages", len(conversations))
	return conversations, nil
}

func (h *chatLocalHandler) getConversationInfoByID(ctx context.Context, id chat1.ConversationID,
	rlimits *[]*chat1.RateLimit) (conversationInfo chat1.ConversationInfoLocal, maxMessages []chat1.MessageFromServerOrError, err error) {
	res, err := h.remoteClient().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query: &chat1.GetInboxQuery{
			ConvID: &id,
		},
	})
	*rlimits = append(*rlimits, res.RateLimit)
	if err != nil {
		return chat1.ConversationInfoLocal{}, nil, err
	}
	if len(res.Inbox.Conversations) == 0 {
		return chat1.ConversationInfoLocal{}, nil, fmt.Errorf("unknown conversation: %v", id)
	}
	return h.getConversationInfo(ctx, res.Inbox.Conversations[0])
}

// getConversationInfo locates the conversation by using id, and returns with
// all fields filled in conversationInfo, along with a ConversationIDTriple
//
// TODO: cache
func (h *chatLocalHandler) getConversationInfo(ctx context.Context,
	conversationRemote chat1.Conversation) (conversationInfo chat1.ConversationInfoLocal, maxMessages []chat1.MessageFromServerOrError, err error) {

	conversationInfo.Id = conversationRemote.Metadata.ConversationID
	conversationInfo.TopicType = conversationRemote.Metadata.IdTriple.TopicType

	if len(conversationRemote.MaxMsgs) == 0 {
		return chat1.ConversationInfoLocal{}, nil,
			libkb.UnexpectedChatDataFromServer{Msg: "conversation has an empty MaxMsgs field"}
	}

	kf := newKeyFinder()
	var maxValidID chat1.MessageID
	var uimap *userInfoMapper
	ctx, uimap = getUserInfoMapper(ctx, h.G())
	for _, b := range conversationRemote.MaxMsgs {
		messagePlaintext, err := h.boxer.unboxMessage(ctx, kf, b)
		if err != nil {
			errMsg := err.Error()
			maxMessages = append(maxMessages, chat1.MessageFromServerOrError{
				UnboxingError: &errMsg,
			})
			continue
		}

		username, deviceName, err := h.getSenderInfoLocal(uimap, messagePlaintext)
		if err != nil {
			return chat1.ConversationInfoLocal{}, nil, err
		}
		maxMessages = append(maxMessages, chat1.MessageFromServerOrError{
			Message: &chat1.MessageFromServer{
				SenderUsername:   username,
				SenderDeviceName: deviceName,
				ServerHeader:     *b.ServerHeader,
				MessagePlaintext: messagePlaintext,
			},
		})

		version, err := messagePlaintext.Version()
		if err != nil {
			return chat1.ConversationInfoLocal{}, nil, err
		}
		switch version {
		case chat1.MessagePlaintextVersion_V1:
			body := messagePlaintext.V1().MessageBody
			if t, err := body.MessageType(); err != nil {
				return chat1.ConversationInfoLocal{}, nil, err
			} else if t == chat1.MessageType_METADATA {
				conversationInfo.TopicName = body.Metadata().ConversationTitle
			}
			if b.ServerHeader.MessageID >= maxValidID {
				conversationInfo.TlfName = messagePlaintext.V1().ClientHeader.TlfName
			}
			conversationInfo.Triple = messagePlaintext.V1().ClientHeader.Conv
		default:
			return chat1.ConversationInfoLocal{}, nil, libkb.NewChatMessageVersionError(version)
		}
	}

	if len(conversationInfo.TlfName) == 0 {
		return chat1.ConversationInfoLocal{}, nil, errors.New("no valid message in the conversation")
	}

	// verify Conv matches ConversationIDTriple in MessageClientHeader
	if !conversationRemote.Metadata.IdTriple.Eq(conversationInfo.Triple) {
		return chat1.ConversationInfoLocal{}, nil, errors.New("server header conversation triple does not match client header triple")
	}

	return conversationInfo, maxMessages, nil
}

func (h *chatLocalHandler) getSenderInfoLocal(uimap *userInfoMapper, messagePlaintext chat1.MessagePlaintext) (senderUsername string, senderDeviceName string, err error) {
	version, err := messagePlaintext.Version()
	if err != nil {
		return "", "", err
	}
	switch version {
	case chat1.MessagePlaintextVersion_V1:
		v1 := messagePlaintext.V1()
		uid := keybase1.UID(v1.ClientHeader.Sender.String())
		did := keybase1.DeviceID(v1.ClientHeader.SenderDevice.String())
		username, deviceName, err := uimap.lookup(uid, did)
		if err != nil {
			return "", "", err
		}

		return username, deviceName, nil

	default:
		return "", "", libkb.NewChatMessageVersionError(version)
	}
}

func (h *chatLocalHandler) makeConversationLocal(ctx context.Context, conversationRemote chat1.Conversation, messages []chat1.MessageFromServerOrError) (conversation chat1.ConversationLocal, err error) {
	if len(messages) == 0 {
		return chat1.ConversationLocal{}, errors.New("empty messages")
	}
	info, _, err := h.getConversationInfo(ctx, conversationRemote)
	if err != nil {
		return chat1.ConversationLocal{}, err
	}
	// TODO: verify info.TlfName by running through KBFS and compare with
	// message.MessagePlaintext.ClientHeader.TlfName,
	conversation = chat1.ConversationLocal{
		Info:     &info,
		Messages: messages,
		ReadUpTo: conversationRemote.ReaderInfo.ReadMsgid,
	}
	return conversation, nil
}

func (h *chatLocalHandler) getConversationMessages(ctx context.Context,
	conversationRemote chat1.Conversation, messageTypes map[chat1.MessageType]bool,
	selector *chat1.MessageSelector, rlimits *[]*chat1.RateLimit) (conv chat1.ConversationLocal, err error) {

	var since time.Time
	if selector.Since != nil {
		since, err = parseTimeFromRFC3339OrDurationFromPast(*selector.Since)
		if err != nil {
			return chat1.ConversationLocal{}, fmt.Errorf("parsing time or duration (%s) error: %s", *selector.Since, since)
		}
	}

	var messages []chat1.MessageFromServerOrError

	query := chat1.GetThreadQuery{
		MarkAsRead:   selector.MarkAsRead,
		MessageTypes: selector.MessageTypes,
	}
	if !since.IsZero() {
		gsince := gregor1.ToTime(since)
		query.After = &gsince
	}
	tview, err := h.GetThreadLocal(ctx, chat1.GetThreadLocalArg{
		ConversationID: conversationRemote.Metadata.ConversationID,
		Query:          &query,
	})
	for _, rl := range tview.RateLimits {
		*rlimits = append(*rlimits, &rl)
	}
	if err != nil {
		return chat1.ConversationLocal{}, err
	}

	for _, m := range tview.Thread.Messages {
		if selector.OnlyNew &&
			conversationRemote.ReaderInfo != nil && m.Message != nil &&
			m.Message.ServerHeader.MessageID <= conversationRemote.ReaderInfo.ReadMsgid {
			break
		}

		messages = append(messages, m)

		selector.Limit--
		if selector.Limit <= 0 {
			break
		}
	}

	if conv, err = h.makeConversationLocal(ctx, conversationRemote, messages); err != nil {
		return chat1.ConversationLocal{}, err
	}

	return conv, nil
}

// GetMessagesLocal implements keybase.chatLocal.GetMessagesLocal protocol.
func (h *chatLocalHandler) GetMessagesLocal(ctx context.Context, arg chat1.MessageSelector) (chat1.GetMessagesLocalRes, error) {
	var rlimits []*chat1.RateLimit
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.GetMessagesLocalRes{}, err
	}
	var messageTypes map[chat1.MessageType]bool
	if len(arg.MessageTypes) > 0 {
		messageTypes := make(map[chat1.MessageType]bool)
		for _, t := range arg.MessageTypes {
			messageTypes[t] = true
		}
	}

	if len(arg.Conversations) == 0 {
		return chat1.GetMessagesLocalRes{},
			libkb.InvalidArgumentError{Msg: "At least 1 conversation ID is required"}
	}

	if arg.Limit <= 0 {
		arg.Limit = int(^uint(0) >> 1) // maximum int
	}

	var conversations []chat1.ConversationLocal
	for _, cid := range arg.Conversations {
		res, err := h.remoteClient().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
			Query: &chat1.GetInboxQuery{
				ConvID: &cid,
			},
		})
		rlimits = append(rlimits, res.RateLimit)
		if err != nil {
			return chat1.GetMessagesLocalRes{}, fmt.Errorf("getting conversation %v error: %v", cid, err)
		}
		if len(res.Inbox.Conversations) == 0 {
			return chat1.GetMessagesLocalRes{}, fmt.Errorf("unknown conversation: %v", cid)
		}
		conversationLocal, err := h.getConversationMessages(ctx, res.Inbox.Conversations[0],
			messageTypes, &arg, &rlimits)
		if err != nil {
			return chat1.GetMessagesLocalRes{},
				fmt.Errorf("getting messages for conversation %v error: %v", cid, err)
		}
		if len(conversationLocal.Messages) != 0 {
			conversations = append(conversations, conversationLocal)
			arg.Limit -= len(conversationLocal.Messages)
			if arg.Limit <= 0 {
				break
			}
		}
	}

	return chat1.GetMessagesLocalRes{
		Msgs:       conversations,
		RateLimits: h.aggRateLimits(rlimits),
	}, nil
}

func (h *chatLocalHandler) addSenderToMessage(msg chat1.MessagePlaintext) (chat1.MessagePlaintext, error) {
	uid := h.G().Env.GetUID()
	if uid.IsNil() {
		return chat1.MessagePlaintext{}, libkb.LoginRequiredError{}
	}
	did := h.G().Env.GetDeviceID()
	if did.IsNil() {
		return chat1.MessagePlaintext{}, libkb.DeviceRequiredError{}
	}

	huid := uid.ToBytes()
	if huid == nil {
		return chat1.MessagePlaintext{}, errors.New("invalid UID")
	}

	hdid := make([]byte, libkb.DeviceIDLen)
	if err := did.ToBytes(hdid); err != nil {
		return chat1.MessagePlaintext{}, err
	}

	version, err := msg.Version()
	if err != nil {
		return chat1.MessagePlaintext{}, err
	}

	switch version {
	case chat1.MessagePlaintextVersion_V1:
		header := msg.V1().ClientHeader
		header.Sender = gregor1.UID(huid)
		header.SenderDevice = gregor1.DeviceID(hdid)
		updated := chat1.MessagePlaintextV1{
			ClientHeader: header,
			MessageBody:  msg.V1().MessageBody,
		}
		return chat1.NewMessagePlaintextWithV1(updated), nil
	default:
		return chat1.MessagePlaintext{}, libkb.NewChatMessageVersionError(version)
	}

}

func (h *chatLocalHandler) prepareMessageForRemote(ctx context.Context, plaintext chat1.MessagePlaintext) (*chat1.MessageBoxed, error) {
	msg, err := h.addSenderToMessage(plaintext)
	if err != nil {
		return nil, err
	}

	// encrypt the message
	skp, err := h.getSigningKeyPair()
	if err != nil {
		return nil, err
	}
	boxed, err := h.boxer.boxMessage(ctx, msg, skp)
	if err != nil {
		return nil, err
	}

	// TODO: populate plaintext.ClientHeader.Conv

	return boxed, nil
}

// PostLocal implements keybase.chatLocal.postLocal protocol.
func (h *chatLocalHandler) PostLocal(ctx context.Context, arg chat1.PostLocalArg) (chat1.PostLocalRes, error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return chat1.PostLocalRes{}, err
	}
	boxed, err := h.prepareMessageForRemote(ctx, arg.MessagePlaintext)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}

	// post to remote gregord
	rarg := chat1.PostRemoteArg{
		ConversationID: arg.ConversationID,
		MessageBoxed:   *boxed,
	}

	plres, err := h.remoteClient().PostRemote(ctx, rarg)
	if err != nil {
		return chat1.PostLocalRes{}, err
	}
	return chat1.PostLocalRes{
		RateLimits: h.aggRateLimits([]*chat1.RateLimit{plres.RateLimit}),
	}, nil
}

func (h *chatLocalHandler) getSigningKeyPair() (kp libkb.NaclSigningKeyPair, err error) {
	// get device signing key for this user
	signingKey, err := engine.GetMySecretKey(h.G(), h.getSecretUI, libkb.DeviceSigningKeyType, "sign chat message")
	if err != nil {
		return libkb.NaclSigningKeyPair{}, err
	}
	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return libkb.NaclSigningKeyPair{}, libkb.KeyCannotSignError{}
	}

	return kp, nil
}

// getSecretUI returns a SecretUI, preferring a delegated SecretUI if
// possible.
func (h *chatLocalHandler) getSecretUI() libkb.SecretUI {
	ui, err := h.G().UIRouter.GetSecretUI(0)
	if err == nil && ui != nil {
		h.G().Log.Debug("chatLocalHandler: using delegated SecretUI")
		return ui
	}
	h.G().Log.Debug("chatLocalHandler: using local SecretUI")
	return h.BaseHandler.getSecretUI(0, h.G())
}

// remoteClient returns a client connection to gregord.
func (h *chatLocalHandler) remoteClient() chat1.RemoteInterface {
	if h.rc != nil {
		return h.rc
	}
	return &chat1.RemoteClient{Cli: h.gh.cli}
}

// unboxThread transforms a chat1.ThreadViewBoxed to a keybase1.ThreadView.
func (h *chatLocalHandler) unboxThread(ctx context.Context, boxed chat1.ThreadViewBoxed, convID chat1.ConversationID) (chat1.ThreadView, error) {
	thread := chat1.ThreadView{
		Pagination: boxed.Pagination,
	}

	finder := newKeyFinder()
	var uimap *userInfoMapper
	ctx, uimap = getUserInfoMapper(ctx, h.G())
	for _, msg := range boxed.Messages {
		messagePlaintext, err := h.boxer.unboxMessage(ctx, finder, msg)
		if err != nil {
			errMsg := err.Error()
			thread.Messages = append(thread.Messages, chat1.MessageFromServerOrError{
				UnboxingError: &errMsg,
			})
			continue
		}

		username, deviceName, err := h.getSenderInfoLocal(uimap, messagePlaintext)
		if err != nil {
			return chat1.ThreadView{}, err
		}

		thread.Messages = append(thread.Messages, chat1.MessageFromServerOrError{
			Message: &chat1.MessageFromServer{
				SenderUsername:   username,
				SenderDeviceName: deviceName,
				ServerHeader:     *msg.ServerHeader,
				MessagePlaintext: messagePlaintext,
			},
		})
	}

	return thread, nil
}

func (h *chatLocalHandler) assertLoggedIn(ctx context.Context) error {
	ok, err := h.G().LoginState().LoggedInProvisionedLoad()
	if err != nil {
		return err
	}
	if !ok {
		return libkb.LoginRequiredError{}
	}
	return nil
}

// keyFinder remembers results from previous calls to CryptKeys().
// It is not intended to be used by multiple concurrent goroutines
// or held onto for very long, just to remember the keys while
// unboxing a thread of messages.
type keyFinder struct {
	keys map[string]keybase1.TLFCryptKeys
}

// newKeyFinder creates a keyFinder.
func newKeyFinder() *keyFinder {
	return &keyFinder{keys: make(map[string]keybase1.TLFCryptKeys)}
}

func (k *keyFinder) cacheKey(tlfName string, tlfPublic bool) string {
	return fmt.Sprintf("%s|%v", tlfName, tlfPublic)
}

// find finds keybase1.TLFCryptKeys for tlfName, checking for existing
// results.
func (k *keyFinder) find(ctx context.Context, tlf keybase1.TlfInterface, tlfName string, tlfPublic bool) (keybase1.TLFCryptKeys, error) {
	ckey := k.cacheKey(tlfName, tlfPublic)
	existing, ok := k.keys[ckey]
	if ok {
		return existing, nil
	}

	var keys keybase1.TLFCryptKeys
	if tlfPublic {
		cid, err := tlf.PublicCanonicalTLFNameAndID(ctx, tlfName)
		if err != nil {
			return keybase1.TLFCryptKeys{}, err
		}
		keys.CanonicalName = cid.CanonicalName
		keys.TlfID = cid.TlfID
		keys.CryptKeys = []keybase1.CryptKey{publicCryptKey}
	} else {
		var err error
		keys, err = tlf.CryptKeys(ctx, tlfName)
		if err != nil {
			return keybase1.TLFCryptKeys{}, err
		}
	}

	k.keys[ckey] = keys

	return keys, nil
}
