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

type Indexer struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	// indexes
	indexes      map[string]*chat1.ConversationIndex
	dirtyIndexes map[string]chat1.ConversationID
	indexLockTab *libkb.LockTable
	flushUID     gregor1.UID
	flushCh      chan struct{}

	// encrypted on-disk storage
	store    *store
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
		store:        newStore(g),
		pageSize:     defaultPageSize,
		stopCh:       make(chan struct{}),
		indexes:      make(map[string]*chat1.ConversationIndex),
		dirtyIndexes: make(map[string]chat1.ConversationID),
		indexLockTab: &libkb.LockTable{},
		flushCh:      make(chan struct{}, 50),
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

func (idx *Indexer) forceFlush() {
	select {
	case idx.flushCh <- struct{}{}:
	default:
	}
}

func (idx *Indexer) ClearMemory() {
	idx.Lock()
	defer idx.Unlock()
	idx.indexes = make(map[string]*chat1.ConversationIndex)
	idx.dirtyIndexes = make(map[string]chat1.ConversationID)
}

func (idx *Indexer) Flush() {
	defer idx.Trace(context.Background(), func() error { return nil }, "Flsh")()
	var dirties []chat1.ConversationID
	idx.Lock()
	for _, convID := range idx.dirtyIndexes {
		dirties = append(dirties, convID)
	}
	idx.dirtyIndexes = make(map[string]chat1.ConversationID)
	idx.Unlock()

	ctx := context.Background()
	for _, convID := range dirties {
		idx.Debug(ctx, "Flush: flushing: %s", convID)
		convIdx, lock, err := idx.AcquireConvIndex(ctx, convID, idx.flushUID)
		if err != nil {
			idx.Debug(ctx, "Flush: failed to acquire in flush: %s: err: %s", convID, err)
			continue
		}
		if err := idx.store.putConvIndex(ctx, convID, idx.flushUID, convIdx.idx); err != nil {
			idx.Debug(ctx, "Flush: failed to put conv index: %s: err: %s", convID, err)
		}
		lock.Release(ctx)
	}
}

func (idx *Indexer) flushLoop(stopCh chan struct{}) {
	for {
		select {
		case <-time.After(30 * time.Second):
			idx.Flush()
		case <-idx.flushCh:
			idx.Flush()
		case <-stopCh:
			return
		}
	}
}

