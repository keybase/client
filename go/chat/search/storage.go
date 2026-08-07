package search

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"maps"
	"strings"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const (
	indexVersion      = 16
	tokenEntryVersion = 2
	aliasEntryVersion = 3

	mdDiskVersion    = 4
	tokenDiskVersion = 1
	aliasDiskVersion = 1
)

// Pending entries are held until the next flush, so a long flush interval and a
// fast writer together decide how much lives in memory. An index pass writes
// thousands of tokens a second, which would otherwise sit there for the whole
// flushDelay. This bounds the pending set instead of the clock: cross it and a
// flush is asked for immediately.
//
// It is a trigger, not a ceiling. The flush cannot run until the writer releases
// s.Lock, and one Add writes a whole batch of tokens and aliases under a single
// hold, so the set peaks at roughly this plus one batch.
//
// It therefore has to sit well above one batch. A page of 300 messages produces
// ~2600 entries, so a bound near that degenerates into "flush after every
// batch", rewriting hot tokens to disk - each one re-encrypted whole, not as a
// delta - on every pass instead of once an interval.
//
// Note this counts entries, not bytes, and the two differ by a lot: an entry
// holding one message id and one holding ten thousand both count as 1. A fresh
// index is a few MB at this bound, but a mature conversation's entries are much
// larger - the pending set is biased towards hot tokens, whose posting lists are
// the longest - so 35-40MB is the realistic ceiling there. A byte-based bound
// would measure the thing that actually matters.
const maxDirtyEntries = 20000

type tokenEntry struct {
	Version string                                `codec:"v"`
	MsgIDs  map[chat1.MessageID]chat1.EmptyStruct `codec:"m"`
}

func newTokenEntry() *tokenEntry {
	return &tokenEntry{
		Version: fmt.Sprintf("%d:%d", indexVersion, tokenEntryVersion),
		MsgIDs:  make(map[chat1.MessageID]chat1.EmptyStruct),
	}
}

func (t *tokenEntry) dup() (res *tokenEntry) {
	if t == nil {
		return nil
	}
	res = new(tokenEntry)
	res.Version = t.Version
	res.MsgIDs = make(map[chat1.MessageID]chat1.EmptyStruct, len(t.MsgIDs))
	for m := range t.MsgIDs {
		res.MsgIDs[m] = chat1.EmptyStruct{}
	}
	return res
}

var refTokenEntry = newTokenEntry()

type aliasEntry struct {
	Version string         `codec:"v"`
	Aliases map[string]int `codec:"z"`
}

func newAliasEntry() *aliasEntry {
	return &aliasEntry{
		Version: fmt.Sprintf("%d:%d", indexVersion, aliasEntryVersion),
		Aliases: make(map[string]int),
	}
}

func (a *aliasEntry) dup() (res *aliasEntry) {
	if a == nil {
		return nil
	}
	res = new(aliasEntry)
	res.Version = a.Version
	res.Aliases = make(map[string]int, len(a.Aliases))
	maps.Copy(res.Aliases, a.Aliases)
	return res
}

func (a *aliasEntry) add(token string) {
	a.Aliases[token]++
}

func (a *aliasEntry) remove(token string) bool {
	a.Aliases[token]--
	if a.Aliases[token] == 0 {
		delete(a.Aliases, token)
		return true
	}
	return false
}

var refAliasEntry = newAliasEntry()

type diskStorage interface {
	GetTokenEntry(ctx context.Context, convID chat1.ConversationID,
		token string) (res *tokenEntry, err error)
	PutTokenEntry(ctx context.Context, convID chat1.ConversationID,
		token string, te *tokenEntry) error
	RemoveTokenEntry(ctx context.Context, convID chat1.ConversationID, token string)
	GetAliasEntry(ctx context.Context, alias string) (res *aliasEntry, err error)
	PutAliasEntry(ctx context.Context, alias string, ae *aliasEntry) error
	RemoveAliasEntry(ctx context.Context, alias string)
	GetMetadata(ctx context.Context, convID chat1.ConversationID) (res *indexMetadata, err error)
	PutMetadata(ctx context.Context, convID chat1.ConversationID, md *indexMetadata) error
	Clear(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) error
}

type diskStore struct {
	utils.DebugLabeler

	uid   gregor1.UID
	mdb   *libkb.JSONLocalDb
	edb   *encrypteddb.EncryptedDB
	keyFn func(ctx context.Context) ([32]byte, error)
}

func newDiskStore(g *globals.Context, uid gregor1.UID,
	keyFn func(ctx context.Context) ([32]byte, error), edb *encrypteddb.EncryptedDB,
	mdb *libkb.JSONLocalDb,
) *diskStore {
	return &diskStore{
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "Search.diskStore", false),
		uid:          uid,
		keyFn:        keyFn,
		edb:          edb,
		mdb:          mdb,
	}
}

func (d *diskStore) GetTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string,
) (res *tokenEntry, err error) {
	key, err := tokenKey(ctx, d.uid, convID, token, d.keyFn)
	if err != nil {
		return nil, err
	}
	res = new(tokenEntry)
	found, err := d.edb.Get(ctx, key, res)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return res, nil
}

func (d *diskStore) PutTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string, te *tokenEntry,
) (err error) {
	key, err := tokenKey(ctx, d.uid, convID, token, d.keyFn)
	if err != nil {
		return err
	}
	return d.edb.Put(ctx, key, te)
}

