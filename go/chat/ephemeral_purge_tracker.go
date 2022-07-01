package chat

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

const ephemeralTrackerDiskVersion = 1
const dbKeyPrefix = "et|uid:%s|convID:"
const memCacheLRUSize = 1000

type EphemeralTracker struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex
	lru         *lru.Cache
	started     bool
	stopCh      chan struct{}
	flushLoopCh chan struct{}
	eg          errgroup.Group
}

var _ types.EphemeralTracker = (*EphemeralTracker)(nil)

type ephemeralTrackerMemCache struct {
	isDirty bool
	info    chat1.EphemeralPurgeInfo
}

type ephemeralTrackerEntry struct {
	StorageVersion int                      `codec:"v"`
	Info           chat1.EphemeralPurgeInfo `codec:"i"`
}

func NewEphemeralTracker(g *globals.Context) *EphemeralTracker {
	nlru, err := lru.New(memCacheLRUSize)
	if err != nil {
		// lru.New only panics if size <= 0
		log.Panicf("Could not create lru cache: %v", err)
	}
	return &EphemeralTracker{Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "EphemeralTracker", false),
		lru:          nlru,
		flushLoopCh:  make(chan struct{}, 10),
	}
}

func (t *EphemeralTracker) Start(ctx context.Context, uid gregor1.UID) {
	defer t.Trace(ctx, nil, "Start")()
	t.Lock()
	defer t.Unlock()
	if t.started {
		return
	}
	t.stopCh = make(chan struct{})
	t.started = true
	t.eg.Go(func() error { return t.flushLoop(uid, t.stopCh) })
}

