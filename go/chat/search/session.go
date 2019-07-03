package search

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"sync"

	mapset "github.com/deckarep/golang-set"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

// searchSession encapsulates a single search session into a three stage
// pipeline; presearch, search and postSearch.
type searchSession struct {
	sync.Mutex
	query, origQuery string
	uid              gregor1.UID
	hitUICh          chan chat1.ChatSearchInboxHit
	indexer          *Indexer
	opts             chat1.SearchOpts

	tokens           tokenMap
	queryRe          *regexp.Regexp
	numConvsSearched int
	inboxIndexStatus *inboxIndexStatus
	// convID -> hit
	convMap      map[string]types.RemoteConversation
	reindexConvs []chat1.ConversationID
	hitMap       map[string]chat1.ChatSearchInboxHit
	convList     []types.RemoteConversation
}

func newSearchSession(query, origQuery string, uid gregor1.UID,
	hitUICh chan chat1.ChatSearchInboxHit, indexUICh chan chat1.ChatSearchIndexStatus,
	indexer *Indexer, opts chat1.SearchOpts) *searchSession {
	if opts.MaxHits > MaxAllowedSearchHits || opts.MaxHits < 0 {
		opts.MaxHits = MaxAllowedSearchHits
	}
	if opts.BeforeContext > MaxContext || opts.BeforeContext < 0 {
		opts.BeforeContext = MaxContext
	}
	if opts.AfterContext > MaxContext || opts.AfterContext < 0 {
		opts.AfterContext = MaxContext
	}
	return &searchSession{
		query:            query,
		origQuery:        origQuery,
		uid:              uid,
		hitUICh:          hitUICh,
		indexer:          indexer,
		opts:             opts,
		inboxIndexStatus: newInboxIndexStatus(indexUICh),
		hitMap:           make(map[string]chat1.ChatSearchInboxHit),
	}
}

func (s *searchSession) getConv(convID chat1.ConversationID) types.RemoteConversation {
	s.Lock()
	defer s.Unlock()
	return s.convMap[convID.String()]
}

func (s *searchSession) setHit(convID chat1.ConversationID, convHit chat1.ChatSearchInboxHit) {
	s.Lock()
	defer s.Unlock()
	s.hitMap[convID.String()] = convHit
}

func (s *searchSession) incrementNumConvsSearched() {
	s.Lock()
	defer s.Unlock()
	s.numConvsSearched++
}

