package search

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

// cap the in-memory cache size
const cacheSize = 250

type Indexer struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	// encrypted on-disk storage
	store *store
	// in-memory cache, "uid:convID" -> idx
	cache    map[string]*chat1.ConversationIndex
	pageSize int
	stopCh   chan struct{}
	started  bool

	maxSyncConvs int

	// for testing
	consumeCh chan chat1.ConversationID
	reindexCh chan chat1.ConversationID
}

var _ types.Indexer = (*Indexer)(nil)

func NewIndexer(g *globals.Context) *Indexer {
	idx := &Indexer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Search.Indexer", false),
		cache:        make(map[string]*chat1.ConversationIndex),
		store:        newStore(g),
		pageSize:     defaultPageSize,
		stopCh:       make(chan struct{}),
	}
	switch idx.G().GetAppType() {
	case libkb.MobileAppType:
		idx.SetMaxSyncConvs(maxSyncConvsMobile)
	default:

		idx.SetMaxSyncConvs(maxSyncConvsDesktop)
	}
	return idx
}

func (idx *Indexer) SetMaxSyncConvs(x int) {
	idx.maxSyncConvs = x
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

	if idx.G().GetEnv().GetDisableSearchIndexer() {
		idx.Debug(ctx, "Search indexer disabled, aborting Start")
		return
	}

	if idx.started {
		return
	}
	idx.started = true
	ticker := libkb.NewBgTicker(time.Hour)
	go func(stopCh chan struct{}) {
		idx.Debug(ctx, "starting SelectiveSync bg loop")

		// run one quickly
		select {
		case <-time.After(libkb.DefaultBgTickerWait):
			idx.SelectiveSync(ctx, uid, false /*forceReindex */)
		case <-stopCh:
			idx.Debug(ctx, "stopping SelectiveSync bg loop")
			return
		}

		for {
			select {
			case <-ticker.C:
				// queue up some jobs on the background loader
				idx.Debug(ctx, "running SelectiveSync")
				idx.SelectiveSync(ctx, uid, false /*forceReindex */)
			case <-stopCh:
				idx.Debug(ctx, "stopping SelectiveSync bg loop")
				ticker.Stop()
				return
			}
		}
	}(idx.stopCh)
}

func (idx *Indexer) Stop(ctx context.Context) chan struct{} {
	defer idx.Trace(ctx, func() error { return nil }, "Stop")()
	idx.Lock()
	defer idx.Unlock()

	ch := make(chan struct{})
	if idx.started {
		close(idx.stopCh)
		idx.stopCh = make(chan struct{})
		idx.started = false
	}
	close(ch)
	return ch
}

func (idx *Indexer) ClearCache() {
	idx.Lock()
	defer idx.Unlock()
	idx.cache = make(map[string]*chat1.ConversationIndex)
}

func (idx *Indexer) OnLogout(mctx libkb.MetaContext) error {
	idx.ClearCache()
	return nil
}

func (idx *Indexer) OnDbNuke(mctx libkb.MetaContext) error {
	idx.ClearCache()
	return nil
}

func (idx *Indexer) cacheKey(convID chat1.ConversationID, uid gregor1.UID) string {
	return fmt.Sprintf("%s:%s", uid, convID)
}

func (idx *Indexer) deleteFromCache(convID chat1.ConversationID, uid gregor1.UID) {
	idx.Lock()
	defer idx.Unlock()

	key := idx.cacheKey(convID, uid)
	delete(idx.cache, key)
}

func (idx *Indexer) GetConvIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (*chat1.ConversationIndex, error) {
	idx.Lock()
	defer idx.Unlock()

	key := idx.cacheKey(convID, uid)
	if convIdx, ok := idx.cache[key]; ok {
		return convIdx, nil
	}
	convIdx, err := idx.store.getConvIndex(ctx, convID, uid)
	if err != nil {
		return nil, err
	}
	if len(idx.cache) < cacheSize {
		idx.cache[key] = convIdx
	}
	return convIdx, nil
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
	if idx.G().GetEnv().GetDisableSearchIndexer() {
		return nil
	}
	if !idx.validBatch(msgs) {
		return nil
	}
	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.Add convID: %v, msgs: %d", convID.String(), len(msgs)))()
	defer idx.consumeResultsForTest(convID, err)
	idx.deleteFromCache(convID, uid)
	return idx.store.add(ctx, convID, uid, msgs)
}

