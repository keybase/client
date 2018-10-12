package search

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

// Bumped whenever there are tokenization or structural changes to building the
// index
const indexVersion = 1

type store struct {
	sync.Mutex
	globals.Contextified
	utils.DebugLabeler
	encryptedDB *encrypteddb.EncryptedDB
}

// store keeps an encrypted index of chat messages for all conversations to
// enable full inbox search locally.
// Data is stored in leveldb in the form:
// (convID) -> {
//                token: { msgID,...},
//                ...
//             },
//     ...       ->        ...
// NOTE: as a performance optimization we may want to splice the metdata from
// the index itself so we can quickly operate on the metadata separately from
// the index and have less bytes to encrypt/decrypt on reads (metadata only
// contains only msg ids and no user content).
func newStore(g *globals.Context) *store {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG(), storage.DefaultSecretUI)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &store{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Search.store", false),
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (s *store) dbKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: fmt.Sprintf("idx:%s:%s", convID, uid),
	}
}

func (s *store) getLocked(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (ret *chat1.ConversationIndex, err error) {
	defer func() {
		// return a blank index
		if ret == nil {
			ret = &chat1.ConversationIndex{}
			ret.Index = map[string]map[chat1.MessageID]bool{}
			ret.Metadata.SeenIDs = map[chat1.MessageID]bool{}
		}
	}()
	dbKey := s.dbKey(convID, uid)
	var entry chat1.ConversationIndex
	found, err := s.encryptedDB.Get(ctx, dbKey, &entry)
	if err != nil || !found {
		return nil, err
	}
	if entry.Metadata.Version != indexVersion {
		// drop the whole index for this conv
		err = s.deleteLocked(ctx, convID, uid)
		return nil, err
	}
	return &entry, nil
}

func (s *store) putLocked(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, entry *chat1.ConversationIndex) error {
	if entry == nil {
		return nil
	}
	dbKey := s.dbKey(convID, uid)
	entry.Metadata.Version = indexVersion
	return s.encryptedDB.Put(ctx, dbKey, *entry)
}

func (s *store) deleteLocked(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) error {
	dbKey := s.dbKey(convID, uid)
	return s.encryptedDB.Delete(ctx, dbKey)
}

func (s *store) getConvIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (entry *chat1.ConversationIndex, err error) {
	s.Lock()
	defer s.Unlock()
	return s.getLocked(ctx, convID, uid)
}

// addTokensLocked add the given tokens to the index under the given message
// id, when ingesting EDIT messages the msgID is of the superseded msg but the
// tokens are from the EDIT itself.
func (s *store) addTokensLocked(entry *chat1.ConversationIndex, tokens []string, msgID chat1.MessageID) {
	for _, token := range tokens {
		msgIDs, ok := entry.Index[token]
		if !ok {
			msgIDs = map[chat1.MessageID]bool{}
		}
		msgIDs[msgID] = true
		entry.Index[token] = msgIDs
	}
}

func (s *store) addMsgLocked(entry *chat1.ConversationIndex, msg chat1.MessageUnboxed) {
	tokens := tokensFromMsg(msg)
	s.addTokensLocked(entry, tokens, msg.GetMessageID())
}

func (s *store) removeMsgLocked(entry *chat1.ConversationIndex, msg chat1.MessageUnboxed) {
	tokens := tokensFromMsg(msg)

	// find the msgID that the index stores
	var msgID chat1.MessageID
	switch msg.GetMessageType() {
	case chat1.MessageType_EDIT, chat1.MessageType_ATTACHMENTUPLOADED:
		superIDs, err := utils.GetSupersedes(msg)
		if err != nil || len(superIDs) != 1 {
			return
		}
		msgID = superIDs[0]
	default:
		msgID = msg.GetMessageID()
	}
	for _, token := range tokens {
		msgIDs, ok := entry.Index[token]
		if !ok {
			continue
		}
		delete(msgIDs, msgID)
		if len(msgIDs) == 0 {
			delete(entry.Index, token)
		}
	}
}

func (s *store) add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) (err error) {
	s.Lock()
	defer s.Unlock()

	entry, err := s.getLocked(ctx, convID, uid)
	if err != nil {
		return err
	}

	fetchSupersededMsgs := func(msg chat1.MessageUnboxed) []chat1.MessageUnboxed {
		superIDs, err := utils.GetSupersedes(msg)
		if err != nil {
			s.G().Log.CDebugf(ctx, "unable to get supersedes: %v", err)
			return nil
		}
		reason := chat1.GetThreadReason_INDEXED_SEARCH
		if conv == nil {
			inbox, err := s.G().InboxSource.ReadUnverified(ctx, uid, true /* useLocalData */, &chat1.GetInboxQuery{
				ConvIDs: []chat1.ConversationID{convID},
			}, nil)
			if err != nil || len(inbox.ConvsUnverified) != 1 {
				s.G().Log.CDebugf(ctx, "unable to read inbox: %v", err)
				return nil
			}
			conv = &inbox.ConvsUnverified[0].Conv
		}
		supersededMsgs, err := s.G().ConvSource.GetMessages(ctx, conv, uid, superIDs, &reason)
		if err != nil {
			// Log but ignore error
			s.G().Log.CDebugf(ctx, "unable to get fetch messages: %v", err)
			return nil
		}
		return supersededMsgs
	}

	for _, msg := range msgs {
		seenIDs := entry.Metadata.SeenIDs
		// Don't add if we've seen
		if _, ok := seenIDs[msg.GetMessageID()]; ok {
			continue
		}
		seenIDs[msg.GetMessageID()] = true
		// NOTE DELETE and DELETEHISTORY are handled through calls to `remove`,
		// other messages will be added if there is any content that can be
		// indexed.
		switch msg.GetMessageType() {
		case chat1.MessageType_ATTACHMENTUPLOADED:
			supersededMsgs := fetchSupersededMsgs(msg)
			for _, sm := range supersededMsgs {
				seenIDs[sm.GetMessageID()] = true
				s.addMsgLocked(entry, sm)
			}
		case chat1.MessageType_EDIT:
			tokens := tokensFromMsg(msg)
			supersededMsgs := fetchSupersededMsgs(msg)
			// remove the original message text and replace it with the edited
			// contents (using the original id in the index)
			for _, sm := range supersededMsgs {
				seenIDs[sm.GetMessageID()] = true
				s.removeMsgLocked(entry, sm)
				s.addTokensLocked(entry, tokens, sm.GetMessageID())
			}
		default:
			s.addMsgLocked(entry, msg)
		}
	}
	err = s.putLocked(ctx, convID, uid, entry)
	return err
}

// Remove tokenizes the message content and updates/removes index keys for each token.
func (s *store) remove(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) (err error) {
	s.Lock()
	defer s.Unlock()

	entry, err := s.getLocked(ctx, convID, uid)
	if err != nil {
		return err
	}

	// walk through the messages in ascending order
	seenIDs := entry.Metadata.SeenIDs
	for _, msg := range msgs {
		// Don't remove if we haven't seen
		if _, ok := entry.Metadata.SeenIDs[msg.GetMessageID()]; !ok {
			continue
		}
		seenIDs[msg.GetMessageID()] = true
		s.removeMsgLocked(entry, msg)
	}
	err = s.putLocked(ctx, convID, uid, entry)
	return err
}
