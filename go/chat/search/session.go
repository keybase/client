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
	"golang.org/x/sync/errgroup"
)

// searchSession encapsulates a single search session into a three stage
// pipeline; presearch, search and postSearch.
type searchSession struct {
	sync.Mutex
	query     string
	uid       gregor1.UID
	hitUICh   chan chat1.ChatSearchInboxHit
	indexUICh chan chat1.ChatSearchIndexStatus
	indexer   *Indexer
	opts      chat1.SearchOpts

	tokens                                                tokenMap
	queryRe                                               *regexp.Regexp
	totalPercentIndexed, indexableConvs, numConvsSearched int
	// convID -> hit
	convMap    map[string]types.RemoteConversation
	convIdxMap map[string]*chat1.ConversationIndex
	hitMap     map[string]chat1.ChatSearchInboxHit
	convList   []types.RemoteConversation

	preSearchCh  chan chat1.ConversationID
	postSearchCh chan chat1.ConversationID
}

func newSearchSession(query string, uid gregor1.UID,
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
		query:        query,
		uid:          uid,
		hitUICh:      hitUICh,
		indexUICh:    indexUICh,
		indexer:      indexer,
		opts:         opts,
		convIdxMap:   make(map[string]*chat1.ConversationIndex),
		hitMap:       make(map[string]chat1.ChatSearchInboxHit),
		preSearchCh:  make(chan chat1.ConversationID, 200),
		postSearchCh: make(chan chat1.ConversationID, 200),
	}
}

func (s *searchSession) getConv(convID chat1.ConversationID) types.RemoteConversation {
	s.Lock()
	defer s.Unlock()
	return s.convMap[convID.String()]
}

func (s *searchSession) getConvIdx(convID chat1.ConversationID) *chat1.ConversationIndex {
	s.Lock()
	defer s.Unlock()
	return s.convIdxMap[convID.String()]
}

func (s *searchSession) setConvIdx(convID chat1.ConversationID, convIdx *chat1.ConversationIndex) {
	s.Lock()
	defer s.Unlock()
	s.convIdxMap[convID.String()] = convIdx
}

