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
	// the loops of the current run. Replaced by each Start rather than reused:
	// Stop waits on it from a goroutine, and a Group cannot be added to while
	// somebody is waiting on it.
	eg         *errgroup.Group
	stoppingCh chan struct{}
	uid        gregor1.UID
	storageCh  chan storageOp

	maxSyncConvs          int
	startSyncDelay        time.Duration
	syncInterval          time.Duration
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
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "Search.Indexer", false),
		pageSize:     defaultPageSize,
		suspendCh:    make(chan chan struct{}, 10),
		resumeWait:   time.Second,
		cancelSyncCh: make(chan struct{}, 100),
		pokeSyncCh:   make(chan struct{}, 100),
		clock:        clockwork.NewRealClock(),
		flushDelay:   15 * time.Second,
		storageCh:    make(chan storageOp, 100),
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

// startLoopLocked runs f as part of the current run, opening one if there isn't
// one yet. Callers hold idx.Lock.
func (idx *Indexer) startLoopLocked(f func(stopCh chan struct{}) error) {
	idx.waitForStopLocked()
	if !idx.started {
		idx.started = true
		idx.newRunLocked()
	}
	stopCh, eg := idx.stopCh, idx.eg
	eg.Go(func() error { return f(stopCh) })
}

// waitForStopLocked keeps successive runs disjoint while Stop finishes its
// asynchronous final flush. It returns with idx.Lock held.
func (idx *Indexer) waitForStopLocked() {
	for idx.stoppingCh != nil {
		stoppingCh := idx.stoppingCh
		idx.Unlock()
		<-stoppingCh
		idx.Lock()
	}
}

// newRunLocked gives this run its own stop channel and errgroup, so nothing a
// previous run is still shutting down can be confused for part of this one.
// Callers hold idx.Lock.
func (idx *Indexer) newRunLocked() {
	idx.stopCh = make(chan struct{})
	idx.eg = new(errgroup.Group)
}

func (idx *Indexer) StartFlushLoop() {
	idx.Lock()
	defer idx.Unlock()
	idx.startLoopLocked(idx.flushLoop)
}

func (idx *Indexer) StartStorageLoop() {
	idx.Lock()
	defer idx.Unlock()
	idx.startLoopLocked(idx.storageLoop)
}

func (idx *Indexer) StartSyncLoop() {
	idx.Lock()
	defer idx.Unlock()
	idx.startLoopLocked(idx.SyncLoop)
}

func (idx *Indexer) SetFlushDelay(dur time.Duration) {
	idx.flushDelay = dur
}

