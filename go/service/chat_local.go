// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/json"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/gregor/protocol/chat1"
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
		Pagination:     arg.Pagination,
	}
	boxed, err := h.remoteClient().GetThreadRemote(ctx, rarg)
	if err != nil {
		return keybase1.ThreadView{}, err
	}

	return h.unboxThread(ctx, boxed)
}

// NewConversationLocal implements keybase.chatLocal.newConversationLocal protocol.
func (h *chatLocalHandler) NewConversationLocal(ctx context.Context, trip chat1.ConversationIDTriple) error {
	md := chat1.ConversationMetadata{
		IdTriple: trip,
	}
	return h.remoteClient().NewConversationRemote(ctx, md)
}

// PostLocal implements keybase.chatLocal.postLocal protocol.
func (h *chatLocalHandler) PostLocal(ctx context.Context, arg keybase1.PostLocalArg) error {
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

	return h.remoteClient().PostRemote(ctx, rarg)
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
func (h *chatLocalHandler) unboxThread(ctx context.Context, boxed chat1.ThreadViewBoxed) (keybase1.ThreadView, error) {
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
	header, err := h.signJSON(msg.ClientHeader, kp)
	if err != nil {
		return err
	}
	msg.HeaderSignature = header

	body, err := h.sign(msg.BodyCiphertext.E, kp)
	if err != nil {
		return err
	}
	msg.BodySignature = body

	return nil
}

// signJSON signs data with a NaclSigningKeyPair, returning a chat1.SignatureInfo.
// It encodes data to JSON before signing.
func (h *chatLocalHandler) signJSON(data interface{}, kp libkb.NaclSigningKeyPair) (chat1.SignatureInfo, error) {
	encoded, err := json.Marshal(data)
	if err != nil {
		return chat1.SignatureInfo{}, err
	}

	return h.sign(encoded, kp)
}

// sign signs msg with a NaclSigningKeyPair, returning a chat1.SignatureInfo.
func (h *chatLocalHandler) sign(msg []byte, kp libkb.NaclSigningKeyPair) (chat1.SignatureInfo, error) {
	sig := *kp.Private.Sign(msg)

	info := chat1.SignatureInfo{
		V: 1,
		S: sig[:],
		K: kp.Public[:],
	}

	return info, nil
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
