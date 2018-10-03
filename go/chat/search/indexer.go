package search

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"sync"

	mapset "github.com/deckarep/golang-set"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const MaxAllowedSearchHits = 10000
const MaxAllowedSearchMessages = 100000
const MaxContext = 15

// stored for each token from the message contents. contains fields to find or
// filter the message.
type msgMetadata struct {
	SenderUsername string
	Ctime          gregor1.Time
}

// matches applys any filters specified in the searchOpts, returning if the msg
// matches or not
func (m msgMetadata) matches(opts chat1.SearchOpts) bool {
	if opts.SentBy != "" && opts.SentBy != m.SenderUsername {
		return false
	}
	// TODO add sentBefore, sentAfter date filters
	return true
}

type msgMetadataIndex map[chat1.MessageID]msgMetadata
type convIndex map[string]msgMetadataIndex

func msgIDsFromSet(set mapset.Set) []chat1.MessageID {
	msgIDSlice := []chat1.MessageID{}
	for _, el := range set.ToSlice() {
		msgID, ok := el.(chat1.MessageID)
		if ok {
			msgIDSlice = append(msgIDSlice, msgID)
		}
	}
	return msgIDSlice
}

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

func (idx *Indexer) dbKey(convID chat1.ConversationID, uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatIndex,
		Key: fmt.Sprintf("idx:%s:%s", convID, uid),
	}
}

func (idx *Indexer) getMsgText(msg chat1.MessageUnboxed) string {
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

func (idx *Indexer) getConvIndex(ctx context.Context, dbKey libkb.DbKey) (convIndex, error) {
	var convIdx convIndex
	found, err := idx.encryptedDB.Get(ctx, dbKey, &convIdx)
	if err != nil {
		return convIdx, err
	}
	if !found {
		convIdx = convIndex{}
	}
	return convIdx, nil
}

// Add tokenizes the message content and creates/updates index keys for each token.
func (idx *Indexer) Add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msg chat1.MessageUnboxed) (err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.Add")()
	idx.Lock()
	defer idx.Unlock()

	msgText := idx.getMsgText(msg)
	tokens := tokenize(msgText)
	if tokens == nil {
		return nil
	}

	dbKey := idx.dbKey(convID, uid)
	convIdx, err := idx.getConvIndex(ctx, dbKey)
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
	err = idx.encryptedDB.Put(ctx, dbKey, convIdx)
	return err
}

// Remove tokenizes the message content and updates/removes index keys for each token.
func (idx *Indexer) Remove(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msg chat1.MessageUnboxed) (err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.Remove")()
	idx.Lock()
	defer idx.Unlock()

	msgText := idx.getMsgText(msg)
	tokens := tokenize(msgText)
	if tokens == nil {
		return nil
	}

	dbKey := idx.dbKey(convID, uid)
	convIdx, err := idx.getConvIndex(ctx, dbKey)
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
	err = idx.encryptedDB.Put(ctx, dbKey, convIdx)
	return err
}

// searchConvLocked finds all messages that match the given set of tokens and
// opts, results are ordered desc by msg id.
func (idx *Indexer) searchConvLocked(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, tokens []string, opts chat1.SearchOpts) (msgIDs []chat1.MessageID, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.searchConvLocked")()

	dbKey := idx.dbKey(convID, uid)
	convIdx, err := idx.getConvIndex(ctx, dbKey)
	if err != nil {
		return nil, err
	}
	var allMsgIDs mapset.Set
	// NOTE potential optimization, sort by token size desc, might be able to
	// short circuit, CORE-8902
	for i, token := range tokens {
		metadata, ok := convIdx[token]
		if !ok {
			// this conversation is missing a token, abort
			return nil, nil
		}

		msgIDs := mapset.NewThreadUnsafeSet()
		for msgID, msgMetadata := range metadata {
			// honor search filters
			if msgMetadata.matches(opts) {
				msgIDs.Add(msgID)
			}
		}

		if i == 0 {
			allMsgIDs = msgIDs
		} else {
			allMsgIDs = allMsgIDs.Intersect(msgIDs)
			if allMsgIDs.Cardinality() == 0 {
				// no matches in this conversation..
				return nil, nil
			}
		}
	}
	msgIDSlice := msgIDsFromSet(allMsgIDs)

	// Sort so we can truncate if necessary, returning the newest results first.
	sort.Sort(utils.ByMsgID(msgIDSlice))
	return msgIDSlice, nil
}

func (idx *Indexer) getMsgsAndIDSet(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgIDs []chat1.MessageID, opts chat1.SearchOpts) (mapset.Set, []chat1.MessageUnboxed, error) {
	idSet := mapset.NewThreadUnsafeSet()
	idSetWithContext := mapset.NewThreadUnsafeSet()
	for _, msgID := range msgIDs {
		for i := 0; i < opts.BeforeContext; i++ {
			beforeID := msgID - chat1.MessageID(i+1)
			if beforeID > 0 {
				idSetWithContext.Add(beforeID)
			} else {
				break
			}
		}

		idSet.Add(msgID)
		idSetWithContext.Add(msgID)

		for i := 0; i < opts.AfterContext; i++ {
			afterID := msgID + chat1.MessageID(i+1)
			idSetWithContext.Add(afterID)
		}
	}
	inbox, err := idx.G().InboxSource.ReadUnverified(ctx, uid, true /* useLocalData */, &chat1.GetInboxQuery{
		ConvIDs: []chat1.ConversationID{convID},
	}, nil)
	if err != nil {
		return nil, nil, err
	}
	if len(inbox.ConvsUnverified) == 0 || !inbox.ConvsUnverified[0].GetConvID().Eq(convID) {
		return nil, nil, nil
	}
	conv := inbox.ConvsUnverified[0].Conv

	msgIDSlice := msgIDsFromSet(idSetWithContext)
	reason := chat1.GetThreadReason_INDEXED_SEARCH
	msgs, err := idx.G().ConvSource.GetMessages(ctx, conv, uid, msgIDSlice, &reason)
	if err != nil {
		return nil, nil, err
	}
	res := []chat1.MessageUnboxed{}
	for _, msg := range msgs {
		if msg.IsValid() {
			res = append(res, msg)
		}
	}
	sort.Sort(utils.ByMsgUnboxedMsgID(res))
	return idSet, res, nil
}