func (s *searchSession) rmConvIdx(convID chat1.ConversationID) {
	s.Lock()
	defer s.Unlock()
	delete(s.convIdxMap, convID.String())
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

func (s *searchSession) decrementIndexableConvs() {
	s.Lock()
	defer s.Unlock()
	s.indexableConvs--
}

func (s *searchSession) addTotalPercentIndex(x int) {
	s.Lock()
	defer s.Unlock()
	s.totalPercentIndexed += x
}

func (s *searchSession) percentIndexed() int {
	s.Lock()
	defer s.Unlock()
	return s.percentIndexedLocked()
}

func (s *searchSession) percentIndexedLocked() int {
	if s.indexableConvs <= 0 {
		return 0
	}
	return s.totalPercentIndexed / s.indexableConvs
}

// searchConv finds all messages that match the given set of tokens and opts,
// results are ordered desc by msg id.
func (s *searchSession) searchConv(ctx context.Context, convID chat1.ConversationID,
	convIdx *chat1.ConversationIndex) (msgIDs []chat1.MessageID, err error) {
	defer s.indexer.Trace(ctx, func() error { return err }, fmt.Sprintf("searchConv convID: %v", convID.String()))()
	if convIdx == nil {
		return nil, nil
	}

	var allMsgIDs mapset.Set
	for token := range s.tokens {
		matchedIDs := mapset.NewThreadUnsafeSet()

		// first gather the messages that directly match the token
		for msgID := range convIdx.Index[token] {
			matchedIDs.Add(msgID)
		}
		// now check any aliases for matches
		for atoken := range convIdx.Alias[token] {
			for msgID := range convIdx.Index[atoken] {
				matchedIDs.Add(msgID)
			}
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
	if msgIDs == nil {
		return nil, nil
	}

	convID := conv.GetConvID()

	idSet, msgs, err := s.getMsgsAndIDSet(ctx, convID, msgIDs)
	if err != nil {
		return nil, err
	}

	hits := []chat1.ChatSearchHit{}
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

func (s *searchSession) reindexConvWithUIUpdate(ctx context.Context, convIdx *chat1.ConversationIndex, conv chat1.Conversation) error {
	percentIndexed := convIdx.PercentIndexed(conv)
	_, convIdx, err := s.indexer.reindexConv(ctx, conv, s.uid, convIdx,
		reindexOpts{forceReindex: true})
	if err != nil {
		return err
	}
	convID := conv.GetConvID()
	s.setConvIdx(convID, convIdx)
	newPercentIndexed := convIdx.PercentIndexed(conv)
	if percentIndexed != newPercentIndexed { // only write out updates..
		s.addTotalPercentIndex(newPercentIndexed - percentIndexed)
		if s.indexUICh != nil { // stream back index percentage as we update it
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
			s.indexUICh <- chat1.ChatSearchIndexStatus{
				PercentIndexed: s.percentIndexed(),
			}
		}
	}
	return nil
}

func (s *searchSession) searchConvWithUIUpdate(ctx context.Context, convID chat1.ConversationID) error {
	convIdx := s.getConvIdx(convID)
	conv := s.getConv(convID)
	s.incrementNumConvsSearched()
	msgIDs, err := s.searchConv(ctx, convID, convIdx)
	if err != nil {
		return err
	}
	hits, err := s.searchHitsFromMsgIDs(ctx, conv, msgIDs)
	if err != nil {
		return err
	}
	if len(msgIDs) != hits.Size() {
		s.indexer.Debug(ctx, "Search: hit mismatch, found %d msgIDs in index, %d hits in conv: %v",
			len(msgIDs), hits.Size(), conv.GetName())
	}
	if hits == nil {
		return nil
	}
	hits.Query = s.query
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
func (s *searchSession) preSearch(ctx context.Context) error {
	defer close(s.preSearchCh)
	for _, conv := range s.convList {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		convID := conv.GetConvID()
		convIdx, err := s.indexer.GetConvIndex(ctx, convID, s.uid)
		if err != nil {
			return err
		}
		s.addTotalPercentIndex(convIdx.PercentIndexed(conv.Conv))
		s.setConvIdx(convID, convIdx)

		switch s.opts.ReindexMode {
		case chat1.ReIndexingMode_PRESEARCH_SYNC:
			// don't send the conv to be searched until we reindex
		default:
			s.preSearchCh <- convID
		}
	}
	percentIndexed := s.percentIndexed()
	if s.indexUICh != nil {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		s.indexUICh <- chat1.ChatSearchIndexStatus{
			PercentIndexed: percentIndexed,
		}
	}
	s.indexer.Debug(ctx, "Search: percent: %d", percentIndexed)

	switch s.opts.ReindexMode {
	case chat1.ReIndexingMode_PRESEARCH_SYNC:
		for _, conv := range s.convList {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
			convIdx := s.getConvIdx(conv.GetConvID())
			if err := s.reindexConvWithUIUpdate(ctx, convIdx, conv.Conv); err != nil {
				s.indexer.Debug(ctx, "Search: Unable to reindexConv: %v, %v", conv.GetName(), err)
				s.decrementIndexableConvs()
				continue
			}
			s.preSearchCh <- conv.GetConvID()
		}
	}
	return nil
}

// search performs the actual search on each conversation after it completes
// preSearch via `preSearchCh`
func (s *searchSession) search(ctx context.Context) error {
	defer func() {
		defer close(s.postSearchCh)
		for range s.preSearchCh {
			// drain the channel in case we short circuit the search.
		}
	}()

	searchDone := false
	for convID := range s.preSearchCh {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		if !searchDone {
			if err := s.searchConvWithUIUpdate(ctx, convID); err != nil {
				return err
			}
			if s.searchDone(ctx, "search") {
				searchDone = true
			}
		}

		s.postSearchCh <- convID
	}
	return nil
}

// postSearch is the final pipeline stage, reindexing conversations if
// POSTSEARCH_SYNC is set.
func (s *searchSession) postSearch(ctx context.Context) error {
	defer func() {
		for convID := range s.postSearchCh {
			// drain the channel in case we short circuit
			s.rmConvIdx(convID)
		}
	}()
	switch s.opts.ReindexMode {
	case chat1.ReIndexingMode_POSTSEARCH_SYNC:
		var prevConvID chat1.ConversationID
		for convID := range s.postSearchCh {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
			// free the memory associated with the completed index
			if !prevConvID.IsNil() {
				s.rmConvIdx(prevConvID)
			}
			prevConvID = convID

			conv := s.getConv(convID)
			convIdx := s.getConvIdx(convID)
			// ignore any fully indexed convs since we respect
			// opts.MaxConvsSearched
			if convIdx.FullyIndexed(conv.Conv) {
				continue
			}
			if err := s.reindexConvWithUIUpdate(ctx, convIdx, conv.Conv); err != nil {
				s.indexer.Debug(ctx, "Search: postSync: error reindexing: convID: %s err: %s",
					conv.GetConvID(), err)
				s.decrementIndexableConvs()
				continue
			}
			if s.searchDone(ctx, "postSearch") {
				continue
			}
			if err := s.searchConvWithUIUpdate(ctx, convID); err != nil {
				return err
			}
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
	s.indexableConvs = len(s.convList)
	if len(s.convList) == 0 {
		return false, nil
	}
	return true, nil
}

func (s *searchSession) run(ctx context.Context) (res *chat1.ChatSearchInboxResults, err error) {
	defer func() {
		if err != nil {
			s.Lock()
			s.indexer.Debug(ctx, "search aborts,%v %d hits, %d percentIndexed, %d indexableConvs, %d convs searched, opts: %+v",
				err, len(s.hitMap), s.percentIndexed(), s.indexableConvs, s.numConvsSearched, s.opts)
			s.Unlock()
		}
	}()
	if shouldRun, err := s.initRun(ctx); !shouldRun || err != nil {
		return nil, err
	}

	eg, ectx := errgroup.WithContext(ctx)
	eg.Go(func() error { return s.preSearch(ectx) })
	eg.Go(func() error { return s.search(ectx) })
	eg.Go(func() error { return s.postSearch(ectx) })
	if err := eg.Wait(); err != nil {
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
	percentIndexed := s.percentIndexedLocked()
	res = &chat1.ChatSearchInboxResults{
		Hits:           hits,
		PercentIndexed: percentIndexed,
	}
	s.indexer.Debug(ctx, "search complete, %d hits, %d percentIndexed, %d indexableConvs, %d convs searched, opts: %+v",
		len(hits), percentIndexed, s.indexableConvs, s.numConvsSearched, s.opts)
	return res, nil
}
