package search

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"golang.org/x/sync/errgroup"
)

// If a conversation doesn't meet the minimum requirements, don't update the
// index realtime. The priority score emphasizes how much of the conversation
// is read, a prerequisite for searching.
const minPriorityScore = 10

type storageAdd struct {
	ctx    context.Context
	convID chat1.ConversationID
	msgs   []chat1.MessageUnboxed
	cb     chan struct{}
}

type storageRemove struct {
	ctx    context.Context
	convID chat1.ConversationID
	msgs   []chat1.MessageUnboxed
	cb     chan struct{}
}

type Indexer struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	// encrypted on-disk storage
	store        *store
	pageSize     int
	stopCh       chan struct{}
	suspendCh    chan chan struct{}
	resumeCh     chan struct{}
	suspendCount int
	resumeWait   time.Duration
	started      bool
	clock        clockwork.Clock
	eg           errgroup.Group
	uid          gregor1.UID
	storageCh    chan interface{}

	maxSyncConvs          int
	startSyncDelay        time.Duration
	selectiveSyncActiveMu sync.Mutex
	selectiveSyncActive   bool
	flushDelay            time.Duration

	// for testing
	consumeCh                            chan chat1.ConversationID
	reindexCh                            chan chat1.ConversationID
	syncLoopCh, cancelSyncCh, pokeSyncCh chan struct{}
}

var _ types.Indexer = (*Indexer)(nil)

func NewIndexer(g *globals.Context) *Indexer {
	idx := &Indexer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), g.GetPerfLog(), "Search.Indexer", false),
		pageSize:     defaultPageSize,
		suspendCh:    make(chan chan struct{}, 10),
		resumeWait:   time.Second,
		cancelSyncCh: make(chan struct{}, 100),
		pokeSyncCh:   make(chan struct{}, 100),
		clock:        clockwork.NewRealClock(),
		flushDelay:   15 * time.Second,
		storageCh:    make(chan interface{}, 100),
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

func (idx *Indexer) SetUID(uid gregor1.UID) {
	idx.uid = uid
	idx.store = newStore(idx.G(), uid)
}

func (idx *Indexer) StartFlushLoop() {
	idx.Lock()
	defer idx.Unlock()
	if !idx.started {
		idx.started = true
		idx.stopCh = make(chan struct{})
	}
	idx.eg.Go(func() error { return idx.flushLoop(idx.stopCh) })
}

func (idx *Indexer) StartStorageLoop() {
	idx.Lock()
	defer idx.Unlock()
	if !idx.started {
		idx.started = true
		idx.stopCh = make(chan struct{})
	}
	idx.eg.Go(func() error { return idx.storageLoop(idx.stopCh) })
}

func (idx *Indexer) StartSyncLoop() {
	idx.Lock()
	defer idx.Unlock()
	if !idx.started {
		idx.started = true
		idx.stopCh = make(chan struct{})
	}
	idx.eg.Go(func() error { return idx.SyncLoop(idx.stopCh) })
}

func (idx *Indexer) SetFlushDelay(dur time.Duration) {
	idx.flushDelay = dur
}

func (idx *Indexer) Start(ctx context.Context, uid gregor1.UID) {
	defer idx.Trace(ctx, func() error { return nil }, "Start")()
	idx.Lock()
	defer idx.Unlock()
	if idx.started {
		return
	}
	idx.uid = uid
	idx.store = newStore(idx.G(), uid)
	idx.started = true
	idx.stopCh = make(chan struct{})
	if !idx.G().IsMobileAppType() && !idx.G().GetEnv().GetDisableSearchIndexer() {
		idx.eg.Go(func() error { return idx.SyncLoop(idx.stopCh) })
	}
	idx.eg.Go(func() error { return idx.flushLoop(idx.stopCh) })
	idx.eg.Go(func() error { return idx.storageLoop(idx.stopCh) })
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

func (idx *Indexer) SyncLoop(stopCh chan struct{}) error {
	ctx := globals.ChatCtx(context.Background(), idx.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	idx.Lock()
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
			if err := idx.SelectiveSync(ctx); err != nil {
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

	stopSync := func(ctx context.Context) {
		idx.Debug(ctx, "stopping SelectiveSync bg loop")
		cancelSync()
		ticker.Stop()
	}
	defer func() {
		idx.Debug(ctx, "shutting down SyncLoop")
	}()
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
			case <-idx.stopCh:
				stopSync(ctx)
				return nil
			}
		case <-stopCh:
			stopSync(ctx)
			return nil
		}
	}
}

