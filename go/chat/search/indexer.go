package search

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"sync"
	"time"

	mapset "github.com/deckarep/golang-set"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Indexer struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	store    *store
	pageSize int
	stopCh   chan chan struct{}
	started  bool

	maxBoostConvs int
	maxBoostMsgs  int
	maxSyncConvs  int

	// for testing
	consumeCh chan chat1.ConversationID
	reindexCh chan chat1.ConversationID
}

var _ types.Indexer = (*Indexer)(nil)

func NewIndexer(g *globals.Context) *Indexer {
	idx := &Indexer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Search.Indexer", false),
		store:        newStore(g),
		pageSize:     defaultPageSize,
		stopCh:       make(chan chan struct{}),
	}
	switch idx.G().GetAppType() {
	case libkb.MobileAppType:
		idx.SetMaxBoostConvs(maxBoostConvsMobile)
		idx.SetMaxBoostMsgs(maxBoostMsgsMobile)
		idx.SetMaxSyncConvs(maxSyncConvsMobile)
	default:
		idx.SetMaxBoostConvs(maxBoostConvsDesktop)
		idx.SetMaxBoostMsgs(maxBoostMsgsDesktop)
		idx.SetMaxSyncConvs(maxSyncConvsDesktop)
	}
	return idx
}

func (idx *Indexer) SetMaxSyncConvs(x int) {
	idx.maxSyncConvs = x
}

func (idx *Indexer) SetMaxBoostConvs(x int) {
	idx.maxBoostConvs = x
}

func (idx *Indexer) SetMaxBoostMsgs(x int) {
	idx.maxBoostMsgs = x
}

func (idx *Indexer) SetPageSize(pageSize int) {
	idx.pageSize = pageSize
}

func (idx *Indexer) SetConsumeCh(ch chan chat1.ConversationID) {
	idx.consumeCh = ch
}

func (idx *Indexer) SetReindexCh(ch chan chat1.ConversationID) {
	idx.reindexCh = ch
}

func (idx *Indexer) Start(ctx context.Context, uid gregor1.UID) {
	defer idx.Trace(ctx, func() error { return nil }, "Start")()
	idx.Lock()
	defer idx.Unlock()

	if idx.started {
		return
	}
	idx.started = true
	ticker := libkb.NewBgTicker(time.Hour)
	go func() {
		for {
			select {
			case <-ticker.C:
				// queue up some jobs on the background loader
				idx.SelectiveSync(ctx, uid, false /*forceReindex */)
			case ch := <-idx.stopCh:
				close(ch)
				ticker.Stop()
				return
			}
		}
	}()
}

func (idx *Indexer) Stop(ctx context.Context) chan struct{} {
	defer idx.Trace(ctx, func() error { return nil }, "Start")()
	idx.Lock()
	defer idx.Unlock()

	ch := make(chan struct{})
	if idx.started {
		idx.started = false
		idx.stopCh <- ch
	} else {
		close(ch)
	}
	return ch
}

func (idx *Indexer) GetConvIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (*chat1.ConversationIndex, error) {
	return idx.store.getConvIndex(ctx, convID, uid)
}

// validBatch verifies the topic type is CHAT
func (idx *Indexer) validBatch(msgs []chat1.MessageUnboxed) bool {
	if len(msgs) == 0 {
		return false
	}

	for _, msg := range msgs {
		switch msg.GetTopicType() {
		case chat1.TopicType_CHAT:
			return true
		case chat1.TopicType_NONE:
			continue
		default:
			return false
		}
	}
	// if we only have TopicType_NONE, assume it's ok to return true so we
	// document the seen ids properly.
	return true
}

func (idx *Indexer) consumeResultsForTest(convID chat1.ConversationID, err error) {
	if err == nil && idx.consumeCh != nil {
		idx.consumeCh <- convID
	}
}

func (idx *Indexer) Add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) (err error) {
	if !idx.validBatch(msgs) {
		return nil
	}
	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.Add convID: %v, msgs: %d", convID.String(), len(msgs)))()
	defer idx.consumeResultsForTest(convID, err)
	err = idx.store.add(ctx, convID, uid, msgs)
	return err
}

func (idx *Indexer) Remove(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) (err error) {
	if !idx.validBatch(msgs) {
		return nil
	}
	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.Remove convID: %v, msgs: %d", convID.String(), len(msgs)))()
	defer idx.consumeResultsForTest(convID, err)
	err = idx.store.remove(ctx, convID, uid, msgs)
	return err
}

