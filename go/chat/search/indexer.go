package search

import (
	"context"
	"fmt"
	"regexp"
	"sort"

	mapset "github.com/deckarep/golang-set"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Indexer struct {
	globals.Contextified
	utils.DebugLabeler
	store *store
	// for testing
	consumeCh chan bool
}

var _ types.Indexer = (*Indexer)(nil)

func NewIndexer(g *globals.Context) *Indexer {
	return &Indexer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Search.Indexer", false),
		store:        newStore(g),
	}
}

func (idx *Indexer) SetConsumeCh(consumeCh chan bool) {
	idx.consumeCh = consumeCh
}

func (idx *Indexer) GetConvIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (*chat1.ConversationIndex, error) {
	return idx.store.getConvIndex(ctx, convID, uid)
}

// searchConv finds all messages that match the given set of tokens and opts,
// results are ordered desc by msg id.
func (idx *Indexer) searchConv(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, tokens []string, opts chat1.SearchOpts) (msgIDs []chat1.MessageID, err error) {
	defer idx.Trace(ctx, func() error { return err }, fmt.Sprintf("searchConv convID: %v", convID.String()))()

	convIdx, err := idx.store.getConvIndex(ctx, convID, uid)
	if err != nil {
		return nil, err
	}
	var allMsgIDs mapset.Set
	// NOTE potential optimization, sort by token size desc, might be able to
	// short circuit, CORE-8902
	for i, token := range tokens {
		msgIDs, ok := convIdx.Index[token]
		if !ok {
			// this conversation is missing a token, abort
			return nil, nil
		}

		matchedIDs := mapset.NewThreadUnsafeSet()
		for msgID := range msgIDs {
			matchedIDs.Add(msgID)
		}

		if i == 0 {
			allMsgIDs = matchedIDs
		} else {
			allMsgIDs = allMsgIDs.Intersect(matchedIDs)
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
		if opts.BeforeContext > 0 {
			// Best effort attempt to get surrounding context
			for i := 0; i < opts.BeforeContext+MaxContext; i++ {
				beforeID := msgID - chat1.MessageID(i+1)
				if beforeID > 0 {
					idSetWithContext.Add(beforeID)
				} else {
					break
				}
			}
		}

		idSet.Add(msgID)
		idSetWithContext.Add(msgID)
		if opts.AfterContext > 0 {
			// Best effort attempt to get surrounding context
			for i := 0; i < opts.AfterContext+MaxContext; i++ {
				afterID := msgID + chat1.MessageID(i+1)
				idSetWithContext.Add(afterID)
			}
		}
	}
	msgIDSlice := msgIDsFromSet(idSetWithContext)
	reason := chat1.GetThreadReason_INDEXED_SEARCH
	msgs, err := idx.G().ChatHelper.GetMessages(ctx, uid, convID, msgIDSlice, true /* resolveSupersedes*/, &reason)
	if err != nil {
		return nil, nil, err
	}
	res := []chat1.MessageUnboxed{}
	for _, msg := range msgs {
		if msg.IsValid() && msg.IsVisible() {
			res = append(res, msg)
		}
	}
	sort.Sort(utils.ByMsgUnboxedMsgID(res))
	return idSet, res, nil
}

// searchHitsFromMsgIDs packages the search hit with context (nearby search
// messages) and match info (for UI highlighting). Results are ordered desc by
// msg id.
func (idx *Indexer) searchHitsFromMsgIDs(ctx context.Context, conv types.RemoteConversation, uid gregor1.UID,
	msgIDs []chat1.MessageID, queryRe *regexp.Regexp, opts chat1.SearchOpts, numHits int) (convHits *chat1.ChatInboxSearchHit, err error) {
	if msgIDs == nil {
		return nil, nil
	}

	convID := conv.GetConvID()
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
		if idSet.Contains(msg.GetMessageID()) && msg.IsValidFull() && opts.Matches(msg) {
			msgText := msg.SearchableText()
			matches := queryRe.FindAllString(msgText, -1)
			if matches == nil {
				continue
			}
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
			if len(hits)+numHits >= opts.MaxHits {
				break
			}
		}
	}
	if len(hits) == 0 {
		return nil, nil
	}
	return &chat1.ChatInboxSearchHit{
		ConvID:   convID,
		ConvName: conv.GetName(),
		Hits:     hits,
	}, nil
}

func (idx *Indexer) consumeResultsForTest(msgs []chat1.MessageUnboxed, err error) {
	if err == nil && idx.consumeCh != nil {
		idx.consumeCh <- true
	}
}

func (idx *Indexer) Add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) (err error) {
	if len(msgs) == 0 {
		return nil
	}
	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.Add convID: %v, msgs: %d", convID.String(), len(msgs)))()
	defer idx.consumeResultsForTest(msgs, err)
	err = idx.store.add(ctx, convID, uid, msgs)
	return err
}

func (idx *Indexer) Remove(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) (err error) {
	if len(msgs) == 0 {
		return nil
	}
	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.Remove convID: %v, msgs: %d", convID.String(), len(msgs)))()
	defer idx.consumeResultsForTest(msgs, err)
	err = idx.store.remove(ctx, convID, uid, msgs)
	return err
}

// Search tokenizes the given query and finds the intersection of all matches
// for each token, returning (convID,msgID) pairs with match information.
func (idx *Indexer) Search(ctx context.Context, uid gregor1.UID, query string,
	opts chat1.SearchOpts, uiCh chan chat1.ChatInboxSearchHit) (hits []chat1.ChatInboxSearchHit, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.Search")()

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

	numHits := 0
	for _, conv := range convs {
		convID := conv.GetConvID()
		msgIDs, err := idx.searchConv(ctx, convID, uid, tokens, opts)
		if err != nil {
			return nil, err
		}
		convHits, err := idx.searchHitsFromMsgIDs(ctx, conv, uid, msgIDs, queryRe, opts, numHits)
		if err != nil {
			return nil, err
		}
		if len(msgIDs) != convHits.Size() {
			idx.Debug(ctx, "search hit mismatch, found %d msgIDs in index, %d hits in conv",
				len(msgIDs), convHits.Size())
		}
		if convHits == nil {
			continue
		}
		if uiCh != nil {
			// Stream search hits back to the UI
			// channel
			uiCh <- *convHits
		}
		hits = append(hits, *convHits)
		numHits += convHits.Size()
		if numHits >= opts.MaxHits {
			break
		}
	}
	if uiCh != nil {
		close(uiCh)
	}
	return hits, nil
}
