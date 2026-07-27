package search

import (
	"context"
	"errors"
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

// storageOp is what every queued storage operation has in common: a waiter that
// must be released whether or not the op ever runs.
type storageOp interface {
	callback() chan error
}

type storageAdd struct {
	ctx    context.Context
	convID chat1.ConversationID
	msgs   []chat1.MessageUnboxed
	cb     chan error
}

func (o storageAdd) callback() chan error { return o.cb }

type storageRemove struct {
	ctx    context.Context
	convID chat1.ConversationID
	msgs   []chat1.MessageUnboxed
	cb     chan error
}

func (o storageRemove) callback() chan error { return o.cb }

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
	storageCh    chan storageOp

	maxSyncConvs          int
	startSyncDelay        time.Duration
	syncInterval          time.Duration
	selectiveSyncActiveMu sync.Mutex
	selectiveSyncActive   bool
	flushDelay            time.Duration

	// convID -> how a conv's last reindex attempt went. A conv whose missing
	// count did not move is backed off rather than retried every interval.
	// See convStalled and recordIndexProgress for the backoff schedule.
	stalledMu    sync.Mutex
	stalledConvs map[chat1.ConvIDStr]stalledConv

	// for testing
	consumeCh                            chan chat1.ConversationID
	reindexCh                            chan chat1.ConversationID
	syncLoopCh, cancelSyncCh, pokeSyncCh chan struct{}
}

var _ types.Indexer = (*Indexer)(nil)

