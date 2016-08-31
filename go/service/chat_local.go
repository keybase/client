// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/hex"
	"encoding/json"
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
func (h *chatLocalHandler) GetInboxLocal(ctx context.Context, p *chat1.Pagination) (chat1.InboxView, error) {
	return h.remoteClient().GetInboxRemote(ctx, p)
}

// GetThreadLocal implements keybase.chatLocal.getThreadLocal protocol.
func (h *chatLocalHandler) GetThreadLocal(ctx context.Context, arg keybase1.GetThreadLocalArg) (keybase1.ThreadView, error) {
	rarg := chat1.GetThreadRemoteArg{
		ConversationID: arg.ConversationID,
		MarkAsRead:     arg.MarkAsRead,
		Pagination:     arg.Pagination,
	}
	boxed, err := h.remoteClient().GetThreadRemote(ctx, rarg)
	if err != nil {
		return keybase1.ThreadView{}, err
	}

	return h.unboxThread(ctx, boxed, arg.ConversationID)
}

func retryUpToNTimesUntilNoError(n int, action func() error) (err error) {
	for ; n > 0; n-- {
		err = action()
		if err == nil {
			return
		}
	}
	return err
}

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
func (h *chatLocalHandler) NewConversationLocal(ctx context.Context, info keybase1.ConversationInfoLocal) (created keybase1.ConversationInfoLocal, err error) {
	res, err := h.boxer.tlf.CryptKeys(ctx, info.TlfName)
	if err != nil {
		return created, err
	}
	tlfIDb, err := hex.DecodeString(string(res.TlfID))
	if err != nil {
		return created, err
	}
	tlfID := chat1.TLFID(tlfIDb)

	triple := chat1.ConversationIDTriple{
		Tlfid:     tlfID,
		TopicType: info.TopicType,
		TopicID:   make(chat1.TopicID, 16),
	}
	info.TlfName = string(res.CanonicalName)

	if err = retryUpToNTimesUntilNoError(3, func() (err error) {
		if triple.TopicID, err = libkb.NewChatTopicID(); err != nil {
			return err
		}
		if info.Id, err = h.remoteClient().NewConversationRemote(ctx, triple); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return created, err
	}

	created = info

	if len(info.TopicName) > 0 {
		// topic name specified, so we follow up with a call to update topic name for the conversation.
		if err = h.updateTopicName(ctx, info, triple); err != nil {
			return created, fmt.Errorf("creating conversaion succeeded but update topic name failed: %v", err)
		}
	}

	return created, nil
}

// UpdateTopicNameLocal implements keybase.chatLocal.updateTopicNameLocal protocol.
func (h *chatLocalHandler) UpdateTopicNameLocal(ctx context.Context, arg keybase1.UpdateTopicNameLocalArg) (err error) {
	info, triple, _, err := h.getConversationInfo(ctx, arg.ConversationID)
	return h.updateTopicName(ctx, info, triple)
}

func (h *chatLocalHandler) updateTopicName(ctx context.Context, conversationInfo keybase1.ConversationInfoLocal, triple chat1.ConversationIDTriple) (err error) {
	err = h.PostLocal(ctx, keybase1.PostLocalArg{
		ConversationID: conversationInfo.Id,
		MessagePlaintext: keybase1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        triple,
				TlfName:     conversationInfo.TlfName,
				MessageType: chat1.MessageType_METADATA,
				Prev:        nil, // TODO
				// Sender and SenderDevice filled by PostLocal
			},
			MessageBodies: []keybase1.MessageBody{keybase1.MessageBody{
				Type: chat1.MessageType_METADATA,
				ConversationMetadata: &keybase1.MessageConversationMetadata{
					ConversationTitle: conversationInfo.TopicName,
				},
			}},
		},
	})
	return err
}

