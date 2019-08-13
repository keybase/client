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

type store struct {
	globals.Contextified
	utils.DebugLabeler
	sync.RWMutex

	keyFn      func(ctx context.Context) ([32]byte, error)
	aliasCache *lru.Cache
	tokenCache *lru.Cache
	edb        *encrypteddb.EncryptedDB
}

func newStore(g *globals.Context) *store {
	ac, _ := lru.New(10000)
	tc, _ := lru.New(3000)
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG(), storage.DefaultSecretUI)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &store{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Search.store", false),
		keyFn:        keyFn,
		aliasCache:   ac,
		tokenCache:   tc,
		edb:          encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (s *store) metadataKey(uid gregor1.UID, convID chat1.ConversationID) libkb.DbKey {
	return s.metadataKeyWithVersion(uid, convID, mdDiskVersion)
}

func (s *store) metadataKeyWithVersion(uid gregor1.UID, convID chat1.ConversationID, version int) libkb.DbKey {
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

func (s *store) tokenKey(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, dat string) (res libkb.DbKey, err error) {
	return s.tokenKeyWithVersion(ctx, uid, convID, dat, tokenDiskVersion)
}

func (s *store) tokenKeyWithVersion(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, dat string, version int) (res libkb.DbKey, err error) {
	var key string
	switch version {
	case 1:
		material, err := s.keyFn(ctx)
		if err != nil {
			return res, err
		}
		hasher := hmac.New(sha256.New, material[:])
		hasher.Write([]byte(dat))
		hasher.Write(convID.DbShortForm())
		hasher.Write(uid.Bytes())
		hasher.Write([]byte(libkb.EncryptionReasonChatIndexerTokenKey))
		key = fmt.Sprintf("tm:%s:%s:%s", uid, convID, hasher.Sum(nil))
	}
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: key,
	}, nil
}

func (s *store) aliasKey(ctx context.Context, dat string) (res libkb.DbKey, err error) {
	return s.aliasKeyWithVersion(ctx, dat, aliasDiskVersion)
}

func (s *store) aliasKeyWithVersion(ctx context.Context, dat string, version int) (res libkb.DbKey, err error) {
	var key string
	switch version {
	case 1:
		material, err := s.keyFn(ctx)
		if err != nil {
			return res, err
		}
		hasher := hmac.New(sha256.New, material[:])
		hasher.Write([]byte(dat))
		hasher.Write([]byte(libkb.EncryptionReasonChatIndexerAliasKey))
		key = fmt.Sprintf("al:%s", hasher.Sum(nil))
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

func (s *store) deleteOldMetadataVersions(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) {
	keyFn := func(version int) (libkb.DbKey, error) {
		return s.metadataKeyWithVersion(uid, convID, version), nil
	}
	s.deleteOldVersions(ctx, keyFn, mdDiskVersion)
}

func (s *store) deleteOldTokenVersions(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, token string) {
	keyFn := func(version int) (libkb.DbKey, error) {
		return s.tokenKeyWithVersion(ctx, uid, convID, token, version)
	}
	s.deleteOldVersions(ctx, keyFn, tokenDiskVersion)
}

func (s *store) deleteOldAliasVersions(ctx context.Context, alias string) {
	keyFn := func(version int) (libkb.DbKey, error) {
		return s.aliasKeyWithVersion(ctx, alias, version)
	}
	s.deleteOldVersions(ctx, keyFn, aliasDiskVersion)
}

func (s *store) GetHits(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, term string) (res map[chat1.MessageID]chat1.EmptyStruct, err error) {
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
		te, err := s.getTokenEntry(ctx, uid, convID, term)
		if err != nil {
			return nil, err
		}
		for msgID := range te.MsgIDs {
			res[msgID] = chat1.EmptyStruct{}
		}
	}
	return res, nil
}

func (s *store) tokenCacheKey(uid gregor1.UID, convID chat1.ConversationID, token string) string {
	return fmt.Sprintf("%s:%s:%s", uid, convID, token)
}

func (s *store) getTokenEntry(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, token string) (res *tokenEntry, err error) {
	cacheKey := s.tokenCacheKey(uid, convID, token)
	if te, ok := s.tokenCache.Get(cacheKey); ok {
		return te.(*tokenEntry), nil
	}
	defer func() {
		if err == nil {
			s.tokenCache.Add(cacheKey, res)
		}
	}()
	var te tokenEntry
	key, err := s.tokenKey(ctx, uid, convID, token)
	if err != nil {
		return nil, err
	}
	found, err := s.edb.Get(ctx, key, &te)
	if err != nil {
		return nil, err
	}
	if !found {
		s.deleteOldTokenVersions(ctx, uid, convID, token)
		return newTokenEntry(), nil
	}
	res = &te
	if res.Version != refTokenEntry.Version {
		return newTokenEntry(), nil
	}
	return res, nil
}

func (s *store) getAliasEntry(ctx context.Context, alias string) (res *aliasEntry, err error) {
	var ae aliasEntry
	if dat, ok := s.aliasCache.Get(alias); ok {
		return dat.(*aliasEntry), nil
	}
	defer func() {
		if err == nil {
			s.aliasCache.Add(alias, res)
		}
	}()
	key, err := s.aliasKey(ctx, alias)
	if err != nil {
		return res, err
	}
	found, err := s.edb.Get(ctx, key, &ae)
	if err != nil {
		return nil, err
	}
	if !found {
		s.deleteOldAliasVersions(ctx, alias)
		return newAliasEntry(), nil
	}
	res = &ae
	if res.Version != refAliasEntry.Version {
		return newAliasEntry(), nil
	}
	return res, nil
}

func (s *store) putTokenEntry(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	token string, te *tokenEntry) (err error) {
	defer func() {
		if err == nil {
			s.tokenCache.Add(s.tokenCacheKey(uid, convID, token), te)
		}
	}()
	key, err := s.tokenKey(ctx, uid, convID, token)
	if err != nil {
		return err
	}
	return s.edb.Put(ctx, key, te)
}

func (s *store) putAliasEntry(ctx context.Context, alias string, ae *aliasEntry) (err error) {
	defer func() {
		if err == nil {
			s.aliasCache.Add(alias, ae)
		}
	}()
	key, err := s.aliasKey(ctx, alias)
	if err != nil {
		return err
	}
	return s.edb.Put(ctx, key, ae)
}

func (s *store) deleteTokenEntry(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	token string) {
	key, err := s.tokenKey(ctx, uid, convID, token)
	if err != nil {
		s.Debug(ctx, "deleteTokenEntry: failed to get token key: %s", err)
		return
	}
	s.tokenCache.Remove(s.tokenCacheKey(uid, convID, token))
	if err := s.G().LocalChatDb.Delete(key); err != nil {
		s.Debug(ctx, "deleteTokenEntry: failed to delete key: %s", err)
	}
}

func (s *store) deleteAliasEntry(ctx context.Context, alias string) {
	key, err := s.aliasKey(ctx, alias)
	if err != nil {
		s.Debug(ctx, "deleteAliasEntry: failed to get key: %s", err)
		return
	}
	s.aliasCache.Remove(key)
	if err := s.G().LocalChatDb.Delete(key); err != nil {
		s.Debug(ctx, "deleteAliasEntry: failed to delete key: %s", err)
	}
}

type addTokenBatch struct {
	md           *indexMetadata
	tokenEntries map[string]*tokenEntry
	aliasEntries map[string]*aliasEntry
}

func newAddTokenBatch() *addTokenBatch {
	return &addTokenBatch{
		tokenEntries: make(map[string]*tokenEntry),
		aliasEntries: make(map[string]*aliasEntry),
	}
}

func (s *store) commitAddTokenBatch(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	batch *addTokenBatch) (err error) {
	defer s.Trace(ctx, func() error { return err }, "commitAddTokenBatch: toks: %d aliases: %d",
		len(batch.tokenEntries), len(batch.aliasEntries))()
	for token, te := range batch.tokenEntries {
		if err := s.putTokenEntry(ctx, uid, convID, token, te); err != nil {
			return err
		}
	}
	for alias, ae := range batch.aliasEntries {
		if err := s.putAliasEntry(ctx, alias, ae); err != nil {
			return err
		}
	}
	return s.putMetadata(ctx, uid, convID, batch.md)
}

func (s *store) getTokenEntryWithBatch(ctx context.Context, batch *addTokenBatch, uid gregor1.UID,
	convID chat1.ConversationID, token string) (*tokenEntry, error) {
	if te, ok := batch.tokenEntries[token]; ok {
		return te, nil
	}
	te, err := s.getTokenEntry(ctx, uid, convID, token)
	if err != nil {
		return te, err
	}
	batch.tokenEntries[token] = te
	return te, nil
}

func (s *store) getAliasEntryWithBatch(ctx context.Context, batch *addTokenBatch, alias string) (*aliasEntry, error) {
	if ae, ok := batch.aliasEntries[alias]; ok {
		return ae, nil
	}
	ae, err := s.getAliasEntry(ctx, alias)
	if err != nil {
		return ae, err
	}
	batch.aliasEntries[alias] = ae
	return ae, nil
}

// addTokens add the given tokens to the index under the given message
// id, when ingesting EDIT messages the msgID is of the superseded msg but the
// tokens are from the EDIT itself.
func (s *store) addTokens(ctx context.Context, batch *addTokenBatch, uid gregor1.UID,
	convID chat1.ConversationID, tokens tokenMap, msgID chat1.MessageID) error {
	for token, aliases := range tokens {
		// Update the token entry with the msg ID hit
		te, err := s.getTokenEntryWithBatch(ctx, batch, uid, convID, token)
		if err != nil {
			return err
		}
		te.MsgIDs[msgID] = chat1.EmptyStruct{}

		// Update all the aliases to point at the token
		for alias := range aliases {
			aliasEntry, err := s.getAliasEntryWithBatch(ctx, batch, alias)
			if err != nil {
				return err
			}
			aliasEntry.add(token)
		}
	}
	return nil
}

func (s *store) addMsg(ctx context.Context, batch *addTokenBatch, uid gregor1.UID, convID chat1.ConversationID,
	msg chat1.MessageUnboxed) error {
	tokens := tokensFromMsg(msg)
	return s.addTokens(ctx, batch, uid, convID, tokens, msg.GetMessageID())
}

func (s *store) removeMsg(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
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
		te, err := s.getTokenEntry(ctx, uid, convID, token)
		if err != nil {
			return err
		}
		delete(te.MsgIDs, msgID)
		if len(te.MsgIDs) == 0 {
			s.deleteTokenEntry(ctx, uid, convID, token)
		} else {
			// If there are still IDs, just write out the updated version
			if err := s.putTokenEntry(ctx, uid, convID, token, te); err != nil {
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

func (s *store) GetMetadata(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res *indexMetadata, err error) {
	var md indexMetadata
	found, err := s.G().LocalChatDb.GetIntoMsgpack(&md, s.metadataKey(uid, convID))
	if err != nil {
		return res, err
	}
	if !found {
		s.deleteOldMetadataVersions(ctx, uid, convID)
		return newIndexMetadata(), nil
	}
	if md.Version != refIndexMetadata.Version {
		return newIndexMetadata(), nil
	}
	return &md, nil
}

func (s *store) putMetadata(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	md *indexMetadata) error {
	return s.G().LocalChatDb.PutObjMsgpack(s.metadataKey(uid, convID), nil, md)
}

func (s *store) Add(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Add")()
	s.Lock()
	defer s.Unlock()

	batch := newAddTokenBatch()
	defer func() {
		if err == nil {
			s.commitAddTokenBatch(ctx, uid, convID, batch)
		}
	}()
	fetchSupersededMsgs := func(msg chat1.MessageUnboxed) []chat1.MessageUnboxed {
		superIDs, err := utils.GetSupersedes(msg)
		if err != nil {
			s.Debug(ctx, "unable to get supersedes: %v", err)
			return nil
		}
		reason := chat1.GetThreadReason_INDEXED_SEARCH
		supersededMsgs, err := s.G().ChatHelper.GetMessages(ctx, uid, convID, superIDs,
			false /* resolveSupersedes*/, &reason)
		if err != nil {
			// Log but ignore error
			s.Debug(ctx, "unable to get fetch messages: %v", err)
			return nil
		}
		return supersededMsgs
	}

	md, err := s.GetMetadata(ctx, uid, convID)
	if err != nil {
		return err
	}
	batch.md = md
	for _, msg := range msgs {
		seenIDs := md.SeenIDs
		// Don't add if we've seen
		if _, ok := seenIDs[msg.GetMessageID()]; ok {
			continue
		}
		seenIDs[msg.GetMessageID()] = chat1.EmptyStruct{}
		// NOTE DELETE and DELETEHISTORY are handled through calls to `remove`,
		// other messages will be added if there is any content that can be
		// indexed.
		switch msg.GetMessageType() {
		case chat1.MessageType_ATTACHMENTUPLOADED:
			supersededMsgs := fetchSupersededMsgs(msg)
			for _, sm := range supersededMsgs {
				seenIDs[sm.GetMessageID()] = chat1.EmptyStruct{}
				s.addMsg(ctx, batch, uid, convID, sm)
			}
		case chat1.MessageType_EDIT:
			tokens := tokensFromMsg(msg)
			supersededMsgs := fetchSupersededMsgs(msg)
			// remove the original message text and replace it with the edited
			// contents (using the original id in the index)
			for _, sm := range supersededMsgs {
				seenIDs[sm.GetMessageID()] = chat1.EmptyStruct{}
				s.removeMsg(ctx, uid, convID, sm)
				s.addTokens(ctx, batch, uid, convID, tokens, sm.GetMessageID())
			}
		default:
			s.addMsg(ctx, batch, uid, convID, msg)
		}
	}
	return nil
}

// Remove tokenizes the message content and updates/removes index keys for each token.
func (s *store) Remove(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Remove")()
	s.Lock()
	defer s.Unlock()

	md, err := s.GetMetadata(ctx, uid, convID)
	if err != nil {
		return err
	}

	seenIDs := md.SeenIDs
	for _, msg := range msgs {
		// Don't remove if we haven't seen
		if _, ok := seenIDs[msg.GetMessageID()]; !ok {
			continue
		}
		seenIDs[msg.GetMessageID()] = chat1.EmptyStruct{}
		s.removeMsg(ctx, uid, convID, msg)
	}
	err = s.putMetadata(ctx, uid, convID, md)
	return err
}

func (s *store) ClearMemory() {
	s.aliasCache.Purge()
	s.tokenCache.Purge()
}
