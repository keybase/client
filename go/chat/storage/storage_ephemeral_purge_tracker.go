package storage

import (
	"fmt"
	"sync"

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
	sync.Mutex
}

type allPurgeInfo map[string]ephemeralPurgeInfo

type ephemeralPurgeInfo struct {
	NextPurgeTime   gregor1.Time    `codec:"n"`
	MinUnexplodedID chat1.MessageID `codec:"e"`
}

type ephemeralTrackerEntry struct {
	StorageVersion int `codec:"v"`
	// convID -> purgeInfo
	AllPurgeInfo allPurgeInfo `codec:"p"`
}

const ephemeralTrackerDiskVersion = 1

func newEphemeralTracker(g *globals.Context) *ephemeralTracker {
	return &ephemeralTracker{Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "ephemeralTracker", false),
	}
}

func (t *ephemeralTracker) makeDbKey(uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("ephemeralTracker:%s", uid),
	}
}

func (t *ephemeralTracker) dbGet(ctx context.Context, uid gregor1.UID) (allPurgeInfo, Error) {
	t.Debug(ctx, "dbGet")

	dbKey := t.makeDbKey(uid)
	raw, found, err := t.G().LocalChatDb.GetRaw(dbKey)
	if err != nil {
		return nil, NewInternalError(ctx, t.DebugLabeler, "GetRaw error: %s", err.Error())
	}
	if !found {
		return make(allPurgeInfo), nil
	}

	var dbRes ephemeralTrackerEntry
	err = decode(raw, &dbRes)
	if err != nil {
		return nil, NewInternalError(ctx, t.DebugLabeler, "decode error: %s", err.Error())
	}
	switch dbRes.StorageVersion {
	case ephemeralTrackerDiskVersion:
		return dbRes.AllPurgeInfo, nil
	default:
		// ignore other versions
		return make(allPurgeInfo), nil
	}
}

func (t *ephemeralTracker) dbSet(ctx context.Context, uid gregor1.UID, newInfo allPurgeInfo) Error {
	t.Debug(ctx, "dbSet")

	var entry ephemeralTrackerEntry
	entry.StorageVersion = ephemeralTrackerDiskVersion
	entry.AllPurgeInfo = newInfo
	data, err := encode(entry)
	if err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "encode error: %s", err.Error())
	}

	dbKey := t.makeDbKey(uid)
	err = t.G().LocalChatDb.PutRaw(dbKey, data)
	if err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "PutRaw error: %s", err.Error())
	}
	return nil
}

func (t *ephemeralTracker) getPurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID) (*ephemeralPurgeInfo, Error) {
	t.Debug(ctx, "getPurgeInfo")

	t.Lock()
	defer t.Unlock()

	allPurgeInfo, err := t.dbGet(ctx, uid)
	if err != nil {
		return nil, err
	}
	purgeInfo, ok := allPurgeInfo[convID.String()]
	if !ok {
		return nil, MissError{}
	}
	return &purgeInfo, nil
}

func (t *ephemeralTracker) getAllPurgeInfo(ctx context.Context, uid gregor1.UID) (allPurgeInfo, Error) {
	t.Debug(ctx, "getAllPurgeInfo")

	t.Lock()
	defer t.Unlock()

	return t.dbGet(ctx, uid)
}

func (t *ephemeralTracker) setPurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, purgeInfo *ephemeralPurgeInfo) Error {
	t.Debug(ctx, "setPurgeInfo %v", purgeInfo)

	t.Lock()
	defer t.Unlock()

	allPurgeInfo, err := t.dbGet(ctx, uid)
	if err != nil {
		return err
	}
	allPurgeInfo[convID.String()] = *purgeInfo
	return t.dbSet(ctx, uid, allPurgeInfo)
}

// When we are filtering new messages coming in/out of storage, we maybe update
// if they tell us about something older we should be purging.
func (t *ephemeralTracker) maybeUpdatePurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, purgeInfo *ephemeralPurgeInfo) Error {
	t.Debug(ctx, "maybeUpdatePurgeInfo")

	t.Lock()
	defer t.Unlock()

	if purgeInfo == nil {
		return nil
	}

	allPurgeInfo, err := t.dbGet(ctx, uid)
	if err != nil {
		return err
	}
	curPurgeInfo, ok := allPurgeInfo[convID.String()]
	t.Debug(ctx, "maybeUpdatePurgeInfo old: %v, ok: %v, new: %v", curPurgeInfo, ok, purgeInfo)
	if !ok {
		// we can only set the NextPurgeTime, but know nothing about the
		// minUnexplodedID, so we clear that value.
		purgeInfo.MinUnexplodedID = 0
	} else { // Throw away our update info if what we already have is more restrictive.
		if purgeInfo.MinUnexplodedID == 0 || curPurgeInfo.MinUnexplodedID < purgeInfo.MinUnexplodedID {
			purgeInfo.MinUnexplodedID = curPurgeInfo.MinUnexplodedID
		}
		if purgeInfo.NextPurgeTime == 0 || curPurgeInfo.NextPurgeTime < purgeInfo.NextPurgeTime {
			purgeInfo.NextPurgeTime = curPurgeInfo.NextPurgeTime
		}
	}
	t.Debug(ctx, "maybeUpdatePurgeInfo setting info: %v", purgeInfo)
	allPurgeInfo[convID.String()] = *purgeInfo
	return t.dbSet(ctx, uid, allPurgeInfo)
}

// If we run an EphemeralPurge and have nothing in our cache, we remove the
// tracker.
func (t *ephemeralTracker) deletePurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID) Error {
	t.Debug(ctx, "deletePurgeInfo")

	t.Lock()
	defer t.Unlock()

	allPurgeInfo, err := t.dbGet(ctx, uid)
	if err != nil {
		return err
	}
	delete(allPurgeInfo, convID.String())
	return t.dbSet(ctx, uid, allPurgeInfo)
}
