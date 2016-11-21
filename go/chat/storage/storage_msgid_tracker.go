package storage

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type msgIDTracker struct {
	libkb.Contextified
}

func (t *msgIDTracker) makeMaxMsgIDKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("maxMsgID:%s:%s", uid, convID),
	}
}

func (t *msgIDTracker) bumpMaxMessageID(
	ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msgID chat1.MessageID) libkb.ChatStorageError {

	// No need to use transaction here since the Storage class takes lock.

	maxMsgIDKey := t.makeMaxMsgIDKey(convID, uid)

	raw, found, err := t.G().LocalChatDb.GetRaw(maxMsgIDKey)
	if err != nil {
		return libkb.NewChatStorageInternalError(t.G(), "GetRaw error: %s", err.Error())
	}
	if found {
		var maxMsgID chat1.MessageID
		if err = decode(raw, &maxMsgID); err != nil {
			return libkb.NewChatStorageInternalError(t.G(), "decode error: %s", err.Error())
		}
		if maxMsgID >= msgID {
			return nil
		}
	}

	dat, err := encode(msgID)
	if err != nil {
		return libkb.NewChatStorageInternalError(t.G(), "encode error: %s", err.Error())
	}
	if err = t.G().LocalChatDb.PutRaw(maxMsgIDKey, dat); err != nil {
		return libkb.NewChatStorageInternalError(t.G(), "PutRaw error: %s", err.Error())
	}

	return nil
}

func (t *msgIDTracker) getMaxMessageID(
	ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (chat1.MessageID, libkb.ChatStorageError) {

	maxMsgIDKey := t.makeMaxMsgIDKey(convID, uid)

	raw, found, err := t.G().LocalChatDb.GetRaw(maxMsgIDKey)
	if err != nil {
		return 0, libkb.NewChatStorageInternalError(t.G(), "GetRaw error: %s", err.Error())
	}
	if !found {
		return 0, libkb.ChatStorageMissError{}
	}

	var maxMsgID chat1.MessageID
	if err = decode(raw, &maxMsgID); err != nil {
		return 0, libkb.NewChatStorageInternalError(t.G(), "decode error: %s", err.Error())
	}

	return maxMsgID, nil
}
