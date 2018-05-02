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

type delhTracker struct {
	globals.Contextified
	utils.DebugLabeler
}

type delhTrackerEntry struct {
	StorageVersion int `codec:"v"`
	// The latest DeleteHistory upto value that has been applied locally
	MaxDeleteHistoryUpto chat1.MessageID `codec:"ldhu"`
	// The most ancient message that a new DeleteHistory could affect
	MinDeletableMessage chat1.MessageID `codec:"em"`
}

const delhTrackerDiskVersion = 2

func newDelhTracker(g *globals.Context) *delhTracker {
	return &delhTracker{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "DelhTracker", false),
	}
}

func (t *delhTracker) makeDbKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("delh:%s:%s", uid, convID),
	}
}

func (t *delhTracker) getEntry(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID) (delhTrackerEntry, Error) {

	var blank delhTrackerEntry
	var res delhTrackerEntry

	dbKey := t.makeDbKey(convID, uid)
	raw, found, err := t.G().LocalChatDb.GetRaw(dbKey)
	if err != nil {
		return res, NewInternalError(ctx, t.DebugLabeler, "GetRaw error: %s", err.Error())
	}
	if !found {
		return res, MissError{}
	}

	err = decode(raw, &res)
	if err != nil {
		return blank, NewInternalError(ctx, t.DebugLabeler, "decode error: %s", err.Error())
	}
	switch res.StorageVersion {
	case delhTrackerDiskVersion:
		return res, nil
	default:
		// ignore other versions
		return blank, MissError{}
	}
}

func (t *delhTracker) setEntry(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, entry delhTrackerEntry) Error {

	entry.StorageVersion = delhTrackerDiskVersion
	data, err := encode(entry)
	if err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "encode error: %s", err.Error())
	}

	dbKey := t.makeDbKey(convID, uid)
	err = t.G().LocalChatDb.PutRaw(dbKey, data)
	if err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "PutRaw error: %s", err.Error())
	}
	t.Debug(ctx, "delhTracker.setEntry(%v, %+v)", convID, entry)
	return nil
}

func (t *delhTracker) setMaxDeleteHistoryUpto(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, msgid chat1.MessageID) Error {

	// No need to use transaction here since the Storage class takes lock.

	entry, err := t.getEntry(ctx, convID, uid)
	switch err.(type) {
	case nil:
	case MissError:
	default:
		return err
	}
	entry.MaxDeleteHistoryUpto = msgid
	return t.setEntry(ctx, convID, uid, entry)
}

func (t *delhTracker) setMinDeletableMessage(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, msgid chat1.MessageID) Error {

	entry, err := t.getEntry(ctx, convID, uid)
	switch err.(type) {
	case nil:
	case MissError:
	default:
		return err
	}
	entry.MinDeletableMessage = msgid
	return t.setEntry(ctx, convID, uid, entry)
}

// Set both values to msgid
func (t *delhTracker) setDeletedUpto(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, msgid chat1.MessageID) Error {

	entry, err := t.getEntry(ctx, convID, uid)
	switch err.(type) {
	case nil:
	case MissError:
	default:
		return err
	}
	entry.MaxDeleteHistoryUpto = msgid
	entry.MinDeletableMessage = msgid
	return t.setEntry(ctx, convID, uid, entry)
}