func (idx *Indexer) Stop(ctx context.Context) chan struct{} {
	defer idx.Trace(ctx, func() error { return nil }, "Stop")()
	idx.Lock()
	defer idx.Unlock()
	ch := make(chan struct{})
	if idx.started {
		idx.store.ClearMemory()
		idx.started = false
		close(idx.stopCh)
		go func() {
			idx.Debug(context.Background(), "Stop: waiting for shutdown")
			_ = idx.eg.Wait()
			idx.Debug(context.Background(), "Stop: shutdown complete")
			close(ch)
		}()
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

func (idx *Indexer) storageDispatch(op interface{}) {
	select {
	case idx.storageCh <- op:
	default:
		idx.Debug(context.Background(), "storageDispatch: failed to dispatch storage operation")
	}
}

func (idx *Indexer) storageLoop(stopCh chan struct{}) error {
	ctx := context.Background()
	idx.Debug(ctx, "storageLoop: starting")
	for {
		select {
		case <-stopCh:
			idx.Debug(ctx, "storageLoop: shutting down")
			return nil
		case iop := <-idx.storageCh:
			switch op := iop.(type) {
			case storageAdd:
				err := idx.store.Add(op.ctx, op.convID, op.msgs)
				if err != nil {
					idx.Debug(op.ctx, "storageLoop: add failed: %s", err)
				}
				idx.consumeResultsForTest(op.convID, err)
				close(op.cb)
			case storageRemove:
				err := idx.store.Remove(op.ctx, op.convID, op.msgs)
				if err != nil {
					idx.Debug(op.ctx, "storageLoop: remove failed: %s", err)
				}
				idx.consumeResultsForTest(op.convID, err)
				close(op.cb)
			}
		}
	}
}

func (idx *Indexer) flushLoop(stopCh chan struct{}) error {
	ctx := context.Background()
	idx.Debug(ctx, "flushLoop: starting")
	for {
		select {
		case <-stopCh:
			idx.Debug(ctx, "flushLoop: shutting down")
			return nil
		case <-idx.clock.After(idx.flushDelay):
			if err := idx.store.Flush(); err != nil {
				idx.Debug(ctx, "flushLoop: failed to flush: %s", err)
			}
		}
	}
}

func (idx *Indexer) hasPriority(ctx context.Context, convID chat1.ConversationID) bool {
	conv, err := utils.GetUnverifiedConv(ctx, idx.G(), idx.uid, convID, types.InboxSourceDataSourceLocalOnly)
	if err != nil {
		idx.Debug(ctx, "unable to fetch GetUnverifiedConv, continuing: %v", err)
		return true
	} else if score := utils.GetConvPriorityScore(conv); score < minPriorityScore {
		idx.Debug(ctx, "%s does not meet minPriorityScore (%.2f < %d), aborting.",
			utils.GetRemoteConvDisplayName(conv), score, minPriorityScore)
		return false
	}
	return true
}

func (idx *Indexer) Add(ctx context.Context, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed) (err error) {
	idx.Lock()
	if !idx.started {
		idx.Unlock()
		return nil
	}
	idx.Unlock()
	_, err = idx.add(ctx, convID, msgs, false)
	return err
}

func (idx *Indexer) add(ctx context.Context, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed, force bool) (cb chan struct{}, err error) {
	cb = make(chan struct{})
	if idx.G().GetEnv().GetDisableSearchIndexer() {
		close(cb)
		return cb, nil
	}
	if !idx.validBatch(msgs) {
		close(cb)
		return cb, nil
	}
	if !(force || idx.hasPriority(ctx, convID)) {
		close(cb)
		return cb, nil
	}

	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.Add conv: %v, msgs: %d, force: %v",
			convID, len(msgs), force))()
	idx.storageDispatch(storageAdd{
		ctx:    globals.BackgroundChatCtx(ctx, idx.G()),
		convID: convID,
		msgs:   msgs,
		cb:     cb,
	})
	return cb, nil
}

func (idx *Indexer) Remove(ctx context.Context, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed) (err error) {
	idx.Lock()
	if !idx.started {
		idx.Unlock()
		return nil
	}
	idx.Unlock()
	_, err = idx.remove(ctx, convID, msgs, false)
	return err
}

