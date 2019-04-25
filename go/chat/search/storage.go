package search

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/buger/jsonparser"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/jsonparserw"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type store struct {
	lockTab *libkb.LockTable
	globals.Contextified
	utils.DebugLabeler
	encryptedDB *encrypteddb.EncryptedDB
}

// store keeps an encrypted index of chat messages for all conversations
// to enable full inbox search locally.  Index data for each conversation
// is stored in an encrypted leveldb in the form:
// (uid,convID) -> {
//  Index: {
//     token: { msgID,... },
//     ...
//  },
//  Alias: {
//    alias: { token,... },
//    ...
//  },
//  Metadata: chat1.ConversationIndexMetadata
//}
// NOTE: as a performance optimization we may want to split the metadata
// from the index itself so we can quickly operate on the metadata
// separately from the index and have less bytes to encrypt/decrypt on
// reads (metadata only contains only msg ids and no user content).
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
		lockTab:      &libkb.LockTable{},
	}
}

func (s *store) dbKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: fmt.Sprintf("idx_j:%s:%s", uid, convID),
	}
}

func (s *store) marshal(idx *chat1.ConversationIndexDisk) ([]byte, error) {
	res, err := json.Marshal(idx)
	s.Debug(context.TODO(), "marshal: %s", res)
	return res, err
}

func (s *store) unmarshalIndex(idx *chat1.ConversationIndexDisk, dat []byte) (err error) {
	var res []chat1.TokenTuple
	jsonparser.ArrayEach(dat,
		func(value []byte, dataType jsonparser.ValueType, offset int, err error) {
			var token string
			token, err = jsonparserw.GetString(value, "t")
			if err != nil {
				return
			}
			var tokenTuple chat1.TokenTuple
			tokenTuple.Token = token
			jsonparser.ArrayEach(value,
				func(value []byte, dataType jsonparser.ValueType, offset int, err error) {
					var msgID int64
					msgID, err = jsonparserw.GetInt(value)
					if err != nil {
						return
					}
					tokenTuple.MsgIDs = append(tokenTuple.MsgIDs, chat1.MessageID(msgID))
				}, "m")
			if err != nil {
				return
			}
			res = append(res, tokenTuple)
		})
	if err != nil {
		return err
	}
	idx.Index = res
	return nil
}

func (s *store) unmarshalAliases(idx *chat1.ConversationIndexDisk, dat []byte) (err error) {
	var res []chat1.AliasTuple
	jsonparser.ArrayEach(dat,
		func(value []byte, dataType jsonparser.ValueType, offset int, err error) {
			s.Debug(context.TODO(), "unmarshal: aliases: %s", value)
			var alias string
			alias, err = jsonparserw.GetString(value, "a")
			if err != nil {
				return
			}
			var aliasTuple chat1.AliasTuple
			aliasTuple.Alias = alias
			jsonparser.ArrayEach(value,
				func(value []byte, dataType jsonparser.ValueType, offset int, err error) {
					var token string
					token, err = jsonparserw.GetString(value)
					if err != nil {
						return
					}
					aliasTuple.Tokens = append(aliasTuple.Tokens, token)
				}, "t")
			if err != nil {
				return
			}
			res = append(res, aliasTuple)
		})
	if err != nil {
		return err
	}
	idx.Alias = res
	return nil
}

func (s *store) unmarshalMetadata(idx *chat1.ConversationIndexDisk, dat []byte) (err error) {
	version, err := jsonparserw.GetInt(dat, "v")
	if err != nil {
		return err
	}
	var seenIDs []chat1.MessageID
	jsonparser.ArrayEach(dat,
		func(value []byte, dataType jsonparser.ValueType, offset int, err error) {
			var msgID int64
			msgID, err = jsonparserw.GetInt(value)
			if err != nil {
				return
			}
			seenIDs = append(seenIDs, chat1.MessageID(msgID))
		}, "s")
	if err != nil {
		return err
	}
	idx.Metadata = chat1.ConversationIndexMetadataDisk{
		Version: int(version),
		SeenIDs: seenIDs,
	}
	return nil
}

