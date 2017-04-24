package storage

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type msgIDTracker struct {
	globals.Contextified
	utils.DebugLabeler
}

func newMsgIDTracker(g *globals.Context) *msgIDTracker {
	return &msgIDTracker{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "MsgIDTracker", false),
	}
}

func (t *msgIDTracker) makeMaxMsgIDKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("maxMsgID:%s:%s", uid, convID),
	}
}

func (t *msgIDTracker) bumpMaxMessageID(
	ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msgID chat1.MessageID) Error {

	// No need to use transaction here since the Storage class takes lock.

	maxMsgIDKey := t.makeMaxMsgIDKey(convID, uid)

	raw, found, err := t.G().LocalChatDb.GetRaw(maxMsgIDKey)
	if err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "GetRaw error: %s", err.Error())
	}
	if found {
		var maxMsgID chat1.MessageID
		if err = decode(raw, &maxMsgID); err != nil {
			return NewInternalError(ctx, t.DebugLabeler, "decode error: %s", err.Error())
		}
		if maxMsgID >= msgID {
			return nil
		}
	}

	dat, err := encode(msgID)
	if err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "encode error: %s", err.Error())
	}
	if err = t.G().LocalChatDb.PutRaw(maxMsgIDKey, dat); err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "PutRaw error: %s", err.Error())
	}

	return nil
}

func (t *msgIDTracker) getMaxMessageID(
	ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (chat1.MessageID, Error) {

	maxMsgIDKey := t.makeMaxMsgIDKey(convID, uid)

	raw, found, err := t.G().LocalChatDb.GetRaw(maxMsgIDKey)
	if err != nil {
		return 0, NewInternalError(ctx, t.DebugLabeler, "GetRaw error: %s", err.Error())
	}
	if !found {
		return 0, MissError{}
	}

	var maxMsgID chat1.MessageID
	if err = decode(raw, &maxMsgID); err != nil {
		return 0, NewInternalError(ctx, t.DebugLabeler, "decode error: %s", err.Error())
	}

	return maxMsgID, nil
}