func (d *diskStore) RemoveTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string,
) {
	key, err := tokenKey(ctx, d.uid, convID, token, d.keyFn)
	if err != nil {
		d.Debug(ctx, "RemoveTokenEntry: failed to get tokenkey: %s", err)
		return
	}
	if err := d.mdb.Delete(key); err != nil {
		d.Debug(ctx, "RemoveTokenEntry: failed to delete key: %s", err)
	}
}

func (d *diskStore) GetAliasEntry(ctx context.Context, alias string) (res *aliasEntry, err error) {
	key, err := aliasKey(ctx, alias, d.keyFn)
	if err != nil {
		return nil, err
	}
	res = new(aliasEntry)
	found, err := d.edb.Get(ctx, key, res)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return res, nil
}

func (d *diskStore) PutAliasEntry(ctx context.Context, alias string, ae *aliasEntry) (err error) {
	key, err := aliasKey(ctx, alias, d.keyFn)
	if err != nil {
		return err
	}
	return d.edb.Put(ctx, key, ae)
}

func (d *diskStore) RemoveAliasEntry(ctx context.Context, alias string) {
	key, err := aliasKey(ctx, alias, d.keyFn)
	if err != nil {
		d.Debug(ctx, "RemoveAliasEntry: failed to get key: %s", err)
		return
	}
	if err := d.mdb.Delete(key); err != nil {
		d.Debug(ctx, "RemoveAliasEntry: failed to delete key: %s", err)
	}
}

func (d *diskStore) GetMetadata(ctx context.Context, convID chat1.ConversationID) (res *indexMetadata, err error) {
	key := metadataKey(d.uid, convID)
	res = new(indexMetadata)
	found, err := d.mdb.GetIntoMsgpack(res, key)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return res, nil
}

func (d *diskStore) PutMetadata(ctx context.Context, convID chat1.ConversationID, md *indexMetadata) (err error) {
	return d.mdb.PutObjMsgpack(metadataKey(d.uid, convID), nil, md)
}

func (d *diskStore) Clear(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) error {
	mdKey := metadataKey(uid, convID)
	tokKey := libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: fmt.Sprintf("tm:%s:%s:", uid, convID),
	}
	dbKeys, err := d.G().LocalChatDb.KeysWithPrefixes(mdKey.ToBytes(), tokKey.ToBytes())
	if err != nil {
		return fmt.Errorf("could not get KeysWithPrefixes: %v", err)
	}
	epick := libkb.FirstErrorPicker{}
	for dbKey := range dbKeys {
		if dbKey.Typ == libkb.DBChatIndex &&
			(strings.HasPrefix(dbKey.Key, mdKey.Key) ||
				strings.HasPrefix(dbKey.Key, tokKey.Key)) {
			epick.Push(d.G().LocalChatDb.Delete(dbKey))
		}
	}
	return epick.Error()
}

type store struct {
	globals.Contextified
	utils.DebugLabeler
	sync.RWMutex // Protects caches and dirty tracking

	uid         gregor1.UID
	keyFn       func(ctx context.Context) ([32]byte, error)
	aliasCache  *lru.Cache
	tokenCache  *lru.Cache
	mdCache     *lru.Cache
	diskStorage diskStorage

	// Entries written but not yet on disk. These hold the entry itself, not just
	// its key: the caches above are bounded LRUs, so a dirty entry can be evicted
	// before the next flush, and a key-only record of it would name an entry that
	// is no longer anywhere in memory. Reads consult these before disk, and Flush
	// writes from these rather than from the caches.
	dirtyTokens   map[chat1.ConvIDStr]map[string]*tokenEntry // map[convIDStr][token]
	dirtyAliases  map[string]*aliasEntry                     // map[alias]
	dirtyMetadata map[chat1.ConvIDStr]*indexMetadata         // map[convIDStr]

	// how many entries are pending across all three maps above, and a one-slot
	// nudge to the flush loop for when that gets big. Buffered and sent to
	// without blocking: a signal already waiting is the same request.
	dirtyCount    int
	flushNeededCh chan struct{}

	flushMtx sync.Mutex // Synchronizes flush operations to disk
	clearMtx sync.RWMutex
}

func newStore(g *globals.Context, uid gregor1.UID) *store {
	ac, _ := lru.New(10000)
	tc, _ := lru.New(3000)
	mc, _ := lru.New(500) // Metadata cache (smaller, fewer active conversations)
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG())
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &store{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.ExternalG(), "Search.store", false),
		uid:           uid,
		keyFn:         keyFn,
		aliasCache:    ac,
		tokenCache:    tc,
		mdCache:       mc,
		diskStorage:   newDiskStore(g, uid, keyFn, encrypteddb.New(g.ExternalG(), dbFn, keyFn), g.LocalChatDb),
		dirtyTokens:   make(map[chat1.ConvIDStr]map[string]*tokenEntry),
		dirtyAliases:  make(map[string]*aliasEntry),
		dirtyMetadata: make(map[chat1.ConvIDStr]*indexMetadata),
		flushNeededCh: make(chan struct{}, 1),
	}
}

func metadataKey(uid gregor1.UID, convID chat1.ConversationID) libkb.DbKey {
	return metadataKeyWithVersion(uid, convID, mdDiskVersion)
}

