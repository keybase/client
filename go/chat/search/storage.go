package search

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"sync"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const (
	indexVersion      = 15
	tokenEntryVersion = 2
	aliasEntryVersion = 3

	mdDiskVersion    = 4
	tokenDiskVersion = 1
	aliasDiskVersion = 1
)

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
	for k, v := range a.Aliases {
		res.Aliases[k] = v
	}
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
	Flush() error
	Cancel()
}

type tokenBatch struct {
	convID chat1.ConversationID
	tokens map[string]*tokenEntry
}

func newTokenBatch(convID chat1.ConversationID) *tokenBatch {
	return &tokenBatch{
		convID: convID,
		tokens: make(map[string]*tokenEntry),
	}
}

type mdBatch struct {
	convID chat1.ConversationID
	md     *indexMetadata
}

type batchingStore struct {
	utils.DebugLabeler
	sync.Mutex

	uid        gregor1.UID
	mdb        *libkb.JSONLocalDb
	edb        *encrypteddb.EncryptedDB
	keyFn      func(ctx context.Context) ([32]byte, error)
	aliasBatch map[string]*aliasEntry
	tokenBatch map[chat1.ConvIDStr]*tokenBatch
	mdBatch    map[chat1.ConvIDStr]*mdBatch
}

func newBatchingStore(log, perfLog logger.Logger, uid gregor1.UID,
	keyFn func(ctx context.Context) ([32]byte, error), edb *encrypteddb.EncryptedDB,
	mdb *libkb.JSONLocalDb) *batchingStore {
	b := &batchingStore{
		DebugLabeler: utils.NewDebugLabeler(log, perfLog, "Search.batchingStore", false),
		uid:          uid,
		keyFn:        keyFn,
		edb:          edb,
		mdb:          mdb,
	}
	b.Lock()
	b.resetLocked()
	b.Unlock()
	return b
}

func (b *batchingStore) resetLocked() {
	b.aliasBatch = make(map[string]*aliasEntry)
	b.tokenBatch = make(map[chat1.ConvIDStr]*tokenBatch)
	b.mdBatch = make(map[chat1.ConvIDStr]*mdBatch)
}

func (b *batchingStore) GetTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string) (res *tokenEntry, err error) {
	b.Lock()
	defer b.Unlock()
	batch, ok := b.tokenBatch[convID.ConvIDStr()]
	if ok && batch.tokens[token] != nil {
		return batch.tokens[token].dup(), nil
	}
	key, err := tokenKey(ctx, b.uid, convID, token, b.keyFn)
	if err != nil {
		return nil, err
	}
	res = new(tokenEntry)
	found, err := b.edb.Get(ctx, key, res)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return res, nil
}

func (b *batchingStore) PutTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string, te *tokenEntry) (err error) {
	b.Lock()
	defer b.Unlock()
	key := convID.ConvIDStr()
	batch, ok := b.tokenBatch[key]
	if !ok {
		batch = newTokenBatch(convID)
	}
	batch.tokens[token] = te
	b.tokenBatch[key] = batch
	return nil
}

func (b *batchingStore) RemoveTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string) {
	b.Lock()
	defer b.Unlock()
	batch, ok := b.tokenBatch[convID.ConvIDStr()]
	if ok {
		delete(batch.tokens, token)
	}
	key, err := tokenKey(ctx, b.uid, convID, token, b.keyFn)
	if err != nil {
		b.Debug(ctx, "RemoveTokenEntry: failed to get tokenkey: %s", err)
		return
	}
	if err := b.mdb.Delete(key); err != nil {
		b.Debug(ctx, "RemoveTokenEntry: failed to delete key: %s", err)
	}
}

func (b *batchingStore) GetAliasEntry(ctx context.Context, alias string) (res *aliasEntry, err error) {
	b.Lock()
	defer b.Unlock()
	var ok bool
	if res, ok = b.aliasBatch[alias]; ok {
		return res.dup(), nil
	}
	key, err := aliasKey(ctx, alias, b.keyFn)
	if err != nil {
		return res, err
	}
	res = new(aliasEntry)
	found, err := b.edb.Get(ctx, key, res)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return res, nil
}