func (idx *Indexer) markDirty(ctx context.Context, convID chat1.ConversationID) {
	idx.Lock()
	defer idx.Unlock()
	idx.dirtyIndexes[convID.String()] = convID
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
	idx.flushUID = uid
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
	go idx.flushLoop(idx.stopCh)
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

func (idx *Indexer) AcquireConvIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (res *ConversationIndexWrapper, lock *libkb.NamedLock, err error) {
	var convIdx *chat1.ConversationIndex
	lock = idx.indexLockTab.AcquireOnName(ctx, idx.G(), fmt.Sprintf("%s:%s", convID, uid))
	idx.Lock()
	defer idx.Unlock()
	defer func() {
		if err != nil {
			lock.Release(ctx)
		} else {
			res = NewConversationIndexWrapper(idx.G(), convIdx)
		}
	}()
	var ok bool
	if convIdx, ok = idx.indexes[convID.String()]; ok {
		return res, lock, nil
	}
	if convIdx, err = idx.store.getConvIndex(ctx, convID, uid); err != nil {
		return nil, lock, err
	}
	idx.indexes[convID.String()] = convIdx
	return res, lock, nil
}

func (idx *Indexer) DropConvIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) {
	lock := idx.indexLockTab.AcquireOnName(ctx, idx.G(), fmt.Sprintf("%s:%s", convID, uid))
	defer lock.Release(ctx)
	idx.Lock()
	defer idx.Unlock()
	delete(idx.indexes, convID.String())
	delete(idx.dirtyIndexes, convID.String())
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
	defer func() {
		if err == nil {
			idx.markDirty(ctx, convID)
		}
	}()

	convIdx, lock, err := idx.AcquireConvIndex(ctx, convID, uid)
	if err != nil {
		return err
	}
	defer lock.Release(ctx)
	return convIdx.Add(ctx, convID, uid, msgs)
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
	defer func() {
		if err == nil {
			idx.markDirty(ctx, convID)
		}
	}()

	convIdx, lock, err := idx.AcquireConvIndex(ctx, convID, uid)
	if err != nil {
		return err
	}
	defer lock.Release(ctx)
	return convIdx.Remove(ctx, convID, msgs)
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
func (idx *Indexer) reindexConv(ctx context.Context, rconv types.RemoteConversation, uid gregor1.UID,
	opts reindexOpts) (completedJobs int, err error) {

	conv := rconv.Conv
	convIdx, lock, err := idx.AcquireConvIndex(ctx, conv.GetConvID(), uid)
	if err != nil {
		return 0, err
	}
	missingIDs := convIdx.MissingIDForConv(conv)
	lock.Release(ctx)
	if len(missingIDs) == 0 {
		return 0, nil
	}
	minIdxID := missingIDs[0]
	maxIdxID := missingIDs[len(missingIDs)-1]

	convID := conv.GetConvID()
	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("reindexConv: conv: %v, minID: %v, maxID: %v, numMissing: %v",
			rconv.GetName(), minIdxID, maxIdxID, len(missingIDs)))()
	defer func() {
		convIdx, lock, err := idx.AcquireConvIndex(ctx, conv.GetConvID(), uid)
		if err == nil {
			size := convIdx.Size()
			lock.Release(ctx)
			idx.Debug(ctx, "reindexConv: complete: conv: %s size: %v", rconv.GetName(), size)
		}
	}()
	defer idx.forceFlush()

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
				return 0, err
			}
		} else { // queue up GetMessages in the background
			job := types.NewConvLoaderJob(convID, nil /*query*/, nil /*pagination*/, types.ConvLoaderPriorityMedium,
				func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
					if err := postHook(ctx); err != nil {
						idx.Debug(ctx, "reindexConv: unable to GetMessages: %v", err)
					}
				})
			if err := idx.G().ConvLoader.Queue(ctx, job); err != nil {
				idx.Debug(ctx, "reindexConv: unable queue job: %v", err)
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
						return 0, err
					}
					continue
				}
				if err := idx.Add(ctx, convID, uid, tv.Messages); err != nil {
					return 0, err
				}
			} else { // queue up results
				job := types.NewConvLoaderJob(convID, query, pagination, types.ConvLoaderPriorityMedium,
					func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
						if err := idx.Add(ctx, convID, uid, tv.Messages); err != nil {
							idx.Debug(ctx, "reindexConv: unable add ids: %v", err)
						}
					})
				if err := idx.G().ConvLoader.Queue(ctx, job); err != nil {
					idx.Debug(ctx, "reindexConv: unable queue job: %v", err)
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
	return completedJobs, nil
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

	sess := newSearchSession(idx.G().GetLog(), query, origQuery, uid, hitUICh, indexUICh, idx, opts)
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
		completedJobs, err := idx.reindexConv(ctx, conv, uid, reindexOpts{
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
	return res, nil
	/*var convIdx *chat1.ConversationIndex
	defer func() {
		res.ConvName = conv.GetName()
		if convIdx != nil {
			min, max := convIdx.MinMaxIDs(conv.Conv)
			res.MinConvID = min
			res.MaxConvID = max
			res.NumMissing = len(convIdx.MissingIDForConv(conv.Conv))
			res.NumMessages = len(convIdx.Metadata.SeenIDs)
			res.PercentIndexed = convIdx.PercentIndexed(conv.Conv)
		}
		if err != nil {
			res.Err = err.Error()
		}
	}()

	convID := conv.GetConvID()
	startT := time.Now()
	_, err = idx.reindexConv(ctx, conv, uid, reindexOpts{forceReindex: true})
	if err != nil {
		return res, err
	}
	res.DurationMsec = gregor1.ToDurationMsec(time.Now().Sub(startT))
	dbKey := idx.store.dbKey(convID, uid)
	b, _, err := idx.G().LocalChatDb.GetRaw(dbKey)
	if err != nil {
		return res, err
	}
	res.IndexSizeDisk = len(b)
	res.IndexSizeMem = convIdx.Size()
	return res, nil*/
}