func metadataKeyWithVersion(uid gregor1.UID, convID chat1.ConversationID, version int) libkb.DbKey {
	var key string
	switch version {
	case 1:
		// original key
		key = fmt.Sprintf("idx:%s:%s", convID, uid)
	case 2:
		// uid as a prefix makes more sense for leveldb to keep values
		// co-located
		key = fmt.Sprintf("idx:%s:%s", uid, convID)
	case 3:
		// changed to use chat1.ConversationIndexDisk to store arrays instead
		// of maps.
		key = fmt.Sprintf("idxd:%s:%s", uid, convID)
	case 4:
		// change to store metadata separate from tokens/aliases
		key = fmt.Sprintf("md:%s:%s", uid, convID)
	default:
		panic("invalid index key version specified")
	}
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: key,
	}
}

func tokenKey(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, dat string,
	keyFn func(ctx context.Context) ([32]byte, error),
) (res libkb.DbKey, err error) {
	return tokenKeyWithVersion(ctx, uid, convID, dat, tokenDiskVersion, keyFn)
}

func tokenKeyWithVersion(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, dat string, version int, keyFn func(ctx context.Context) ([32]byte, error),
) (res libkb.DbKey, err error) {
	var key string
	switch version {
	case 1:
		material, err := keyFn(ctx)
		if err != nil {
			return res, err
		}
		hasher := hmac.New(sha256.New, material[:])
		_, err = hasher.Write([]byte(dat))
		if err != nil {
			return res, err
		}
		_, err = hasher.Write(convID.DbShortForm())
		if err != nil {
			return res, err
		}
		_, err = hasher.Write(uid.Bytes())
		if err != nil {
			return res, err
		}
		_, err = hasher.Write([]byte(libkb.EncryptionReasonChatIndexerTokenKey))
		if err != nil {
			return res, err
		}
		key = fmt.Sprintf("tm:%s:%s:%s", uid, convID, hasher.Sum(nil))
	default:
		return res, fmt.Errorf("unexpected token version %d", version)
	}
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: key,
	}, nil
}

func aliasKey(ctx context.Context, dat string,
	keyFn func(ctx context.Context) ([32]byte, error),
) (res libkb.DbKey, err error) {
	return aliasKeyWithVersion(ctx, dat, aliasDiskVersion, keyFn)
}

func aliasKeyWithVersion(ctx context.Context, dat string, version int,
	keyFn func(ctx context.Context) ([32]byte, error),
) (res libkb.DbKey, err error) {
	var key string
	switch version {
	case 1:
		material, err := keyFn(ctx)
		if err != nil {
			return res, err
		}
		hasher := hmac.New(sha256.New, material[:])
		_, err = hasher.Write([]byte(dat))
		if err != nil {
			return res, err
		}
		_, err = hasher.Write([]byte(libkb.EncryptionReasonChatIndexerAliasKey))
		if err != nil {
			return res, err
		}
		key = fmt.Sprintf("al:%s", hasher.Sum(nil))
	default:
		return res, fmt.Errorf("unexpected token version %d", version)
	}
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: key,
	}, nil
}

// deleteOldVersions purges old disk structures so we don't error out on msg
// pack decode or strand indexes with ephemeral content.
func (s *store) deleteOldVersions(ctx context.Context, keyFn func(int) (libkb.DbKey, error), minVersion, maxVersion int) {
	for version := minVersion; version < maxVersion; version++ {
		key, err := keyFn(version)
		if err != nil {
			s.Debug(ctx, "unable to get key for version %d, %v", version, err)
			continue
		}
		if err := s.G().LocalChatDb.Delete(key); err != nil {
			s.Debug(ctx, "deleteOldVersions: failed to delete key: %s", err)
		}
	}
}

func (s *store) deleteOldMetadataVersions(ctx context.Context, convID chat1.ConversationID) {
	keyFn := func(version int) (libkb.DbKey, error) {
		return metadataKeyWithVersion(s.uid, convID, version), nil
	}
	s.deleteOldVersions(ctx, keyFn, 3, mdDiskVersion)
}

func (s *store) deleteOldTokenVersions(ctx context.Context, convID chat1.ConversationID, token string) {
	keyFn := func(version int) (libkb.DbKey, error) {
		return tokenKeyWithVersion(ctx, s.uid, convID, token, version, s.keyFn)
	}
	s.deleteOldVersions(ctx, keyFn, 1, tokenDiskVersion)
}

func (s *store) deleteOldAliasVersions(ctx context.Context, alias string) {
	keyFn := func(version int) (libkb.DbKey, error) {
		return aliasKeyWithVersion(ctx, alias, version, s.keyFn)
	}
	s.deleteOldVersions(ctx, keyFn, 1, aliasDiskVersion)
}

func (s *store) GetHits(ctx context.Context, convID chat1.ConversationID, term string) (res map[chat1.MessageID]chat1.EmptyStruct, err error) {
	defer s.Trace(ctx, &err, "GetHits")()
	s.RLock()
	defer s.RUnlock()
	res = make(map[chat1.MessageID]chat1.EmptyStruct)
	// Get all terms and aliases
	terms := make(map[string]chat1.EmptyStruct)
	ae, err := s.getAliasEntry(ctx, term)
	if err != nil {
		return res, err
	}
	aliases := ae.Aliases
	terms[term] = chat1.EmptyStruct{}
	for alias := range aliases {
		terms[alias] = chat1.EmptyStruct{}
	}
	// Find all the msg IDs
	for term := range terms {
		te, err := s.getTokenEntry(ctx, convID, term)
		if err != nil {
			return nil, err
		}
		for msgID := range te.MsgIDs {
			res[msgID] = chat1.EmptyStruct{}
		}
	}
	return res, nil
}

func (s *store) tokenCacheKey(convID chat1.ConversationID, token string) string {
	return fmt.Sprintf("%s:%s", convID, token)
}

