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
	gh             *gregorHandler
	boxer          *chatBoxer
	userInfoMapper userInfoMapper

	// for test only
	rc chat1.RemoteInterface
}

// newChatLocalHandler creates a chatLocalHandler.
func newChatLocalHandler(xp rpc.Transporter, g *libkb.GlobalContext, gh *gregorHandler) *chatLocalHandler {
	return &chatLocalHandler{
		BaseHandler:    NewBaseHandler(xp),
		Contextified:   libkb.NewContextified(g),
		gh:             gh,
		boxer:          newChatBoxer(g),
		userInfoMapper: userInfoMapper{g: g},
	}
}

// GetInboxLocal implements keybase.chatLocal.getInboxLocal protocol.
func (h *chatLocalHandler) GetInboxLocal(ctx context.Context, arg chat1.GetInboxLocalArg) (chat1.InboxView, error) {

	ib, err := h.remoteClient().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query:      arg.Query,
		Pagination: arg.Pagination,
	})
	return ib.Inbox, err
}

// GetThreadLocal implements keybase.chatLocal.getThreadLocal protocol.
func (h *chatLocalHandler) GetThreadLocal(ctx context.Context, arg chat1.GetThreadLocalArg) (chat1.ThreadView, error) {
	rarg := chat1.GetThreadRemoteArg{
		ConversationID: arg.ConversationID,
		Query:          arg.Query,
		Pagination:     arg.Pagination,
	}
	boxed, err := h.remoteClient().GetThreadRemote(ctx, rarg)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	return h.unboxThread(ctx, boxed.Thread, arg.ConversationID)
}

func retryWithoutBackoffUpToNTimesUntilNoError(n int, action func() (bool, error)) (err error) {
	retriable := true
	for ; retriable && n > 0; n-- {
		retriable, err = action()
		if err == nil {
			return nil
		}
	}
	return err
}

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
func (h *chatLocalHandler) NewConversationLocal(ctx context.Context, info chat1.ConversationInfoLocal) (created chat1.ConversationInfoLocal, err error) {
	h.G().Log.Debug("NewConversationLocal: %+v", info)
	res, err := h.boxer.tlf.CryptKeys(ctx, info.TlfName)
	if err != nil {
		return created, fmt.Errorf("error getting crypt keys %s", err)
	}
	tlfIDb := res.TlfID.ToBytes()
	if tlfIDb == nil {
		return created, errors.New("invalid TlfID acquired")
	}
	tlfID := chat1.TLFID(tlfIDb)

	triple := chat1.ConversationIDTriple{
		Tlfid:     tlfID,
		TopicType: info.TopicType,
		TopicID:   make(chat1.TopicID, 16),
	}
	info.TlfName = string(res.CanonicalName)

	if err = retryWithoutBackoffUpToNTimesUntilNoError(3, func() (retriable bool, err error) {
		if triple.TopicType != chat1.TopicType_CHAT {
			// We only set topic ID if it's not CHAT. We are supporting only one
			// conversation per TLF now. A topic ID of 0s is intentional as it would
			// cause insertion failure in database.

			if triple.TopicID, err = libkb.NewChatTopicID(); err != nil {
				return false, fmt.Errorf("error creating topic ID: %s", err)
			}
		}

		firstMessageBoxed, err := h.prepareMessageForRemote(ctx, makeFirstMessage(ctx, info, triple))
		if err != nil {
			return false, fmt.Errorf("error preparing message: %s", err)
		}

		res, err := h.remoteClient().NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
			IdTriple:   triple,
			TLFMessage: *firstMessageBoxed,
		})
		if err != nil {
			if triple.TopicType == chat1.TopicType_CHAT {
				// If a chat conversation already exists, server should just return it.
				// So this must be something else.
				return false, err
			}

			// Not a chat conversation. Multiples are fine.
			// TODO: after we have exportable errors in gregor, only retry on topic
			// ID duplication.
			return true, err
		}
		info.Id = res.ConvID
		created = info

		return false, nil
	}); err != nil {
		return created, err
	}

	return created, nil
}