func (s *store) unmarshal(idx *chat1.ConversationIndexDisk, dat []byte) error {
	s.Debug(context.TODO(), "unmarshal: begin: %s", dat)
	jsonIndexList, _, _, err := jsonparser.Get(dat, "i")
	if err != nil {
		return err
	}
	jsonAliasList, _, _, err := jsonparser.Get(dat, "a")
	if err != nil {
		return err
	}
	jsonMetadata, _, _, err := jsonparser.Get(dat, "metadata")
	if err != nil {
		return err
	}

	if err := s.unmarshalIndex(idx, jsonIndexList); err != nil {
		return err
	}
	if err := s.unmarshalAliases(idx, jsonAliasList); err != nil {
		return err
	}
	if err := s.unmarshalMetadata(idx, jsonMetadata); err != nil {
		return err
	}
	return nil
}

func (s *store) getLocked(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (ret *chat1.ConversationIndex, err error) {
	defer func() {
		// return a blank index
		if err == nil && ret == nil {
			ret = &chat1.ConversationIndex{
				Index: make(map[string]map[chat1.MessageID]chat1.EmptyStruct),
				Alias: make(map[string]map[string]chat1.EmptyStruct),
				Metadata: chat1.ConversationIndexMetadata{
					SeenIDs: make(map[chat1.MessageID]chat1.EmptyStruct),
				},
			}
		}
		if err != nil {
			if derr := s.deleteLocked(ctx, convID, uid); derr != nil {
				s.Debug(ctx, "unable to delete: %v", derr)
			}
		}
	}()

	dbKey := s.dbKey(convID, uid)
	var entry chat1.ConversationIndexDisk
	raw, found, err := s.encryptedDB.GetRaw(ctx, dbKey)
	if err != nil || !found {
		return nil, err
	}
	if err := s.unmarshal(&entry, raw); err != nil {
		return nil, err
	}
	if entry.Metadata.Version != IndexVersion {
		// drop the whole index for this conv
		err = s.deleteLocked(ctx, convID, uid)
		return nil, err
	}

	ret = &chat1.ConversationIndex{
		Index: make(map[string]map[chat1.MessageID]chat1.EmptyStruct, len(entry.Index)),
		Alias: make(map[string]map[string]chat1.EmptyStruct, len(entry.Alias)),
		Metadata: chat1.ConversationIndexMetadata{
			Version: entry.Metadata.Version,
			SeenIDs: make(map[chat1.MessageID]chat1.EmptyStruct, len(entry.Metadata.SeenIDs)),
		},
	}
	for _, t := range entry.Index {
		ret.Index[t.Token] = make(map[chat1.MessageID]chat1.EmptyStruct, len(t.MsgIDs))
		for _, msgID := range t.MsgIDs {
			ret.Index[t.Token][msgID] = chat1.EmptyStruct{}
		}
	}
	for _, t := range entry.Alias {
		ret.Alias[t.Alias] = make(map[string]chat1.EmptyStruct, len(t.Tokens))
		for _, token := range t.Tokens {
			ret.Alias[t.Alias][token] = chat1.EmptyStruct{}
		}
	}
	for _, msgID := range entry.Metadata.SeenIDs {
		ret.Metadata.SeenIDs[msgID] = chat1.EmptyStruct{}
	}

	return ret, nil
}

func (s *store) putLocked(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, idx *chat1.ConversationIndex) error {
	if idx == nil {
		return nil
	}
	dbKey := s.dbKey(convID, uid)
	entry := chat1.ConversationIndexDisk{
		Index: make([]chat1.TokenTuple, len(idx.Index)),
		Alias: make([]chat1.AliasTuple, len(idx.Alias)),
		Metadata: chat1.ConversationIndexMetadataDisk{
			Version: IndexVersion,
			SeenIDs: make([]chat1.MessageID, len(idx.Metadata.SeenIDs)),
		},
	}

	i := 0
	for token, msgIDMap := range idx.Index {
		msgIDs := make([]chat1.MessageID, len(msgIDMap))
		ii := 0
		for msgID := range msgIDMap {
			msgIDs[ii] = msgID
			ii++
		}
		entry.Index[i] = chat1.TokenTuple{Token: token, MsgIDs: msgIDs}
		i++
	}

	j := 0
	for alias, tokenMap := range idx.Alias {
		tokens := make([]string, len(tokenMap))
		jj := 0
		for token := range tokenMap {
			tokens[jj] = token
			jj++
		}
		entry.Alias[j] = chat1.AliasTuple{Alias: alias, Tokens: tokens}
		j++
	}

	k := 0
	for msgID := range idx.Metadata.SeenIDs {
		entry.Metadata.SeenIDs[k] = msgID
		k++
	}
	raw, err := s.marshal(&entry)
	if err != nil {
		return err
	}
	return s.encryptedDB.PutRaw(ctx, dbKey, raw)
}

func (s *store) deleteLocked(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) error {
	dbKey := s.dbKey(convID, uid)
	return s.encryptedDB.Delete(ctx, dbKey)
}

func (s *store) getConvIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (entry *chat1.ConversationIndex, err error) {
	lock := s.lockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)
	return s.getLocked(ctx, convID, uid)
}

