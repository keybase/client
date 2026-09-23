package chat

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

type appStateCtxFactory struct{}

func (appStateCtxFactory) NewKeyFinder() types.KeyFinder   { return nil }
func (appStateCtxFactory) NewUPAKFinder() types.UPAKFinder { return nil }

// pullRecorder is the only part of ConversationSource a background load
// reaches; anything else panics on the nil embedded interface.
type pullRecorder struct {
	types.ConversationSource
	pulls chan chat1.ConversationID
}

func (p *pullRecorder) Pull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	reason chat1.GetThreadReason, customRi func() chat1.RemoteInterface, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination,
) (chat1.ThreadView, error) {
	select {
	case p.pulls <- convID:
	default:
	}
	return chat1.ThreadView{}, nil
}

func setupAppStateConvLoader(t *testing.T) (*BackgroundConvLoader, *pullRecorder, libkb.TestContext) {
	tc := externalstest.SetupTest(t, "convloader-appstate", 0)
	t.Cleanup(tc.Cleanup)
	tc.G.ConnectionManager = libkb.NewConnectionManager()
	pulls := &pullRecorder{pulls: make(chan chat1.ConversationID, 100)}
	g := globals.NewContext(tc.G, &globals.ChatContext{
		CtxFactory: appStateCtxFactory{},
		ConvSource: pulls,
	})
	b := NewBackgroundConvLoader(g)
	b.resumeWait = time.Millisecond
	b.loadWait = time.Millisecond
	return b, pulls, tc
}

func requireConvLoaderStopped(t *testing.T, b *BackgroundConvLoader) {
	t.Helper()
	select {
	case <-b.Stop(context.TODO()):
	case <-time.After(10 * time.Second):
		require.FailNow(t, "Stop did not finish")
	}
}

var convLoaderTestConvID = chat1.ConversationID([]byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16})

func convLoaderTestJob() types.ConvLoaderJob {
	return types.NewConvLoaderJob(convLoaderTestConvID, &chat1.Pagination{Num: 1},
		types.ConvLoaderPriorityHigh, types.ConvLoaderGeneric, nil)
}

// Stop does not wait for the loop's delay before dispatching a job.
func TestConvLoaderStopDuringLoadDelay(t *testing.T) {
	b, _, _ := setupAppStateConvLoader(t)
	clock := clockwork.NewFakeClock()
	b.clock = clock
	b.Start(context.TODO(), gregor1.UID([]byte{1, 2, 3, 4}))
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	waited := make(chan struct{})
	go func() {
		clock.BlockUntil(1)
		close(waited)
	}()
	select {
	case <-waited:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "the loader never slept on the clock before dispatching the job")
	}
	requireConvLoaderStopped(t, b)
}

type pullCall struct {
	ctx context.Context
	uid gregor1.UID
}

// ctxPuller hands each load to the test and holds it until release closes,
// or until its ctx is canceled unless ignoreCancel is set.
type ctxPuller struct {
	types.ConversationSource
	calls        chan pullCall
	release      chan struct{}
	ignoreCancel bool
}

func newCtxPuller(ignoreCancel bool) *ctxPuller {
	return &ctxPuller{
		calls:        make(chan pullCall, 100),
		release:      make(chan struct{}),
		ignoreCancel: ignoreCancel,
	}
}

func (p *ctxPuller) Pull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	reason chat1.GetThreadReason, customRi func() chat1.RemoteInterface, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination,
) (chat1.ThreadView, error) {
	p.calls <- pullCall{ctx: ctx, uid: uid}
	done := ctx.Done()
	if p.ignoreCancel {
		done = nil
	}
	select {
	case <-p.release:
	case <-done:
	}
	return chat1.ThreadView{}, ctx.Err()
}

func requirePull(t *testing.T, p *ctxPuller) pullCall {
	t.Helper()
	select {
	case call := <-p.calls:
		return call
	case <-time.After(10 * time.Second):
		require.FailNow(t, "no load")
		return pullCall{}
	}
}

func TestConvLoaderStartWaitsForPreviousRun(t *testing.T) {
	b, _, _ := setupAppStateConvLoader(t)
	pulls := newCtxPuller(true)
	b.G().ConvSource = pulls
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	b.Start(context.TODO(), uid)
	// release is idempotent so the stuck load is unblocked before Stop is
	// awaited on any exit path, including require.FailNow, which skips the
	// rest of the test body.
	var releaseOnce sync.Once
	release := func() { releaseOnce.Do(func() { close(pulls.release) }) }
	defer requireConvLoaderStopped(t, b)
	defer release()
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	load := requirePull(t, pulls)

	started := make(chan struct{})
	go func() {
		b.Start(context.TODO(), uid)
		close(started)
	}()
	select {
	case <-started:
		require.FailNow(t, "Start returned while the previous run's load was still running")
	case <-time.After(200 * time.Millisecond):
	}
	require.Error(t, load.ctx.Err(), "Start did not cancel the previous run's load")
	release()
	select {
	case <-started:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "Start did not return after the previous run exited")
	}
	require.True(t, b.isRunning())
}