func NewIndexer(g *globals.Context) *Indexer {
	idx := &Indexer{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "Search.Indexer", false),
		pageSize:     defaultPageSize,
		suspendCh:    make(chan chan struct{}, 10),
		resumeWait:   time.Second,
		cancelSyncCh: make(chan struct{}, 100),
		pokeSyncCh:   make(chan struct{}, 100),
		clock:        clockwork.NewRealClock(),
		flushDelay:   15 * time.Second,
		storageCh:    make(chan storageOp, 100),
		stalledConvs: make(map[chat1.ConvIDStr]stalledConv),
	}
	switch idx.G().GetAppType() {
	case libkb.MobileAppType:
		idx.SetMaxSyncConvs(maxSyncConvsMobile)
		idx.startSyncDelay = startSyncDelayMobile
		idx.syncInterval = syncIntervalMobile
	default:
		idx.startSyncDelay = startSyncDelayDesktop
		idx.SetMaxSyncConvs(maxSyncConvsDesktop)
		idx.syncInterval = syncIntervalDesktop
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
	defer idx.Trace(ctx, nil, "Start")()
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
	idx.Debug(ctx, "starting SelectiveSync bg loop with interval: %v", idx.syncInterval)

	ticker := libkb.NewBgTicker(idx.syncInterval)
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
			idx.Debug(ctx, "SelectiveSync already running, skipping new sync attempt")
			return
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
				time.Sleep(libkb.RandomJitter(idx.resumeWait))
			case <-stopCh:
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
	defer idx.Trace(ctx, nil, "Stop")()
	idx.Lock()
	defer idx.Unlock()
	ch := make(chan struct{})
	if idx.started {
		// stall counts describe one indexer run, so drop them with it: a count
		// carried into the next Start would clamp a conv on evidence gathered
		// before the restart
		idx.stalledMu.Lock()
		idx.stalledConvs = make(map[chat1.ConvIDStr]stalledConv)
		idx.stalledMu.Unlock()
		idx.started = false
		close(idx.stopCh)
		go func() {
			idx.Debug(context.Background(), "Stop: waiting for shutdown")
			_ = idx.eg.Wait()
			// Write out what is pending before dropping it. ClearMemory discards
			// the overlay and the flush loop has stopped, so anything not written
			// here is simply lost - work that has to be done again at best, and
			// at worst tokens whose metadata already reached disk.
			//
			// This waits for the loops rather than running inline in Stop:
			// storageLoop keeps writing into the overlay until stopCh closes, so
			// a flush taken before that misses whatever lands in between and
			// ClearMemory then drops it. It also keeps a flush of up to
			// maxDirtyEntries individually-encrypted writes off idx.Lock, which
			// every Add, Remove, Suspend and Clear has to take.
			//
			// On the logout path this flush fails: logout clears the device
			// encryption key before it runs the logout hooks that reach us, and
			// the store encrypts per write. Tokens and metadata share the
			// overlay and are dropped together, so disk stays consistent and the
			// work is redone after the next login -- but the write-out only
			// really happens at process shutdown.
			ctx := context.Background()
			if err := idx.store.Flush(); err != nil {
				idx.Debug(ctx, "Stop: final flush failed: %s", err)
			}
			idx.store.ClearMemory()
			idx.Debug(ctx, "Stop: shutdown complete")
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (idx *Indexer) Suspend(ctx context.Context) bool {
	defer idx.Trace(ctx, nil, "Suspend")()
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
	defer idx.Trace(ctx, nil, "Resume")()
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

// storageDispatch queues op, reporting whether it was accepted. A caller that
// waits on the op's callback must close it itself when this returns false:
// nothing else will, and the waiter - reindexConv does an unconditional receive
// - would park forever. In SelectiveSync that parks the sync holding its cancel
// func, so every later attempt sees "already running" and background indexing is
// finished for the life of the process.
// It also refuses to queue once the indexer is stopping. Nothing is left to run
// the op then, and the drain that would have released its callback may already
// have walked the queue.
func (idx *Indexer) storageDispatch(op storageOp) bool {
	// The queue check has to happen under the same lock hold as the started
	// check, and Stop clears started and closes stopCh under that lock. Testing
	// started, releasing, then sending leaves a window where Stop runs in
	// between and the drain has already walked the queue, so the op is enqueued
	// with nobody left to release its callback. Selecting on stopCh instead of
	// holding the lock does not close it either: once stopCh is closed both
	// cases are ready and Go picks between them at random. The send is
	// non-blocking and storageLoop never takes idx.Lock, so holding it here
	// cannot deadlock.
	idx.Lock()
	defer idx.Unlock()
	if !idx.started {
		return false
	}
	select {
	case idx.storageCh <- op:
		return true
	default:
		idx.Debug(context.Background(), "storageDispatch: failed to dispatch storage operation")
		return false
	}
}

// releaseStorageCB wakes an op's waiter, reporting whether the op actually ran.
// The channel is buffered, so the send never blocks even with nobody waiting,
// and a waiter that receives from a closed channel reads nil - success.
func releaseStorageCB(cb chan error, err error) {
	if cb == nil {
		return
	}
	if err != nil {
		cb <- err
	}
	close(cb)
}

// drainStorageQueue releases every op still queued at shutdown. They will not
// run, so each callback reports errStorageStopped: a caller told an op finished
// marks its messages as indexed, and nothing put them there.
//
// Split out of storageLoop because that select has both cases ready once stopCh
// closes and Go picks between them at random, which is untestable from outside.
func (idx *Indexer) drainStorageQueue() {
	for {
		select {
		case op := <-idx.storageCh:
			releaseStorageCB(op.callback(), errStorageStopped)
		default:
			return
		}
	}
}

func (idx *Indexer) storageLoop(stopCh chan struct{}) error {
	ctx := context.Background()
	idx.Debug(ctx, "storageLoop: starting")
	for {
		select {
		case <-stopCh:
			idx.Debug(ctx, "storageLoop: shutting down")
			idx.drainStorageQueue()
			return nil
		case iop := <-idx.storageCh:
			switch op := iop.(type) {
			case storageAdd:
				err := idx.store.Add(op.ctx, op.convID, op.msgs)
				if err != nil {
					idx.Debug(op.ctx, "storageLoop: add failed: %s", err)
				}
				idx.consumeResultsForTest(op.convID, err)
				releaseStorageCB(op.cb, err)
			case storageRemove:
				err := idx.store.Remove(op.ctx, op.convID, op.msgs)
				if err != nil {
					idx.Debug(op.ctx, "storageLoop: remove failed: %s", err)
				}
				idx.consumeResultsForTest(op.convID, err)
				releaseStorageCB(op.cb, err)
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
		case <-idx.store.flushNeeded():
			// too much pending to wait out the interval
			if err := idx.store.Flush(); err != nil {
				idx.Debug(ctx, "flushLoop: failed to flush: %s", err)
			}
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
	msgs []chat1.MessageUnboxed,
) (err error) {
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
	msgs []chat1.MessageUnboxed, force bool,
) (cb chan error, err error) {
	cb = make(chan error, 1)
	if idx.G().GetEnv().GetDisableSearchIndexer() {
		close(cb)
		return cb, nil
	}
	if !idx.validBatch(msgs) {
		close(cb)
		return cb, nil
	}
	if !force && !idx.hasPriority(ctx, convID) {
		close(cb)
		return cb, nil
	}

	defer idx.Trace(ctx, &err,
		"Indexer.Add conv: %v, msgs: %d, force: %v",
		convID, len(msgs), force)()
	if !idx.storageDispatch(storageAdd{
		ctx:    globals.BackgroundChatCtx(ctx, idx.G()),
		convID: convID,
		msgs:   msgs,
		cb:     cb,
	}) {
		// nothing will run this op, so nothing will close cb
		close(cb)
		return cb, errStorageQueueFull
	}
	return cb, nil
}

func (idx *Indexer) Remove(ctx context.Context, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed,
) (err error) {
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
	msgs []chat1.MessageUnboxed, force bool,
) (cb chan error, err error) {
	cb = make(chan error, 1)
	if idx.G().GetEnv().GetDisableSearchIndexer() {
		close(cb)
		return cb, nil
	}
	if !idx.validBatch(msgs) {
		close(cb)
		return cb, nil
	}
	if !force && !utils.IsConvLoaderContext(ctx) && !idx.hasPriority(ctx, convID) {
		close(cb)
		return cb, nil
	}

	defer idx.Trace(ctx, &err,
		"Indexer.Remove conv: %v, msgs: %d, force: %v",
		convID, len(msgs), force)()
	if !idx.storageDispatch(storageRemove{
		ctx:    globals.BackgroundChatCtx(ctx, idx.G()),
		convID: convID,
		msgs:   msgs,
		cb:     cb,
	}) {
		// nothing will run this op, so nothing will close cb
		close(cb)
		return cb, errStorageQueueFull
	}
	return cb, nil
}

// reindexConv fills in the messages this conv is missing from the index. It
// chunks the missing ids pageSize at a time, fetches each chunk with GetMessages
// and indexes it, then marks the whole chunk seen so ids the source will never
// produce stop counting as missing. It stops early once numJobs chunks are done,
// so a large conv is filled in across several passes.
func (idx *Indexer) reindexConv(ctx context.Context, rconv types.RemoteConversation,
	numJobs int, inboxIndexStatus *inboxIndexStatus,
) (completedJobs int, err error) {
	if idx.G().GetEnv().GetDisableSearchIndexer() {
		// add() drops everything in this case, so paging on would MarkSeen ids
		// that were never indexed and leave them permanently unsearchable if the
		// indexer is turned back on.
		return 0, nil
	}
	conv := rconv.Conv
	convID := conv.GetConvID()
	missingIDs, err := idx.store.MissingIDForConv(ctx, conv)
	if err != nil {
		return 0, err
	}
	if len(missingIDs) == 0 {
		return 0, nil
	}
	minIdxID := missingIDs[0]
	maxIdxID := missingIDs[len(missingIDs)-1]

	defer idx.Trace(ctx, &err,
		"Indexer.reindex: conv: %v, minID: %v, maxID: %v, numMissing: %v",
		utils.GetRemoteConvDisplayName(rconv), minIdxID, maxIdxID, len(missingIDs))()

	reason := chat1.GetThreadReason_INDEXED_SEARCH
	// Page over the MISSING ids, not over the raw min..max range. The range
	// includes everything already indexed - tens of thousands of messages in a
	// large conv - and re-fetching those spends the inbox-wide budget before
	// reaching the missing ones. Each pass restarts at the lowest missing id, so
	// the top of a large conv is otherwise never reachable.
	for start := 0; start < len(missingIDs); start += idx.pageSize {
		select {
		case <-ctx.Done():
			return completedJobs, ctx.Err()
		default:
		}
		end := start + idx.pageSize
		if end > len(missingIDs) {
			end = len(missingIDs)
		}
		chunk := missingIDs[start:end]
		msgs, err := idx.G().ConvSource.GetMessages(ctx, convID, idx.uid, chunk, &reason, nil, false)
		if err != nil {
			if utils.IsPermanentErr(err) {
				return completedJobs, err
			}
			// transient: leave these ids missing so a later pass retries them
			continue
		}
		cb, err := idx.add(ctx, convID, msgs, true)
		if err != nil {
			return completedJobs, err
		}
		select {
		case addErr := <-cb:
			if addErr != nil {
				// The op failed or never ran, so nothing in this chunk was
				// indexed. Marking it seen here would record those messages as
				// indexed with no tokens behind them, and the conv would never
				// be revisited to fix it.
				return completedJobs, addErr
			}
		case <-ctx.Done():
			return completedJobs, ctx.Err()
		}
		// The fetch succeeded, so every id we asked for is now accounted for:
		// the ones that came back were indexed by add() -- or skipped by it as
		// unindexable, which is equally final -- and the ones that did not are
		// ids the source will never produce. Unmarked, the latter hold the conv
		// at "not fully indexed" permanently.
		if err := idx.store.MarkSeen(ctx, convID, chunk); err != nil {
			// The store is failing, not the conv. Give up on this conv rather
			// than paging on: without the mark these ids stay missing, so
			// counting the job would make a storage failure look like a stalled
			// conv and back it off for a reason that has nothing to do with it.
			return completedJobs, err
		}
		completedJobs++
		if numJobs > 0 && completedJobs >= numJobs {
			break
		}
		if inboxIndexStatus != nil {
			status, err := idx.store.IndexStatus(ctx, conv)
			if err != nil {
				idx.Debug(ctx, "updateInboxIndex: unable to get index status %v", err)
				continue
			}
			inboxIndexStatus.addConv(status, conv)
			percentIndexed, err := inboxIndexStatus.updateUI(ctx)
			if err != nil {
				idx.Debug(ctx, "unable to update ui %v", err)
			} else {
				idx.Debug(ctx, "%v is %d%% indexed, inbox is %d%% indexed",
					utils.GetRemoteConvDisplayName(rconv), status.percentIndexed(), percentIndexed)
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
	convMap map[chat1.ConvIDStr]types.RemoteConversation,
) (res []types.RemoteConversation) {
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
	opts chat1.SearchOpts, hitUICh chan chat1.ChatSearchInboxHit, indexUICh chan chat1.ChatSearchIndexStatus,
) (res *chat1.ChatSearchInboxResults, err error) {
	defer idx.Trace(ctx, &err, "Indexer.Search")()
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

// errStorageQueueFull reports that a storage op was never queued. Callers that
// mark work as done once the op completes must not do so on this error: the op
// did not run, so nothing was indexed.
var errStorageQueueFull = errors.New("search storage queue full, operation dropped")

// errStorageStopped reports that a queued op was released by shutdown rather
// than run. Same contract as errStorageQueueFull: the op did not run.
var errStorageStopped = errors.New("search storage loop stopped, operation dropped")

const maxStallSkips = 12

// the largest exponent used for the backoff; see recordIndexProgress
const maxStallStreak = 4

type stalledConv struct {
	numMissing uint
	// intervals still to skip before the next attempt
	skips int
	// consecutive no-progress attempts, doubling the backoff each time
	streak uint
}

// convStalled reports whether to skip this conv on this pass, and consumes one
// of its backoff intervals if so.
//
// The backoff is deliberately bounded rather than permanent. "numMissing did not
// move" is strong evidence that the missing IDs cannot be fetched, but it is not
// proof: reindexConv restarts at the lowest missing ID and stops once it has
// spent the pass budget, so a conv whose budgeted pages happened to cover only
// unfetchable IDs looks identical to a stuck one while still having real work
// further up its range. Backing off instead of suppressing means that conv
// resumes on its own, and a genuinely stuck one still costs ~1/12th of what it
// did.
func (idx *Indexer) convStalled(convID chat1.ConversationID, numMissing uint) bool {
	idx.stalledMu.Lock()
	defer idx.stalledMu.Unlock()
	convIDStr := convID.ConvIDStr()
	prev, ok := idx.stalledConvs[convIDStr]
	if !ok || prev.numMissing != numMissing {
		// never seen, or something changed the conv since: give it an attempt
		return false
	}
	if prev.skips <= 0 {
		return false
	}
	prev.skips--
	idx.stalledConvs[convIDStr] = prev
	return true
}

// recordIndexProgress stores the missing count after an attempt, so the next
// pass can tell whether that attempt accomplished anything. A conv that has
// reached 0 needs no entry: its caller skips a fully indexed conv anyway.
func (idx *Indexer) recordIndexProgress(ctx context.Context, conv chat1.Conversation, before uint) {
	status, err := idx.store.IndexStatus(ctx, conv)
	if err != nil {
		idx.Debug(ctx, "recordIndexProgress: unable to get index status: %v", err)
		return
	}
	convIDStr := conv.GetConvID().ConvIDStr()
	idx.stalledMu.Lock()
	defer idx.stalledMu.Unlock()
	if status.fullyIndexed() || status.numMissing != before {
		// done, or made progress: clear any marker so it keeps getting attempts
		delete(idx.stalledConvs, convIDStr)
		return
	}
	// Clamp the EXPONENT, not the result. Nothing else bounds how many times a
	// conv fails to converge, and a large enough shift overflows int negative
	// (then to 0), which reads as "no skips" and silently turns the backoff off
	// for good.
	streak := idx.stalledConvs[convIDStr].streak + 1
	if streak > maxStallStreak {
		streak = maxStallStreak
	}
	skips := 1 << streak
	if skips > maxStallSkips {
		skips = maxStallSkips
	}
	idx.stalledConvs[convIDStr] = stalledConv{
		numMissing: status.numMissing,
		skips:      skips,
		streak:     streak,
	}
}

// SelectiveSync queues up a small number of jobs on the background loader
// periodically so our index can cover all conversations. The number of jobs
// varies between desktop and mobile so mobile can be more conservative.
// A stalled conv is retried after 2, then 4, then 8, then every 12 skipped
// intervals - so on desktop it settles to one attempt per 13 passes, a bit over
// an hour, reached after ~90 minutes. Even a permanently stuck conv is retried
// occasionally: nothing is suppressed forever on the strength of an inference.
//
// reindexConv marks fetched-but-unreturned ids as seen, so a conv converges on
// its own and should never reach the backoff at all. It is the backstop for
// whatever still cannot converge, not the mechanism.
func (idx *Indexer) SelectiveSync(ctx context.Context) (err error) {
	defer idx.Trace(ctx, &err, "SelectiveSync")()
	defer idx.PerfTrace(ctx, &err, "SelectiveSync")()
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
		// one status read, not one per question: each is an O(maxID-minID) scan
		// of SeenIDs under the store lock
		status, err := idx.store.IndexStatus(ctx, conv.Conv)
		if err != nil {
			idx.Debug(ctx, "SelectiveSync: Unable to get md for conv: %v, %v", convID, err)
			continue
		}
		if status.fullyIndexed() {
			continue
		}

		// A conv is "fully indexed" only when numMissing hits 0, and numMissing
		// counts every ID in the min..max range. IDs the server will never
		// return - deleted, or never delivered to us - therefore stay missing
		// forever, so such a conv is never fully indexed and SelectiveSync
		// re-queues it every syncInterval. Each pass re-fetches thousands of
		// already-indexed messages, marks nothing new, and burns the whole
		// maxSyncConvs budget - on the order of a thousand remote getMessages
		// every syncInterval, indefinitely, on an idle client.
		//
		// So skip a conv whose missing count did not move on its last attempt.
		// Anything that actually changes the conv - a new message, a delete,
		// clearing the index - changes the count and lets it back in, so this
		// only suppresses the provably unproductive case.
		if idx.convStalled(convID, status.numMissing) {
			continue
		}

		completedJobs, err := idx.reindexConv(ctx, conv, numJobs, nil)
		if err != nil {
			idx.Debug(ctx, "Unable to reindex conv: %v, %v", convID, err)
			// the pages it did finish still spent budget
			numJobs -= completedJobs
			if numJobs <= 0 {
				break
			}
			continue
		}
		if completedJobs == 0 {
			// also the transient-fetch-failure path in reindexConv, which is
			// indistinguishable from no progress here. Don't record a stall for
			// it: a network blip would suppress the conv until it next changes.
			continue
		}
		idx.recordIndexProgress(ctx, conv.Conv, status.numMissing)
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
	defer idx.Trace(ctx, &err, "Indexer.IndexInbox")()

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
	defer idx.Trace(ctx, &err, "Indexer.indexConvWithProfile")()
	defer func() {
		res.ConvName = utils.GetRemoteConvDisplayName(conv)
		// Re-read stats so the report reflects any reindexing performed above.
		if stats, statsErr := idx.store.ConvIndexStats(ctx, conv.Conv); statsErr == nil {
			minID, maxID := MinMaxIDs(conv.Conv)
			res.MinConvID = minID
			res.MaxConvID = maxID
			res.NumMissing = stats.numMissing
			res.NumMessages = stats.numMessages
			res.PercentIndexed = stats.percent
			res.IndexSizeMem = stats.sizeMem
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
	return res, nil
}

func (idx *Indexer) FullyIndexed(ctx context.Context, convID chat1.ConversationID) (res bool, err error) {
	defer idx.Trace(ctx, &err, "Indexer.FullyIndexed")()
	conv, err := utils.GetUnverifiedConv(ctx, idx.G(), idx.uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return false, err
	}
	return idx.store.FullyIndexed(ctx, conv.Conv)
}

func (idx *Indexer) PercentIndexed(ctx context.Context, convID chat1.ConversationID) (res int, err error) {
	defer idx.Trace(ctx, &err, "Indexer.PercentIndexed")()
	conv, err := utils.GetUnverifiedConv(ctx, idx.G(), idx.uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return 0, err
	}
	return idx.store.PercentIndexed(ctx, conv.Conv)
}

func (idx *Indexer) Clear(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (err error) {
	defer idx.Trace(ctx, &err, "Indexer.Clear uid: %v convID: %v", uid, convID)()
	idx.Lock()
	store := idx.store
	idx.Unlock()
	if store == nil {
		return nil
	}
	// clearing the index resets what is missing, so this conv gets fresh
	// attempts rather than staying suppressed at its old count
	idx.stalledMu.Lock()
	delete(idx.stalledConvs, convID.ConvIDStr())
	idx.stalledMu.Unlock()
	return store.Clear(ctx, uid, convID)
}

func (idx *Indexer) OnDbNuke(mctx libkb.MetaContext) (err error) {
	defer idx.Trace(mctx.Ctx(), &err, "Indexer.OnDbNuke")()
	idx.Lock()
	defer idx.Unlock()
	if !idx.started {
		return nil
	}
	idx.stalledMu.Lock()
	idx.stalledConvs = make(map[chat1.ConvIDStr]stalledConv)
	idx.stalledMu.Unlock()
	idx.store.ClearMemory()
	return nil
}

func (idx *Indexer) GetStoreHits(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	query string,
) (res map[chat1.MessageID]chat1.EmptyStruct, err error) {
	return idx.store.GetHits(ctx, convID, query)
}