func (b *batchingStore) PutAliasEntry(ctx context.Context, alias string, ae *aliasEntry) (err error) {
	b.Lock()
	defer b.Unlock()
	b.aliasBatch[alias] = ae
	return nil
}

func (b *batchingStore) RemoveAliasEntry(ctx context.Context, alias string) {
	b.Lock()
	defer b.Unlock()
	delete(b.aliasBatch, alias)
	key, err := aliasKey(ctx, alias, b.keyFn)
	if err != nil {
		b.Debug(ctx, "RemoveAliasEntry: failed to get key: %s", err)
		return
	}
	if err := b.mdb.Delete(key); err != nil {
		b.Debug(ctx, "RemoveAliasEntry: failed to delete key: %s", err)
	}
}

func (b *batchingStore) GetMetadata(ctx context.Context, convID chat1.ConversationID) (res *indexMetadata, err error) {
	b.Lock()
	defer b.Unlock()
	if md, ok := b.mdBatch[convID.ConvIDStr()]; ok {
		return md.md.dup(), nil
	}
	key := metadataKey(b.uid, convID)
	res = new(indexMetadata)
	found, err := b.mdb.GetIntoMsgpack(res, key)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}
	return res, nil
}

func (b *batchingStore) PutMetadata(ctx context.Context, convID chat1.ConversationID, md *indexMetadata) (err error) {
	b.Lock()
	defer b.Unlock()
	b.mdBatch[convID.ConvIDStr()] = &mdBatch{
		md:     md,
		convID: convID,
	}
	return nil
}

func (b *batchingStore) Flush() (err error) {
	ctx := context.Background()
	defer b.Trace(ctx, func() error { return err }, "Flush")()
	b.Lock()
	defer b.Unlock()
	if len(b.tokenBatch) == 0 && len(b.aliasBatch) == 0 && len(b.mdBatch) == 0 {
		return nil
	}
	defer b.resetLocked()

	b.Debug(ctx, "Flush: flushing tokens from %d convs", len(b.tokenBatch))
	for _, tokenBatch := range b.tokenBatch {
		b.Debug(ctx, "Flush: flushing %d tokens from %s", len(tokenBatch.tokens), tokenBatch.convID)
		for token, te := range tokenBatch.tokens {
			key, err := tokenKey(ctx, b.uid, tokenBatch.convID, token, b.keyFn)
			if err != nil {
				return err
			}
			if err := b.edb.Put(ctx, key, te); err != nil {
				return err
			}
		}
	}
	b.Debug(ctx, "Flush: flushing %d aliases", len(b.aliasBatch))
	for alias, ae := range b.aliasBatch {
		key, err := aliasKey(ctx, alias, b.keyFn)
		if err != nil {
			return err
		}
		if err := b.edb.Put(ctx, key, ae); err != nil {
			return err
		}
	}
	b.Debug(ctx, "Flush: flushing %d conv metadata", len(b.mdBatch))
	for _, mdBatch := range b.mdBatch {
		b.Debug(ctx, "Flush: flushing md from %s", mdBatch.convID)
		if err := b.mdb.PutObjMsgpack(metadataKey(b.uid, mdBatch.convID), nil, mdBatch.md); err != nil {
			return err
		}
	}
	return nil
}

func (b *batchingStore) Cancel() {
	defer b.Trace(context.Background(), func() error { return nil }, "Cancel")()
	b.Lock()
	defer b.Unlock()
	b.resetLocked()
}

type store struct {
	globals.Contextified
	utils.DebugLabeler
	sync.RWMutex

	uid         gregor1.UID
	keyFn       func(ctx context.Context) ([32]byte, error)
	aliasCache  *lru.Cache
	tokenCache  *lru.Cache
	diskStorage diskStorage
}

func newStore(g *globals.Context, uid gregor1.UID) *store {
	ac, _ := lru.New(10000)
	tc, _ := lru.New(3000)
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG())
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &store{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "Search.store", false),
		uid:          uid,
		keyFn:        keyFn,
		aliasCache:   ac,
		tokenCache:   tc,
		diskStorage: newBatchingStore(g.GetLog(), g.GetPerfLog(), uid, keyFn, encrypteddb.New(g.ExternalG(), dbFn, keyFn),
			g.LocalChatDb),
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
	keyFn func(ctx context.Context) ([32]byte, error)) (res libkb.DbKey, err error) {
	return tokenKeyWithVersion(ctx, uid, convID, dat, tokenDiskVersion, keyFn)
}

