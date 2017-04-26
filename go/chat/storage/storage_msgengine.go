package storage

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"
)

type msgEngine struct {
	globals.Contextified
	utils.DebugLabeler
}

type boxedLocalMessage struct {
	MsgID   chat1.MessageID   `codec:"I"`
	MsgType chat1.MessageType `codec:"T"`
	V       int               `codec:"V"`
	E       []byte            `codec:"E"`
	N       [24]byte          `codec:"N"`
}

func (b boxedLocalMessage) GetMessageID() chat1.MessageID {
	return b.MsgID
}

func (b boxedLocalMessage) GetMessageType() chat1.MessageType {
	return b.MsgType
}

func newMsgEngine(g *globals.Context) *msgEngine {
	return &msgEngine{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "MessageEngine", true),
	}
}

func (ms *msgEngine) fetchSecretKey(ctx context.Context) (key [32]byte, err Error) {
	var ok bool
	val := ctx.Value(beskkey)
	if key, ok = val.([32]byte); !ok {
		return key, MiscError{Msg: "secret key not in context"}
	}
	return key, nil
}

func (ms *msgEngine) makeMsgKey(convID chat1.ConversationID, uid gregor1.UID, msgID chat1.MessageID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("msg:%s:%s:%d", uid, convID, msgID),
	}
}

func (ms *msgEngine) WriteMessages(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) Error {

	// Sanity check
	if len(msgs) == 0 {
		return nil
	}

	// Write out all the messages
	for _, msg := range msgs {

		// Encode message
		dat, err := encode(msg)
		if err != nil {
			return NewInternalError(ctx, ms.DebugLabeler, "writeMessages: failed to encode: %s",
				err.Error())
		}

		// Encrypt message
		key, cerr := ms.fetchSecretKey(ctx)
		if cerr != nil {
			return cerr
		}
		var nonce []byte
		nonce, err = libkb.RandBytes(24)
		if err != nil {
			return MiscError{Msg: fmt.Sprintf("writeMessages: failure to generate nonce: %s", err.Error())}
		}
		var fnonce [24]byte
		copy(fnonce[:], nonce)
		sealed := secretbox.Seal(nil, dat, &fnonce, &key)

		// Encode stored message
		payload := boxedLocalMessage{
			MsgID:   msg.GetMessageID(),
			MsgType: msg.GetMessageType(),
			V:       cryptoVersion,
			E:       sealed,
			N:       fnonce,
		}
		dat, err = encode(payload)
		if err != nil {
			return NewInternalError(ctx, ms.DebugLabeler, "writeMessages: failed to encode: %s",
				err.Error())
		}

		// Store
		if err = ms.G().LocalChatDb.PutRaw(ms.makeMsgKey(convID, uid, msg.GetMessageID()), dat); err != nil {
			return NewInternalError(ctx, ms.DebugLabeler, "writeMessages: failed to write msg: %s", err.Error())
		}
	}

	return nil
}

func (ms *msgEngine) ReadMessages(ctx context.Context, rc ResultCollector,
	convID chat1.ConversationID, uid gregor1.UID, maxID chat1.MessageID) (err Error) {

	// Run all errors through resultCollector
	defer func() {
		if err != nil {
			err = rc.Error(err)
		}
	}()

	// Read all msgs in reverse order
	for msgID := maxID; !rc.Done() && msgID > 0; msgID-- {
		raw, found, err := ms.G().LocalChatDb.GetRaw(ms.makeMsgKey(convID, uid, msgID))
		if err != nil {
			return NewInternalError(ctx, ms.DebugLabeler, "readMessages: failed to read msg: %s", err.Error())
		}
		if !found {
			return MissError{}
		}

		// Decode and check to see if this is a cache hit
		var bmsg boxedLocalMessage
		if err = decode(raw, &bmsg); err != nil {
			return NewInternalError(ctx, ms.DebugLabeler, "readMessages: failed to decode msg: %s", err.Error())
		}
		if bmsg.GetMessageID() == 0 {
			return MissError{}
		}
		if bmsg.V > cryptoVersion {
			return NewInternalError(ctx, ms.DebugLabeler, "readMessages: bad crypto version: %d current: %d id: %d", bmsg.V, cryptoVersion, bmsg.GetMessageID())
		}

		// Decrypt
		fkey, cerr := ms.fetchSecretKey(ctx)
		if cerr != nil {
			return cerr
		}
		pt, ok := secretbox.Open(nil, bmsg.E, &bmsg.N, &fkey)
		if !ok {
			return NewInternalError(ctx, ms.DebugLabeler, "readMessages: failed to decrypt msg: %d err: %s", bmsg.GetMessageID(), err.Error())
		}

		// Decode payload
		var msg chat1.MessageUnboxed
		if err = decode(pt, &msg); err != nil {
			return NewInternalError(ctx, ms.DebugLabeler, "readMessages: failed to decode: %s", err.Error())
		}

		rc.Push(msg)
	}

	return nil
}

func (ms *msgEngine) Init(ctx context.Context, key [32]byte, convID chat1.ConversationID,
	uid gregor1.UID) (context.Context, Error) {
	return context.WithValue(ctx, beskkey, key), nil
}