func (s *store) getTokenEntry(ctx context.Context, convID chat1.ConversationID, token string) (res *tokenEntry, err error) {
	cacheKey := s.tokenCacheKey(convID, token)
	if te, ok := s.tokenCache.Get(cacheKey); ok {
		return te.(*tokenEntry), nil
	}
	// evicted from the cache but not yet flushed: the copy on disk is stale
	if te, ok := s.dirtyTokens[convID.ConvIDStr()][token]; ok {
		if te == nil {
			// pending delete: the copy still on disk is about to go
			return newTokenEntry(), nil
		}
		s.tokenCache.Add(cacheKey, te)
		return te, nil
	}
	if res, err = s.diskStorage.GetTokenEntry(ctx, convID, token); err != nil {
		return nil, err
	}
	if res == nil {
		s.deleteOldTokenVersions(ctx, convID, token)
		return newTokenEntry(), nil
	}
	if res.Version != refTokenEntry.Version {
		return newTokenEntry(), nil
	}
	s.tokenCache.Add(cacheKey, res)
	return res, nil
}

func (s *store) getAliasEntry(ctx context.Context, alias string) (res *aliasEntry, err error) {
	if dat, ok := s.aliasCache.Get(alias); ok {
		return dat.(*aliasEntry), nil
	}
	// evicted from the cache but not yet flushed: the copy on disk is stale
	if ae, ok := s.dirtyAliases[alias]; ok {
		if ae == nil {
			// pending delete: the copy still on disk is about to go
			return newAliasEntry(), nil
		}
		s.aliasCache.Add(alias, ae)
		return ae, nil
	}
	if res, err = s.diskStorage.GetAliasEntry(ctx, alias); err != nil {
		return nil, err
	}
	if res == nil {
		s.deleteOldAliasVersions(ctx, alias)
		return newAliasEntry(), nil
	}
	if res.Version != refAliasEntry.Version {
		return newAliasEntry(), nil
	}
	s.aliasCache.Add(alias, res)
	return res, nil
}

func (s *store) putTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string, te *tokenEntry,
) (err error) {
	cacheKey := s.tokenCacheKey(convID, token)
	s.tokenCache.Add(cacheKey, te)

	convIDStr := convID.ConvIDStr()
	if s.dirtyTokens[convIDStr] == nil {
		s.dirtyTokens[convIDStr] = make(map[string]*tokenEntry)
	}
	if _, ok := s.dirtyTokens[convIDStr][token]; !ok {
		s.dirtyCount++
	}
	s.dirtyTokens[convIDStr][token] = te
	s.signalFlushIfFullLocked()

	return nil
}

// signalFlushIfFullLocked asks the flush loop to run early once enough entries
// are pending. Callers hold s.Lock; the send never blocks, so it cannot deadlock
// against the flush it is asking for.
func (s *store) signalFlushIfFullLocked() {
	if s.dirtyCount < maxDirtyEntries {
		return
	}
	select {
	case s.flushNeededCh <- struct{}{}:
	default:
	}
}

// flushNeeded fires once the pending set reaches maxDirtyEntries.
func (s *store) flushNeeded() <-chan struct{} {
	return s.flushNeededCh
}

func (s *store) putAliasEntry(ctx context.Context, alias string, ae *aliasEntry) (err error) {
	s.aliasCache.Add(alias, ae)
	if _, ok := s.dirtyAliases[alias]; !ok {
		s.dirtyCount++
	}
	s.dirtyAliases[alias] = ae
	s.signalFlushIfFullLocked()

	return nil
}

func (s *store) putMetadata(ctx context.Context, convID chat1.ConversationID, md *indexMetadata) (err error) {
	convIDStr := convID.ConvIDStr()
	s.mdCache.Add(convIDStr, md)
	if _, ok := s.dirtyMetadata[convIDStr]; !ok {
		s.dirtyCount++
	}
	s.dirtyMetadata[convIDStr] = md
	s.signalFlushIfFullLocked()

	return nil
}

func (s *store) deleteTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string,
) {
	cacheKey := s.tokenCacheKey(convID, token)

	s.tokenCache.Remove(cacheKey)

	// Flush snapshots pending mutations under s.Lock, then applies them to disk
	// after releasing the lock. A write-through delete could therefore race:
	//
	//   flush snapshots old value -> delete removes disk key -> flush writes old value
	//
	// Queue a nil tombstone instead. A later flush applies it after any older
	// snapshot, and requeue() will not replace the tombstone with a failed older
	// write. This preserves the ordering of in-memory mutations.
	convIDStr := convID.ConvIDStr()
	if s.dirtyTokens[convIDStr] == nil {
		s.dirtyTokens[convIDStr] = make(map[string]*tokenEntry)
	}
	if _, pending := s.dirtyTokens[convIDStr][token]; !pending {
		s.dirtyCount++
	}
	s.dirtyTokens[convIDStr][token] = nil
	s.signalFlushIfFullLocked()
}

func (s *store) deleteAliasEntry(ctx context.Context, alias string) {
	s.aliasCache.Remove(alias)
	// queued, not written through - see deleteTokenEntry
	if _, pending := s.dirtyAliases[alias]; !pending {
		s.dirtyCount++
	}
	s.dirtyAliases[alias] = nil
	s.signalFlushIfFullLocked()
}

