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

type ephemeralTracker struct {
	globals.Contextified
	utils.DebugLabeler
}

type ephemeralTrackerEntry struct {
	StorageVersion int `codec:"v"`
	// The latest conv metadata that has been applied locally.
	Metadata chat1.ConvEphemeralMetadata `codec:"m"`
}

const ephemeralTrackerDiskVersion = 1

func newEphemeralTracker(g *globals.Context) *ephemeralTracker {
	return &ephemeralTracker{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "ephemeralTracker", false),
	}
}

func (t *ephemeralTracker) makeDbKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("ephemeralTracker:%s:%s", uid, convID),
	}
}

func (t *ephemeralTracker) getMetadata(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID) (*chat1.ConvEphemeralMetadata, Error) {

	dbKey := t.makeDbKey(convID, uid)
	raw, found, err := t.G().LocalChatDb.GetRaw(dbKey)
	if err != nil {
		return nil, NewInternalError(ctx, t.DebugLabeler, "GetRaw error: %s", err.Error())
	}
	if !found {
		return nil, MissError{}
	}

	var dbRes ephemeralTrackerEntry
	err = decode(raw, &dbRes)
	if err != nil {
		return nil, NewInternalError(ctx, t.DebugLabeler, "decode error: %s", err.Error())
	}
	switch dbRes.StorageVersion {
	case ephemeralTrackerDiskVersion:
		return &dbRes.Metadata, nil
	default:
		// ignore other versions
		return nil, MissError{}
	}
}

func (t *ephemeralTracker) setMetadata(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, metadata *chat1.ConvEphemeralMetadata) Error {
	if metadata == nil {
		return nil
	}
	var entry ephemeralTrackerEntry
	entry.StorageVersion = ephemeralTrackerDiskVersion
	entry.Metadata = *metadata
	data, err := encode(entry)
	if err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "encode error: %s", err.Error())
	}

	dbKey := t.makeDbKey(convID, uid)
	err = t.G().LocalChatDb.PutRaw(dbKey, data)
	if err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "PutRaw error: %s", err.Error())
	}
	t.Debug(ctx, "ephemeralTracker.setMetadata(%v, %+v)", convID, entry)
	return nil
}