// pullBlocker fails the first load of the old user's conversation once
// released, so the old run asks to retry it.
type pullBlocker struct {
	types.ConversationSource
	oldUID  gregor1.UID
	started chan struct{}
	// the old user's conversation can be pulled more than once (a retry),
	// so started is closed only on the first
	startedOnce sync.Once
	release     chan struct{}

	mu   sync.Mutex
	uids []gregor1.UID
}

func (p *pullBlocker) Pull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	reason chat1.GetThreadReason, customRi func() chat1.RemoteInterface, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination,
) (chat1.ThreadView, error) {
	p.mu.Lock()
	p.uids = append(p.uids, uid)
	p.mu.Unlock()
	if uid.Eq(p.oldUID) {
		p.startedOnce.Do(func() { close(p.started) })
		<-p.release
		return chat1.ThreadView{}, context.Canceled
	}
	return chat1.ThreadView{}, nil
}

func TestConvLoaderReplacedRunRetryStaysInItsRun(t *testing.T) {
	b, _, _ := setupAppStateConvLoader(t)
	oldUID, newUID := gregor1.UID([]byte{1, 2, 3, 4}), gregor1.UID([]byte{5, 6, 7, 8})
	pulls := &pullBlocker{oldUID: oldUID, started: make(chan struct{}), release: make(chan struct{})}
	b.G().ConvSource = pulls
	b.Start(context.TODO(), oldUID)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	select {
	case <-pulls.started:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "old run did not load")
	}
	started := make(chan struct{})
	go func() {
		b.Start(context.TODO(), newUID)
		close(started)
	}()
	defer requireConvLoaderStopped(t, b)
	close(pulls.release)
	select {
	case <-started:
	case <-time.After(10 * time.Second):
		require.FailNow(t, "Start did not return")
	}

	// past the retry delay and the new run's load delays
	time.Sleep(time.Second)
	b.Lock()
	queued := b.queue.queue.Len()
	b.Unlock()
	require.Zero(t, queued, "old run's retry reached the new queue")
	pulls.mu.Lock()
	defer pulls.mu.Unlock()
	require.Equal(t, []gregor1.UID{oldUID}, pulls.uids)
}

// A loader created while the app is already in BACKGROUND must not load
// anything once started, until the app comes to FOREGROUND. The sleep gives
// the loader's own app-state watcher time to observe the already-BACKGROUND
// state before Start runs.
func TestConvLoaderBackgroundLaunchStaysSuspended(t *testing.T) {
	tc := externalstest.SetupTest(t, "convloader-appstate-launch", 0)
	t.Cleanup(tc.Cleanup)
	tc.G.ConnectionManager = libkb.NewConnectionManager()
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	pulls := &pullRecorder{pulls: make(chan chat1.ConversationID, 100)}
	g := globals.NewContext(tc.G, &globals.ChatContext{
		CtxFactory: appStateCtxFactory{},
		ConvSource: pulls,
	})
	b := NewBackgroundConvLoader(g)
	b.resumeWait = time.Millisecond
	b.loadWait = time.Millisecond
	time.Sleep(100 * time.Millisecond)

	uid := gregor1.UID([]byte{1, 2, 3, 4})
	b.Start(context.TODO(), uid)
	defer requireConvLoaderStopped(t, b)
	require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
	select {
	case <-pulls.pulls:
		require.FailNow(t, "loaded in BACKGROUND right after launch")
	case <-time.After(300 * time.Millisecond):
	}

	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	select {
	case convID := <-pulls.pulls:
		require.Equal(t, convLoaderTestConvID, convID)
	case <-time.After(10 * time.Second):
		require.FailNow(t, "no load after FOREGROUND")
	}
}

// Each run's app-state watch cancels an active load on BACKGROUND, and a
// run started while BACKGROUND loads nothing until the app leaves it.
func TestConvLoaderAppStateAcrossRuns(t *testing.T) {
	b, _, tc := setupAppStateConvLoader(t)
	pulls := newCtxPuller(false)
	b.G().ConvSource = pulls
	defer close(pulls.release)
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	appState := tc.G.MobileAppState
	requireCanceled := func(i int, load pullCall) {
		t.Helper()
		select {
		case <-load.ctx.Done():
		case <-time.After(10 * time.Second):
			require.FailNow(t, "load not canceled in BACKGROUND", "run %d", i)
		}
	}
	for i := range 3 {
		appState.Update(keybase1.MobileAppState_FOREGROUND)
		b.Start(context.TODO(), uid)
		require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
		load := requirePull(t, pulls)

		appState.Update(keybase1.MobileAppState_BACKGROUND)
		requireCanceled(i, load)
		requireConvLoaderStopped(t, b)

		// A run started in BACKGROUND loads nothing until the app leaves it.
		b.Start(context.TODO(), uid)
		require.NoError(t, b.Queue(context.TODO(), convLoaderTestJob()))
		select {
		case <-pulls.calls:
			require.FailNow(t, "loaded in BACKGROUND", "run %d", i)
		case <-time.After(300 * time.Millisecond):
		}
		appState.Update(keybase1.MobileAppState_FOREGROUND)
		load = requirePull(t, pulls)
		appState.Update(keybase1.MobileAppState_BACKGROUND)
		requireCanceled(i, load)
		requireConvLoaderStopped(t, b)
	}
}
