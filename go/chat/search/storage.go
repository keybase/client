package search

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"fmt"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const indexVersion = 7
const tokenEntryVersion = 2
const aliasEntryVersion = 1

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
	Version string                       `codec:"v"`
	Aliases map[string]chat1.EmptyStruct `codec:"a"`
}

func newAliasEntry() *aliasEntry {
	return &aliasEntry{
		Version: fmt.Sprintf("%d:%d", indexVersion, aliasEntryVersion),
		Aliases: make(map[string]chat1.EmptyStruct),
	}
}

var refAliasEntry = newAliasEntry()

type store struct {
	utils.DebugLabeler
	lockTab *libkb.LockTable
	globals.Contextified
	keyFn      func(ctx context.Context) ([32]byte, error)
	aliasCache *lru.Cache
	edb        *encrypteddb.EncryptedDB
}

func newStore(g *globals.Context) *store {
	ac, _ := lru.New(10000)
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG(), storage.DefaultSecretUI)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &store{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Search.store", false),
		lockTab:      &libkb.LockTable{},
		keyFn:        keyFn,
		aliasCache:   ac,
		edb:          encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (s *store) metadataKey(uid gregor1.UID, convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: fmt.Sprintf("md:%s:%s", uid, convID),
	}
}

func (s *store) entryKey(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, dat, name string) (res libkb.DbKey, err error) {
	material, err := s.keyFn(ctx)
	if err != nil {
		return res, err
	}
	termPart := append(append([]byte(dat), material[:]...), convID.DbShortForm()...)
	termPartBytes := hmac.New(sha256.New, termPart).Sum(nil)
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: fmt.Sprintf("%s:%s:%s:%s", name, uid, convID, termPartBytes),
	}, nil
}

func (s *store) termKey(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, dat string) (res libkb.DbKey, err error) {
	return s.entryKey(ctx, uid, convID, dat, "term")
}

func (s *store) aliasKey(ctx context.Context, dat string) (res libkb.DbKey, err error) {
	material, err := s.keyFn(ctx)
	if err != nil {
		return res, err
	}
	termPart := append([]byte(dat), material[:]...)
	termPartBytes := hmac.New(sha256.New, termPart).Sum(nil)
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: fmt.Sprintf("al:%s", termPartBytes),
	}, nil
}

func (s *store) getHits(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, term string) (res map[chat1.MessageID]chat1.EmptyStruct, err error) {
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

func (s *store) getTokenEntry(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, token string) (res *tokenEntry, err error) {
	var te tokenEntry
	key, err := s.termKey(ctx, uid, convID, token)
	if err != nil {
		return nil, err
	}
	found, err := s.edb.Get(ctx, key, &te)
	if err != nil {
		return nil, err
	}
	if !found {
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
	key, err := s.aliasKey(ctx, alias)
	if err != nil {
		return res, err
	}
	found, err := s.edb.Get(ctx, key, &ae)
	if err != nil {
		return nil, err
	}
	if !found {
		return newAliasEntry(), nil
	}
	res = &ae
	if res.Version != refAliasEntry.Version {
		return newAliasEntry(), nil
	}
	s.aliasCache.Add(alias, res)
	return res, nil
}

func (s *store) putTokenEntry(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	token string, te *tokenEntry) error {
	key, err := s.termKey(ctx, uid, convID, token)
	if err != nil {
		return err
	}
	return s.edb.Put(ctx, key, te)
}

func (s *store) putAliasEntry(ctx context.Context, alias string, ae *aliasEntry) error {
	key, err := s.aliasKey(ctx, alias)
	if err != nil {
		return err
	}
	s.aliasCache.Remove(key)
	return s.edb.Put(ctx, key, ae)
}

func (s *store) deleteTokenEntry(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	token string) {
	key, err := s.termKey(ctx, uid, convID, token)
	if err != nil {
		s.Debug(ctx, "deleteTokenEntry: failed to get token key: %s", err)
		return
	}
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
func (s *store) addTokensLocked(ctx context.Context, batch *addTokenBatch, uid gregor1.UID,
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
			aliasEntry.Aliases[token] = chat1.EmptyStruct{}
		}
	}
	return nil
}

func (s *store) addMsgLocked(ctx context.Context, batch *addTokenBatch, uid gregor1.UID, convID chat1.ConversationID,
	msg chat1.MessageUnboxed) error {
	tokens := tokensFromMsg(msg)
	return s.addTokensLocked(ctx, batch, uid, convID, tokens, msg.GetMessageID())
}

func (s *store) removeMsgLocked(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
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
			delete(aliasEntry.Aliases, token)
			if len(aliasEntry.Aliases) == 0 {
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

func (s *store) getMetadata(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res *indexMetadata, err error) {
	var md indexMetadata
	found, err := s.G().LocalChatDb.GetIntoMsgpack(&md, s.metadataKey(uid, convID))
	if err != nil {
		return res, err
	}
	if !found {
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

func (s *store) add(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed) (err error) {
	defer s.Trace(ctx, func() error { return err }, "add")()
	lock := s.lockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)

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

	md, err := s.getMetadata(ctx, uid, convID)
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
				s.addMsgLocked(ctx, batch, uid, convID, sm)
			}
		case chat1.MessageType_EDIT:
			tokens := tokensFromMsg(msg)
			supersededMsgs := fetchSupersededMsgs(msg)
			// remove the original message text and replace it with the edited
			// contents (using the original id in the index)
			for _, sm := range supersededMsgs {
				seenIDs[sm.GetMessageID()] = chat1.EmptyStruct{}
				s.removeMsgLocked(ctx, uid, convID, sm)
				s.addTokensLocked(ctx, batch, uid, convID, tokens, sm.GetMessageID())
			}
		default:
			s.addMsgLocked(ctx, batch, uid, convID, msg)
		}
	}
	return nil
}

// Remove tokenizes the message content and updates/removes index keys for each token.
func (s *store) remove(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed) (err error) {
	lock := s.lockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)

	md, err := s.getMetadata(ctx, uid, convID)
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
		s.removeMsgLocked(ctx, uid, convID, msg)
	}
	err = s.putMetadata(ctx, uid, convID, md)
	return err
}