func tokenKeyWithVersion(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, dat string, version int, keyFn func(ctx context.Context) ([32]byte, error)) (res libkb.DbKey, err error) {
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
	keyFn func(ctx context.Context) ([32]byte, error)) (res libkb.DbKey, err error) {
	return aliasKeyWithVersion(ctx, dat, aliasDiskVersion, keyFn)
}

func aliasKeyWithVersion(ctx context.Context, dat string, version int,
	keyFn func(ctx context.Context) ([32]byte, error)) (res libkb.DbKey, err error) {
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
func (s *store) deleteOldVersions(ctx context.Context, keyFn func(int) (libkb.DbKey, error), maxVersion int) {
	for version := 1; version < maxVersion; version++ {
		key, err := keyFn(version)
		if err != nil {
			s.Debug(ctx, "unable to get key for version %d, %v", version, err)
			continue
		}
		s.Debug(ctx, "cleaning old version %d: for key %v", version, key)
		if err := s.G().LocalChatDb.Delete(key); err != nil {
			s.Debug(ctx, "deleteOldVersions: failed to delete key: %s", err)
		}
	}
}

func (s *store) deleteOldMetadataVersions(ctx context.Context, convID chat1.ConversationID) {
	keyFn := func(version int) (libkb.DbKey, error) {
		return metadataKeyWithVersion(s.uid, convID, version), nil
	}
	s.deleteOldVersions(ctx, keyFn, mdDiskVersion)
}

func (s *store) deleteOldTokenVersions(ctx context.Context, convID chat1.ConversationID, token string) {
	keyFn := func(version int) (libkb.DbKey, error) {
		return tokenKeyWithVersion(ctx, s.uid, convID, token, version, s.keyFn)
	}
	s.deleteOldVersions(ctx, keyFn, tokenDiskVersion)
}

func (s *store) deleteOldAliasVersions(ctx context.Context, alias string) {
	keyFn := func(version int) (libkb.DbKey, error) {
		return aliasKeyWithVersion(ctx, alias, version, s.keyFn)
	}
	s.deleteOldVersions(ctx, keyFn, aliasDiskVersion)
}

func (s *store) GetHits(ctx context.Context, convID chat1.ConversationID, term string) (res map[chat1.MessageID]chat1.EmptyStruct, err error) {
	defer s.Trace(ctx, func() error { return err }, "GetHits")()
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
	defer func() {
		if err == nil {
			s.tokenCache.Add(cacheKey, res.dup())
		}
	}()
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
	return res, nil
}

func (s *store) getAliasEntry(ctx context.Context, alias string) (res *aliasEntry, err error) {
	if dat, ok := s.aliasCache.Get(alias); ok {
		return dat.(*aliasEntry), nil
	}
	defer func() {
		if err == nil {
			s.aliasCache.Add(alias, res.dup())
		}
	}()
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
	return res, nil
}

func (s *store) putTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string, te *tokenEntry) (err error) {
	defer func() {
		if err == nil {
			s.tokenCache.Add(s.tokenCacheKey(convID, token), te.dup())
		}
	}()
	return s.diskStorage.PutTokenEntry(ctx, convID, token, te)
}

func (s *store) putAliasEntry(ctx context.Context, alias string, ae *aliasEntry) (err error) {
	defer func() {
		if err == nil {
			s.aliasCache.Add(alias, ae.dup())
		}
	}()
	return s.diskStorage.PutAliasEntry(ctx, alias, ae)
}

func (s *store) deleteTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string) {
	s.tokenCache.Remove(s.tokenCacheKey(convID, token))
	s.diskStorage.RemoveTokenEntry(ctx, convID, token)
}

func (s *store) deleteAliasEntry(ctx context.Context, alias string) {
	s.aliasCache.Remove(alias)
	s.diskStorage.RemoveAliasEntry(ctx, alias)
}

// addTokens add the given tokens to the index under the given message
// id, when ingesting EDIT messages the msgID is of the superseded msg but the
// tokens are from the EDIT itself.
func (s *store) addTokens(ctx context.Context,
	convID chat1.ConversationID, tokens tokenMap, msgID chat1.MessageID) error {
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
	msg chat1.MessageUnboxed) error {
	tokens := tokensFromMsg(msg)
	return s.addTokens(ctx, convID, tokens, msg.GetMessageID())
}