// UpdateTopicNameLocal implements keybase.chatLocal.updateTopicNameLocal protocol.
func (h *chatLocalHandler) UpdateTopicNameLocal(ctx context.Context, arg chat1.UpdateTopicNameLocalArg) (err error) {
	info, triple, _, err := h.getConversationInfoByID(ctx, arg.ConversationID)
	return h.PostLocal(ctx, chat1.PostLocalArg{
		ConversationID:   info.Id,
		MessagePlaintext: makeUnboxedMessageToUpdateTopicName(ctx, info, triple),
	})
}

func makeFirstMessage(ctx context.Context, conversationInfo chat1.ConversationInfoLocal, triple chat1.ConversationIDTriple) chat1.MessagePlaintext {
	if len(conversationInfo.TopicName) > 0 {
		return makeUnboxedMessageToUpdateTopicName(ctx, conversationInfo, triple)
	}
	v1 := chat1.MessagePlaintextV1{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        triple,
			TlfName:     conversationInfo.TlfName,
			MessageType: chat1.MessageType_TLFNAME,
			Prev:        nil, // TODO
			// Sender and SenderDevice filled by PostLocal
		},
	}
	return chat1.NewMessagePlaintextWithV1(v1)
}

func makeUnboxedMessageToUpdateTopicName(ctx context.Context, conversationInfo chat1.ConversationInfoLocal, triple chat1.ConversationIDTriple) (unboxed chat1.MessagePlaintext) {
	v1 := chat1.MessagePlaintextV1{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        triple,
			TlfName:     conversationInfo.TlfName,
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
func (h *chatLocalHandler) ResolveConversationLocal(ctx context.Context, arg chat1.ConversationInfoLocal) (conversations []chat1.ConversationInfoLocal, err error) {
	if arg.Id != 0 {
		info, _, _, err := h.getConversationInfoByID(ctx, arg.Id)
		if err != nil {
			return nil, err
		}
		return []chat1.ConversationInfoLocal{info}, nil
	}
	return h.resolveConversations(ctx, arg)
}

func (h *chatLocalHandler) GetInboxSummaryLocal(ctx context.Context, arg chat1.GetInboxSummaryLocalArg) (res chat1.GetInboxSummaryLocalRes, err error) {

	var after time.Time
	if len(arg.After) > 0 {
		after, err = parseTimeFromRFC3339OrDurationFromPast(arg.After)
		if err != nil {
			return res, fmt.Errorf("parsing time or duration (%s) error: %s", arg.After, err)
		}
	}
	var before time.Time
	if len(arg.Before) > 0 {
		before, err = parseTimeFromRFC3339OrDurationFromPast(arg.Before)
		if err != nil {
			return res, fmt.Errorf("parsing time or duration (%s) error: %s", arg.Before, err)
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
	rpcArg.Query = &query

	iview, err := h.GetInboxLocal(ctx, rpcArg)
	if err != nil {
		return res, err
	}
	for _, conv := range iview.Conversations {
		info, _, maxMessages, err := h.getConversationInfo(ctx, conv)
		if err != nil {
			return res, err
		}
		c := chat1.ConversationLocal{
			Id:       info.Id,
			Info:     &info,
			Messages: maxMessages,
		}
		res.Conversations = append(res.Conversations, c)
	}

	res.MoreTotal = 1000 // TODO: implement this on server

	return res, nil
}

// resolveConversations gets conversations from inbox using tlfName, topicName,
// and topicType fields in criteria, and returns all matching conversations.
// Conversation IDs are populated in returned conversations.
func (h *chatLocalHandler) resolveConversations(ctx context.Context, criteria chat1.ConversationInfoLocal) (conversations []chat1.ConversationInfoLocal, err error) {
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

	if len(criteria.TlfName) == 0 {
		return nil, errors.New("unexpected criteria: empty TlfName")
	}
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
	conversationsRemote, err := h.remoteClient().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query: &chat1.GetInboxQuery{
			TlfID: &tlfID,
		},
		Pagination: nil,
	})
	if err != nil {
		return nil, err
	}
	for _, cr := range conversationsRemote.Inbox.Conversations {
		info, _, _, err := h.getConversationInfo(ctx, cr)
		if err != nil {
			return nil, err
		}
		if info.TlfName != criteria.TlfName {
			// check again using signed information to make sure it's the correct
			// conversation
			return nil, libkb.UnexpectedChatDataFromServer{Msg: fmt.Sprintf("Unexpected data is returned from server. We asked for %v, but got conversation for %v. TODO: handle tlfName changes properly for SBS case", criteria.TlfName, info.TlfName)}
		}
		appendMaybe(info)
	}

	h.G().Log.Debug("- resolveConversations: returning: %d messages", len(conversations))
	return conversations, nil
}

func (h *chatLocalHandler) getConversationInfoByID(ctx context.Context, id chat1.ConversationID) (conversationInfo chat1.ConversationInfoLocal, triple chat1.ConversationIDTriple, maxMessages []chat1.Message, err error) {
	res, err := h.remoteClient().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query: &chat1.GetInboxQuery{
			ConvID: &id,
		},
	})
	if err != nil {
		return conversationInfo, triple, maxMessages, err
	}
	if len(res.Inbox.Conversations) == 0 {
		return conversationInfo, triple, maxMessages, fmt.Errorf("unknown conversation: %v", id)
	}
	return h.getConversationInfo(ctx, res.Inbox.Conversations[0])
}

