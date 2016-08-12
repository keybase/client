// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/gregor/protocol/chat1"
)

type chatLocalHandler struct {
	*BaseHandler
	libkb.Contextified
	gh   *gregorHandler
	tlfh *tlfHandler
}

func newChatLocalHandler(xp rpc.Transporter, g *libkb.GlobalContext, gh *gregorHandler) *chatLocalHandler {
	return &chatLocalHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		gh:           gh,
		tlfh:         newTlfHandler(xp, g),
	}
}

func (h *chatLocalHandler) GetInboxLocal(ctx context.Context, p *chat1.Pagination) (chat1.InboxView, error) {
	return h.remoteClient().GetInboxRemote(ctx, p)
}

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

func (h *chatLocalHandler) NewConversationLocal(context.Context, chat1.ConversationIDTriple) error {
	return nil
}

func (h *chatLocalHandler) PostLocal(ctx context.Context, arg keybase1.PostLocalArg) error {
	sealed, err := h.sealMessage(ctx, arg.MessagePlaintext)
	if err != nil {
		return err
	}

	rarg := chat1.PostRemoteArg{
		ConversationID: arg.ConversationID,
		MessageBoxed:   sealed,
	}

	return h.remoteClient().PostRemote(ctx, rarg)
}

func (h *chatLocalHandler) remoteClient() *chat1.RemoteClient {
	return &chat1.RemoteClient{Cli: h.gh.cli}
}

func (h *chatLocalHandler) unboxThread(ctx context.Context, boxed chat1.ThreadViewBoxed) (keybase1.ThreadView, error) {
	thread := keybase1.ThreadView{
		Pagination: boxed.Pagination,
	}

	for _, msg := range boxed.Messages {
		unboxed, err := h.unboxMessage(ctx, msg)
		if err != nil {
			return keybase1.ThreadView{}, err
		}
		thread.Messages = append(thread.Messages, unboxed)
	}

	return thread, nil
}

func (h *chatLocalHandler) unboxMessage(ctx context.Context, msg chat1.MessageBoxed) (keybase1.Message, error) {
	tlfName := msg.ClientHeader.TlfName
	keys, err := h.tlfKeys(ctx, tlfName)
	if err != nil {
		return keybase1.Message{}, err
	}

	var matchKey *keybase1.CryptKey
	for _, key := range keys.CryptKeys {
		if key.KeyGeneration == msg.KeyGeneration {
			matchKey = &key
			break
		}
	}

	if matchKey == nil {
		return keybase1.Message{}, fmt.Errorf("no key found for generation %d", msg.KeyGeneration)
	}

	return h.unboxMessageWithKey(msg, matchKey)
}

func (h *chatLocalHandler) unboxMessageWithKey(msg chat1.MessageBoxed, key *keybase1.CryptKey) (keybase1.Message, error) {
	if msg.ServerHeader == nil {
		return keybase1.Message{}, errors.New("nil ServerHeader in MessageBoxed")
	}

	unboxed := keybase1.Message{
		ServerHeader: *msg.ServerHeader,
	}

	if len(msg.BodyCiphertext.N) != libkb.NaclDHNonceSize {
		return keybase1.Message{}, libkb.DecryptBadNonceError{}
	}
	var nonce [libkb.NaclDHNonceSize]byte
	copy(nonce[:], msg.BodyCiphertext.N)

	plaintext, ok := secretbox.Open(nil, msg.BodyCiphertext.E, &nonce, ((*[32]byte)(&key.Key)))
	if !ok {
		return keybase1.Message{}, libkb.DecryptOpenError{}
	}

	h.G().Log.Debug("plaintext: %v", plaintext)
	if err := json.Unmarshal(plaintext, &unboxed.MessagePlaintext); err != nil {
		return keybase1.Message{}, err
	}

	return unboxed, nil

}

func (h *chatLocalHandler) sealMessage(ctx context.Context, msg keybase1.MessagePlaintext) (chat1.MessageBoxed, error) {
	tlfName := msg.ClientHeader.TlfName
	keys, err := h.tlfKeys(ctx, tlfName)
	if err != nil {
		return chat1.MessageBoxed{}, err
	}

	var recentKey *keybase1.CryptKey
	for _, key := range keys.CryptKeys {
		if recentKey == nil || key.KeyGeneration > recentKey.KeyGeneration {
			recentKey = &key
		}
	}

	if recentKey == nil {
		return chat1.MessageBoxed{}, fmt.Errorf("no key found for tlf %q", tlfName)
	}

	return h.sealMessageWithKey(msg, recentKey)
}

func (h *chatLocalHandler) sealMessageWithKey(msg keybase1.MessagePlaintext, key *keybase1.CryptKey) (chat1.MessageBoxed, error) {
	s, err := json.Marshal(msg)
	if err != nil {
		return chat1.MessageBoxed{}, err
	}

	var nonce [libkb.NaclDHNonceSize]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return chat1.MessageBoxed{}, err
	}

	sealed := secretbox.Seal(nil, []byte(s), &nonce, ((*[32]byte)(&key.Key)))

	boxed := chat1.MessageBoxed{
		ClientHeader: msg.ClientHeader,
		BodyCiphertext: chat1.EncryptedData{
			V: 1,
			E: sealed,
			N: nonce[:],
		},
		KeyGeneration: key.KeyGeneration,
	}

	return boxed, nil
}

func (h *chatLocalHandler) tlfKeys(ctx context.Context, tlfName string) (keybase1.TLFCryptKeys, error) {
	return h.tlfh.CryptKeys(ctx, tlfName)
}
