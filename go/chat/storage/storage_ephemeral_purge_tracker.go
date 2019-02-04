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

type allPurgeInfo map[string]chat1.EphemeralPurgeInfo

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

func (t *ephemeralTracker) dbGet(ctx context.Context, uid gregor1.UID) (info allPurgeInfo, err Error) {
	dbKey := t.makeDbKey(uid)
	raw, found, lerr := t.G().LocalChatDb.GetRaw(dbKey)

	if err != nil {
		return nil, NewInternalError(ctx, t.DebugLabeler, "GetRaw error: %s", lerr.Error())
	}
	if !found {
		return make(allPurgeInfo), nil
	}

	var dbRes ephemeralTrackerEntry
	if err := decode(raw, &dbRes); err != nil {
		return nil, NewInternalError(ctx, t.DebugLabeler, "decode error: %s", err.Error())
	}

	switch dbRes.StorageVersion {
	case ephemeralTrackerDiskVersion:
		info = dbRes.AllPurgeInfo
	default:
		// ignore other versions
		info = make(allPurgeInfo)
	}
	return info, nil
}

func (t *ephemeralTracker) dbSet(ctx context.Context, uid gregor1.UID, newInfo allPurgeInfo) (err Error) {
	var entry ephemeralTrackerEntry
	entry.StorageVersion = ephemeralTrackerDiskVersion
	entry.AllPurgeInfo = newInfo
	data, lerr := encode(entry)
	if lerr != nil {
		return NewInternalError(ctx, t.DebugLabeler, "encode error: %s", lerr.Error())
	}

	dbKey := t.makeDbKey(uid)
	if err := t.G().LocalChatDb.PutRaw(dbKey, data); err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "PutRaw error: %s", err.Error())
	}
	return nil
}

func (t *ephemeralTracker) getPurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID) (purgeInfo *chat1.EphemeralPurgeInfo, err Error) {
	t.Lock()
	defer t.Unlock()

	allPurgeInfo, err := t.dbGet(ctx, uid)
	if err != nil {
		return nil, err
	}
	info, ok := allPurgeInfo[convID.String()]
	if !ok {
		return nil, MissError{}
	}
	return &info, nil
}

func (t *ephemeralTracker) getAllPurgeInfo(ctx context.Context, uid gregor1.UID) (info allPurgeInfo, err Error) {
	t.Lock()
	defer t.Unlock()

	return t.dbGet(ctx, uid)
}

func (t *ephemeralTracker) setPurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) (err Error) {
	defer t.Trace(ctx, func() error { return err }, "setPurgeInfo")()

	t.Lock()
	defer t.Unlock()

	if purgeInfo == nil {
		return nil
	}

	allPurgeInfo, err := t.dbGet(ctx, uid)
	if err != nil {
		return err
	}
	allPurgeInfo[convID.String()] = *purgeInfo
	t.Debug(ctx, "setPurgeInfo setting info: %v", *purgeInfo)
	if err = t.dbSet(ctx, uid, allPurgeInfo); err == nil {
		// Let our background monitor know about the new info.
		if qerr := t.G().EphemeralPurger.Queue(ctx, *purgeInfo); qerr != nil {
			return NewInternalError(ctx, t.DebugLabeler, "purger.Queue error: %s", qerr.Error())
		}
	}
	return err
}

// When we are filtering new messages coming in/out of storage, we maybe update
// if they tell us about something older we should be purging.
func (t *ephemeralTracker) maybeUpdatePurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) (err Error) {
	defer t.Trace(ctx, func() error { return err }, "maybeUpdatePurgeInfo")()

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
	if ok { // Throw away our update info if what we already have is more restrictive.
		if curPurgeInfo.IsActive {
			purgeInfo.IsActive = true
		}
		if purgeInfo.MinUnexplodedID == 0 || curPurgeInfo.MinUnexplodedID < purgeInfo.MinUnexplodedID {
			purgeInfo.MinUnexplodedID = curPurgeInfo.MinUnexplodedID
		}
		if purgeInfo.NextPurgeTime == 0 || (curPurgeInfo.NextPurgeTime != 0 && curPurgeInfo.NextPurgeTime < purgeInfo.NextPurgeTime) {
			purgeInfo.NextPurgeTime = curPurgeInfo.NextPurgeTime
		}
	}
	t.Debug(ctx, "maybeUpdatePurgeInfo setting info: %v", purgeInfo)
	allPurgeInfo[convID.String()] = *purgeInfo
	if err = t.dbSet(ctx, uid, allPurgeInfo); err == nil {
		// Let our background monitor know about the new info.
		if qerr := t.G().EphemeralPurger.Queue(ctx, *purgeInfo); qerr != nil {
			return NewInternalError(ctx, t.DebugLabeler, "purger.Queue error: %s", qerr.Error())
		}
	}
	return err
}

func (t *ephemeralTracker) inactivatePurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID) (err Error) {
	defer t.Trace(ctx, func() error { return err }, "inactivatePurgeInfo")()

	t.Lock()
	defer t.Unlock()

	allPurgeInfo, err := t.dbGet(ctx, uid)
	if err != nil {
		return err
	}
	purgeInfo, ok := allPurgeInfo[convID.String()]
	if !ok {
		return nil
	}
	purgeInfo.IsActive = false
	if err = t.dbSet(ctx, uid, allPurgeInfo); err == nil {
		// Let our background monitor know about the new info.
		if qerr := t.G().EphemeralPurger.Queue(ctx, purgeInfo); qerr != nil {
			return NewInternalError(ctx, t.DebugLabeler, "purger.Queue error: %s", qerr.Error())
		}
	}
	return err
}

func (t *ephemeralTracker) clear(uid gregor1.UID) error {
	return t.G().LocalChatDb.Delete(t.makeDbKey(uid))
}