// getConversationInfo locates the conversation by using id, and returns with
// all fields filled in conversationInfo, along with a ConversationIDTriple
//
// TODO: cache
func (h *chatLocalHandler) getConversationInfo(ctx context.Context, conversationRemote chat1.Conversation) (conversationInfo chat1.ConversationInfoLocal, triple chat1.ConversationIDTriple, maxMessages []chat1.Message, err error) {

	conversationInfo.Id = conversationRemote.Metadata.ConversationID
	conversationInfo.TopicType = conversationRemote.Metadata.IdTriple.TopicType

	if len(conversationRemote.MaxMsgs) == 0 {
		return conversationInfo, triple, maxMessages,
			libkb.UnexpectedChatDataFromServer{Msg: "conversation has an empty MaxMsgs field"}
	}

	for _, b := range conversationRemote.MaxMsgs {
		unboxed, err := h.boxer.unboxMessage(ctx, newKeyFinder(), b)
		if err != nil {
			return conversationInfo, triple, maxMessages, err
		}

		maxMessages = append(maxMessages, unboxed)

		version, err := unboxed.MessagePlaintext.Version()
		if err != nil {
			return conversationInfo, triple, maxMessages, err
		}
		switch version {
		case chat1.MessagePlaintextVersion_V1:
			body := unboxed.MessagePlaintext.V1().MessageBody
			if t, err := body.MessageType(); err != nil {
				return conversationInfo, triple, maxMessages, err
			} else if t == chat1.MessageType_METADATA {
				conversationInfo.TopicName = body.Metadata().ConversationTitle
			}
			if unboxed.ServerHeader.MessageID.String() == conversationRemote.ReaderInfo.MaxMsgid.String() {
				conversationInfo.TlfName = unboxed.MessagePlaintext.V1().ClientHeader.TlfName
			}
		default:
			return conversationInfo, triple, maxMessages, libkb.NewChatMessageVersionError(version)
		}

	}

	if len(conversationInfo.TlfName) == 0 {
		return conversationInfo, triple, maxMessages, errors.New("unexpected response from server: global MaxMsgid is not present in MaxHeaders")
	}

	// TODO: verify Conv matches ConversationIDTriple in MessageClientHeader

	return conversationInfo, triple, maxMessages, nil
}