// searchHitsFromMsgIDs packages the search hit with context (nearby search
// messages) and match info (for UI highlighting). Results are ordered desc by
// msg id.
func (idx *Indexer) searchHitsFromMsgIDs(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgIDs []chat1.MessageID, queryRe *regexp.Regexp, opts chat1.SearchOpts) (convHits *chat1.ChatConvSearchHit, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.searchHitsFromMsgIDs")()

	getUIMsgs := func(msgs []chat1.MessageUnboxed) (uiMsgs []chat1.UIMessage) {
		for i := len(msgs) - 1; i >= 0; i-- {
			msg := msgs[i]
			if !msg.IsValid() {
				continue
			}
			uiMsg := utils.PresentMessageUnboxed(ctx, idx.G(), msg, uid, convID)
			uiMsgs = append(uiMsgs, uiMsg)
		}
		return uiMsgs
	}

	idSet, msgs, err := idx.getMsgsAndIDSet(ctx, uid, convID, msgIDs, opts)
	if err != nil {
		return nil, err
	}

	hits := []chat1.ChatSearchHit{}
	for i, msg := range msgs {
		if idSet.Contains(msg.GetMessageID()) && msg.IsValid() {
			msgText := msg.Valid().MessageBody.Text().Body
			matches := queryRe.FindAllString(msgText, -1)
			if matches != nil {
				afterLimit := i - opts.AfterContext
				if afterLimit < 0 {
					afterLimit = 0
				}
				afterMessages := getUIMsgs(msgs[afterLimit:i])

				var beforeMessages []chat1.UIMessage
				if i < len(msgs)-1 {
					beforeLimit := i + 1 + opts.AfterContext
					if beforeLimit >= len(msgs) {
						beforeLimit = len(msgs)
					}
					beforeMessages = getUIMsgs(msgs[i+1 : beforeLimit])
				}

				searchHit := chat1.ChatSearchHit{
					BeforeMessages: beforeMessages,
					HitMessage:     utils.PresentMessageUnboxed(ctx, idx.G(), msg, uid, convID),
					AfterMessages:  afterMessages,
					Matches:        matches,
				}
				hits = append(hits, searchHit)
			}
		}
	}
	if len(hits) == 0 {
		return nil, nil
	}
	return &chat1.ChatConvSearchHit{
		ConvID: convID,
		Hits:   hits,
	}, nil
}

// Search tokenizes the given query and finds the intersection of all matches
// for each token, returning (convID,msgID) pairs with match information.
func (idx *Indexer) Search(ctx context.Context, uid gregor1.UID, query string,
	opts chat1.SearchOpts) (hits []chat1.ChatConvSearchHit, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.Search")()
	idx.Lock()
	defer idx.Unlock()

	// NOTE opts.MaxMessages is ignored
	if opts.MaxHits > MaxAllowedSearchHits || opts.MaxHits < 0 {
		opts.MaxHits = MaxAllowedSearchHits
	}
	if opts.BeforeContext > MaxContext || opts.BeforeContext < 0 {
		opts.BeforeContext = MaxContext
	}
	if opts.AfterContext > MaxContext || opts.AfterContext < 0 {
		opts.AfterContext = MaxContext
	}

	tokens := tokenize(query)
	if tokens == nil {
		return nil, nil
	}
	queryRe, err := getQueryRe(query)
	if err != nil {
		return nil, err
	}

	// Find all conversations in our inbox
	ib := storage.NewInbox(idx.G())
	_, convs, err := ib.ReadAll(ctx, uid)
	if err != nil {
		return nil, err
	}

	// NOTE performance opt, do this in parallel CORE-8902
	numHits := 0
	for _, conv := range convs {
		convID := conv.GetConvID()
		msgIDs, err := idx.searchConvLocked(ctx, convID, uid, tokens, opts)
		if err != nil {
			return nil, err
		} else if msgIDs == nil {
			continue
		}
		// truncate the result list if necessary
		if numHits+len(msgIDs) >= opts.MaxHits {
			msgIDs = msgIDs[:opts.MaxHits-numHits]
		}
		convHits, err := idx.searchHitsFromMsgIDs(ctx, convID, uid, msgIDs, queryRe, opts)
		if err != nil {
			return nil, err
		} else if convHits == nil {
			continue
		}
		hits = append(hits, *convHits)
		numHits += len(convHits.Hits)
		if numHits >= opts.MaxHits {
			break
		}
	}
	return hits, nil
}
