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
	"github.com/keybase/client/go/protocol/keybase1"
)

type Indexer struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	// encrypted on-disk storage
	store        *store
	pageSize     int
	stopCh       chan chan struct{}
	suspendCh    chan chan struct{}
	resumeCh     chan struct{}
	suspendCount int
	resumeWait   time.Duration
	started      bool

	maxSyncConvs          int
	startSyncDelay        time.Duration
	selectiveSyncActiveMu sync.Mutex
	selectiveSyncActive   bool

	// for testing
	consumeCh                            chan chat1.ConversationID
	reindexCh                            chan chat1.ConversationID
	syncLoopCh, cancelSyncCh, pokeSyncCh chan struct{}
}

var _ types.Indexer = (*Indexer)(nil)

func NewIndexer(g *globals.Context) *Indexer {
	idx := &Indexer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Search.Indexer", false),
		store:        newStore(g),
		pageSize:     defaultPageSize,
		stopCh:       make(chan chan struct{}, 10),
		suspendCh:    make(chan chan struct{}, 10),
		resumeWait:   time.Second,
		cancelSyncCh: make(chan struct{}, 100),
		pokeSyncCh:   make(chan struct{}, 100),
	}
	switch idx.G().GetAppType() {
	case libkb.MobileAppType:
		idx.SetMaxSyncConvs(maxSyncConvsMobile)
		idx.startSyncDelay = startSyncDelayMobile
	default:
		idx.startSyncDelay = startSyncDelayDesktop
		idx.SetMaxSyncConvs(maxSyncConvsDesktop)
	}
	return idx
}