func (h *chatLocalHandler) fillMessageInfoLocal(ctx context.Context, m *chat1.Message, isNew bool) (err error) {
	m.Info = &chat1.MessageInfoLocal{
		IsNew: isNew,
	}
	version, err := m.MessagePlaintext.Version()
	if err != nil {
		return err
	}
	switch version {
	case chat1.MessagePlaintextVersion_V1:
		if m.Info.SenderUsername, err = h.userInfoMapper.getUsername(ctx, keybase1.UID(m.MessagePlaintext.V1().ClientHeader.Sender.String())); err != nil {
			return err
		}
		if m.Info.SenderDeviceName, err = h.userInfoMapper.getDeviceName(ctx, keybase1.DeviceID(m.MessagePlaintext.V1().ClientHeader.SenderDevice.String())); err != nil {
			return err
		}
		return nil
	default:
		return libkb.NewChatMessageVersionError(version)
	}
}

func (h *chatLocalHandler) makeConversationLocal(ctx context.Context, conversationRemote chat1.Conversation, messages []chat1.Message) (conversation chat1.ConversationLocal, err error) {
	if len(messages) == 0 {
		return conversation, errors.New("empty messages")
	}
	info, _, _, err := h.getConversationInfo(ctx, conversationRemote)
	if err != nil {
		return conversation, err
	}
	// TODO: verify info.TlfName by running through KBFS and compare with
	// message.MessagePlaintext.ClientHeader.TlfName,
	conversation = chat1.ConversationLocal{
		Info:     &info,
		Id:       conversationRemote.Metadata.ConversationID,
		Messages: messages,
	}
	return conversation, err
}

func (h *chatLocalHandler) getConversationMessages(ctx context.Context, conversationRemote chat1.Conversation, messageTypes map[chat1.MessageType]bool, selector *chat1.MessageSelector) (conv chat1.ConversationLocal, err error) {
	var since time.Time
	if selector.Since != nil {
		since, err := parseTimeFromRFC3339OrDurationFromPast(*selector.Since)
		if err != nil {
			return conv, fmt.Errorf("parsing time or duration (%s) error: %s", *selector.Since, since)
		}
	}

	var messages []chat1.Message

	query := chat1.GetThreadQuery{
		MarkAsRead:   selector.MarkAsRead,
		MessageTypes: selector.MessageTypes,
	}
	if !since.IsZero() {
		gsince := gregor1.ToTime(since)
		query.Before = &gsince
	}
	tview, err := h.GetThreadLocal(ctx, chat1.GetThreadLocalArg{
		ConversationID: conversationRemote.Metadata.ConversationID,
		Query:          &query,
	})
	if err != nil {
		return conv, err
	}

	for _, m := range tview.Messages {
		isNew := false
		if conversationRemote.ReaderInfo != nil && m.ServerHeader.MessageID > conversationRemote.ReaderInfo.ReadMsgid {
			isNew = true
		}

		if selector.OnlyNew && !isNew {
			// new messages are in front, so at this point we can stop fetching
			break
		}

		h.fillMessageInfoLocal(ctx, &m, isNew)

		messages = append(messages, m)

		selector.Limit--
		if selector.Limit <= 0 {
			break
		}
	}

	if conv, err = h.makeConversationLocal(ctx, conversationRemote, messages); err != nil {
		return conv, err
	}

	return conv, err
}