// addTokens add the given tokens to the index under the given message
// id, when ingesting EDIT messages the msgID is of the superseded msg but the
// tokens are from the EDIT itself.
func (s *store) addTokens(ctx context.Context,
	convID chat1.ConversationID, tokens tokenMap, msgID chat1.MessageID,
) error {
	for token, aliases := range tokens {
		// Update the token entry with the msg ID hit
		te, err := s.getTokenEntry(ctx, convID, token)
		if err != nil {
			return err
		}
		te.MsgIDs[msgID] = chat1.EmptyStruct{}

		// Update all the aliases to point at the token
		for alias := range aliases {
			aliasEntry, err := s.getAliasEntry(ctx, alias)
			if err != nil {
				return err
			}
			aliasEntry.add(token)
			if err := s.putAliasEntry(ctx, alias, aliasEntry); err != nil {
				return err
			}
		}
		if err := s.putTokenEntry(ctx, convID, token, te); err != nil {
			return err
		}
	}
	return nil
}

func (s *store) addMsg(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessageUnboxed,
) error {
	tokens := tokensFromMsg(msg)
	return s.addTokens(ctx, convID, tokens, msg.GetMessageID())
}

func (s *store) removeMsg(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessageUnboxed,
) error {
	// find the msgID that the index stores
	var msgID chat1.MessageID
	switch msg.GetMessageType() {
	case chat1.MessageType_EDIT, chat1.MessageType_ATTACHMENTUPLOADED:
		superIDs, err := utils.GetSupersedes(msg)
		if err != nil || len(superIDs) != 1 {
			return err
		}
		msgID = superIDs[0]
	default:
		msgID = msg.GetMessageID()
	}

	for token, aliases := range tokensFromMsg(msg) {
		// handle token
		te, err := s.getTokenEntry(ctx, convID, token)
		if err != nil {
			return err
		}
		delete(te.MsgIDs, msgID)
		if len(te.MsgIDs) == 0 {
			s.deleteTokenEntry(ctx, convID, token)
		} else {
			// If there are still IDs, just write out the updated version
			if err := s.putTokenEntry(ctx, convID, token, te); err != nil {
				return err
			}
		}
		// take out aliases
		for alias := range aliases {
			aliasEntry, err := s.getAliasEntry(ctx, alias)
			if err != nil {
				return err
			}
			if aliasEntry.remove(token) {
				s.deleteAliasEntry(ctx, alias)
			} else {
				if err := s.putAliasEntry(ctx, alias, aliasEntry); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// The cached *indexMetadata (and its SeenIDs map) is mutated under s.Lock() by
// Add/Remove, so the shared pointer must never escape the store lock. The read
// helpers below acquire s.RLock() and return computed values (never the shared
// map) to avoid a concurrent map read/write with the storage loop.

// MissingIDForConv returns the message IDs in conv that are not yet indexed.
func (s *store) MissingIDForConv(ctx context.Context, conv chat1.Conversation) (res []chat1.MessageID, err error) {
	s.RLock()
	defer s.RUnlock()
	md, err := s.getMetadataLocked(ctx, conv.GetConvID())
	if err != nil {
		return nil, err
	}
	return md.MissingIDForConv(conv), nil
}

// FullyIndexed reports whether every message in conv has been indexed.
func (s *store) FullyIndexed(ctx context.Context, conv chat1.Conversation) (res bool, err error) {
	status, err := s.IndexStatus(ctx, conv)
	if err != nil {
		return false, err
	}
	return status.fullyIndexed(), nil
}

// PercentIndexed returns how much of conv has been indexed, as a percentage.
func (s *store) PercentIndexed(ctx context.Context, conv chat1.Conversation) (res int, err error) {
	status, err := s.IndexStatus(ctx, conv)
	if err != nil {
		return 0, err
	}
	return status.percentIndexed(), nil
}

// IndexStatus returns the missing/total message counts for conv.
func (s *store) IndexStatus(ctx context.Context, conv chat1.Conversation) (res indexStatus, err error) {
	s.RLock()
	defer s.RUnlock()
	md, err := s.getMetadataLocked(ctx, conv.GetConvID())
	if err != nil {
		return indexStatus{}, err
	}
	return md.indexStatus(conv), nil
}

type convIndexStats struct {
	numMissing  int
	numMessages int
	percent     int
	sizeMem     int64
}

// ConvIndexStats returns aggregate profiling stats for conv's index.
func (s *store) ConvIndexStats(ctx context.Context, conv chat1.Conversation) (res convIndexStats, err error) {
	s.RLock()
	defer s.RUnlock()
	md, err := s.getMetadataLocked(ctx, conv.GetConvID())
	if err != nil {
		return res, err
	}
	return convIndexStats{
		numMissing:  len(md.MissingIDForConv(conv)),
		numMessages: len(md.SeenIDs),
		percent:     md.indexStatus(conv).percentIndexed(),
		sizeMem:     md.Size(),
	}, nil
}

// MarkSeen records IDs as accounted for without indexing anything for them.
//
// A conv is "fully indexed" only when every ID between its min and max is in
// SeenIDs, but an ID the server will not return for us can never get there by
// being indexed: deleted messages, and gaps that never existed. Left unmarked
// they hold numMissing above zero forever, so the conv is never fully indexed
// and SelectiveSync re-fetches the same already-indexed messages every interval.
// Callers mark the IDs they asked for after a fetch that succeeded - the source
// affirmatively answered for that range, so anything absent from the reply is
// not coming.
func (s *store) MarkSeen(ctx context.Context, convID chat1.ConversationID, ids []chat1.MessageID) (err error) {
	if len(ids) == 0 {
		return nil
	}
	s.clearMtx.RLock()
	defer s.clearMtx.RUnlock()
	s.Lock()
	defer s.Unlock()
	md, err := s.getMetadataLocked(ctx, convID)
	if err != nil {
		return err
	}
	modified := false
	for _, id := range ids {
		if _, ok := md.SeenIDs[id]; !ok {
			md.SeenIDs[id] = chat1.EmptyStruct{}
			modified = true
		}
	}
	if !modified {
		return nil
	}
	return s.putMetadata(ctx, convID, md)
}

// getMetadataLocked returns the live cached metadata for convID, populating the
// cache from disk on a miss. The returned *indexMetadata is shared and its
// SeenIDs map may be mutated, so callers must hold s.RLock for read-only access
// or s.Lock to mutate it.
func (s *store) getMetadataLocked(ctx context.Context, convID chat1.ConversationID) (res *indexMetadata, err error) {
	convIDStr := convID.ConvIDStr()
	if cached, ok := s.mdCache.Get(convIDStr); ok {
		return cached.(*indexMetadata), nil
	}
	// evicted from the cache but not yet flushed: the copy on disk is stale, and
	// for metadata that means losing SeenIDs and re-indexing what it recorded
	if md, ok := s.dirtyMetadata[convIDStr]; ok {
		s.mdCache.Add(convIDStr, md)
		return md, nil
	}

	if res, err = s.diskStorage.GetMetadata(ctx, convID); err != nil {
		return nil, err
	}
	if res == nil {
		s.deleteOldMetadataVersions(ctx, convID)
		res = newIndexMetadata()
	} else if res.Version != refIndexMetadata.Version {
		res = newIndexMetadata()
	}

	s.mdCache.Add(convIDStr, res)
	return res, nil
}

func (s *store) Add(ctx context.Context, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed,
) (err error) {
	defer s.Trace(ctx, &err, "Add")()

	// Pre-fetch superseded messages before acquiring the lock. EDIT and
	// ATTACHMENTUPLOADED messages require a network/DB lookup to find the
	// message they supersede, and that call can block indefinitely on the
	// conv lock. Holding s.Lock() during that call would block ClearMemory
	// (and transitively Indexer.Clear → idx.Lock()), freezing all thread
	// loading. Fetch outside the lock; only the in-memory index mutations
	// need serialization.
	type supersededFetch struct {
		msgs   []chat1.MessageUnboxed
		tokens tokenMap // only set for EDIT
	}
	reason := chat1.GetThreadReason_INDEXED_SEARCH
	superseded := make(map[chat1.MessageID]supersededFetch, len(msgs))

	// Collect what every message in this batch supersedes, then fetch the whole
	// set in one call. Asking per message costs one GetMessages round trip per
	// edit or attachment upload, which over a backfill of a large conversation
	// is tens of thousands of single-message fetches.
	superIDsByMsg := make(map[chat1.MessageID][]chat1.MessageID, len(msgs))
	var allSuperIDs []chat1.MessageID
	seenSuperID := make(map[chat1.MessageID]bool)
	for _, msg := range msgs {
		switch msg.GetMessageType() {
		case chat1.MessageType_ATTACHMENTUPLOADED, chat1.MessageType_EDIT:
			superIDs, err := utils.GetSupersedes(msg)
			if err != nil {
				s.Debug(ctx, "Add: unable to get supersedes: %v", err)
				continue
			}
			superIDsByMsg[msg.GetMessageID()] = superIDs
			for _, superID := range superIDs {
				if !seenSuperID[superID] {
					seenSuperID[superID] = true
					allSuperIDs = append(allSuperIDs, superID)
				}
			}
		}
	}

	supersededByID := make(map[chat1.MessageID]chat1.MessageUnboxed, len(allSuperIDs))
	if len(allSuperIDs) > 0 {
		supersededMsgs, err := s.G().ChatHelper.GetMessages(ctx, s.uid, convID, allSuperIDs,
			false /* resolveSupersedes */, &reason)
		if err != nil {
			// the batch tells us nothing about which ID was at fault, so fall back
			// to the per-message fetches and let each one fail on its own
			s.Debug(ctx, "Add: unable to fetch superseded messages in bulk: %v", err)
			for _, superIDs := range superIDsByMsg {
				single, err := s.G().ChatHelper.GetMessages(ctx, s.uid, convID, superIDs,
					false /* resolveSupersedes */, &reason)
				if err != nil {
					s.Debug(ctx, "Add: unable to fetch superseded messages: %v", err)
					continue
				}
				for _, sm := range single {
					supersededByID[sm.GetMessageID()] = sm
				}
			}
		} else {
			for _, sm := range supersededMsgs {
				supersededByID[sm.GetMessageID()] = sm
			}
		}
	}

	unresolved := make(map[chat1.MessageID]bool)
	for _, msg := range msgs {
		superIDs, ok := superIDsByMsg[msg.GetMessageID()]
		if !ok {
			continue
		}
		fetch := supersededFetch{}
		for _, superID := range superIDs {
			if sm, ok := supersededByID[superID]; ok {
				fetch.msgs = append(fetch.msgs, sm)
			}
		}
		if len(fetch.msgs) == 0 {
			// We know what this message supersedes but could not fetch it, so
			// its content has nowhere to go. Record that rather than falling
			// through as a no-op, or the message would be marked seen with the
			// edit never applied and nothing would revisit it.
			if len(superIDs) > 0 {
				unresolved[msg.GetMessageID()] = true
			}
			continue
		}
		if msg.GetMessageType() == chat1.MessageType_EDIT {
			fetch.tokens = tokensFromMsg(msg)
		}
		superseded[msg.GetMessageID()] = fetch
	}

	// Fetching superseded messages above can block, so only join the mutation
	// barrier once the data needed for the write is ready.
	s.clearMtx.RLock()
	defer s.clearMtx.RUnlock()
	s.Lock()
	defer s.Unlock()

	modified := false
	md, err := s.getMetadataLocked(ctx, convID)
	if err != nil {
		s.Debug(ctx, "failed to get metadata: %s", err)
		return err
	}
	defer func() {
		if modified && err == nil {
			err = s.putMetadata(ctx, convID, md)
		}
	}()
	for _, msg := range msgs {
		seenIDs := md.SeenIDs
		// Don't add if we've seen
		if _, ok := seenIDs[msg.GetMessageID()]; ok {
			continue
		}
		// Mark seen only once the indexing behind the mark has succeeded. md is
		// the live shared object and is usually already pending, so a mark made
		// up front stands whatever happens next: the message ends up recorded as
		// indexed with no tokens for it, and nothing re-indexes a message the
		// metadata already accounts for. The same reasoning covers a message
		// whose superseded target could not be fetched -- leave it unseen so a
		// later pass can try again.
		// NOTE DELETE and DELETEHISTORY are handled through calls to `remove`,
		// other messages will be added if there is any content that can be
		// indexed.
		if unresolved[msg.GetMessageID()] {
			continue
		}
		switch msg.GetMessageType() {
		case chat1.MessageType_ATTACHMENTUPLOADED:
			for _, sm := range superseded[msg.GetMessageID()].msgs {
				err := s.addMsg(ctx, convID, sm)
				if err != nil {
					return err
				}
				seenIDs[sm.GetMessageID()] = chat1.EmptyStruct{}
				modified = true
			}
		case chat1.MessageType_EDIT:
			fetch := superseded[msg.GetMessageID()]
			// remove the original message text and replace it with the edited
			// contents (using the original id in the index)
			for _, sm := range fetch.msgs {
				err := s.removeMsg(ctx, convID, sm)
				if err != nil {
					return err
				}
				err = s.addTokens(ctx, convID, fetch.tokens, sm.GetMessageID())
				if err != nil {
					return err
				}
				seenIDs[sm.GetMessageID()] = chat1.EmptyStruct{}
				modified = true
			}
		default:
			err := s.addMsg(ctx, convID, msg)
			if err != nil {
				return err
			}
		}
		seenIDs[msg.GetMessageID()] = chat1.EmptyStruct{}
		modified = true
	}
	return nil
}

// Remove tokenizes the message content and updates/removes index keys for each token.
func (s *store) Remove(ctx context.Context, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed,
) (err error) {
	defer s.Trace(ctx, &err, "Remove")()
	s.clearMtx.RLock()
	defer s.clearMtx.RUnlock()
	s.Lock()
	defer s.Unlock()

	md, err := s.getMetadataLocked(ctx, convID)
	if err != nil {
		return err
	}

	modified := false
	seenIDs := md.SeenIDs
	for _, msg := range msgs {
		// Don't remove if we haven't seen
		if _, ok := seenIDs[msg.GetMessageID()]; !ok {
			continue
		}
		modified = true
		err := s.removeMsg(ctx, convID, msg)
		if err != nil {
			return err
		}
	}
	if modified {
		// Through the overlay, never straight to disk. md is the live shared
		// object, so it carries SeenIDs from an Add whose token entries are
		// still only pending; writing it here published "these messages are
		// indexed" ahead of the tokens backing them, and a conv that reaches
		// numMissing 0 that way is never looked at again.
		return s.putMetadata(ctx, convID, md)
	}
	return nil
}

func (s *store) ClearMemory() {
	defer s.Trace(context.Background(), nil, "ClearMemory")()
	s.Lock()
	defer s.Unlock()

	s.aliasCache.Purge()
	s.tokenCache.Purge()
	s.mdCache.Purge()

	s.dirtyTokens = make(map[chat1.ConvIDStr]map[string]*tokenEntry)
	s.dirtyAliases = make(map[string]*aliasEntry)
	s.dirtyMetadata = make(map[chat1.ConvIDStr]*indexMetadata)
	s.dirtyCount = 0
	select {
	case <-s.flushNeededCh:
	default:
	}
}

func (s *store) Clear(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) error {
	// Keep Add, Remove, and MarkSeen out of the gap between Flush and
	// ClearMemory. A mutation that starts during this clear waits and is applied
	// afterward instead of being silently discarded.
	s.clearMtx.Lock()
	defer s.clearMtx.Unlock()
	// ClearMemory is global while the disk clear is for one conv, so flush first:
	// otherwise clearing one conversation discards every other conversation's
	// pending writes along with it. If the flush fails those writes are still
	// lost - the clear proceeds regardless, since leaving this conv's index half
	// dropped is worse.
	if err := s.Flush(); err != nil {
		s.Debug(ctx, "Clear: flush before clear failed: %s", err)
	}
	s.ClearMemory()
	return s.diskStorage.Clear(ctx, uid, convID)
}

type tokenSnapshot struct {
	convID chat1.ConversationID
	token  string
	entry  *tokenEntry
}

func (s *store) Flush() error {
	ctx := context.Background()
	defer s.Trace(ctx, nil, "store.Flush")()

	s.flushMtx.Lock()
	defer s.flushMtx.Unlock()

	// Snapshot the entries that need to be flushed to disk.
	var tokenSnapshots []tokenSnapshot
	aliasSnapshots := make(map[string]*aliasEntry)
	mdSnapshots := make(map[chat1.ConvIDStr]*indexMetadata)
	{
		s.Lock()

		if len(s.dirtyTokens) == 0 && len(s.dirtyAliases) == 0 && len(s.dirtyMetadata) == 0 {
			s.Debug(ctx, "Flush: nothing dirty, skipping")
			s.Unlock()
			return nil
		}

		for convIDStr, tokens := range s.dirtyTokens {
			convID, err := chat1.MakeConvID(string(convIDStr))
			if err != nil {
				s.Debug(ctx, "Flush: invalid convID %s: %s", convIDStr, err)
				continue
			}
			for token, te := range tokens {
				tokenSnapshots = append(tokenSnapshots, tokenSnapshot{
					convID: convID,
					token:  token,
					entry:  te.dup(),
				})
			}
		}

		for alias, ae := range s.dirtyAliases {
			aliasSnapshots[alias] = ae.dup()
		}

		for convIDStr, md := range s.dirtyMetadata {
			mdSnapshots[convIDStr] = md.dup()
		}

		// Clear dirty tracking
		s.dirtyTokens = make(map[chat1.ConvIDStr]map[string]*tokenEntry)
		s.dirtyAliases = make(map[string]*aliasEntry)
		s.dirtyMetadata = make(map[chat1.ConvIDStr]*indexMetadata)
		s.dirtyCount = 0
		// drop a signal raised before this flush: it has just been answered
		select {
		case <-s.flushNeededCh:
		default:
		}

		s.Unlock()
	}

	s.Debug(ctx, "Flush: writing %d tokens, %d aliases, %d metadata to disk",
		len(tokenSnapshots), len(aliasSnapshots), len(mdSnapshots))

	for i, snapshot := range tokenSnapshots {
		// a nil entry is a queued delete, not a value to write
		if snapshot.entry == nil {
			s.diskStorage.RemoveTokenEntry(ctx, snapshot.convID, snapshot.token)
			continue
		}
		if err := s.diskStorage.PutTokenEntry(ctx, snapshot.convID, snapshot.token, snapshot.entry); err != nil {
			s.Debug(ctx, "Flush: failed to write token: %s", err)
			s.requeue(tokenSnapshots[i:], aliasSnapshots, mdSnapshots)
			return err
		}
	}
	tokenSnapshots = nil

	for alias, ae := range aliasSnapshots {
		if ae == nil {
			s.diskStorage.RemoveAliasEntry(ctx, alias)
			delete(aliasSnapshots, alias)
			continue
		}
		if err := s.diskStorage.PutAliasEntry(ctx, alias, ae); err != nil {
			s.Debug(ctx, "Flush: failed to write alias: %s", err)
			s.requeue(nil, aliasSnapshots, mdSnapshots)
			return err
		}
		delete(aliasSnapshots, alias)
	}

	for convIDStr, md := range mdSnapshots {
		convID, err := chat1.MakeConvID(string(convIDStr))
		if err != nil {
			s.Debug(ctx, "Flush: invalid convID %s: %s", convIDStr, err)
			delete(mdSnapshots, convIDStr)
			continue
		}
		if err := s.diskStorage.PutMetadata(ctx, convID, md); err != nil {
			s.Debug(ctx, "Flush: failed to write metadata: %s", err)
			s.requeue(nil, nil, mdSnapshots)
			return err
		}
		delete(mdSnapshots, convIDStr)
	}

	return nil
}

// requeue puts snapshots that never reached disk back into the pending set so a
// later flush retries them.
//
// A dropped failure is unrecoverable: the entry leaves dirty tracking before the
// write is attempted, and nothing marks it dirty again, since nobody mutates a
// token entry for a message that is already indexed. The live metadata meanwhile
// keeps its SeenIDs, so the next successful flush records those messages as
// indexed with no tokens on disk - unsearchable, and never re-indexed because the
// conv reads as complete.
//
// A key written again since the snapshot was taken is left alone: that pending
// value is newer than what failed to write.
func (s *store) requeue(tokens []tokenSnapshot, aliases map[string]*aliasEntry,
	mds map[chat1.ConvIDStr]*indexMetadata,
) {
	s.Lock()
	defer s.Unlock()
	for _, snapshot := range tokens {
		convIDStr := snapshot.convID.ConvIDStr()
		if s.dirtyTokens[convIDStr] == nil {
			s.dirtyTokens[convIDStr] = make(map[string]*tokenEntry)
		}
		// A value queued since the snapshot was taken - including a nil
		// tombstone from a delete - describes a later state of the entry than
		// the one whose write failed, so restoring the snapshot over it would
		// roll that mutation back.
		if _, ok := s.dirtyTokens[convIDStr][snapshot.token]; ok {
			continue
		}
		s.dirtyTokens[convIDStr][snapshot.token] = snapshot.entry
		s.dirtyCount++
	}
	for alias, ae := range aliases {
		if _, ok := s.dirtyAliases[alias]; ok {
			continue
		}
		s.dirtyAliases[alias] = ae
		s.dirtyCount++
	}
	for convIDStr, md := range mds {
		if _, ok := s.dirtyMetadata[convIDStr]; ok {
			continue
		}
		s.dirtyMetadata[convIDStr] = md
		s.dirtyCount++
	}
}