func (idx *Indexer) SetStartSyncDelay(d time.Duration) {
	idx.startSyncDelay = d
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

func (idx *Indexer) SetSyncLoopCh(ch chan struct{}) {
	idx.syncLoopCh = ch
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
	if !idx.G().IsMobileAppType() {
		idx.started = true
		go idx.SyncLoop(ctx, uid)
	}
}

func (idx *Indexer) CancelSync(ctx context.Context) {
	idx.Debug(ctx, "CancelSync")
	select {
	case <-ctx.Done():
	case idx.cancelSyncCh <- struct{}{}:
	default:
	}
}

func (idx *Indexer) PokeSync(ctx context.Context) {
	idx.Debug(ctx, "PokeSync")
	select {
	case <-ctx.Done():
	case idx.pokeSyncCh <- struct{}{}:
	default:
	}
}

func (idx *Indexer) SyncLoop(ctx context.Context, uid gregor1.UID) {
	idx.Lock()
	stopCh := idx.stopCh
	suspendCh := idx.suspendCh
	idx.Unlock()
	idx.Debug(ctx, "starting SelectiveSync bg loop")

	ticker := libkb.NewBgTicker(time.Hour)
	after := time.After(idx.startSyncDelay)
	appState := keybase1.MobileAppState_FOREGROUND
	netState := keybase1.MobileNetworkState_WIFI
	var cancelFn context.CancelFunc
	var l sync.Mutex
	cancelSync := func() {
		l.Lock()
		defer l.Unlock()
		if cancelFn != nil {
			cancelFn()
			cancelFn = nil
		}
	}
	attemptSync := func(ctx context.Context) {
		if netState.IsLimited() {
			return
		}
		l.Lock()
		defer l.Unlock()
		if cancelFn != nil {
			cancelFn()
		}
		ctx, cancelFn = context.WithCancel(ctx)
		go func() {
			idx.Debug(ctx, "running SelectiveSync")
			if err := idx.SelectiveSync(ctx, uid); err != nil {
				idx.Debug(ctx, "unable to complete SelectiveSync: %v", err)
				if idx.syncLoopCh != nil {
					idx.syncLoopCh <- struct{}{}
				}
			}
			l.Lock()
			defer l.Unlock()
			if cancelFn != nil {
				cancelFn()
				cancelFn = nil
			}
		}()
	}

	stopSync := func(ctx context.Context, ch chan struct{}) {
		idx.Debug(ctx, "stopping SelectiveSync bg loop")
		cancelSync()
		ticker.Stop()
		close(ch)
	}
	for {
		select {
		case <-idx.cancelSyncCh:
			cancelSync()
		case <-idx.pokeSyncCh:
			attemptSync(ctx)
		case <-after:
			attemptSync(ctx)
		case <-ticker.C:
			attemptSync(ctx)
		case appState = <-idx.G().MobileAppState.NextUpdate(&appState):
			switch appState {
			case keybase1.MobileAppState_FOREGROUND:
			// if we enter any state besides foreground cancel any running syncs
			default:
				cancelSync()
			}
		case netState = <-idx.G().MobileNetState.NextUpdate(&netState):
			if netState.IsLimited() {
				// if we switch off of wifi cancel any running syncs
				cancelSync()
			}
		case ch := <-suspendCh:
			cancelSync()
			// block until we are told to resume or stop.
			select {
			case <-ch:
				time.Sleep(idx.resumeWait)
			case ch := <-idx.stopCh:
				stopSync(ctx, ch)
				return
			}
		case ch := <-stopCh:
			stopSync(ctx, ch)
			return
		}
	}
}

func (idx *Indexer) Stop(ctx context.Context) chan struct{} {
	defer idx.Trace(ctx, func() error { return nil }, "Stop")()
	idx.Lock()
	defer idx.Unlock()
	idx.store.ClearMemory()
	ch := make(chan struct{})
	if idx.started {
		idx.stopCh <- ch
		idx.started = false
	} else {
		close(ch)
	}
	return ch
}

func (idx *Indexer) Suspend(ctx context.Context) bool {
	defer idx.Trace(ctx, func() error { return nil }, "Suspend")()
	idx.Lock()
	defer idx.Unlock()
	if !idx.started {
		return false
	}
	if idx.suspendCount == 0 {
		idx.Debug(ctx, "Suspend: sending on suspendCh")
		idx.resumeCh = make(chan struct{})
		select {
		case idx.suspendCh <- idx.resumeCh:
		default:
			idx.Debug(ctx, "Suspend: failed to suspend loop")
		}
	}
	idx.suspendCount++
	return true
}

func (idx *Indexer) Resume(ctx context.Context) bool {
	defer idx.Trace(ctx, func() error { return nil }, "Resume")()
	idx.Lock()
	defer idx.Unlock()
	if idx.suspendCount > 0 {
		idx.suspendCount--
		if idx.suspendCount == 0 && idx.resumeCh != nil {
			close(idx.resumeCh)
			return true
		}
	}
	return false
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
	return idx.store.Add(ctx, uid, convID, msgs)
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
	return idx.store.Remove(ctx, uid, convID, msgs)
}

// reindexConv attempts to fill in any missing messages from the index.  For a
// small number of messages we use the GetMessages api to fill in the holes. If
// our index is missing many messages, we page through and add batches of
// missing messages.
func (idx *Indexer) reindexConv(ctx context.Context, rconv types.RemoteConversation, uid gregor1.UID,
	numJobs int, inboxIndexStatus *inboxIndexStatus) (completedJobs int, err error) {
	conv := rconv.Conv
	convID := conv.GetConvID()
	md, err := idx.store.GetMetadata(ctx, uid, convID)
	if err != nil {
		return 0, err
	}
	missingIDs := md.MissingIDForConv(conv)
	if len(missingIDs) == 0 {
		return 0, nil
	}
	minIdxID := missingIDs[0]
	maxIdxID := missingIDs[len(missingIDs)-1]

	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.reindex: conv: %v, minID: %v, maxID: %v, numMissing: %v",
			rconv.GetName(), minIdxID, maxIdxID, len(missingIDs)))()

	reason := chat1.GetThreadReason_INDEXED_SEARCH
	if len(missingIDs) < idx.pageSize {
		msgs, err := idx.G().ConvSource.GetMessages(ctx, conv, uid, missingIDs, &reason)
		if err != nil {
			if utils.IsPermanentErr(err) {
				return 0, err
			}
			return 0, nil
		}
		if err := idx.Add(ctx, convID, uid, msgs); err != nil {
			return 0, err
		}
		completedJobs++
	} else {
		query := &chat1.GetThreadQuery{
			DisablePostProcessThread: true,
			MarkAsRead:               false,
		}
		for i := minIdxID; i < maxIdxID; i += chat1.MessageID(idx.pageSize) {
			select {
			case <-ctx.Done():
				return 0, ctx.Err()
			default:
			}
			pagination := utils.MessageIDControlToPagination(ctx, idx.DebugLabeler, &chat1.MessageIDControl{
				Num:   idx.pageSize,
				Pivot: &i,
				Mode:  chat1.MessageIDControlMode_NEWERMESSAGES,
			}, nil)
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
			completedJobs++
			if numJobs > 0 && completedJobs >= numJobs {
				break
			}
			if inboxIndexStatus != nil {
				md, err := idx.store.GetMetadata(ctx, uid, conv.GetConvID())
				if err != nil {
					idx.Debug(ctx, "updateInboxIndex: unable to GetMetadata %v", err)
					continue
				}
				inboxIndexStatus.addConv(md, conv)
				percentIndexed, err := inboxIndexStatus.updateUI(ctx)
				if err != nil {
					idx.Debug(ctx, "unable to update ui %v", err)
				} else {
					idx.Debug(ctx, "%v is %d%% indexed, inbox is %d%% indexed",
						rconv.GetName(), md.PercentIndexed(conv), percentIndexed)
				}
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
			if conv.Conv.GetFinalizeInfo() == nil {
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
		// get a selective sync to run after the search completes even if we
		// errored.
		idx.PokeSync(ctx)

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

	idx.CancelSync(ctx)
	sess := newSearchSession(query, origQuery, uid, hitUICh, indexUICh, idx, opts)
	return sess.run(ctx)
}

func (idx *Indexer) IsBackgroundActive() bool {
	idx.selectiveSyncActiveMu.Lock()
	defer idx.selectiveSyncActiveMu.Unlock()
	return idx.selectiveSyncActive
}

func (idx *Indexer) setSelectiveSyncActive(val bool) {
	idx.selectiveSyncActiveMu.Lock()
	defer idx.selectiveSyncActiveMu.Unlock()
	idx.selectiveSyncActive = val
}

// SelectiveSync queues up a small number of jobs on the background loader
// periodically so our index can cover all conversations. The number of jobs
// varies between desktop and mobile so mobile can be more conservative.
func (idx *Indexer) SelectiveSync(ctx context.Context, uid gregor1.UID) (err error) {
	defer idx.Trace(ctx, func() error { return err }, "SelectiveSync")()
	idx.setSelectiveSyncActive(true)
	defer func() { idx.setSelectiveSyncActive(false) }()

	convMap, err := idx.allConvs(ctx, uid, nil)
	if err != nil {
		return err
	}

	// make sure the most recently modified convs are fully indexed
	convs := idx.convsByMTime(ctx, uid, convMap)
	// number of batches of messages to fetch in total
	numJobs := idx.maxSyncConvs
	for _, conv := range convs {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		convID := conv.GetConvID()
		md, err := idx.store.GetMetadata(ctx, uid, convID)
		if err != nil {
			idx.Debug(ctx, "SelectiveSync: Unable to get md for conv: %v, %v", convID, err)
			continue
		}
		if md.FullyIndexed(conv.Conv) {
			continue
		}

		completedJobs, err := idx.reindexConv(ctx, conv, uid, numJobs, nil)
		if err != nil {
			idx.Debug(ctx, "Unable to reindex conv: %v, %v", convID, err)
			continue
		} else if completedJobs == 0 {
			continue
		}
		idx.Debug(ctx, "SelectiveSync: Indexed completed jobs %d", completedJobs)
		numJobs -= completedJobs
		if numJobs <= 0 {
			break
		}
	}
	return nil
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
	md, err := idx.store.GetMetadata(ctx, uid, conv.GetConvID())
	if err != nil {
		return res, err
	}
	defer func() {
		res.ConvName = conv.GetName()
		if md != nil {
			min, max := MinMaxIDs(conv.Conv)
			res.MinConvID = min
			res.MaxConvID = max
			res.NumMissing = len(md.MissingIDForConv(conv.Conv))
			res.NumMessages = len(md.SeenIDs)
			res.PercentIndexed = md.PercentIndexed(conv.Conv)
		}
		if err != nil {

			res.Err = err.Error()
		}
	}()

	startT := time.Now()
	_, err = idx.reindexConv(ctx, conv, uid, 0, nil)
	if err != nil {
		return res, err
	}
	res.DurationMsec = gregor1.ToDurationMsec(time.Now().Sub(startT))
	dbKey := idx.store.metadataKey(uid, conv.GetConvID())
	b, _, err := idx.G().LocalChatDb.GetRaw(dbKey)
	if err != nil {
		return res, err
	}
	res.IndexSizeDisk = len(b)
	res.IndexSizeMem = md.Size()
	return res, nil
}

func (idx *Indexer) FullyIndexed(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (res bool, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.FullyIndexed")()
	conv, err := utils.GetUnverifiedConv(ctx, idx.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return false, err
	}
	md, err := idx.store.GetMetadata(ctx, uid, convID)
	if err != nil {
		return false, err
	}
	return md.FullyIndexed(conv.Conv), nil
}

func (idx *Indexer) PercentIndexed(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (res int, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.PercentIndexed")()
	conv, err := utils.GetUnverifiedConv(ctx, idx.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return 0, err
	}
	md, err := idx.store.GetMetadata(ctx, uid, convID)
	if err != nil {
		return 0, err
	}
	return md.PercentIndexed(conv.Conv), nil
}

func (idx *Indexer) OnDbNuke(mctx libkb.MetaContext) error {
	idx.store.ClearMemory()
	return nil
}

func (idx *Indexer) GetStoreHits(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	query string) (res map[chat1.MessageID]chat1.EmptyStruct, err error) {
	return idx.store.GetHits(ctx, uid, convID, query)
}