// GetMessagesLocal implements keybase.chatLocal.GetMessagesLocal protocol.
func (h *chatLocalHandler) GetMessagesLocal(ctx context.Context, arg chat1.MessageSelector) (conversations []chat1.ConversationLocal, err error) {
	var messageTypes map[chat1.MessageType]bool
	if len(arg.MessageTypes) > 0 {
		messageTypes := make(map[chat1.MessageType]bool)
		for _, t := range arg.MessageTypes {
			messageTypes[t] = true
		}
	}

	if len(arg.Conversations) == 0 {
		return nil, libkb.InvalidArgumentError{Msg: "At least 1 conversation ID is required"}
	}

	if arg.Limit <= 0 {
		arg.Limit = int(^uint(0) >> 1) // maximum int
	}

	for _, cid := range arg.Conversations {
		res, err := h.remoteClient().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
			Query: &chat1.GetInboxQuery{
				ConvID: &cid,
			},
		})
		if err != nil {
			return nil, fmt.Errorf("getting conversation %v error: %v", cid, err)
		}
		if len(res.Inbox.Conversations) == 0 {
			return nil, fmt.Errorf("unknown conversation: %v", cid)
		}
		conversationLocal, err := h.getConversationMessages(ctx, res.Inbox.Conversations[0],
			messageTypes, &arg)
		if err != nil {
			return nil, fmt.Errorf("getting messages for conversation %v error: %v", cid, err)
		}
		if len(conversationLocal.Messages) != 0 {
			conversations = append(conversations, conversationLocal)
			arg.Limit -= len(conversationLocal.Messages)
			if arg.Limit <= 0 {
				break
			}
		}
	}

	return conversations, nil
}

func (h *chatLocalHandler) addSenderToMessage(msg chat1.MessagePlaintext) (chat1.MessagePlaintext, error) {
	ok, err := h.G().LoginState().LoggedInProvisionedLoad()
	if err != nil {
		return msg, err
	}
	if !ok {
		return msg, libkb.LoginRequiredError{}
	}

	uid := h.G().Env.GetUID()
	if uid.IsNil() {
		return msg, libkb.LoginRequiredError{}
	}
	did := h.G().Env.GetDeviceID()
	if did.IsNil() {
		return msg, libkb.DeviceRequiredError{}
	}

	huid := uid.ToBytes()
	if huid == nil {
		return msg, errors.New("invalid UID")
	}

	hdid := make([]byte, libkb.DeviceIDLen)
	if err = did.ToBytes(hdid); err != nil {
		return msg, err
	}

	version, err := msg.Version()
	if err != nil {
		return msg, err
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
		return msg, libkb.NewChatMessageVersionError(version)
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
func (h *chatLocalHandler) PostLocal(ctx context.Context, arg chat1.PostLocalArg) error {
	boxed, err := h.prepareMessageForRemote(ctx, arg.MessagePlaintext)
	if err != nil {
		return err
	}

	// post to remote gregord
	rarg := chat1.PostRemoteArg{
		ConversationID: arg.ConversationID,
		MessageBoxed:   *boxed,
	}

	_, err = h.remoteClient().PostRemote(ctx, rarg)
	return err
}

func (h *chatLocalHandler) getSigningKeyPair() (kp libkb.NaclSigningKeyPair, err error) {
	// get device signing key for this user
	signingKey, err := engine.GetMySecretKey(h.G(), h.getSecretUI, libkb.DeviceSigningKeyType, "sign chat message")
	if err != nil {
		return kp, err
	}
	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return kp, libkb.KeyCannotSignError{}
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
	for _, msg := range boxed.Messages {
		unboxed, err := h.boxer.unboxMessage(ctx, finder, msg)
		if err != nil {
			return chat1.ThreadView{}, err
		}

		thread.Messages = append(thread.Messages, unboxed)
	}

	return thread, nil
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

// find finds keybase1.TLFCryptKeys for tlfName, checking for existing
// results.
func (k *keyFinder) find(ctx context.Context, tlf keybase1.TlfInterface, tlfName string) (keybase1.TLFCryptKeys, error) {
	existing, ok := k.keys[tlfName]
	if ok {
		return existing, nil
	}

	keys, err := tlf.CryptKeys(ctx, tlfName)
	if err != nil {
		return keybase1.TLFCryptKeys{}, err
	}

	k.keys[tlfName] = keys

	return keys, nil
}
