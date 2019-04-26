package search

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
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
		Key: fmt.Sprintf("idx_v6:%s:%s", uid, convID),
	}
}

func (s *store) putConvIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	idx *chat1.ConversationIndex) error {
	lock := s.lockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)
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
	return s.encryptedDB.Put(ctx, dbKey, entry)
}

func (s *store) deleteLocked(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) error {
	dbKey := s.dbKey(convID, uid)
	return s.encryptedDB.Delete(ctx, dbKey)
}

func (s *store) getConvIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (ret *chat1.ConversationIndex, err error) {
	lock := s.lockTab.AcquireOnName(ctx, s.G(), convID.String())
	defer lock.Release(ctx)
	defer func() {
		// return a blank index
		if err == nil && ret == nil {
			ret = &chat1.ConversationIndex{
				Index: make(map[string]map[chat1.MessageID]chat1.EmptyStruct),
				Alias: make(map[string]map[string]chat1.EmptyStruct),
				Metadata: chat1.ConversationIndexMetadata{
					Version: IndexVersion,
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
	found, err := s.encryptedDB.Get(ctx, dbKey, &entry)
	if err != nil || !found {
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