// addTokensLocked add the given tokens to the index under the given message
// id, when ingesting EDIT messages the msgID is of the superseded msg but the
// tokens are from the EDIT itself.
func (s *store) addTokensLocked(entry *chat1.ConversationIndex, tokens tokenMap, msgID chat1.MessageID) {
	for token, aliases := range tokens {
		msgIDs, ok := entry.Index[token]
		if !ok {
			msgIDs = map[chat1.MessageID]chat1.EmptyStruct{}
		}
		msgIDs[msgID] = chat1.EmptyStruct{}
		entry.Index[token] = msgIDs
		for alias := range aliases {
			atoken, ok := entry.Alias[alias]
			if !ok {
				atoken = map[string]chat1.EmptyStruct{}
			}
			atoken[token] = chat1.EmptyStruct{}
			entry.Alias[alias] = atoken
		}
	}
}

func (s *store) addMsgLocked(entry *chat1.ConversationIndex, msg chat1.MessageUnboxed) {
	tokens := tokensFromMsg(msg)
	s.addTokensLocked(entry, tokens, msg.GetMessageID())
}

func (s *store) removeMsgLocked(entry *chat1.ConversationIndex, msg chat1.MessageUnboxed) {
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

	for token, aliases := range tokensFromMsg(msg) {
		msgIDs := entry.Index[token]
		delete(msgIDs, msgID)
		if len(msgIDs) == 0 {
			delete(entry.Index, token)
		}
		for alias := range aliases {
			for atoken := range entry.Alias[alias] {
				_, ok := entry.Index[atoken]
				if !ok {
					delete(entry.Alias[alias], atoken)
				}
			}
			if len(entry.Alias[alias]) == 0 {
				delete(entry.Alias, alias)
			}
		}
	}
}

func (s *store) add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) (err error) {
	lock := s.lockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)

	entry, err := s.getLocked(ctx, convID, uid)
	if err != nil {
		return err
	}

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

	for _, msg := range msgs {
		seenIDs := entry.Metadata.SeenIDs
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
				s.addMsgLocked(entry, sm)
			}
		case chat1.MessageType_EDIT:
			tokens := tokensFromMsg(msg)
			supersededMsgs := fetchSupersededMsgs(msg)
			// remove the original message text and replace it with the edited
			// contents (using the original id in the index)
			for _, sm := range supersededMsgs {
				seenIDs[sm.GetMessageID()] = chat1.EmptyStruct{}
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
	lock := s.lockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)

	entry, err := s.getLocked(ctx, convID, uid)
	if err != nil {
		return err
	}

	seenIDs := entry.Metadata.SeenIDs
	for _, msg := range msgs {
		// Don't remove if we haven't seen
		if _, ok := seenIDs[msg.GetMessageID()]; !ok {
			continue
		}
		seenIDs[msg.GetMessageID()] = chat1.EmptyStruct{}
		s.removeMsgLocked(entry, msg)
	}
	err = s.putLocked(ctx, convID, uid, entry)
	return err
}
