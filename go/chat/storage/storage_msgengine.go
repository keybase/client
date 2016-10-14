package storage

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"
)

type msgEngine struct {
	libkb.Contextified
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

func newMsgEngine(g *libkb.GlobalContext) *msgEngine {
	return &msgEngine{
		Contextified: libkb.NewContextified(g),
	}
}

func (ms *msgEngine) fetchSecretKey(ctx context.Context) (key [32]byte, err libkb.ChatStorageError) {
	var ok bool
	val := ctx.Value(beskkey)
	if key, ok = val.([32]byte); !ok {
		return key, libkb.ChatStorageMiscError{Msg: "secret key not in context"}
	}
	return key, nil
}

func (ms *msgEngine) makeMsgKey(convID chat1.ConversationID, uid gregor1.UID, msgID chat1.MessageID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("msg:%s:%s:%d", uid, convID, msgID),
	}
}

func (ms *msgEngine) writeMessages(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageFromServerOrError) libkb.ChatStorageError {

	// Sanity check
	if len(msgs) == 0 {
		return nil
	}

	// Write out all the messages
	for _, msg := range msgs {

		// Encode message
		dat, err := encode(msg)
		if err != nil {
			return libkb.NewChatStorageInternalError(ms.G(), "writeMessages: failed to encode: %s",
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
			return libkb.ChatStorageMiscError{Msg: fmt.Sprintf("writeMessages: failure to generate nonce: %s", err.Error())}
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
			return libkb.NewChatStorageInternalError(ms.G(), "writeMessages: failed to encode: %s",
				err.Error())
		}

		// Store
		if err = ms.G().LocalDb.PutRaw(ms.makeMsgKey(convID, uid, msg.GetMessageID()), dat); err != nil {
			return libkb.NewChatStorageInternalError(ms.G(), "writeMessages: failed to write msg: %s",
				err.Error())
		}
	}

	return nil
}

func (ms *msgEngine) readMessages(ctx context.Context, res *[]chat1.MessageFromServerOrError,
	convID chat1.ConversationID, uid gregor1.UID, maxID chat1.MessageID, num int, df doneFunc) libkb.ChatStorageError {

	// Read all msgs in reverse order
	for msgID := maxID; !df(res, num) && msgID > 0; msgID-- {
		raw, found, err := ms.G().LocalDb.GetRaw(ms.makeMsgKey(convID, uid, msgID))
		if err != nil {
			return libkb.NewChatStorageInternalError(ms.G(), "readMessages: failed to read msg: %s", err.Error())
		}
		if !found {
			return libkb.ChatStorageMissError{}
		}

		// Decode and check to see if this is a cache hit
		var bmsg boxedLocalMessage
		if err = decode(raw, &bmsg); err != nil {
			return libkb.NewChatStorageInternalError(ms.G(), "readMessages: failed to decode msg: %s", err.Error())
		}
		if bmsg.GetMessageID() == 0 {
			return libkb.ChatStorageMissError{}
		}
		if bmsg.V > cryptoVersion {
			return libkb.NewChatStorageInternalError(ms.G(), "readMessages: bad crypto version: %d current: %d id: %d", bmsg.V, cryptoVersion, bmsg.GetMessageID())
		}

		// Decrypt
		fkey, cerr := ms.fetchSecretKey(ctx)
		if cerr != nil {
			return cerr
		}
		pt, ok := secretbox.Open(nil, bmsg.E, &bmsg.N, &fkey)
		if !ok {
			return libkb.NewChatStorageInternalError(ms.G(), "readMessages: failed to decrypt msg: %d err: %s", bmsg.GetMessageID(), err.Error())
		}

		// Decode payload
		var msg chat1.MessageFromServerOrError
		if err = decode(pt, &msg); err != nil {
			return libkb.NewChatStorageInternalError(ms.G(), "readMessages: failed to decode: %s", err.Error())
		}

		*res = append(*res, msg)
	}

	return nil
}

func (ms *msgEngine) init(ctx context.Context, key [32]byte, convID chat1.ConversationID,
	uid gregor1.UID) (context.Context, libkb.ChatStorageError) {
	return context.WithValue(ctx, beskkey, key), nil
}