func (idx *Indexer) Start(ctx context.Context, uid gregor1.UID) {
	defer idx.Trace(ctx, nil, "Start")()
	idx.Lock()
	// Stop performs its final flush asynchronously. Do not install a new store
	// while the old loops can still read idx.store or drain the shared storage
	// queue. Waiting here keeps runs disjoint without duplicating every loop and
	// dispatch API around a per-run object.
	idx.waitForStopLocked()
	defer idx.Unlock()
	if idx.started {
		return
	}
	idx.uid = uid
	idx.store = newStore(idx.G(), uid)
	idx.started = true
	idx.newRunLocked()
	if !idx.G().IsMobileAppType() && !idx.G().GetEnv().GetDisableSearchIndexer() {
		idx.startLoopLocked(idx.SyncLoop)
	}
	idx.startLoopLocked(idx.flushLoop)
	idx.startLoopLocked(idx.storageLoop)
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
	// Subscribe once per state transition; NextUpdate leaks channels into
	// MobileAppState/MobileNetState.updateChs when called each iteration and
	// the state never changes (e.g. on headless servers).
	appStateCh := idx.G().MobileAppState.NextUpdate(&appState)
	netStateCh := idx.G().MobileNetState.NextUpdate(&netState)
	var cancelFn context.CancelFunc
	var l sync.Mutex
	var syncAttemptWG sync.WaitGroup
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
		syncAttemptWG.Add(1)
		go func() {
			defer syncAttemptWG.Done()
			idx.Debug(ctx, "running SelectiveSync")
			if err := idx.SelectiveSync(ctx); err != nil {
				idx.Debug(ctx, "unable to complete SelectiveSync: %v", err)
				if idx.syncLoopCh != nil {
					select {
					case idx.syncLoopCh <- struct{}{}:
					default:
					}
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
		// Stop must not finish while an old attempt can still read idx.store or
		// dispatch into the next run.
		syncAttemptWG.Wait()
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
		case appState = <-appStateCh:
			appStateCh = idx.G().MobileAppState.NextUpdate(&appState)
			switch appState {
			case keybase1.MobileAppState_FOREGROUND:
			// if we enter any state besides foreground cancel any running syncs
			default:
				cancelSync()
			}
		case netState = <-netStateCh:
			netStateCh = idx.G().MobileNetState.NextUpdate(&netState)
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
		idx.started = false
		close(idx.stopCh)
		idx.stoppingCh = ch
		// Keep the shutdown goroutine self-contained. Start waits on stoppingCh,
		// so these remain the old run's store and loops.
		store, eg := idx.store, idx.eg
		go func() {
			idx.Debug(context.Background(), "Stop: waiting for shutdown")
			if eg != nil {
				// nil when nothing ever started a loop, which only a test does
				_ = eg.Wait()
			}
			store.ClearMemory()
			idx.Debug(context.Background(), "Stop: shutdown complete")
			idx.Lock()
			if idx.stoppingCh == ch {
				idx.stoppingCh = nil
			}
			close(ch)
			idx.Unlock()
		}()
	} else if idx.stoppingCh != nil {
		return idx.stoppingCh
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

// storageDispatch queues op, reporting why it was rejected when it cannot.
// The caller completes the op's callback with that error so every op has exactly
// one result and no waiter can be stranded.
// It also refuses to queue once the indexer is stopping. Nothing is left to run
// the op then, and the drain that would have released its callback may already
// have walked the queue.
func (idx *Indexer) storageDispatch(op storageOp) error {
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
		return errStorageStopped
	}
	select {
	case idx.storageCh <- op:
		return nil
	default:
		idx.Debug(context.Background(), "storageDispatch: failed to dispatch storage operation")
		return errStorageQueueFull
	}
}

// releaseStorageCB wakes an op's waiter, reporting whether the op actually ran.
// The channel is buffered, so the one result never blocks even with nobody
// waiting. Every accepted or rejected op completes exactly once.
func releaseStorageCB(cb chan error, err error) {
	if cb == nil {
		return
	}
	cb <- err
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
		releaseStorageCB(cb, nil)
		return cb, nil
	}
	if !idx.validBatch(msgs) {
		releaseStorageCB(cb, nil)
		return cb, nil
	}
	if !force && !idx.hasPriority(ctx, convID) {
		releaseStorageCB(cb, nil)
		return cb, nil
	}

	defer idx.Trace(ctx, &err,
		"Indexer.Add conv: %v, msgs: %d, force: %v",
		convID, len(msgs), force)()
	if err := idx.storageDispatch(storageAdd{
		ctx:    globals.BackgroundChatCtx(ctx, idx.G()),
		convID: convID,
		msgs:   msgs,
		cb:     cb,
	}); err != nil {
		releaseStorageCB(cb, err)
		return cb, err
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
		releaseStorageCB(cb, nil)
		return cb, nil
	}
	if !idx.validBatch(msgs) {
		releaseStorageCB(cb, nil)
		return cb, nil
	}
	if !force && !utils.IsConvLoaderContext(ctx) && !idx.hasPriority(ctx, convID) {
		releaseStorageCB(cb, nil)
		return cb, nil
	}

	defer idx.Trace(ctx, &err,
		"Indexer.Remove conv: %v, msgs: %d, force: %v",
		convID, len(msgs), force)()
	if err := idx.storageDispatch(storageRemove{
		ctx:    globals.BackgroundChatCtx(ctx, idx.G()),
		convID: convID,
		msgs:   msgs,
		cb:     cb,
	}); err != nil {
		releaseStorageCB(cb, err)
		return cb, err
	}
	return cb, nil
}

// maxConsecutiveFetchFailures is how many transient fetch failures in a row
// reindexConv tolerates before it abandons the conv for this pass. Two rather
// than one so a single bad chunk does not stop a conv that is otherwise fine.
const maxConsecutiveFetchFailures = 2

type reindexResult struct {
	completed int
	attempted int
}

// reindexConv fills in missing messages. Chunks missing IDs by pageSize, fetches each
// chunk, indexes it, then marks unreturned IDs seen so the conv can converge despite
// deleted messages and gaps. Stops after numJobs chunks (large convs indexed across
// multiple passes).
func (idx *Indexer) reindexConv(ctx context.Context, rconv types.RemoteConversation,
	numJobs int, inboxIndexStatus *inboxIndexStatus,
) (res reindexResult, err error) {
	if idx.G().GetEnv().GetDisableSearchIndexer() {
		// add() drops everything in this case, so paging on would MarkSeen ids
		// that were never indexed and leave them permanently unsearchable if the
		// indexer is turned back on.
		return res, nil
	}
	conv := rconv.Conv
	convID := conv.GetConvID()
	missingIDs, err := idx.store.MissingIDForConv(ctx, conv)
	if err != nil {
		return res, err
	}
	if len(missingIDs) == 0 {
		return res, nil
	}
	minIdxID := missingIDs[0]
	maxIdxID := missingIDs[len(missingIDs)-1]

	defer idx.Trace(ctx, &err,
		"Indexer.reindex: conv: %v, minID: %v, maxID: %v, numMissing: %v",
		utils.GetRemoteConvDisplayName(rconv), minIdxID, maxIdxID, len(missingIDs))()

	reason := chat1.GetThreadReason_INDEXED_SEARCH
	// Page over MISSING ids only, not the full min..max range. Otherwise we refetch
	// tens of thousands of already-indexed messages and spend the budget before
	// reaching the holes. Failed fetches count toward budget same as successful ones
	// (both cost a round trip); counting only successes lets a broken conv spend
	// hundreds of attempts in one pass.
	consecutiveFetchFailures := 0
	for start := 0; start < len(missingIDs); start += idx.pageSize {
		select {
		case <-ctx.Done():
			return res, ctx.Err()
		default:
		}
		end := start + idx.pageSize
		if end > len(missingIDs) {
			end = len(missingIDs)
		}
		chunk := missingIDs[start:end]
		msgs, err := idx.G().ConvSource.GetMessages(ctx, convID, idx.uid, chunk, &reason, nil, false)
		res.attempted++
		if err != nil {
			if utils.IsPermanentErr(err) {
				return res, err
			}
			// transient: leave these ids missing so a later pass retries them
			consecutiveFetchFailures++
			if consecutiveFetchFailures >= maxConsecutiveFetchFailures {
				// it is the network failing rather than these particular ids, so
				// paging on just spends the budget on the same failure
				idx.Debug(ctx, "reindexConv: giving up on conv after %d consecutive fetch failures: %s",
					consecutiveFetchFailures, err)
				return res, nil
			}
			if numJobs > 0 && res.attempted >= numJobs {
				return res, nil
			}
			continue
		}
		consecutiveFetchFailures = 0
		cb, err := idx.add(ctx, convID, msgs, true)
		if err != nil {
			return res, err
		}
		select {
		case addErr := <-cb:
			if addErr != nil {
				// The op failed or never ran, so nothing in this chunk was
				// indexed. Marking it seen here would record those messages as
				// indexed with no tokens behind them, and the conv would never
				// be revisited to fix it.
				return res, addErr
			}
		case <-ctx.Done():
			return res, ctx.Err()
		}
		// Add accounts for the messages that came back. Mark only requested IDs
		// absent from the successful response: a returned edit whose superseded
		// message was unavailable is deliberately left unseen by Add so it can
		// be retried.
		returnedIDs := make(map[chat1.MessageID]struct{}, len(msgs))
		for _, msg := range msgs {
			returnedIDs[msg.GetMessageID()] = struct{}{}
		}
		unreturnedIDs := make([]chat1.MessageID, 0, len(chunk))
		for _, id := range chunk {
			if _, ok := returnedIDs[id]; !ok {
				unreturnedIDs = append(unreturnedIDs, id)
			}
		}
		if err := idx.store.MarkSeen(ctx, convID, unreturnedIDs); err != nil {
			// The store is failing, not the conv. Give up on this conv rather
			// than paging on: without the mark these ids stay missing, so
			// counting the job would misreport storage failure as completed
			// indexing work.
			return res, err
		}
		res.completed++
		if numJobs > 0 && res.attempted >= numJobs {
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
	return res, nil
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

// SelectiveSync queues up a small number of jobs on the background loader
// periodically so our index can cover all conversations. The number of jobs
// varies between desktop and mobile so mobile can be more conservative.
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
		fullyIndexed, err := idx.store.FullyIndexed(ctx, conv.Conv)
		if err != nil {
			idx.Debug(ctx, "SelectiveSync: Unable to get md for conv: %v, %v", convID, err)
			continue
		}
		if fullyIndexed {
			continue
		}

		result, err := idx.reindexConv(ctx, conv, numJobs, nil)
		numJobs -= result.attempted
		if err != nil {
			idx.Debug(ctx, "Unable to reindex conv: %v, %v", convID, err)
			if numJobs <= 0 {
				break
			}
			continue
		}
		if result.completed > 0 {
			idx.Debug(ctx, "SelectiveSync: Indexed completed jobs %d", result.completed)
		}
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
	return store.Clear(ctx, uid, convID)
}

func (idx *Indexer) OnDbNuke(mctx libkb.MetaContext) (err error) {
	defer idx.Trace(mctx.Ctx(), &err, "Indexer.OnDbNuke")()
	idx.Lock()
	defer idx.Unlock()
	if !idx.started {
		return nil
	}
	idx.store.ClearMemory()
	return nil
}

func (idx *Indexer) GetStoreHits(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	query string,
) (res map[chat1.MessageID]chat1.EmptyStruct, err error) {
	return idx.store.GetHits(ctx, convID, query)
}
