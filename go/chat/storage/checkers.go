package storage

import (
	"bytes"
	"context"
	"encoding/hex"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type BodyHashChecker func(bodyHash chat1.Hash, uniqueMsgID chat1.MessageID, uniqueConvID chat1.ConversationID) error
type PrevChecker func(msgID chat1.MessageID, convID chat1.ConversationID, uniqueHeaderHash chat1.Hash) error

// These are globally unique. They don't include the UID.
func makeBodyHashIndexKey(bodyHash chat1.Hash) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBodyHashIndex,
		Key: fmt.Sprintf("bodyhash:%s", bodyHash),
	}
}

func makeBodyHashIndexValue(convID chat1.ConversationID, msgID chat1.MessageID) []byte {
	return []byte(fmt.Sprintf("%s:%d", hex.EncodeToString(convID), msgID))
}

// CheckAndRecordBodyHash checks the current message's body hash against all the body hashes we've
// seen, to prevent replays. If the header hash is new, add it to the set.
func CheckAndRecordBodyHash(ctx context.Context, g *globals.Context, bodyHash chat1.Hash, uniqueMsgID chat1.MessageID, uniqueConvID chat1.ConversationID) error {
	bodyHashKey := makeBodyHashIndexKey(bodyHash)
	bodyHashValue := []byte(fmt.Sprintf("%s:%s", uniqueConvID, uniqueMsgID))
	existingVal, found, err := g.LocalChatDb.GetRaw(bodyHashKey)
	// Log errors as warnings, and skip this check. That prevents a corrupt
	// leveldb cache from breaking chat.
	if err != nil {
		g.Log.CDebugf(ctx, "error getting body hash key from chat db: %s", err)
		return nil
	}
	if found {
		if !bytes.Equal(existingVal, bodyHashValue) {
			err := fmt.Errorf("chat message body hash replay detected, %s != %s", string(existingVal), string(bodyHashValue))
			g.Log.CDebugf(ctx, "%s", err)
			return err
		}
		return nil
	}
	err = g.LocalChatDb.PutRaw(bodyHashKey, bodyHashValue)
	// Also suppress write errors.
	if err != nil {
		g.Log.CDebugf(ctx, "error writing body hash key to chat db: %s", err)
	}
	return nil
}

// These are globally unique. They don't include the UID.
func makePrevIndexKey(convID chat1.ConversationID, msgID chat1.MessageID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBodyHashIndex,
		Key: fmt.Sprintf("prev:%s:%s", hex.EncodeToString(convID), msgID),
	}
}

func makePrevIndexValue(headerHash chat1.Hash) []byte {
	return []byte(hex.EncodeToString(headerHash))
}

// CheckAndRecordPrevPointer checks the current message's header hash against all the prev pointers we've
// ever seen. If the current message is new, add it to the set.
func CheckAndRecordPrevPointer(ctx context.Context, g *globals.Context, msgID chat1.MessageID, convID chat1.ConversationID, uniqueHeaderHash chat1.Hash) error {
	prevKey := makePrevIndexKey(convID, msgID)
	headerHashVal := makePrevIndexValue(uniqueHeaderHash)
	existingVal, found, err := g.LocalChatDb.GetRaw(prevKey)
	// Log errors as warnings, and skip this check. That prevents a corrupt
	// leveldb cache from breaking chat.
	if err != nil {
		g.Log.CWarningf(ctx, "error getting prev pointer key from chat db: %s", err)
		return nil
	}
	if found {
		if !bytes.Equal(existingVal, headerHashVal) {
			g.Log.CDebugf(ctx, "chat message prev pointer inconsistency detected")
			g.Log.CDebugf(ctx, "in conv_id %s, msg_id %s", convID.String(), msgID.String())
			g.Log.CDebugf(ctx, "mismatch: %s (stored) != %s (new)", string(existingVal), string(headerHashVal))
			err := fmt.Errorf("chat message prev pointer inconsistency detected, %s != %s", string(existingVal), string(headerHashVal))
			return err
		}
		return nil
	}
	g.Log.CDebugf(ctx, "storing header hash %s for conv_id %s, msg_id %s", string(headerHashVal), convID.String(), msgID.String())
	err = g.LocalChatDb.PutRaw(prevKey, headerHashVal)
	// Also suppress write errors.
	if err != nil {
		g.Log.CDebugf(ctx, "error writing body hash key to chat db: %s", err)
	}
	return nil
}