func (t *EphemeralTracker) Stop(ctx context.Context) chan struct{} {
	defer t.Trace(ctx, nil, "Stop")()
	t.Lock()
	defer t.Unlock()
	ch := make(chan struct{})
	if t.started {
		close(t.stopCh)
		t.started = false
		go func() {
			_ = t.eg.Wait()
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (t *EphemeralTracker) flushLoop(uid gregor1.UID, stopCh chan struct{}) error {
	ctx := context.Background()
	for {
		select {
		case <-t.flushLoopCh:
			if err := t.Flush(ctx, uid); err != nil {
				t.Debug(ctx, "unable to flush: %v", err)
			}
		case <-t.G().Clock().After(30 * time.Second):
			if err := t.Flush(ctx, uid); err != nil {
				t.Debug(ctx, "unable to flush: %v", err)
			}
		case <-stopCh:
			if err := t.Flush(ctx, uid); err != nil {
				t.Debug(ctx, "unable to flush: %v", err)
			}
			return nil
		}
	}
}

func (t *EphemeralTracker) key(uid gregor1.UID, convID chat1.ConversationID) string {
	return fmt.Sprintf(dbKeyPrefix, uid) + convID.String()
}

func (t *EphemeralTracker) dbKey(uid gregor1.UID, convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatEphemeralTracker,
		Key: t.key(uid, convID),
	}
}

func (t *EphemeralTracker) get(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (*ephemeralTrackerMemCache, error) {
	memKey := t.key(uid, convID)
	data, found := t.lru.Get(memKey)
	if found {
		cache, ok := data.(ephemeralTrackerMemCache)
		if ok {
			return &cache, nil
		}
	}

	dbKey := t.dbKey(uid, convID)
	raw, found, err := t.G().LocalChatDb.GetRaw(dbKey)
	if err != nil {
		return nil, err
	} else if !found {
		return nil, nil
	}

	var dbRes ephemeralTrackerEntry
	if err := decode(raw, &dbRes); err != nil {
		return nil, err
	}

	switch dbRes.StorageVersion {
	case ephemeralTrackerDiskVersion:
		cache := ephemeralTrackerMemCache{info: dbRes.Info}
		t.lru.Add(memKey, cache)
		return &cache, nil
	default:
		// ignore other versions
		return nil, nil
	}
}

func (t *EphemeralTracker) put(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, info chat1.EphemeralPurgeInfo) (err error) {
	t.lru.Add(t.key(uid, convID), ephemeralTrackerMemCache{
		info:    info,
		isDirty: true,
	})
	return nil
}

func (t *EphemeralTracker) Flush(ctx context.Context, uid gregor1.UID) error {
	t.Lock()
	defer t.Unlock()
	return t.flushLocked(ctx, uid)
}

func (t *EphemeralTracker) flushLocked(ctx context.Context, uid gregor1.UID) error {
	for _, key := range t.lru.Keys() {
		rawCache, found := t.lru.Get(key)
		cache, ok := rawCache.(ephemeralTrackerMemCache)
		if !found || !ok || !cache.isDirty {
			continue
		}

		var entry ephemeralTrackerEntry
		entry.StorageVersion = ephemeralTrackerDiskVersion
		entry.Info = cache.info
		data, err := encode(entry)
		if err != nil {
			return err
		}

		dbKey := t.dbKey(uid, cache.info.ConvID)
		if err := t.G().LocalChatDb.PutRaw(dbKey, data); err != nil {
			return err
		}
		cache.isDirty = false
		t.lru.Add(key, cache)
	}
	return nil
}

func (t *EphemeralTracker) GetPurgeInfo(ctx context.Context,
	uid gregor1.UID, convID chat1.ConversationID) (chat1.EphemeralPurgeInfo, error) {
	defer t.Trace(ctx, nil, "GetPurgeInfo")()
	t.Lock()
	defer t.Unlock()

	cache, err := t.get(ctx, uid, convID)
	if err != nil {
		return chat1.EphemeralPurgeInfo{}, err
	} else if cache == nil {
		return chat1.EphemeralPurgeInfo{}, storage.MissError{}
	}
	return cache.info, nil
}

func (t *EphemeralTracker) getAllKeysLocked(ctx context.Context, uid gregor1.UID) (keys []libkb.DbKey, err error) {
	innerKeyPrefix := fmt.Sprintf(dbKeyPrefix, uid)
	prefix := libkb.DbKey{
		Typ: libkb.DBChatEphemeralTracker,
		Key: innerKeyPrefix,
	}.ToBytes()
	leveldb, ok := t.G().LocalChatDb.GetEngine().(*libkb.LevelDb)
	if !ok {
		return nil, fmt.Errorf("could not get leveldb")
	}
	dbKeys, err := leveldb.KeysWithPrefixes(prefix)
	if err != nil {
		return nil, err
	}
	keys = make([]libkb.DbKey, 0, len(dbKeys))
	for dbKey := range dbKeys {
		if dbKey.Typ == libkb.DBChatEphemeralTracker && strings.HasPrefix(dbKey.Key, innerKeyPrefix) {
			keys = append(keys, dbKey)
		}
	}
	return keys, nil
}

func (t *EphemeralTracker) GetAllPurgeInfo(ctx context.Context, uid gregor1.UID) ([]chat1.EphemeralPurgeInfo, error) {
	defer t.Trace(ctx, nil, "GetAllPurgeInfo")()
	t.Lock()
	defer t.Unlock()

	if err := t.flushLocked(ctx, uid); err != nil {
		return nil, err
	}

	dbKeys, err := t.getAllKeysLocked(ctx, uid)
	if err != nil {
		return nil, err
	}
	allPurgeInfo := make([]chat1.EphemeralPurgeInfo, 0, len(dbKeys))
	innerKeyPrefix := fmt.Sprintf(dbKeyPrefix, uid)
	for _, dbKey := range dbKeys {
		convID, err := chat1.MakeConvID(dbKey.Key[len(innerKeyPrefix):])
		if err != nil {
			return nil, err
		}
		cache, err := t.get(ctx, uid, convID)
		if err != nil {
			return nil, err
		} else if cache == nil {
			continue
		}
		allPurgeInfo = append(allPurgeInfo, cache.info)
	}
	return allPurgeInfo, nil
}

func (t *EphemeralTracker) SetPurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) (err error) {
	t.Lock()
	defer t.Unlock()

	if purgeInfo == nil {
		return nil
	}

	if err = t.put(ctx, uid, convID, *purgeInfo); err != nil {
		return err
	}
	// Let our background monitor know about the new info.
	return t.G().EphemeralPurger.Queue(ctx, *purgeInfo)
}

// When we are filtering new messages coming in/out of storage, we maybe update
// if they tell us about something older we should be purging.
func (t *EphemeralTracker) MaybeUpdatePurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) (err error) {
	t.Lock()
	defer t.Unlock()

	if purgeInfo == nil || purgeInfo.IsNil() {
		return nil
	}

	cache, err := t.get(ctx, uid, convID)
	if err != nil {
		return err
	}
	if cache != nil { // Throw away our update info if what we already have is more restrictive.
		if cache.info.IsActive {
			purgeInfo.IsActive = true
		}

		if purgeInfo.MinUnexplodedID == 0 || cache.info.MinUnexplodedID < purgeInfo.MinUnexplodedID {
			purgeInfo.MinUnexplodedID = cache.info.MinUnexplodedID
		}
		if purgeInfo.NextPurgeTime == 0 || (cache.info.NextPurgeTime != 0 && cache.info.NextPurgeTime < purgeInfo.NextPurgeTime) {
			purgeInfo.NextPurgeTime = cache.info.NextPurgeTime
		}
	}
	if cache != nil && purgeInfo.Eq(cache.info) {
		return nil
	}
	if err = t.put(ctx, uid, convID, *purgeInfo); err != nil {
		return nil
	}
	return t.G().EphemeralPurger.Queue(ctx, *purgeInfo)
}

func (t *EphemeralTracker) InactivatePurgeInfo(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID) (err error) {
	t.Lock()
	defer t.Unlock()

	cache, err := t.get(ctx, uid, convID)
	if err != nil {
		return err
	} else if cache == nil {
		return nil
	}
	cache.info.IsActive = false
	if err = t.put(ctx, uid, convID, cache.info); err != nil {
		return err
	}
	// Let our background monitor know about the new info.
	return t.G().EphemeralPurger.Queue(ctx, cache.info)
}

func (t *EphemeralTracker) clearMemory() {
	t.lru.Purge()
}

func (t *EphemeralTracker) Clear(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (err error) {
	defer t.Trace(ctx, &err, "Clear")()
	t.Lock()
	defer t.Unlock()

	t.lru.Remove(t.key(uid, convID))
	dbKey := t.dbKey(uid, convID)
	return t.G().LocalChatDb.Delete(dbKey)
}

func (t *EphemeralTracker) OnDbNuke(mctx libkb.MetaContext) error {
	t.clearMemory()
	return nil
}

func (t *EphemeralTracker) OnLogout(mctx libkb.MetaContext) error {
	select {
	case t.flushLoopCh <- struct{}{}:
	default:
	}
	return nil
}

func decode(data []byte, res interface{}) error {
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(data, &mh)
	err := dec.Decode(res)
	return err
}

func encode(input interface{}) ([]byte, error) {
	mh := codec.MsgpackHandle{WriteExt: true}
	var data []byte
	enc := codec.NewEncoderBytes(&data, &mh)
	if err := enc.Encode(input); err != nil {
		return nil, err
	}
	return data, nil
}