// searchConv finds all messages that match the given set of tokens and opts,
// results are ordered desc by msg id.
func (idx *Indexer) searchConv(ctx context.Context, convID chat1.ConversationID, convIdx *chat1.ConversationIndex,
	uid gregor1.UID, tokens []string, opts chat1.SearchOpts) (msgIDs []chat1.MessageID, err error) {
	defer idx.Trace(ctx, func() error { return err }, fmt.Sprintf("searchConv convID: %v", convID.String()))()
	if convIdx == nil {
		return nil, nil
	}

	var allMsgIDs mapset.Set
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
	// Best effort attempt to get surrounding context. We filter out
	// non-visible messages so exact counts may be slightly off. We add a
	// padding of MaxContext to minimize the chance of this but don't have any
	// error correction in place.
	for _, msgID := range msgIDs {
		if opts.BeforeContext > 0 {
			for i := 0; i < opts.BeforeContext+MaxContext; i++ {
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
		if opts.AfterContext > 0 {
			for i := 0; i < opts.AfterContext+MaxContext; i++ {
				afterID := msgID + chat1.MessageID(i+1)
				idSetWithContext.Add(afterID)
			}
		}
	}
	msgIDSlice := msgIDsFromSet(idSetWithContext)
	reason := chat1.GetThreadReason_INDEXED_SEARCH
	msgs, err := idx.G().ChatHelper.GetMessages(ctx, uid, convID, msgIDSlice,
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
func (idx *Indexer) searchHitsFromMsgIDs(ctx context.Context, conv types.RemoteConversation, uid gregor1.UID,
	msgIDs []chat1.MessageID, queryRe *regexp.Regexp, opts chat1.SearchOpts) (convHits *chat1.ChatSearchInboxHit, err error) {
	if msgIDs == nil {
		return nil, nil
	}

	convID := conv.GetConvID()

	idSet, msgs, err := idx.getMsgsAndIDSet(ctx, uid, convID, msgIDs, opts)
	if err != nil {
		return nil, err
	}

	hits := []chat1.ChatSearchHit{}
	for i, msg := range msgs {
		if idSet.Contains(msg.GetMessageID()) && msg.IsValidFull() && opts.Matches(msg) {
			matches := searchMatches(msg, queryRe)
			if len(matches) == 0 {
				continue
			}
			afterLimit := i - opts.AfterContext
			if afterLimit < 0 {
				afterLimit = 0
			}
			afterMessages := getUIMsgs(ctx, idx.G(), convID, uid, msgs[afterLimit:i])

			var beforeMessages []chat1.UIMessage
			if i < len(msgs)-1 {
				beforeLimit := i + 1 + opts.AfterContext
				if beforeLimit >= len(msgs) {
					beforeLimit = len(msgs)
				}
				beforeMessages = getUIMsgs(ctx, idx.G(), convID, uid, msgs[i+1:beforeLimit])
			}

			searchHit := chat1.ChatSearchHit{
				BeforeMessages: beforeMessages,
				HitMessage:     utils.PresentMessageUnboxed(ctx, idx.G(), msg, uid, convID),
				AfterMessages:  afterMessages,
				Matches:        matches,
			}
			hits = append(hits, searchHit)
			if len(hits) >= opts.MaxHits {
				break
			}
		}
	}
	if len(hits) == 0 {
		return nil, nil
	}
	return &chat1.ChatSearchInboxHit{
		ConvID:   convID,
		ConvName: conv.GetName(),
		Hits:     hits,
	}, nil
}

type reindexOpts struct {
	forceReindex bool
	limitMaxJobs bool
	maxJobs      int
}

// reindexConv attempts to fill in any missing messages from the index.
// forceReindex toggles if the behavior is blocking or queued into the
// background conversation loader. For a small number of messages we use the
// GetMessages api to fill in the holes. If our index is missing many messages,
// we page through and add batches of missing messages.
func (idx *Indexer) reindexConv(ctx context.Context, conv chat1.Conversation, uid gregor1.UID,
	convIdx *chat1.ConversationIndex, opts reindexOpts) (completedJobs int, newIdx *chat1.ConversationIndex, err error) {

	// find the min and max missing ids so we can page between them to fill the gaps.
	minConvMsgID := conv.GetMaxDeletedUpTo()
	maxConvMsgID := conv.GetMaxMessageID()
	missingIDs := convIdx.MissingIDs(minConvMsgID, maxConvMsgID)
	if len(missingIDs) == 0 {
		return 0, convIdx, nil
	}
	minIdxID := maxConvMsgID
	maxIdxID := minConvMsgID
	for _, msgID := range missingIDs {
		if msgID < minIdxID {
			minIdxID = msgID
		}
		if msgID > maxIdxID {
			maxIdxID = msgID
		}
	}

	convID := conv.GetConvID()
	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.reindex: convID: %v, minID: %v, maxID: %v, numMissing: %v", convID, minIdxID, maxIdxID, len(missingIDs)))()

	reason := chat1.GetThreadReason_INDEXED_SEARCH
	if len(missingIDs) < idx.pageSize {
		postHook := func(ctx context.Context) error {
			msgs, err := idx.G().ConvSource.GetMessages(ctx, conv, uid, missingIDs, &reason)
			if err != nil {
				if utils.IsPermanentErr(err) {
					return err
				}
				return nil
			}
			return idx.Add(ctx, convID, uid, msgs)
		}
		if opts.forceReindex { // block on gathering results
			if err := postHook(ctx); err != nil {
				return 0, nil, err
			}
		} else { // queue up GetMessages in the background
			job := types.NewConvLoaderJob(convID, nil /*query*/, nil /*pagination*/, types.ConvLoaderPriorityMedium,
				func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
					if err := postHook(ctx); err != nil {
						idx.Debug(ctx, "unable to GetMessages: %v", err)
					}
				})
			if err := idx.G().ConvLoader.Queue(ctx, job); err != nil {
				idx.Debug(ctx, "unable queue job: %v", err)
			}
		}
		completedJobs++
	} else {
		query := &chat1.GetThreadQuery{
			DisablePostProcessThread: true,
			MarkAsRead:               false,
		}
		for i := minIdxID; i < maxIdxID; i += chat1.MessageID(idx.pageSize) {
			pagination := utils.XlateMessageIDControlToPagination(&chat1.MessageIDControl{
				Num:    idx.pageSize,
				Pivot:  &i,
				Recent: true,
			})
			if opts.forceReindex { // block on gathering results
				tv, err := idx.G().ConvSource.Pull(ctx, convID, uid, reason, query, pagination)
				if err != nil {
					if utils.IsPermanentErr(err) {
						return 0, nil, err
					}
					continue
				}
				if err := idx.Add(ctx, convID, uid, tv.Messages); err != nil {
					return 0, nil, err
				}
			} else { // queue up results
				job := types.NewConvLoaderJob(convID, query, pagination, types.ConvLoaderPriorityMedium,
					func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
						if err := idx.Add(ctx, convID, uid, tv.Messages); err != nil {
							idx.Debug(ctx, "unable add ids: %v", err)
						}
					})
				if err := idx.G().ConvLoader.Queue(ctx, job); err != nil {
					idx.Debug(ctx, "unable queue job: %v", err)
				}
			}
			completedJobs++
			if opts.limitMaxJobs && completedJobs >= opts.maxJobs {
				break
			}
		}
	}
	if idx.reindexCh != nil {
		idx.reindexCh <- convID
	}
	if opts.forceReindex { // refresh the index
		var err error
		convIdx, err = idx.store.getConvIndex(ctx, convID, uid)
		if err != nil {
			return 0, nil, err
		}
	}
	return completedJobs, convIdx, nil
}

func (idx *Indexer) allConvs(ctx context.Context, uid gregor1.UID) (map[string]types.RemoteConversation, error) {
	// Find all conversations in our inbox
	pagination := &chat1.Pagination{Num: idx.pageSize}
	topicType := chat1.TopicType_CHAT
	inboxQuery := &chat1.GetInboxQuery{
		ComputeActiveList: false,
		TopicType:         &topicType,
		Status: []chat1.ConversationStatus{
			chat1.ConversationStatus_UNFILED,
			chat1.ConversationStatus_FAVORITE,
			chat1.ConversationStatus_MUTED,
		},
	}
	username := idx.G().Env.GetUsername().String()
	// convID -> remoteConv
	convMap := map[string]types.RemoteConversation{}
	for !pagination.Last {
		inbox, err := idx.G().InboxSource.ReadUnverified(ctx, uid, true /* useLocalData*/, inboxQuery, pagination)
		if err != nil {
			return nil, err
		}
		pagination = inbox.Pagination
		pagination.Num = idx.pageSize
		pagination.Previous = nil
		for _, conv := range inbox.ConvsUnverified {
			if !conv.Conv.IsSelfFinalized(username) {
				convID := conv.GetConvID()
				convMap[convID.String()] = conv
			}
		}
	}
	return convMap, nil
}

// Search tokenizes the given query and finds the intersection of all matches
// for each token, returning matches.
func (idx *Indexer) Search(ctx context.Context, uid gregor1.UID, query string, opts chat1.SearchOpts,
	hitUICh chan chat1.ChatSearchInboxHit, indexUICh chan chat1.ChatSearchIndexStatus) (res *chat1.ChatSearchInboxResults, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.Search")()
	defer func() {
		if hitUICh != nil {
			close(hitUICh)
		}
		if indexUICh != nil {
			close(indexUICh)
		}
	}()

	// NOTE opts.MaxMessages is only used by the regexp searcher for search
	// boosting
	opts.MaxMessages = idx.maxBoostMsgs

	if opts.MaxHits > MaxAllowedSearchHits || opts.MaxHits < 0 {
		opts.MaxHits = MaxAllowedSearchHits
	}
	if opts.MaxHits == 0 {
		return nil, nil // um.
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
	queryRe, err := utils.GetQueryRe(query)
	if err != nil {
		return nil, err
	}

	convMap, err := idx.allConvs(ctx, uid)
	if err != nil || len(convMap) == 0 {
		return nil, err
	}

	// convID -> convIdx
	convIdxMap := map[string]*chat1.ConversationIndex{}
	totalPercentIndexed := 0
	for _, conv := range convMap {
		convID := conv.GetConvID()
		convIdx, err := idx.store.getConvIndex(ctx, convID, uid)
		if err != nil {
			return nil, err
		}
		totalPercentIndexed += convIdx.PercentIndexed(conv.Conv)
		convIdxMap[convID.String()] = convIdx
	}
	if opts.ForceReindex { // block on full reindexing and display progress as we go
		for convIDStr, conv := range convMap {
			convIdx := convIdxMap[convIDStr]
			percentIndexed := convIdx.PercentIndexed(conv.Conv)
			_, convIdx, err = idx.reindexConv(ctx, conv.Conv, uid, convIdx, reindexOpts{forceReindex: opts.ForceReindex})
			if err != nil {
				idx.Debug(ctx, "Unable to reindexConv: %v, %v", conv.Conv.GetConvID(), err)
				continue
			}
			convIdxMap[convIDStr] = convIdx
			newPercentIndexed := convIdx.PercentIndexed(conv.Conv)
			if percentIndexed != newPercentIndexed { // only write out updates..
				totalPercentIndexed -= percentIndexed
				totalPercentIndexed += newPercentIndexed
				if indexUICh != nil { // stream back index percentage as we update it
					indexUICh <- chat1.ChatSearchIndexStatus{
						PercentIndexed: totalPercentIndexed / len(convMap),
					}
				}
			}
		}
	}

	var numConvs, numBoostConvs int
	hits := []chat1.ChatSearchInboxHit{}
	for convIDStr, conv := range convMap {
		numConvs++
		convIdx := convIdxMap[convIDStr]
		convID := conv.GetConvID()
		msgIDs, err := idx.searchConv(ctx, convID, convIdx, uid, tokens, opts)
		if err != nil {
			return nil, err
		}
		convHits, err := idx.searchHitsFromMsgIDs(ctx, conv, uid, msgIDs, queryRe, opts)
		if err != nil {
			return nil, err
		}
		if len(msgIDs) != convHits.Size() {
			idx.Debug(ctx, "search hit mismatch, found %d msgIDs in index, %d hits in conv: %v",
				len(msgIDs), convHits.Size(), conv.GetName())
		}

		// If we don't have any hits, try to boost the search results with the
		// conversation based search.
		if convHits == nil && numBoostConvs < idx.maxBoostConvs {
			numBoostConvs++
			hits, err := idx.G().RegexpSearcher.Search(ctx, uid, convID, queryRe, nil /* uiCh */, opts)
			if err != nil {
				return nil, err
			} else if len(hits) > 0 {
				convHits = &chat1.ChatSearchInboxHit{
					ConvID:   convID,
					ConvName: conv.GetName(),
					Hits:     hits,
				}
			}
		}

		if convHits == nil {
			continue
		}
		if hitUICh != nil {
			// Stream search hits back to the UI channel
			hitUICh <- *convHits
		}
		hits = append(hits, *convHits)
		if opts.MaxConvs > 0 && numConvs >= opts.MaxConvs {
			break
		}
	}
	// kick this off in the background after we have our results so there is no
	// lock contention during the search
	if !opts.ForceReindex {
		for convIDStr, conv := range convMap {
			convIdx := convIdxMap[convIDStr]
			_, _, err = idx.reindexConv(ctx, conv.Conv, uid, convIdx, reindexOpts{forceReindex: opts.ForceReindex})
			if err != nil {
				return nil, err
			}
		}
	}
	percentIndexed := totalPercentIndexed / len(convMap)
	res = &chat1.ChatSearchInboxResults{
		Hits:           hits,
		PercentIndexed: percentIndexed,
	}
	return res, nil
}

type convIdxWithPercent struct {
	convID         chat1.ConversationID
	idx            *chat1.ConversationIndex
	percentIndexed int
}

// SelectiveSync queues up a small number of jobs on the background loader
// periodically so our index can cover all conversations. The number of jobs
// varies between desktop and mobile so mobile can be more conservative.
func (idx *Indexer) SelectiveSync(ctx context.Context, uid gregor1.UID, forceReindex bool) {
	defer idx.Trace(ctx, func() error { return nil }, "SelectiveSync")()

	convMap, err := idx.allConvs(ctx, uid)
	if err != nil {
		idx.Debug(ctx, "SelectiveSync: Unable to get convs: %v", err)
		return
	}
	convIdxs := []convIdxWithPercent{}
	for _, conv := range convMap {
		convID := conv.GetConvID()
		convIdx, err := idx.store.getConvIndex(ctx, convID, uid)
		if err != nil {
			idx.Debug(ctx, "SelectiveSync: Unable to get idx for conv: %v, %v", convID, err)
			continue
		}
		convIdxs = append(convIdxs, convIdxWithPercent{
			convID:         convID,
			idx:            convIdx,
			percentIndexed: convIdx.PercentIndexed(conv.Conv),
		})
	}
	// Pick the conversations that have the least percent indexed
	sort.Slice(convIdxs, func(i, j int) bool {
		return convIdxs[i].percentIndexed < convIdxs[j].percentIndexed
	})

	maxJobs := idx.maxSyncConvs
	var totalCompletedJobs int
	for _, idxInfo := range convIdxs {
		conv := convMap[idxInfo.convID.String()].Conv
		completedJobs, _, err := idx.reindexConv(ctx, conv, uid, idxInfo.idx, reindexOpts{
			forceReindex: forceReindex, // only true in tests
			limitMaxJobs: true,
			maxJobs:      maxJobs - totalCompletedJobs,
		})
		if err != nil {
			idx.Debug(ctx, "Unable to reindex conv: %v, %v", idxInfo.convID, err)
			continue
		}
		totalCompletedJobs += completedJobs
		idx.Debug(ctx, "SelectiveSync: Indexed %d/%d jobs", totalCompletedJobs, maxJobs)
		if totalCompletedJobs >= maxJobs {
			break
		}
	}
}

// IndexInbox is only exposed in devel for debugging/profiling the indexing
// process.
func (idx *Indexer) IndexInbox(ctx context.Context, uid gregor1.UID) (res map[string]chat1.ProfileSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.IndexInbox")()

	convMap, err := idx.allConvs(ctx, uid)
	if err != nil {
		return nil, err
	}
	// convID -> stats
	res = map[string]chat1.ProfileSearchConvStats{}
	for convIDStr, conv := range convMap {
		idx.G().Log.CDebugf(ctx, "Indexing conv: %v", conv.GetName())
		convStats, err := idx.indexConvWithProfile(ctx, conv.Conv, uid)
		if err != nil {
			idx.G().Log.CDebugf(ctx, "Indexing errored for conv: %v, %v", conv.GetName(), err)
			continue
		}
		idx.G().Log.CDebugf(ctx, "Indexing completed for conv: %v, stats: %+v", conv.GetName(), convStats)
		res[convIDStr] = convStats
	}
	return res, nil
}

func (idx *Indexer) indexConvWithProfile(ctx context.Context, conv chat1.Conversation, uid gregor1.UID) (res chat1.ProfileSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.indexConvWithProfile")()

	convID := conv.GetConvID()
	convIdx, err := idx.store.getConvIndex(ctx, convID, uid)
	if err != nil {
		return res, err
	}
	startT := time.Now()
	_, convIdx, err = idx.reindexConv(ctx, conv, uid, convIdx, reindexOpts{forceReindex: true})
	if err != nil {
		return res, err
	}
	res.NumMessages += len(convIdx.Metadata.SeenIDs)
	res.DurationMsec = gregor1.ToDurationMsec(time.Now().Sub(startT))
	res.PercentIndexed = convIdx.PercentIndexed(conv)
	dbKey := idx.store.dbKey(convID, uid)
	b, _, err := idx.G().LocalChatDb.GetRaw(dbKey)
	if err != nil {
		return res, err
	}
	res.IndexSize = len(b)
	return res, nil
}