func (h *chatLocalHandler) CompleteAndCanonicalizeTlfName(ctx context.Context, tlfName string) (res keybase1.CanonicalTlfName, err error) {
	username := h.G().Env.GetUsername()
	if len(username) == 0 {
		return res, fmt.Errorf("Username is empty. Are you logged in?")
	}

	// Append username in case it's not present. We don't need to check if it
	// exists already since CryptKeys calls below transforms the TLF name into a
	// canonical one.
	tlfName = tlfName + "," + string(username)

	// TODO: do some caching in boxer so we don't end up calling this RPC
	// unnecessarily too often
	resp, err := h.boxer.tlf.CryptKeys(ctx, tlfName)
	if err != nil {
		return "", err
	}

	return resp.CanonicalName, nil
}

func latestTimestampFromConversation(conv chat1.Conversation) (t time.Time) {
	for _, h := range conv.MaxHeaders {
		ct := gregor1.FromTime(h.Ctime)
		if ct.After(t) {
			t = ct
		}
	}
	return t
}

// GetOrCreateTextConversationLocal implements
// keybase.chatLocal.GetOrCreateTextConversationLocal protocol.
func (h *chatLocalHandler) ResolveConversationLocal(ctx context.Context, arg keybase1.ConversationInfoLocal) (conversations []keybase1.ResolvedConversationLocal, err error) {
	if arg.Id != 0 {
		info, _, lastUpdated, err := h.getConversationInfo(ctx, arg.Id)
		if err != nil {
			return nil, err
		}
		return []keybase1.ResolvedConversationLocal{
			keybase1.ResolvedConversationLocal{
				Conversation: info,
				Timestamp:    keybase1.ToTime(lastUpdated),
			},
		}, nil
	}
	return h.searchForConversations(ctx, arg)
}

// searchForConversations searches for conversations using tlfName, topicName,
// and topicType fields in criteria, and returns all matching conversations.
// Conversation IDs are populated in returned conversations.
func (h *chatLocalHandler) searchForConversations(ctx context.Context, criteria keybase1.ConversationInfoLocal) (conversations []keybase1.ResolvedConversationLocal, err error) {
	ipagination := &chat1.Pagination{Num: 20}
getinbox:
	for i := 0; i < 10000; /* in case we have a server bug */ i++ {
		iview, err := h.GetInboxLocal(ctx, ipagination)
		if err != nil {
			return conversations, err
		}
		for _, conv := range iview.Conversations {
			info, _, lastUpdated, err := h.getConversationInfo(ctx, conv.Metadata.ConversationID)
			if err != nil {
				return conversations, err
			}
			if len(criteria.TlfName) > 0 && criteria.TlfName != info.TlfName {
				continue
			}
			if len(criteria.TopicName) > 0 && criteria.TopicName != info.TopicName {
				continue
			}
			if criteria.TopicType != chat1.TopicType_NONE && criteria.TopicType != info.TopicType {
				continue
			}
			conversations = append(conversations, keybase1.ResolvedConversationLocal{
				Conversation: info,
				Timestamp:    keybase1.ToTime(lastUpdated),
			})
		}

		if iview.Pagination == nil || iview.Pagination.Last {
			break getinbox
		} else {
			ipagination = iview.Pagination
		}
	}

	return conversations, nil
}

