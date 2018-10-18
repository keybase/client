package search

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"time"

	mapset "github.com/deckarep/golang-set"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Indexer struct {
	globals.Contextified
	utils.DebugLabeler

	store    *store
	pageSize int

	// for testing
	consumeCh chan chat1.ConversationID
	reindexCh chan chat1.ConversationID
}

var _ types.Indexer = (*Indexer)(nil)

func NewIndexer(g *globals.Context) *Indexer {
	return &Indexer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Search.Indexer", false),
		store:        newStore(g),
		pageSize:     defaultPageSize,
	}
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
			msgText := msg.SearchableText()
			matches := queryRe.FindAllString(msgText, -1)
			if matches == nil {
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

// reindex attempts to fill in any missing messages from the index.
// forceReindex toggles if the behavior is blocking or queued into the
// background conversation loader. For a small number of messages we use the
// GetMessages api to fill in the holes. If our index is missing many messages,
// we page through and add batches of missing messages.
func (idx *Indexer) reindex(ctx context.Context, conv chat1.Conversation, uid gregor1.UID,
	convIdx *chat1.ConversationIndex, forceReindex bool) (newIdx *chat1.ConversationIndex, err error) {

	// find the min and max missing ids so we can page between them to fill the gaps.
	minConvMsgID := conv.GetMaxDeletedUpTo()
	maxConvMsgID := conv.GetMaxMessageID()
	missingIDs := convIdx.MissingIDs(minConvMsgID, maxConvMsgID)
	if len(missingIDs) == 0 {
		return convIdx, nil
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
				return err
			}
			return idx.Add(ctx, convID, uid, msgs)
		}
		if forceReindex { // block on gathering results
			if err := postHook(ctx); err != nil {
				return nil, err
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
			if forceReindex { // block on gathering results
				tv, err := idx.G().ConvSource.Pull(ctx, convID, uid, reason, query, pagination)
				if err != nil {
					return nil, err
				}
				if err := idx.Add(ctx, convID, uid, tv.Messages); err != nil {
					return nil, err
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
		}
	}
	if idx.reindexCh != nil {
		idx.reindexCh <- convID
	}
	if forceReindex { // refresh the index
		var err error
		convIdx, err = idx.store.getConvIndex(ctx, convID, uid)
		if err != nil {
			return nil, err
		}
	}
	return convIdx, nil
}

// Search tokenizes the given query and finds the intersection of all matches
// for each token, returning matches.
func (idx *Indexer) Search(ctx context.Context, uid gregor1.UID, query string,
	opts chat1.SearchOpts, uiCh chan chat1.ChatSearchInboxHit) (res *chat1.ChatSearchInboxResults, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.Search")()
	defer func() {
		if uiCh != nil {
			close(uiCh)
		}
	}()

	// NOTE opts.MaxMessages is ignored
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
	queryRe, err := getQueryRe(query)
	if err != nil {
		return nil, err
	}

	// Find all conversations in our inbox
	pagination := &chat1.Pagination{Num: idx.pageSize}
	topicType := chat1.TopicType_CHAT
	inboxQuery := &chat1.GetInboxQuery{
		TopicType: &topicType,
	}
	// convID -> remoteConv
	convMap := map[string]types.RemoteConversation{}
	// convID -> convIdx
	convIdxMap := map[string]*chat1.ConversationIndex{}
	for !pagination.Last {
		inbox, err := idx.G().InboxSource.ReadUnverified(ctx, uid, true /* useLocalData*/, inboxQuery, pagination)
		if err != nil {
			return nil, err
		}
		pagination = inbox.Pagination
		pagination.Num = idx.pageSize
		pagination.Previous = nil
		for _, conv := range inbox.ConvsUnverified {
			convID := conv.GetConvID()
			convMap[convID.String()] = conv
			convIdx, err := idx.store.getConvIndex(ctx, convID, uid)
			if err != nil {
				return nil, err
			}
			if opts.ForceReindex { // block on full reindexing
				convIdx, err = idx.reindex(ctx, conv.Conv, uid, convIdx, opts.ForceReindex)
				if err != nil {
					return nil, err
				}
			}
			convIdxMap[convID.String()] = convIdx
		}
	}

	numConvs := 0
	totalPercentIndexed := 0
	hits := []chat1.ChatSearchInboxHit{}
	for convIDStr, conv := range convMap {
		convIdx := convIdxMap[convIDStr]
		if convIdx == nil {
			continue
		}
		numConvs++
		percentIndexed := convIdx.PercentIndexed(conv.Conv)
		totalPercentIndexed += percentIndexed
		msgIDs, err := idx.searchConv(ctx, conv.GetConvID(), convIdx, uid, tokens, opts)
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
		if convHits == nil {
			continue
		}
		if uiCh != nil {
			// Stream search hits back to the UI channel
			uiCh <- *convHits
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
			if _, err := idx.reindex(ctx, conv.Conv, uid, convIdx, opts.ForceReindex); err != nil {
				return nil, err
			}
		}
	}
	percentIndexed := totalPercentIndexed / numConvs
	res = &chat1.ChatSearchInboxResults{
		Hits:           hits,
		PercentIndexed: percentIndexed,
	}
	return res, nil
}

// IndexInbox is only exposed in devel for debugging/profiling the indexing
// process.
func (idx *Indexer) IndexInbox(ctx context.Context, uid gregor1.UID) (res map[string]chat1.ProfileSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.IndexInbox")()

	pagination := &chat1.Pagination{Num: idx.pageSize}
	// convID -> stats
	res = map[string]chat1.ProfileSearchConvStats{}
	topicType := chat1.TopicType_CHAT
	inboxQuery := &chat1.GetInboxQuery{
		TopicType: &topicType,
	}
	for !pagination.Last {
		inbox, err := idx.G().InboxSource.ReadUnverified(ctx, uid, true /* useLocalData*/, inboxQuery, pagination)
		if err != nil {
			return nil, err
		}
		pagination = inbox.Pagination
		pagination.Num = idx.pageSize
		pagination.Previous = nil
		for _, conv := range inbox.ConvsUnverified {
			convID := conv.GetConvID()
			idx.G().Log.CDebugf(ctx, "Indexing conv: %v", conv.GetName())
			convStats, err := idx.indexConv(ctx, conv.Conv, uid)
			if err != nil {
				idx.G().Log.CDebugf(ctx, "Indexing errored for conv: %v, %v", conv.GetName(), err)
				continue
			}
			idx.G().Log.CDebugf(ctx, "Indexing completed for conv: %v, stats: %+v", conv.GetName(), convStats)
			res[convID.String()] = convStats
		}
	}
	return res, nil
}

func (idx *Indexer) indexConv(ctx context.Context, conv chat1.Conversation, uid gregor1.UID) (res chat1.ProfileSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.indexConv")()

	convID := conv.GetConvID()
	convIdx, err := idx.store.getConvIndex(ctx, convID, uid)
	if err != nil {
		return res, err
	}
	startT := time.Now()
	convIdx, err = idx.reindex(ctx, conv, uid, convIdx, true /* force reindex */)
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