func (idx *Indexer) Remove(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) (err error) {
	if idx.G().GetEnv().GetDisableSearchIndexer() {
		return nil
	}
	if !idx.validBatch(msgs) {
		return nil
	}
	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.Remove convID: %v, msgs: %d", convID.String(), len(msgs)))()
	defer idx.consumeResultsForTest(convID, err)
	idx.deleteFromCache(convID, uid)
	return idx.store.remove(ctx, convID, uid, msgs)
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

	missingIDs := convIdx.MissingIDForConv(conv)
	if len(missingIDs) == 0 {
		return 0, convIdx, nil
	}
	minIdxID := missingIDs[0]
	maxIdxID := missingIDs[len(missingIDs)-1]

	convID := conv.GetConvID()
	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.reindex: convID: %v, minID: %v, maxID: %v, numMissing: %v",
			convID, minIdxID, maxIdxID, len(missingIDs)))()

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
			pagination := utils.MessageIDControlToPagination(ctx, idx.DebugLabeler, &chat1.MessageIDControl{
				Num:   idx.pageSize,
				Pivot: &i,
				Mode:  chat1.MessageIDControlMode_NEWERMESSAGES,
			}, nil)
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
		convIdx, err = idx.GetConvIndex(ctx, convID, uid)
		if err != nil {
			return 0, nil, err
		}
	}
	return completedJobs, convIdx, nil
}

func (idx *Indexer) SearchableConvs(ctx context.Context, uid gregor1.UID, convID *chat1.ConversationID) (res []types.RemoteConversation, err error) {
	convMap, err := idx.allConvs(ctx, uid, convID)
	if err != nil {
		return res, err
	}
	return idx.convsByMTime(ctx, uid, convMap), nil
}

func (idx *Indexer) allConvs(ctx context.Context, uid gregor1.UID, convID *chat1.ConversationID) (map[string]types.RemoteConversation, error) {
	// Find all conversations in our inbox
	pagination := &chat1.Pagination{Num: idx.pageSize}
	topicType := chat1.TopicType_CHAT
	inboxQuery := &chat1.GetInboxQuery{
		ConvID:            convID,
		ComputeActiveList: false,
		TopicType:         &topicType,
		Status: []chat1.ConversationStatus{
			chat1.ConversationStatus_UNFILED,
			chat1.ConversationStatus_FAVORITE,
			chat1.ConversationStatus_MUTED,
		},
		MemberStatus: []chat1.ConversationMemberStatus{
			chat1.ConversationMemberStatus_ACTIVE,
			chat1.ConversationMemberStatus_PREVIEW,
		},
		SkipBgLoads: true,
	}
	username := idx.G().Env.GetUsername().String()
	// convID -> remoteConv
	convMap := map[string]types.RemoteConversation{}
	for !pagination.Last {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		inbox, err := idx.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll,
			inboxQuery, pagination)
		if err != nil {
			return nil, err
		}
		if inbox.Pagination != nil {
			pagination = inbox.Pagination
			pagination.Num = idx.pageSize
			pagination.Previous = nil
		}
		for _, conv := range inbox.ConvsUnverified {
			if !conv.Conv.IsSelfFinalized(username) {
				convID := conv.GetConvID()
				convMap[convID.String()] = conv
			}
		}
	}
	return convMap, nil
}

func (idx *Indexer) convsByMTime(ctx context.Context, uid gregor1.UID,
	convMap map[string]types.RemoteConversation) (res []types.RemoteConversation) {
	res = make([]types.RemoteConversation, len(convMap))
	index := 0
	for _, conv := range convMap {
		res[index] = conv
		index++
	}
	_, ib, err := storage.NewInbox(idx.G()).ReadAll(ctx, uid, true)
	if err != nil {
		idx.Debug(ctx, "convsByMTime: failed to read inbox: %s", err)
		return res
	}
	sortMap := make(map[string]gregor1.Time)
	for _, conv := range ib {
		sortMap[conv.GetConvID().String()] = utils.GetConvMtime(conv.Conv)
	}
	sort.Slice(res, func(i, j int) bool {
		imtime := sortMap[res[i].GetConvID().String()]
		jmtime := sortMap[res[j].GetConvID().String()]
		return imtime.After(jmtime)
	})
	return res
}

// Search tokenizes the given query and finds the intersection of all matches
// for each token, returning matches.
func (idx *Indexer) Search(ctx context.Context, uid gregor1.UID, query, origQuery string,
	opts chat1.SearchOpts, hitUICh chan chat1.ChatSearchInboxHit, indexUICh chan chat1.ChatSearchIndexStatus) (res *chat1.ChatSearchInboxResults, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.Search")()
	defer func() {
		if hitUICh != nil {
			close(hitUICh)
		}
		if indexUICh != nil {
			close(indexUICh)
		}
	}()
	if idx.G().GetEnv().GetDisableSearchIndexer() {
		idx.Debug(ctx, "Search: Search indexer is disabled, results will be inaccurate.")
	}

	sess := newSearchSession(query, origQuery, uid, hitUICh, indexUICh, idx, opts)
	return sess.run(ctx)
}

