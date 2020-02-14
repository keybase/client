package storage

import (
	"fmt"
	"log"
	"strings"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

const ephemeralTrackerDiskVersion = 1
const dbKeyPrefix = "et|uid:%s|convID:"
const memCacheLRUSize = 1000

type ephemeralTracker struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex
	lru *lru.Cache
}

type ephemeralTrackerEntry struct {
	StorageVersion int                      `codec:"v"`
	Info           chat1.EphemeralPurgeInfo `codec:"i"`
}

func newEphemeralTracker(g *globals.Context) *ephemeralTracker {
	nlru, err := lru.New(memCacheLRUSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &ephemeralTracker{Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "ephemeralTracker", false),
		lru:          nlru,
	}
}

func (t *ephemeralTracker) key(uid gregor1.UID, convID chat1.ConversationID) string {
	return fmt.Sprintf(dbKeyPrefix, uid) + convID.String()
}

func (t *ephemeralTracker) dbKey(uid gregor1.UID, convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatEphemeralTracker,
		Key: t.key(uid, convID),
	}
}

func (t *ephemeralTracker) get(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (*chat1.EphemeralPurgeInfo, Error) {

	memKey := t.key(uid, convID)
	data, found := t.lru.Get(memKey)
	if found {
		info, ok := data.(chat1.EphemeralPurgeInfo)
		if ok {
			return &info, nil
		}
	}

	dbKey := t.dbKey(uid, convID)
	raw, found, lerr := t.G().LocalChatDb.GetRaw(dbKey)
	if lerr != nil {
		return nil, NewInternalError(ctx, t.DebugLabeler, "GetRaw error: %v", lerr)
	} else if !found {
		return nil, nil
	}

	var dbRes ephemeralTrackerEntry
	if err := decode(raw, &dbRes); err != nil {
		return nil, NewInternalError(ctx, t.DebugLabeler, "decode error: %v", err)
	}

	switch dbRes.StorageVersion {
	case ephemeralTrackerDiskVersion:
		t.lru.Add(memKey, dbRes.Info)
		return &dbRes.Info, nil
	default:
		// ignore other versions
		return nil, nil
	}
}

func (t *ephemeralTracker) put(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, info chat1.EphemeralPurgeInfo) (err Error) {
	var entry ephemeralTrackerEntry
	entry.StorageVersion = ephemeralTrackerDiskVersion
	entry.Info = info
	data, lerr := encode(entry)
	if lerr != nil {
		return NewInternalError(ctx, t.DebugLabeler, "encode error: %s", lerr)
	}

	dbKey := t.dbKey(uid, convID)
	if err := t.G().LocalChatDb.PutRaw(dbKey, data); err != nil {
		return NewInternalError(ctx, t.DebugLabeler, "PutRaw error: %s", err)
	}
	t.lru.Add(t.key(uid, convID), info)
	return nil
}

func (t *ephemeralTracker) getPurgeInfo(ctx context.Context,
	uid gregor1.UID, convID chat1.ConversationID) (chat1.EphemeralPurgeInfo, Error) {
	t.Lock()
	defer t.Unlock()

	info, err := t.get(ctx, uid, convID)
	if err != nil {
		return chat1.EphemeralPurgeInfo{}, err
	} else if info == nil {
		return chat1.EphemeralPurgeInfo{}, MissError{}
	}
	return *info, nil
}

func (t *ephemeralTracker) getAllKeysLocked(ctx context.Context, uid gregor1.UID) (keys []libkb.DbKey, err Error) {
	innerKeyPrefix := fmt.Sprintf(dbKeyPrefix, uid)
	prefix := libkb.DbKey{
		Typ: libkb.DBChatEphemeralTracker,
		Key: innerKeyPrefix,
	}.ToBytes()
	leveldb, ok := t.G().LocalChatDb.GetEngine().(*libkb.LevelDb)
	if !ok {
		return nil, NewInternalError(ctx, t.DebugLabeler, "could not get leveldb")
	}
	dbKeys, ierr := leveldb.KeysWithPrefixes(prefix)
	if ierr != nil {
		return nil, NewInternalError(ctx, t.DebugLabeler, "could not get KeysWithPrefixes: %v", ierr)
	}
	keys = make([]libkb.DbKey, 0, len(dbKeys))
	for dbKey := range dbKeys {
		if dbKey.Typ == libkb.DBChatEphemeralTracker && strings.HasPrefix(dbKey.Key, innerKeyPrefix) {
			keys = append(keys, dbKey)
		}
	}
	return keys, nil
}

func (t *ephemeralTracker) getAllPurgeInfo(ctx context.Context, uid gregor1.UID) ([]chat1.EphemeralPurgeInfo, Error) {
	t.Lock()
	defer t.Unlock()

	dbKeys, err := t.getAllKeysLocked(ctx, uid)
	if err != nil {
		return nil, err
	}
	allPurgeInfo := make([]chat1.EphemeralPurgeInfo, 0, len(dbKeys))
	innerKeyPrefix := fmt.Sprintf(dbKeyPrefix, uid)
	for _, dbKey := range dbKeys {
		convID, ierr := chat1.MakeConvID(dbKey.Key[len(innerKeyPrefix):])
		if ierr != nil {
			return nil, NewInternalError(ctx, t.DebugLabeler, "unable to make convID: %v", ierr)
		}
		info, err := t.get(ctx, uid, convID)
		if err != nil {
			return nil, err
		} else if info == nil {
			continue
		}
		allPurgeInfo = append(allPurgeInfo, *info)
	}
	return allPurgeInfo, nil
}

func (t *ephemeralTracker) setPurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) (err Error) {
	defer t.Trace(ctx, func() error { return err }, "setPurgeInfo")()

	t.Lock()
	defer t.Unlock()

	if purgeInfo == nil {
		return nil
	}

	t.Debug(ctx, "setPurgeInfo setting info: %v", *purgeInfo)
	if err = t.put(ctx, uid, convID, *purgeInfo); err != nil {
		return err
	}
	// Let our background monitor know about the new info.
	if qerr := t.G().EphemeralPurger.Queue(ctx, *purgeInfo); qerr != nil {
		return NewInternalError(ctx, t.DebugLabeler, "purger.Queue error: %v", qerr)
	}
	return nil
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

	curPurgeInfo, err := t.get(ctx, uid, convID)
	if err != nil {
		return err
	}
	t.Debug(ctx, "maybeUpdatePurgeInfo old: %v, new: %v", curPurgeInfo, purgeInfo)
	if curPurgeInfo != nil { // Throw away our update info if what we already have is more restrictive.
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
	if purgeInfo == curPurgeInfo {
		return nil
	}
	t.Debug(ctx, "maybeUpdatePurgeInfo setting info: %v", purgeInfo)
	if err = t.put(ctx, uid, convID, *purgeInfo); err != nil {
		return nil
	}
	if qerr := t.G().EphemeralPurger.Queue(ctx, *purgeInfo); qerr != nil {
		return NewInternalError(ctx, t.DebugLabeler, "purger.Queue error: %v", qerr)
	}
	return nil
}

func (t *ephemeralTracker) inactivatePurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID) (err Error) {
	defer t.Trace(ctx, func() error { return err }, "inactivatePurgeInfo")()

	t.Lock()
	defer t.Unlock()

	info, err := t.get(ctx, uid, convID)
	if err != nil {
		return err
	} else if info == nil {
		return nil
	}
	info.IsActive = false
	if err = t.put(ctx, uid, convID, *info); err != nil {
		return err
	}
	// Let our background monitor know about the new info.
	if qerr := t.G().EphemeralPurger.Queue(ctx, *info); qerr != nil {
		return NewInternalError(ctx, t.DebugLabeler, "purger.Queue error: %v", qerr)
	}
	return nil
}

func (t *ephemeralTracker) clear(uid gregor1.UID) error {
	t.Lock()
	defer t.Unlock()

	dbKeys, err := t.getAllKeysLocked(context.TODO(), uid)
	if err != nil {
		return err
	}
	for _, dbKey := range dbKeys {
		if err := t.G().LocalChatDb.Delete(dbKey); err != nil {
			return err
		}
	}
	t.lru.Purge()
	return nil
}