func (s *store) removeMsg(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessageUnboxed) error {
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

func (s *store) GetMetadata(ctx context.Context, convID chat1.ConversationID) (res *indexMetadata, err error) {
	if res, err = s.diskStorage.GetMetadata(ctx, convID); err != nil {
		return res, err
	}
	if res == nil {
		s.deleteOldMetadataVersions(ctx, convID)
		return newIndexMetadata(), nil
	}
	if res.Version != refIndexMetadata.Version {
		return newIndexMetadata(), nil
	}
	return res, nil
}

func (s *store) Add(ctx context.Context, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Add")()
	s.Lock()
	defer s.Unlock()

	fetchSupersededMsgs := func(msg chat1.MessageUnboxed) []chat1.MessageUnboxed {
		superIDs, err := utils.GetSupersedes(msg)
		if err != nil {
			s.Debug(ctx, "unable to get supersedes: %v", err)
			return nil
		}
		reason := chat1.GetThreadReason_INDEXED_SEARCH
		supersededMsgs, err := s.G().ChatHelper.GetMessages(ctx, s.uid, convID, superIDs,
			false /* resolveSupersedes*/, &reason)
		if err != nil {
			// Log but ignore error
			s.Debug(ctx, "unable to get fetch messages: %v", err)
			return nil
		}
		return supersededMsgs
	}

	modified := false
	md, err := s.GetMetadata(ctx, convID)
	if err != nil {
		s.Debug(ctx, "failed to get metadata: %s", err)
		return err
	}
	defer func() {
		if modified {
			if err := s.diskStorage.PutMetadata(ctx, convID, md); err != nil {
				s.Debug(ctx, "failed to put metadata: %s", err)
			}
		}
	}()
	for _, msg := range msgs {
		seenIDs := md.SeenIDs
		// Don't add if we've seen
		if _, ok := seenIDs[msg.GetMessageID()]; ok {
			continue
		}
		modified = true
		seenIDs[msg.GetMessageID()] = chat1.EmptyStruct{}
		// NOTE DELETE and DELETEHISTORY are handled through calls to `remove`,
		// other messages will be added if there is any content that can be
		// indexed.
		switch msg.GetMessageType() {
		case chat1.MessageType_ATTACHMENTUPLOADED:
			supersededMsgs := fetchSupersededMsgs(msg)
			for _, sm := range supersededMsgs {
				seenIDs[sm.GetMessageID()] = chat1.EmptyStruct{}
				err := s.addMsg(ctx, convID, sm)
				if err != nil {
					return err
				}
			}
		case chat1.MessageType_EDIT:
			tokens := tokensFromMsg(msg)
			supersededMsgs := fetchSupersededMsgs(msg)
			// remove the original message text and replace it with the edited
			// contents (using the original id in the index)
			for _, sm := range supersededMsgs {
				seenIDs[sm.GetMessageID()] = chat1.EmptyStruct{}
				err := s.removeMsg(ctx, convID, sm)
				if err != nil {
					return err
				}
				err = s.addTokens(ctx, convID, tokens, sm.GetMessageID())
				if err != nil {
					return err
				}
			}
		default:
			err := s.addMsg(ctx, convID, msg)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// Remove tokenizes the message content and updates/removes index keys for each token.
func (s *store) Remove(ctx context.Context, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Remove")()
	s.Lock()
	defer s.Unlock()

	md, err := s.GetMetadata(ctx, convID)
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
		seenIDs[msg.GetMessageID()] = chat1.EmptyStruct{}
		err := s.removeMsg(ctx, convID, msg)
		if err != nil {
			return err
		}
	}
	if modified {
		return s.diskStorage.PutMetadata(ctx, convID, md)
	}
	return nil
}

func (s *store) ClearMemory() {
	defer s.Trace(context.Background(), func() error { return nil }, "ClearMemory")()
	s.aliasCache.Purge()
	s.tokenCache.Purge()
	s.diskStorage.Cancel()
}

func (s *store) Flush() error {
	return s.diskStorage.Flush()
}