// SelectiveSync queues up a small number of jobs on the background loader
// periodically so our index can cover all conversations. The number of jobs
// varies between desktop and mobile so mobile can be more conservative.
func (idx *Indexer) SelectiveSync(ctx context.Context, uid gregor1.UID, forceReindex bool) {
	defer idx.Trace(ctx, func() error { return nil }, "SelectiveSync")()

	convMap, err := idx.allConvs(ctx, uid, nil)
	if err != nil {
		idx.Debug(ctx, "SelectiveSync: Unable to get convs: %v", err)
		return
	}

	// make sure the most recently modified convs are fully indexed
	convs := idx.convsByMTime(ctx, uid, convMap)
	maxJobs := idx.maxSyncConvs
	var totalCompletedJobs, fullyIndexedConvs int
	for _, conv := range convs {
		convID := conv.GetConvID()
		convIdx, err := idx.GetConvIndex(ctx, convID, uid)
		if err != nil {
			idx.Debug(ctx, "SelectiveSync: Unable to get idx for conv: %v, %v", convID, err)
			continue
		}
		if convIdx.FullyIndexed(conv.Conv) {
			fullyIndexedConvs++
			continue
		}

		completedJobs, _, err := idx.reindexConv(ctx, conv.Conv, uid, convIdx, reindexOpts{
			forceReindex: forceReindex, // only true in tests
			limitMaxJobs: true,
			maxJobs:      maxJobs - totalCompletedJobs,
		})
		if err != nil {
			idx.Debug(ctx, "Unable to reindex conv: %v, %v", convID, err)
			continue
		} else if completedJobs == 0 {
			fullyIndexedConvs++
			continue
		}
		totalCompletedJobs += completedJobs
		idx.Debug(ctx, "SelectiveSync: Indexed %d/%d jobs", totalCompletedJobs, maxJobs)
		if totalCompletedJobs >= maxJobs {
			break
		}
	}
	idx.Debug(ctx, "SelectiveSync: Complete, %d/%d convs already fully indexed",
		fullyIndexedConvs, len(convs))
}

// IndexInbox is only exposed in devel for debugging/profiling the indexing
// process.
func (idx *Indexer) IndexInbox(ctx context.Context, uid gregor1.UID) (res map[string]chat1.ProfileSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.IndexInbox")()

	convMap, err := idx.allConvs(ctx, uid, nil)
	if err != nil {
		return nil, err
	}
	// convID -> stats
	res = map[string]chat1.ProfileSearchConvStats{}
	for convIDStr, conv := range convMap {
		idx.G().Log.CDebugf(ctx, "Indexing conv: %v", conv.GetName())
		convStats, err := idx.indexConvWithProfile(ctx, conv, uid)
		if err != nil {
			idx.G().Log.CDebugf(ctx, "Indexing errored for conv: %v, %v", conv.GetName(), err)
		} else {
			idx.G().Log.CDebugf(ctx, "Indexing completed for conv: %v, stats: %+v", conv.GetName(), convStats)
		}
		res[convIDStr] = convStats
	}
	return res, nil
}

func (idx *Indexer) indexConvWithProfile(ctx context.Context, conv types.RemoteConversation,
	uid gregor1.UID) (res chat1.ProfileSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.indexConvWithProfile")()
	var convIdx *chat1.ConversationIndex
	defer func() {
		res.ConvName = conv.GetName()
		if convIdx != nil {
			res.NumMessages = len(convIdx.Metadata.SeenIDs)
			res.PercentIndexed = convIdx.PercentIndexed(conv.Conv)
		}
		if err != nil {
			res.Err = err.Error()
		}
	}()

	convID := conv.GetConvID()
	convIdx, err = idx.GetConvIndex(ctx, convID, uid)
	if err != nil {
		return res, err
	}

	startT := time.Now()
	_, convIdx, err = idx.reindexConv(ctx, conv.Conv, uid, convIdx, reindexOpts{forceReindex: true})
	if err != nil {
		return res, err
	}
	res.DurationMsec = gregor1.ToDurationMsec(time.Now().Sub(startT))
	dbKey := idx.store.dbKey(convID, uid)
	b, _, err := idx.G().LocalChatDb.GetRaw(dbKey)
	if err != nil {
		return res, err
	}
	res.IndexSize = len(b)
	return res, nil
}