// getConversationInfo locates the conversation by using id, and returns with
// all fields filled in conversationInfo, along with a ConversationIDTriple
//
// TODO: cache
func (h *chatLocalHandler) getConversationInfo(ctx context.Context, id chat1.ConversationID) (conversationInfo keybase1.ConversationInfoLocal, triple chat1.ConversationIDTriple, lastUpdated time.Time, err error) {
	ipagination := &chat1.Pagination{Num: 20}
getinbox:
	for i := 0; i < 10000; /* in case we have a server bug */ i++ {
		iview, err := h.GetInboxLocal(ctx, ipagination)
		if err != nil {
			return conversationInfo, triple, lastUpdated, err
		}

		for _, conversation := range iview.Conversations {
			if id == conversation.Metadata.ConversationID {
				triple = conversation.Metadata.IdTriple
				conversationInfo.Id = id
				conversationInfo.TopicType = triple.TopicType

				if len(conversation.MaxHeaders) == 0 {
					return conversationInfo, triple, lastUpdated, errors.New("empty conversation found")
				}

				// if no METADATA message exists, just use the first one to get TLF Name
				messageID := conversation.MaxHeaders[0].MessageID
				for _, header := range conversation.MaxHeaders {
					if header.MessageType == chat1.MessageType_METADATA {
						messageID = header.MessageID
						break
					}
				}

				boxed, err := h.remoteClient().GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
					ConversationID: id,
					MessageIDs:     []chat1.MessageID{messageID},
				})
				if err != nil {
					return conversationInfo, triple, lastUpdated, err
				}
				if len(boxed) != 1 {
					return conversationInfo, triple, lastUpdated, fmt.Errorf("unexpected number of messages (got %d, expected 1) from GetMessagesRemote", len(boxed))
				}
				unboxed, err := h.boxer.unboxMessage(ctx, newKeyFinder(), boxed[0])
				if err != nil {
					continue
				}
				if len(unboxed.MessagePlaintext.MessageBodies) < 1 {
					return conversationInfo, triple, lastUpdated, errors.New("empty MessageBodies")
				}
				body := unboxed.MessagePlaintext.MessageBodies[0]
				conversationInfo.TlfName = unboxed.MessagePlaintext.ClientHeader.TlfName
				if body.Type == chat1.MessageType_METADATA && body.ConversationMetadata != nil {
					conversationInfo.TopicName = body.ConversationMetadata.ConversationTitle
				}

				lastUpdated = latestTimestampFromConversation(conversation)

				return conversationInfo, triple, lastUpdated, nil
			}
		}

		if iview.Pagination == nil || iview.Pagination.Last {
			break getinbox
		} else {
			ipagination = iview.Pagination
		}
	}

	return conversationInfo, triple, lastUpdated, errors.New("conversation not found")
}

func (h *chatLocalHandler) fillMessageInfoLocal(ctx context.Context, m *keybase1.Message, isNew bool) (err error) {
	m.Info = &keybase1.MessageInfoLocal{
		IsNew: isNew,
	}
	if m.Info.SenderUsername, err = h.userInfoMapper.getUsername(ctx, keybase1.UID(m.MessagePlaintext.ClientHeader.Sender.String())); err != nil {
		return err
	}
	if m.Info.SenderDeviceName, err = h.userInfoMapper.getDeviceName(ctx, keybase1.DeviceID(m.MessagePlaintext.ClientHeader.SenderDevice.String())); err != nil {
		return err
	}
	return nil
}

func (h *chatLocalHandler) makeConversationLocal(ctx context.Context, conversationMetadata chat1.ConversationMetadata, messages []keybase1.Message) (conversation keybase1.ConversationLocal, err error) {
	if len(messages) == 0 {
		return conversation, errors.New("empty messages")
	}
	info, _, _, err := h.getConversationInfo(ctx, conversationMetadata.ConversationID)
	if err != nil {
		return conversation, err
	}
	// TODO: verify info.TlfName by running through KBFS and compare with
	// message.MessagePlaintext.ClientHeader.TlfName,
	conversation = keybase1.ConversationLocal{
		Info:     &info,
		Id:       conversationMetadata.ConversationID,
		Messages: messages,
	}
	return conversation, err
}

