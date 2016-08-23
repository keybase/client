// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/hex"
	"encoding/json"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/gregor/protocol/chat1"
	"github.com/keybase/gregor/protocol/gregor1"
)

// chatLocalHandler implements keybase1.chatLocal.
type chatLocalHandler struct {
	*BaseHandler
	libkb.Contextified
	gh    *gregorHandler
	boxer *chatBoxer
}

// newChatLocalHandler creates a chatLocalHandler.
func newChatLocalHandler(xp rpc.Transporter, g *libkb.GlobalContext, gh *gregorHandler) *chatLocalHandler {
	return &chatLocalHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		gh:           gh,
		boxer:        &chatBoxer{tlf: newTlfHandler(nil, g)},
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

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
func (h *chatLocalHandler) NewConversationLocal(ctx context.Context, trip chat1.ConversationIDTriple) (id chat1.ConversationID, err error) {
	// TODO: change rpc to take a topic name, and follow up with a message with
	// MessageType=TOPIC_NAME to set the topic name for the conversation
	id, err = h.remoteClient().NewConversationRemote(ctx, trip)
	return id, err
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

// GetOrCreateTextConversationLocal implements
// keybase.chatLocal.GetOrCreateTextConversationLocal protocol. It returns the
// most recent conversation's ConversationID for given TLF ID, or creates a new
// conversation and returns its ID if none exists yet.
//
// TODO: after we implement multiple conversations per TLF and topic names,
// change this to look up by topic name
//
// TODO: list all conversations for given TLF from server so that we don't have
// to go through the entire inbox
func (h *chatLocalHandler) GetOrCreateTextConversationLocal(ctx context.Context, arg keybase1.GetOrCreateTextConversationLocalArg) (id chat1.ConversationID, err error) {
	res, err := h.boxer.tlf.CryptKeys(ctx, arg.TlfName)
	if err != nil {
		return id, err
	}
	tlfIDb, err := hex.DecodeString(string(res.TlfID))
	if err != nil {
		return id, err
	}
	tlfID := chat1.TLFID(tlfIDb)

	ipagination := &chat1.Pagination{Num: 20}
getinbox:
	for i := 0; i < 10000; /* in case we have a server bug */ i++ {
		iview, err := h.GetInboxLocal(ctx, ipagination)
		if err != nil {
			return id, err
		}
		for _, conv := range iview.Conversations {
			if conv.Metadata.IdTriple.Tlfid.Eq(tlfID) {
				// TODO: check topic name and topic ID here when we support multiple
				// topics per TLF
				return conv.Metadata.ConversationID, nil
			}
		}

		if iview.Pagination == nil || iview.Pagination.Last {
			break getinbox
		} else {
			ipagination = iview.Pagination
		}
	}

	id, err = h.NewConversationLocal(ctx, chat1.ConversationIDTriple{
		Tlfid:     tlfID,
		TopicType: arg.TopicType,
		// TopicID filled by server?
	})
	if err != nil {
		return id, err
	}

	return id, nil
}

func (h *chatLocalHandler) getConversationMessages(ctx context.Context, conversation *chat1.Conversation, messageTypes map[chat1.MessageType]bool, selector *keybase1.MessageSelector) (conv keybase1.ConversationMessagesLocal, err error) {
	tpagination := &chat1.Pagination{Num: 20}
	tcount := 0
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

			if selector.Before != nil && gregor1.FromTime(m.ServerHeader.Ctime).Before(keybase1.FromTime(*selector.Before)) {
				continue
			}

			if selector.After != nil && gregor1.FromTime(m.ServerHeader.Ctime).After(keybase1.FromTime(*selector.After)) {
				// messages are sorted DESC by time, so at this point we can stop fetching
				break getthread
			}

			if m.ServerHeader.MessageID > conversation.ReadMsgid {
				m.IsNew = true
			}

			if selector.OnlyNew && !m.IsNew {
				// new messages are in front, so at this point we can stop fetching
				break getthread
			}

			conv.Messages = append(conv.Messages, m)

			tcount++
			if selector.LimitPerConversation > 0 && tcount >= selector.LimitPerConversation {
				break getthread
			}
		}

		if tview.Pagination == nil || tview.Pagination.Last {
			break getthread
		} else {
			tpagination = tview.Pagination
		}
	}

	conv.Id = conversation.Metadata.ConversationID
	return conv, nil
}

// GetMessagesLocal implements keybase.chatLocal.GetMessagesLocal protocol.
func (h *chatLocalHandler) GetMessagesLocal(ctx context.Context, arg keybase1.MessageSelector) (messages []keybase1.ConversationMessagesLocal, err error) {
	var messageTypes map[chat1.MessageType]bool
	if len(arg.MessageTypes) > 0 {
		messageTypes := make(map[chat1.MessageType]bool)
		for _, t := range arg.MessageTypes {
			messageTypes[t] = true
		}
	}

	var conversations map[chat1.ConversationID]bool
	if len(arg.Conversations) > 0 {
		conversations := make(map[chat1.ConversationID]bool)
		for _, c := range arg.Conversations {
			conversations[c] = true
		}
	}

	ipagination := &chat1.Pagination{Num: 20}
	icount := 0
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

				icount++
				if arg.LimitOfConversations > 0 && icount >= arg.LimitOfConversations {
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