func (idx *Indexer) remove(ctx context.Context, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed, force bool) (cb chan struct{}, err error) {
	cb = make(chan struct{})
	if idx.G().GetEnv().GetDisableSearchIndexer() {
		close(cb)
		return cb, nil
	}
	if !idx.validBatch(msgs) {
		close(cb)
		return cb, nil
	}
	if !(force || idx.hasPriority(ctx, convID)) {
		close(cb)
		return cb, nil
	}

	defer idx.Trace(ctx, func() error { return err },
		fmt.Sprintf("Indexer.Remove conv: %v, msgs: %d, force: %v",
			convID, len(msgs), force))()
	idx.storageDispatch(storageRemove{
		ctx:    globals.BackgroundChatCtx(ctx, idx.G()),
		convID: convID,
		msgs:   msgs,
		cb:     cb,
	})
	return cb, nil
}

// reindexConv attempts to fill in any missing messages from the index.  For a
// small number of messages we use the GetMessages api to fill in the holes. If
// our index is missing many messages, we page through and add batches of
// missing messages.
func (idx *Indexer) reindexConv(ctx context.Context, rconv types.RemoteConversation,
	numJobs int, inboxIndexStatus *inboxIndexStatus) (completedJobs int, err error) {
	conv := rconv.Conv
	convID := conv.GetConvID()
	md, err := idx.store.GetMetadata(ctx, convID)
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
			utils.GetRemoteConvDisplayName(rconv), minIdxID, maxIdxID, len(missingIDs)))()

	reason := chat1.GetThreadReason_INDEXED_SEARCH
	if len(missingIDs) < idx.pageSize {
		msgs, err := idx.G().ConvSource.GetMessages(ctx, conv, idx.uid, missingIDs, &reason)
		if err != nil {
			if utils.IsPermanentErr(err) {
				return 0, err
			}
			return 0, nil
		}
		cb, err := idx.add(ctx, convID, msgs, true)
		if err != nil {
			return 0, err
		}
		<-cb
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
			tv, err := idx.G().ConvSource.Pull(ctx, convID, idx.uid, reason, query, pagination)
			if err != nil {
				if utils.IsPermanentErr(err) {
					return 0, err
				}
				continue
			}
			cb, err := idx.add(ctx, convID, tv.Messages, true)
			if err != nil {
				return 0, err
			}
			<-cb
			completedJobs++
			if numJobs > 0 && completedJobs >= numJobs {
				break
			}
			if inboxIndexStatus != nil {
				md, err := idx.store.GetMetadata(ctx, conv.GetConvID())
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
						utils.GetRemoteConvDisplayName(rconv), md.PercentIndexed(conv), percentIndexed)
				}
			}
		}
	}
	if idx.reindexCh != nil {
		idx.reindexCh <- convID
	}
	return completedJobs, nil
}

func (idx *Indexer) SearchableConvs(ctx context.Context, convID *chat1.ConversationID) (res []types.RemoteConversation, err error) {
	convMap, err := idx.allConvs(ctx, convID)
	if err != nil {
		return res, err
	}
	return idx.convsPrioritySorted(ctx, convMap), nil
}

func (idx *Indexer) allConvs(ctx context.Context, convID *chat1.ConversationID) (map[chat1.ConvIDStr]types.RemoteConversation, error) {
	// Find all conversations in our inbox
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
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	inbox, err := idx.G().InboxSource.ReadUnverified(ctx, idx.uid, types.InboxSourceDataSourceAll,
		inboxQuery)
	if err != nil {
		return nil, err
	}

	// convID -> remoteConv
	convMap := make(map[chat1.ConvIDStr]types.RemoteConversation, len(inbox.ConvsUnverified))
	for _, conv := range inbox.ConvsUnverified {
		if conv.Conv.GetFinalizeInfo() != nil {
			continue
		}
		// Don't index any conversation if we are a RESTRICTEDBOT member,
		// we won't have full access to the messages. We use
		// UntrustedTeamRole here since the server could just deny serving
		// us instead of lying about the role.
		if conv.Conv.ReaderInfo != nil && conv.Conv.ReaderInfo.UntrustedTeamRole == keybase1.TeamRole_RESTRICTEDBOT {
			continue
		}
		convMap[conv.ConvIDStr] = conv
	}
	return convMap, nil
}

func (idx *Indexer) convsPrioritySorted(ctx context.Context,
	convMap map[chat1.ConvIDStr]types.RemoteConversation) (res []types.RemoteConversation) {
	res = make([]types.RemoteConversation, len(convMap))
	index := 0
	for _, conv := range convMap {
		res[index] = conv
		index++
	}
	sort.Slice(res, func(i, j int) bool {
		return utils.GetConvPriorityScore(convMap[res[i].ConvIDStr]) >= utils.GetConvPriorityScore(convMap[res[j].ConvIDStr])
	})
	return res
}