// searchConv finds all messages that match the given set of tokens and opts,
// results are ordered desc by msg id.
func (s *searchSession) searchConv(ctx context.Context, convID chat1.ConversationID) (msgIDs []chat1.MessageID, err error) {
	defer s.indexer.Trace(ctx, func() error { return err }, fmt.Sprintf("searchConv convID: %s", convID))()
	var allMsgIDs mapset.Set
	for token := range s.tokens {
		matchedIDs := mapset.NewThreadUnsafeSet()
		idMap, err := s.indexer.store.GetHits(ctx, s.uid, convID, token)
		if err != nil {
			return nil, err
		}
		for msgID := range idMap {
			matchedIDs.Add(msgID)
		}
		if allMsgIDs == nil {
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

func (s *searchSession) getMsgsAndIDSet(ctx context.Context, convID chat1.ConversationID,
	msgIDs []chat1.MessageID) (mapset.Set, []chat1.MessageUnboxed, error) {
	idSet := mapset.NewThreadUnsafeSet()
	idSetWithContext := mapset.NewThreadUnsafeSet()
	// Best effort attempt to get surrounding context. We filter out
	// non-visible messages so exact counts may be slightly off. We add a
	// padding of MaxContext to minimize the chance of this but don't have any
	// error correction in place.
	for _, msgID := range msgIDs {
		if s.opts.BeforeContext > 0 {
			for i := 0; i < s.opts.BeforeContext+MaxContext; i++ {
				// ensure we don't underflow MessageID which is a uint.
				if chat1.MessageID(i+1) >= msgID {
					break
				}
				beforeID := msgID - chat1.MessageID(i+1)
				idSetWithContext.Add(beforeID)
			}
		}

		idSet.Add(msgID)
		idSetWithContext.Add(msgID)
		if s.opts.AfterContext > 0 {
			for i := 0; i < s.opts.AfterContext+MaxContext; i++ {
				afterID := msgID + chat1.MessageID(i+1)
				idSetWithContext.Add(afterID)
			}
		}
	}
	msgIDSlice := msgIDsFromSet(idSetWithContext)
	reason := chat1.GetThreadReason_INDEXED_SEARCH
	msgs, err := s.indexer.G().ChatHelper.GetMessages(ctx, s.uid, convID, msgIDSlice,
		true /* resolveSupersedes*/, &reason)
	if err != nil {
		if utils.IsPermanentErr(err) {
			return nil, nil, err
		}
		return nil, nil, nil
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
func (s *searchSession) searchHitsFromMsgIDs(ctx context.Context, conv types.RemoteConversation,
	msgIDs []chat1.MessageID) (convHits *chat1.ChatSearchInboxHit, err error) {
	convID := conv.GetConvID()
	defer s.indexer.Trace(ctx, func() error { return err },
		fmt.Sprintf("searchHitsFromMsgIDs convID: %s msgIDs: %d", convID, len(msgIDs)))()
	if msgIDs == nil {
		return nil, nil
	}

	// pull the messages in batches, short circuiting if we meet the search
	// opts criteria.
	var hits []chat1.ChatSearchHit
	for i := 0; i < len(msgIDs); i += s.opts.MaxHits {
		var batch []chat1.MessageID
		if i+s.opts.MaxHits > len(msgIDs) {
			batch = msgIDs[i:]
		} else {
			batch = msgIDs[i : i+s.opts.MaxHits]
		}
		hits, err = s.searchHitBatch(ctx, convID, batch, hits)
		if err != nil {
			return nil, err
		}
		if len(hits) >= s.opts.MaxHits {
			break
		}
	}
	if len(hits) == 0 {
		return nil, nil
	}
	return &chat1.ChatSearchInboxHit{
		ConvID:   convID,
		TeamType: conv.GetTeamType(),
		ConvName: conv.GetName(),
		Hits:     hits,
		Time:     hits[0].HitMessage.Valid().Ctime,
	}, nil
}

func (s *searchSession) searchHitBatch(ctx context.Context, convID chat1.ConversationID, msgIDs []chat1.MessageID,
	hits []chat1.ChatSearchHit) (res []chat1.ChatSearchHit, err error) {
	idSet, msgs, err := s.getMsgsAndIDSet(ctx, convID, msgIDs)
	if err != nil {
		return nil, err
	}
	for i, msg := range msgs {
		if idSet.Contains(msg.GetMessageID()) && msg.IsValidFull() && s.opts.Matches(msg) {
			var afterMessages, beforeMessages []chat1.UIMessage
			if s.opts.AfterContext > 0 {
				afterLimit := i - s.opts.AfterContext
				if afterLimit < 0 {
					afterLimit = 0
				}
				afterMessages = getUIMsgs(ctx, s.indexer.G(), convID, s.uid, msgs[afterLimit:i])
			}

			if s.opts.BeforeContext > 0 && i < len(msgs)-1 {
				beforeLimit := i + 1 + s.opts.BeforeContext
				if beforeLimit >= len(msgs) {
					beforeLimit = len(msgs)
				}
				beforeMessages = getUIMsgs(ctx, s.indexer.G(), convID, s.uid, msgs[i+1:beforeLimit])
			}

			matches := searchMatches(msg, s.queryRe)
			searchHit := chat1.ChatSearchHit{
				BeforeMessages: beforeMessages,
				HitMessage:     utils.PresentMessageUnboxed(ctx, s.indexer.G(), msg, s.uid, convID),
				AfterMessages:  afterMessages,
				Matches:        matches,
			}
			hits = append(hits, searchHit)
			if len(hits) >= s.opts.MaxHits {
				break
			}
		}
	}
	return hits, nil
}

func (s *searchSession) convFullyIndexed(ctx context.Context, conv chat1.Conversation) (bool, error) {
	md, err := s.indexer.store.GetMetadata(ctx, s.uid, conv.GetConvID())
	if err != nil {
		return false, err
	}
	return md.FullyIndexed(conv), nil
}

func (s *searchSession) updateInboxIndex(ctx context.Context, conv chat1.Conversation) {
	md, err := s.indexer.store.GetMetadata(ctx, s.uid, conv.GetConvID())
	if err != nil {
		s.indexer.Debug(ctx, "updateInboxIndex: unable to GetMetadata %v", err)
		return
	}
	s.inboxIndexStatus.addConv(md, conv)
}

func (s *searchSession) percentIndexed() int {
	return s.inboxIndexStatus.percentIndexed()
}

func (s *searchSession) reindexConvWithUIUpdate(ctx context.Context, rconv types.RemoteConversation) error {
	conv := rconv.Conv
	if _, err := s.indexer.reindexConv(ctx, rconv, s.uid, 0, s.inboxIndexStatus); err != nil {
		return err
	}
	s.updateInboxIndex(ctx, conv)
	if _, err := s.inboxIndexStatus.updateUI(ctx); err != nil {
		s.indexer.Debug(ctx, "unable to update ui %v", err)
	}
	return nil
}

func (s *searchSession) searchConvWithUIUpdate(ctx context.Context, convID chat1.ConversationID) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	conv := s.getConv(convID)
	msgIDs, err := s.searchConv(ctx, convID)
	if err != nil {
		return err
	}
	s.incrementNumConvsSearched()
	hits, err := s.searchHitsFromMsgIDs(ctx, conv, msgIDs)
	if err != nil {
		return err
	}
	if len(msgIDs) != hits.Size() {
		s.indexer.Debug(ctx, "Search: hit mismatch, found %d msgIDs in index, %d hits in conv: %v, %v",
			len(msgIDs), hits.Size(), conv.GetName(), conv.GetConvID())
	}
	if hits == nil {
		return nil
	}
	hits.Query = s.origQuery
	if s.hitUICh != nil {
		// Stream search hits back to the UI channel
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		s.hitUICh <- *hits
	}
	s.setHit(convID, *hits)
	return nil
}

func (s *searchSession) searchDone(ctx context.Context, stage string) bool {
	s.Lock()
	defer s.Unlock()
	if s.opts.MaxConvsSearched > 0 && s.numConvsSearched >= s.opts.MaxConvsSearched {
		s.indexer.Debug(ctx, "Search: [%s] max search convs reached", stage)
		return true
	}
	if s.opts.MaxConvsHit > 0 && len(s.hitMap) >= s.opts.MaxConvsHit {
		s.indexer.Debug(ctx, "Search: [%s] max hit convs reached", stage)
		return true
	}
	return false
}

// preSearch is the first pipeline stage, blocking on reindexing conversations
// if PRESEARCH_SYNC is set. As conversations are processed they are passed to
// the `search` stage via `preSearchCh`.
func (s *searchSession) preSearch(ctx context.Context) (err error) {
	defer s.indexer.Trace(ctx, func() error { return err }, "searchSession.preSearch")()
	for _, conv := range s.convList {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		s.updateInboxIndex(ctx, conv.Conv)
		switch s.opts.ReindexMode {
		case chat1.ReIndexingMode_POSTSEARCH_SYNC:
			fullyIndexed, err := s.convFullyIndexed(ctx, conv.Conv)
			if err != nil || !fullyIndexed {
				if err != nil {
					s.indexer.Debug(ctx, "Search: failed to compute full indexed: %s", err)
				}
				s.reindexConvs = append(s.reindexConvs, conv.GetConvID())
			}
		}
	}

	percentIndexed, err := s.inboxIndexStatus.updateUI(ctx)
	if err != nil {
		return err
	}
	s.indexer.Debug(ctx, "Search: percent: %d", percentIndexed)

	for _, conv := range s.convList {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		switch s.opts.ReindexMode {
		case chat1.ReIndexingMode_PRESEARCH_SYNC:
			if err := s.reindexConvWithUIUpdate(ctx, conv); err != nil {
				s.indexer.Debug(ctx, "Search: Unable to reindexConv: %v, %v, %v", conv.GetName(), conv.GetConvID(), err)
				s.inboxIndexStatus.rmConv(conv.Conv)
				continue
			}
			s.updateInboxIndex(ctx, conv.Conv)
		}
	}
	return nil
}

// search performs the actual search on each conversation after it completes
// preSearch via `preSearchCh`
func (s *searchSession) search(ctx context.Context) (err error) {
	defer s.indexer.Trace(ctx, func() error { return err }, "searchSession.search")()
	for _, conv := range s.convList {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		if err := s.searchConvWithUIUpdate(ctx, conv.GetConvID()); err != nil {
			return err
		}
		if s.searchDone(ctx, "search") {
			return nil
		}
	}
	return nil
}

// postSearch is the final pipeline stage, reindexing conversations if
// POSTSEARCH_SYNC is set.
func (s *searchSession) postSearch(ctx context.Context) (err error) {
	defer s.indexer.Trace(ctx, func() error { return err }, "searchSession.postSearch")()
	switch s.opts.ReindexMode {
	case chat1.ReIndexingMode_POSTSEARCH_SYNC:
	default:
		return nil
	}
	for _, convID := range s.reindexConvs {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		conv := s.getConv(convID)
		// ignore any fully indexed convs since we respect
		// opts.MaxConvsSearched
		fullyIndexed, err := s.convFullyIndexed(ctx, conv.Conv)
		if err != nil {
			return err
		}
		if fullyIndexed {
			continue
		}
		if err := s.reindexConvWithUIUpdate(ctx, conv); err != nil {
			s.indexer.Debug(ctx, "Search: postSearch: error reindexing: conv: %v convID: %v err: %v",
				conv.GetName(), conv.GetConvID(), err)
			s.inboxIndexStatus.rmConv(conv.Conv)
			continue
		}
		if s.searchDone(ctx, "postSearch") {
			continue
		}
		if err := s.searchConvWithUIUpdate(ctx, convID); err != nil {
			return err
		}
	}
	return nil
}

func (s *searchSession) initRun(ctx context.Context) (shouldRun bool, err error) {
	s.Lock()
	defer s.Unlock()
	s.tokens = tokenize(s.query)
	if s.tokens == nil {
		return false, nil
	}
	s.queryRe, err = utils.GetQueryRe(s.query)
	if err != nil {
		return false, err
	}

	s.convMap, err = s.indexer.allConvs(ctx, s.uid, s.opts.ConvID)
	if err != nil {
		return false, err
	}
	s.convList = s.indexer.convsByMTime(ctx, s.uid, s.convMap)
	if len(s.convList) == 0 {
		return false, nil
	}
	return true, nil
}

func (s *searchSession) run(ctx context.Context) (res *chat1.ChatSearchInboxResults, err error) {
	defer func() {
		if err != nil {
			s.Lock()
			s.indexer.Debug(ctx, "search aborted, %v %d hits, %d%% percentIndexed, %d indexableConvs, %d convs searched, opts: %+v",
				err, len(s.hitMap), s.percentIndexed(), s.inboxIndexStatus.numConvs(), s.numConvsSearched, s.opts)
			s.Unlock()
		}
	}()
	if shouldRun, err := s.initRun(ctx); !shouldRun || err != nil {
		return nil, err
	}

	if err := s.preSearch(ctx); err != nil {
		return nil, err
	}
	if err := s.search(ctx); err != nil {
		return nil, err
	}
	if err := s.postSearch(ctx); err != nil {
		return nil, err
	}

	s.Lock()
	defer s.Unlock()
	hits := make([]chat1.ChatSearchInboxHit, len(s.hitMap))
	index := 0
	for _, hit := range s.hitMap {
		hits[index] = hit
		index++
	}
	percentIndexed := s.percentIndexed()
	res = &chat1.ChatSearchInboxResults{
		Hits:           hits,
		PercentIndexed: percentIndexed,
	}
	s.indexer.Debug(ctx, "search completed, %d hits, %d%% percentIndexed, %d indexableConvs, %d convs searched, opts: %+v",
		len(hits), percentIndexed, s.inboxIndexStatus.numConvs(), s.numConvsSearched, s.opts)
	return res, nil
}