func (h *chatLocalHandler) getConversationMessages(ctx context.Context, conversation *chat1.Conversation, messageTypes map[chat1.MessageType]bool, selector *keybase1.MessageSelector) (conv keybase1.ConversationLocal, err error) {
	var since time.Time
	if selector.Since != nil {
		since, err := parseTimeFromRFC3339OrDurationFromPast(*selector.Since)
		if err != nil {
			return conv, fmt.Errorf("parsing time or duration (%s) error: %s", *selector.Since, since)
		}
	}

	var messages []keybase1.Message

	tpagination := &chat1.Pagination{Num: 20}
getthread:
	for i := 0; i < 10000; /* in case we have a server bug */ i++ {
		tview, err := h.GetThreadLocal(ctx, keybase1.GetThreadLocalArg{
			ConversationID: conversation.Metadata.ConversationID,
			MarkAsRead:     selector.MarkAsRead,
			Pagination:     tpagination,
		})
		if err != nil {
			return conv, err
		}

		for _, m := range tview.Messages {
			if len(m.MessagePlaintext.MessageBodies) == 0 {
				continue
			}

			if messageTypes != nil && !messageTypes[m.MessagePlaintext.MessageBodies[0].Type] {
				continue
			}

			if !since.IsZero() && gregor1.FromTime(m.ServerHeader.Ctime).Before(since) {
				// messages are sorted DESC by time, so at this point we can stop fetching
				break getthread
			}

			isNew := false
			if conversation.ReaderInfo != nil && m.ServerHeader.MessageID > conversation.ReaderInfo.ReadMsgid {
				isNew = true
			}

			if selector.OnlyNew && !isNew {
				// new messages are in front, so at this point we can stop fetching
				break getthread
			}

			h.fillMessageInfoLocal(ctx, &m, isNew)

			messages = append(messages, m)

			selector.Limit--
			if selector.Limit <= 0 {
				break getthread
			}
		}

		if tview.Pagination == nil || tview.Pagination.Last {
			break getthread
		} else {
			tpagination = tview.Pagination
		}
	}

	if conv, err = h.makeConversationLocal(ctx, conversation.Metadata, messages); err != nil {
		return conv, err
	}

	return conv, err
}

// GetMessagesLocal implements keybase.chatLocal.GetMessagesLocal protocol.
func (h *chatLocalHandler) GetMessagesLocal(ctx context.Context, arg keybase1.MessageSelector) (messages []keybase1.ConversationLocal, err error) {
	var messageTypes map[chat1.MessageType]bool
	if len(arg.MessageTypes) > 0 {
		messageTypes := make(map[chat1.MessageType]bool)
		for _, t := range arg.MessageTypes {
			messageTypes[t] = true
		}
	}

	// conversations, if non-nil, is derived from arg
	var conversations map[chat1.ConversationID]bool
	if len(arg.Conversations) > 0 {
		conversations := make(map[chat1.ConversationID]bool)
		for _, c := range arg.Conversations {
			conversations[c] = true
		}
	}

	if arg.Limit <= 0 {
		arg.Limit = int(^uint(0) >> 1) // maximum int
	}

	ipagination := &chat1.Pagination{Num: 20}
getinbox:
	for i := 0; i < 10000; /* in case we have a server bug */ i++ {
		iview, err := h.GetInboxLocal(ctx, ipagination)
		if err != nil {
			return nil, err
		}

		for _, conversation := range iview.Conversations {
			if conversations != nil && !conversations[conversation.Metadata.ConversationID] {
				continue
			}
			conv, err := h.getConversationMessages(ctx, &conversation, messageTypes, &arg)
			if err != nil {
				return nil, err
			}
			if len(conv.Messages) != 0 {
				messages = append(messages, conv)

				if arg.Limit <= 0 {
					break getinbox
				}
			}
		}

		// TODO: determine whether need to continue according to the MessageSelector
		if iview.Pagination == nil || iview.Pagination.Last {
			break getinbox
		} else {
			ipagination = iview.Pagination
		}
	}

	return messages, nil
}

func (h *chatLocalHandler) fillSenderIDsForPostLocal(arg *keybase1.PostLocalArg) error {
	uid := h.G().Env.GetUID()
	if uid.IsNil() {
		return fmt.Errorf("Can't send message without a current UID. Are you logged in?")
	}
	did := h.G().Env.GetDeviceID()
	if did.IsNil() {
		return fmt.Errorf("Can't send message without a current DeviceID. Are you logged in?")
	}

	arg.MessagePlaintext.ClientHeader.Sender = gregor1.UID(uid)
	arg.MessagePlaintext.ClientHeader.SenderDevice = gregor1.DeviceID(did)

	return nil
}