// Search tokenizes the given query and finds the intersection of all matches
// for each token, returning matches.
func (idx *Indexer) Search(ctx context.Context, query, origQuery string,
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
	sess := newSearchSession(query, origQuery, idx.uid, hitUICh, indexUICh, idx, opts)
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
func (idx *Indexer) SelectiveSync(ctx context.Context) (err error) {
	defer idx.Trace(ctx, func() error { return err }, "SelectiveSync")()
	idx.setSelectiveSyncActive(true)
	defer func() { idx.setSelectiveSyncActive(false) }()

	convMap, err := idx.allConvs(ctx, nil)
	if err != nil {
		return err
	}

	// make sure the most recently read convs are fully indexed
	convs := idx.convsPrioritySorted(ctx, convMap)
	// number of batches of messages to fetch in total
	numJobs := idx.maxSyncConvs
	for _, conv := range convs {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		convID := conv.GetConvID()
		md, err := idx.store.GetMetadata(ctx, convID)
		if err != nil {
			idx.Debug(ctx, "SelectiveSync: Unable to get md for conv: %v, %v", convID, err)
			continue
		}
		if md.FullyIndexed(conv.Conv) {
			continue
		}

		completedJobs, err := idx.reindexConv(ctx, conv, numJobs, nil)
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
func (idx *Indexer) IndexInbox(ctx context.Context) (res map[chat1.ConvIDStr]chat1.ProfileSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.IndexInbox")()

	convMap, err := idx.allConvs(ctx, nil)
	if err != nil {
		return nil, err
	}
	// convID -> stats
	res = map[chat1.ConvIDStr]chat1.ProfileSearchConvStats{}
	for convIDStr, conv := range convMap {
		idx.G().Log.CDebugf(ctx, "Indexing conv: %v", utils.GetRemoteConvDisplayName(conv))
		convStats, err := idx.indexConvWithProfile(ctx, conv)
		if err != nil {
			idx.G().Log.CDebugf(ctx, "Indexing errored for conv: %v, %v",
				utils.GetRemoteConvDisplayName(conv), err)
		} else {
			idx.G().Log.CDebugf(ctx, "Indexing completed for conv: %v, stats: %+v",
				utils.GetRemoteConvDisplayName(conv), convStats)
		}
		res[convIDStr] = convStats
	}
	return res, nil
}

func (idx *Indexer) indexConvWithProfile(ctx context.Context, conv types.RemoteConversation) (res chat1.ProfileSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.indexConvWithProfile")()
	md, err := idx.store.GetMetadata(ctx, conv.GetConvID())
	if err != nil {
		return res, err
	}
	defer func() {
		res.ConvName = utils.GetRemoteConvDisplayName(conv)
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
	_, err = idx.reindexConv(ctx, conv, 0, nil)
	if err != nil {
		return res, err
	}
	res.DurationMsec = gregor1.ToDurationMsec(time.Since(startT))
	dbKey := metadataKey(idx.uid, conv.GetConvID())
	b, _, err := idx.G().LocalChatDb.GetRaw(dbKey)
	if err != nil {
		return res, err
	}
	res.IndexSizeDisk = len(b)
	res.IndexSizeMem = md.Size()
	return res, nil
}

func (idx *Indexer) FullyIndexed(ctx context.Context, convID chat1.ConversationID) (res bool, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.FullyIndexed")()
	conv, err := utils.GetUnverifiedConv(ctx, idx.G(), idx.uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return false, err
	}
	md, err := idx.store.GetMetadata(ctx, convID)
	if err != nil {
		return false, err
	}
	return md.FullyIndexed(conv.Conv), nil
}

func (idx *Indexer) PercentIndexed(ctx context.Context, convID chat1.ConversationID) (res int, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.PercentIndexed")()
	conv, err := utils.GetUnverifiedConv(ctx, idx.G(), idx.uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return 0, err
	}
	md, err := idx.store.GetMetadata(ctx, convID)
	if err != nil {
		return 0, err
	}
	return md.PercentIndexed(conv.Conv), nil
}

func (idx *Indexer) OnDbNuke(mctx libkb.MetaContext) (err error) {
	defer idx.Trace(mctx.Ctx(), func() error { return err }, "Indexer.OnDbNuke")()
	idx.Lock()
	defer idx.Unlock()
	if !idx.started {
		return nil
	}
	idx.store.ClearMemory()
	return nil
}

func (idx *Indexer) GetStoreHits(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	query string) (res map[chat1.MessageID]chat1.EmptyStruct, err error) {
	return idx.store.GetHits(ctx, convID, query)
}
