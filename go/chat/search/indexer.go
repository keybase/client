package search

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

// stored for each token from the message contents. contains fields to find or
// filter the message.
type msgMetadata struct {
	SenderUsername string
	Ctime          gregor1.Time
}
type msgMetadataIndex map[chat1.MessageID]msgMetadata
type convIndex map[string]msgMetadataIndex

// Indexer keeps an encrypted index of chat messages for all conversations to enable full inbox search locally.
// Data is stored in leveldb in the form:
// (convID) -> {
//                token: { msgID: (msgMetadata), ...},
//                ...
//             },
//     ...       ->        ...
// Where msgMetadata has information about the message which can be used to
// filter the search such as sender username or creation time.  The workload is
// expected to be write heavy with keeping the index up to date.
type Indexer struct {
	sync.Mutex
	globals.Contextified
	utils.DebugLabeler
	encryptedDB *encrypteddb.EncryptedDB
}

var _ types.Indexer = (*Indexer)(nil)

func NewIndexer(g *globals.Context) *Indexer {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG(), storage.DefaultSecretUI)
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &Indexer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Search.Indexer", false),
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
}

func (i *Indexer) dbKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: fmt.Sprintf("idx:%s:%s", convID, uid),
	}
}

func (i *Indexer) getMsgText(msg chat1.MessageUnboxed) string {
	if !msg.IsValid() {
		return ""
	}
	mbody := msg.Valid().MessageBody

	switch msg.GetMessageType() {
	case chat1.MessageType_TEXT:
		return mbody.Text().Body
	case chat1.MessageType_EDIT:
		return mbody.Edit().Body
	default:
		return ""
	}
}

func (i *Indexer) getConvIndex(ctx context.Context, dbKey libkb.DbKey) (convIndex, error) {
	var convIdx convIndex
	found, err := i.encryptedDB.Get(ctx, dbKey, &convIdx)
	if err != nil {
		return convIdx, err
	}
	if !found {
		convIdx = convIndex{}
	}
	return convIdx, nil
}

// Add tokenizes the message content and creates/updates index keys for each token.
func (i *Indexer) Add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msg chat1.MessageUnboxed) (err error) {
	defer i.Trace(ctx, func() error { return err }, "Indexer.Add")()
	i.Lock()
	defer i.Unlock()

	msgText := i.getMsgText(msg)
	tokens := tokenize(msgText)
	if tokens == nil {
		return nil
	}

	dbKey := i.dbKey(convID, uid)
	convIdx, err := i.getConvIndex(ctx, dbKey)
	if err != nil {
		return err
	}

	mvalid := msg.Valid()
	idxMetadata := msgMetadata{
		SenderUsername: mvalid.SenderUsername,
		Ctime:          mvalid.ServerHeader.Ctime,
	}
	for _, token := range tokens {
		metadata, ok := convIdx[token]
		if !ok {
			metadata = msgMetadataIndex{}
		}
		metadata[msg.GetMessageID()] = idxMetadata
		convIdx[token] = metadata
	}
	err = i.encryptedDB.Put(ctx, dbKey, convIdx)
	return err
}

// Remove tokenizes the message content and updates/removes index keys for each token.
func (i *Indexer) Remove(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msg chat1.MessageUnboxed) (err error) {
	defer i.Trace(ctx, func() error { return err }, "Indexer.Remove")()

	msgText := i.getMsgText(msg)
	tokens := tokenize(msgText)
	if tokens == nil {
		return nil
	}

	dbKey := i.dbKey(convID, uid)
	convIdx, err := i.getConvIndex(ctx, dbKey)
	if err != nil {
		return err
	}

	for _, token := range tokens {
		metadata, ok := convIdx[token]
		if !ok {
			continue
		}
		delete(metadata, msg.GetMessageID())
		if len(metadata) == 0 {
			delete(convIdx, token)
		}
	}
	err = i.encryptedDB.Put(ctx, dbKey, convIdx)
	return err
}

// Search tokenizes the given query and finds the intersection of all matches
// for each token, returning (convID,msgID) pairs with match information.
func (i *Indexer) Search(ctx context.Context, uid gregor1.UID, query string,
	opts chat1.SearchOpts) ([]chat1.ChatConvSearchHit, error) {
	return nil, nil
}