// PostLocal implements keybase.chatLocal.postLocal protocol.
func (h *chatLocalHandler) PostLocal(ctx context.Context, arg keybase1.PostLocalArg) error {
	if err := h.fillSenderIDsForPostLocal(&arg); err != nil {
		return err
	}
	// encrypt the message
	boxed, err := h.boxer.boxMessage(ctx, arg.MessagePlaintext)
	if err != nil {
		return err
	}

	// get device signing key for this user
	signingKey, err := engine.GetMySecretKey(h.G(), h.getSecretUI, libkb.DeviceSigningKeyType, "sign chat message")
	if err != nil {
		return err
	}
	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return libkb.KeyCannotSignError{}
	}

	// sign the header, encrypted body
	if err := h.signMessageBoxed(&boxed, kp); err != nil {
		return err
	}

	// post to remote gregord
	rarg := chat1.PostRemoteArg{
		ConversationID: arg.ConversationID,
		MessageBoxed:   boxed,
	}

	_, err = h.remoteClient().PostRemote(ctx, rarg)
	return err
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
func (h *chatLocalHandler) remoteClient() *chat1.RemoteClient {
	return &chat1.RemoteClient{Cli: h.gh.cli}
}

// unboxThread transforms a chat1.ThreadViewBoxed to a keybase1.ThreadView.
func (h *chatLocalHandler) unboxThread(ctx context.Context, boxed chat1.ThreadViewBoxed, convID chat1.ConversationID) (keybase1.ThreadView, error) {
	thread := keybase1.ThreadView{
		Pagination: boxed.Pagination,
	}

	finder := newKeyFinder()
	for _, msg := range boxed.Messages {
		unboxed, err := h.boxer.unboxMessage(ctx, finder, msg)
		if err != nil {
			return keybase1.ThreadView{}, err
		}

		thread.Messages = append(thread.Messages, unboxed)
	}

	return thread, nil
}

// signMessageBoxed signs the header and encrypted body of a chat1.MessageBoxed
// with the NaclSigningKeyPair.
func (h *chatLocalHandler) signMessageBoxed(msg *chat1.MessageBoxed, kp libkb.NaclSigningKeyPair) error {
	header, err := h.signJSON(msg.ClientHeader, kp, libkb.SignaturePrefixChatHeader)
	if err != nil {
		return err
	}
	msg.HeaderSignature = header

	body, err := h.sign(msg.BodyCiphertext.E, kp, libkb.SignaturePrefixChatBody)
	if err != nil {
		return err
	}
	msg.BodySignature = body

	return nil
}

// signJSON signs data with a NaclSigningKeyPair, returning a chat1.SignatureInfo.
// It encodes data to JSON before signing.
func (h *chatLocalHandler) signJSON(data interface{}, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) {
	encoded, err := json.Marshal(data)
	if err != nil {
		return chat1.SignatureInfo{}, err
	}

	return h.sign(encoded, kp, prefix)
}

func exportSigInfo(si *libkb.NaclSigInfo) chat1.SignatureInfo {
	return chat1.SignatureInfo{
		V: si.Version,
		S: si.Sig[:],
		K: si.Kid,
	}
}

// sign signs msg with a NaclSigningKeyPair, returning a chat1.SignatureInfo.
func (h *chatLocalHandler) sign(msg []byte, kp libkb.NaclSigningKeyPair, prefix libkb.SignaturePrefix) (chat1.SignatureInfo, error) {
	sig, err := kp.SignV2(msg, prefix)
	if err != nil {
		return chat1.SignatureInfo{}, err
	}
	return exportSigInfo(sig), nil
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
