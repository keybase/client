package maps

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

type fakeLocationWatcher struct {
	sync.Mutex
	calls []string
}

func (w *fakeLocationWatcher) StartWatching() { w.record("start") }
func (w *fakeLocationWatcher) StopWatching()  { w.record("stop") }

func (w *fakeLocationWatcher) record(call string) {
	w.Lock()
	defer w.Unlock()
	w.calls = append(w.calls, call)
}

func (w *fakeLocationWatcher) Calls() []string {
	w.Lock()
	defer w.Unlock()
	return append([]string(nil), w.calls...)
}

type watchCall struct {
	convID chat1.ConversationID
	perm   chat1.UIWatchPositionPerm
}

type fakeWatchChatUI struct {
	utils.NullChatUI
	sync.Mutex
	watches []watchCall
	clears  []chat1.LocationWatchID
	nextID  chat1.LocationWatchID
}

func (u *fakeWatchChatUI) ChatWatchPosition(_ context.Context, convID chat1.ConversationID,
	perm chat1.UIWatchPositionPerm,
) (chat1.LocationWatchID, error) {
	u.Lock()
	defer u.Unlock()
	u.watches = append(u.watches, watchCall{convID: convID, perm: perm})
	u.nextID++
	return u.nextID, nil
}

func (u *fakeWatchChatUI) ChatClearWatch(_ context.Context, id chat1.LocationWatchID) error {
	u.Lock()
	defer u.Unlock()
	u.clears = append(u.clears, id)
	return nil
}

func (u *fakeWatchChatUI) Watches() []watchCall {
	u.Lock()
	defer u.Unlock()
	return append([]watchCall(nil), u.watches...)
}

func (u *fakeWatchChatUI) Clears() []chat1.LocationWatchID {
	u.Lock()
	defer u.Unlock()
	return append([]chat1.LocationWatchID(nil), u.clears...)
}

type nilCtxFactory struct{}

func (nilCtxFactory) NewKeyFinder() types.KeyFinder   { return nil }
func (nilCtxFactory) NewUPAKFinder() types.UPAKFinder { return nil }

// newWatchTestTracker builds a tracker whose map unfurls fail right away (the
// mock chat helper returns no message), so the tracker loop runs without a
// chat server. chatUI nil means no UI is connected.
func newWatchTestTracker(t *testing.T, tc libkb.TestContext, watcher types.LocationWatcher,
	chatUI libkb.ChatUI,
) *LiveLocationTracker {
	tc.G.ChatHelper = kbtest.NewMockChatHelper()
	tc.G.SetUIRouter(kbtest.NewMockUIRouter(chatUI))
	g := globals.NewContext(tc.G, &globals.ChatContext{
		CtxFactory:      nilCtxFactory{},
		LocationWatcher: watcher,
	})
	l := NewLiveLocationTracker(g)
	l.SetClock(clockwork.NewFakeClock())
	t.Cleanup(func() {
		l.StopAllTracking(context.Background())
		select {
		case <-l.Stop(context.Background()):
		case <-time.After(10 * time.Second):
			t.Error("trackers did not stop")
		}
	})
	return l
}

var watchTestConvID = chat1.ConversationID("conv")

func startTestTracker(l *LiveLocationTracker, msgID chat1.MessageID) *locationTrack {
	l.StartTracking(context.Background(), watchTestConvID, msgID, l.clock.Now().Add(time.Hour))
	l.Lock()
	defer l.Unlock()
	return l.trackers[newLocationTrack(watchTestConvID, msgID, time.Time{}, false, 0, false).Key()]
}

func waitTrackerRemoved(t *testing.T, l *LiveLocationTracker, track *locationTrack) {
	require.Eventually(t, func() bool {
		l.Lock()
		defer l.Unlock()
		_, ok := l.trackers[track.Key()]
		return !ok
	}, 10*time.Second, 5*time.Millisecond)
}

func TestLiveLocationTrackerNativeWatcher(t *testing.T) {
	tc := libkb.SetupTest(t, "LiveLocationTrackerNativeWatcher", 0)
	t.Cleanup(tc.Cleanup)
	watcher := &fakeLocationWatcher{}
	ui := &fakeWatchChatUI{}
	l := newWatchTestTracker(t, tc, watcher, ui)

	first := startTestTracker(l, 1)
	second := startTestTracker(l, 2)
	require.Eventually(t, func() bool { return len(ui.Watches()) == 2 }, 10*time.Second, 5*time.Millisecond)
	require.Equal(t, []string{"start"}, watcher.Calls(), "one native watch for both trackers")
	for _, w := range ui.Watches() {
		require.Equal(t, watchCall{convID: watchTestConvID, perm: chat1.UIWatchPositionPerm_ALWAYS}, w,
			"the UI is still asked for permission")
	}

	first.Stop()
	waitTrackerRemoved(t, l, first)
	require.Equal(t, []string{"start"}, watcher.Calls(), "still tracking")

	second.Stop()
	waitTrackerRemoved(t, l, second)
	require.Equal(t, []string{"start", "stop"}, watcher.Calls())
	require.Empty(t, ui.Clears(), "the UI never watched, so it never clears")

	third := startTestTracker(l, 3)
	require.Eventually(t, func() bool { return len(watcher.Calls()) == 3 }, 10*time.Second, 5*time.Millisecond)
	require.Equal(t, []string{"start", "stop", "start"}, watcher.Calls())
	third.Stop()
	waitTrackerRemoved(t, l, third)
	require.Equal(t, []string{"start", "stop", "start", "stop"}, watcher.Calls())
}

func TestLiveLocationTrackerChatUIWatch(t *testing.T) {
	tc := libkb.SetupTest(t, "LiveLocationTrackerChatUIWatch", 0)
	t.Cleanup(tc.Cleanup)
	ui := &fakeWatchChatUI{}
	l := newWatchTestTracker(t, tc, nil, ui)

	first := startTestTracker(l, 1)
	second := startTestTracker(l, 2)
	require.Eventually(t, func() bool { return len(ui.Watches()) == 2 }, 10*time.Second, 5*time.Millisecond)

	first.Stop()
	waitTrackerRemoved(t, l, first)
	require.Len(t, ui.Clears(), 1)
	second.Stop()
	waitTrackerRemoved(t, l, second)
	require.ElementsMatch(t, []chat1.LocationWatchID{1, 2}, ui.Clears())
}

func TestLiveLocationTrackerRestoreStartsNativeWatch(t *testing.T) {
	tc := libkb.SetupTest(t, "LiveLocationTrackerRestoreStartsNativeWatch", 0)
	t.Cleanup(tc.Cleanup)
	watcher := &fakeLocationWatcher{}
	l := newWatchTestTracker(t, tc, watcher, nil)

	endTime := l.clock.Now().Add(time.Hour)
	live := newLocationTrack(watchTestConvID, 1, endTime, false, 10, false)
	other := newLocationTrack(watchTestConvID, 2, endTime, false, 10, false)
	stopped := newLocationTrack(watchTestConvID, 3, endTime, false, 10, true)
	l.Lock()
	l.runRestoredLocked([]*locationTrack{live, other, stopped})
	l.Unlock()

	require.Eventually(t, func() bool { return len(watcher.Calls()) == 1 }, 10*time.Second, 5*time.Millisecond)
	require.Equal(t, []string{"start"}, watcher.Calls())
	require.True(t, l.ActivelyTracking(context.Background()))

	live.Stop()
	other.Stop()
	waitTrackerRemoved(t, l, live)
	waitTrackerRemoved(t, l, other)
	require.Equal(t, []string{"start", "stop"}, watcher.Calls())
}

func TestLiveLocationTrackerNativeWatchStopsWhenTrackerEnds(t *testing.T) {
	tc := libkb.SetupTest(t, "LiveLocationTrackerNativeWatchStopsWhenTrackerEnds", 0)
	t.Cleanup(tc.Cleanup)
	watcher := &fakeLocationWatcher{}
	l := newWatchTestTracker(t, tc, watcher, nil)
	clock := l.clock.(clockwork.FakeClock)

	track := startTestTracker(l, 1)
	require.Eventually(t, func() bool { return len(watcher.Calls()) == 1 }, 10*time.Second, 5*time.Millisecond)
	clock.BlockUntil(2)
	clock.Advance(2 * time.Hour)
	waitTrackerRemoved(t, l, track)
	require.Equal(t, []string{"start", "stop"}, watcher.Calls())
}

type failingWatchChatUI struct {
	utils.NullChatUI
	attempts atomic.Int32
}

func (u *failingWatchChatUI) ChatWatchPosition(context.Context, chat1.ConversationID,
	chat1.UIWatchPositionPerm,
) (chat1.LocationWatchID, error) {
	u.attempts.Add(1)
	return 0, errors.New("no UI yet")
}

func TestLiveLocationTrackerChatUIWatchGivesUp(t *testing.T) {
	tc := libkb.SetupTest(t, "LiveLocationTrackerChatUIWatchGivesUp", 0)
	t.Cleanup(tc.Cleanup)
	ui := &failingWatchChatUI{}
	l := newWatchTestTracker(t, tc, nil, ui)
	clock := l.clock.(clockwork.FakeClock)

	done := make(chan error, 1)
	track := newLocationTrack(watchTestConvID, 1, clock.Now().Add(time.Hour), false, 10, false)
	go func() {
		_, err := l.startChatUIWatch(context.Background(), track)
		done <- err
	}()
	// One try plus 21 retries, a second apart.
	const maxAttempts = 22
	for n := int32(1); ; n++ {
		require.Eventually(t, func() bool { return ui.attempts.Load() >= n }, 10*time.Second, time.Millisecond)
		if n == maxAttempts {
			break
		}
		clock.BlockUntil(1)
		clock.Advance(time.Second)
	}
	select {
	case err := <-done:
		require.Error(t, err)
	case <-time.After(10 * time.Second):
		require.Fail(t, "still retrying", "after %d attempts", ui.attempts.Load())
	}
	require.EqualValues(t, maxAttempts, ui.attempts.Load())
}

// A tracker whose watch never starts ends like any other: it leaves no tracker
// and no background-work hold, so the app can still reach BACKGROUND.
func TestLiveLocationTrackerFailedWatchLeavesNoHold(t *testing.T) {
	t.Setenv("KEYBASE_APP_TYPE", string(libkb.MobileAppType))
	tc := libkb.SetupTest(t, "LiveLocationTrackerFailedWatchLeavesNoHold", 0)
	t.Cleanup(tc.Cleanup)
	ui := &failingWatchChatUI{}
	l := newWatchTestTracker(t, tc, nil, ui)
	clock := l.clock.(clockwork.FakeClock)
	appState := tc.G.MobileAppState

	track := startTestTracker(l, 1)
	require.NotNil(t, track)
	// A fix while the watch is still retrying holds the app up.
	require.Eventually(t, func() bool { return ui.attempts.Load() >= 1 }, 10*time.Second, time.Millisecond)
	l.LocationUpdate(context.Background(), chat1.Coordinate{Lat: 1, Lon: 1})
	require.Zero(t, tc.G.MobileLifecycle.UIBackground(false, lifecycle.BackgroundTaskDeps{}))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State())

	for ui.attempts.Load() < 22 {
		// Read the count while the retry is parked on the clock: Advance
		// releases it, so a count read afterward can already include it.
		clock.BlockUntil(1)
		n := ui.attempts.Load()
		clock.Advance(time.Second)
		require.Eventually(t, func() bool { return ui.attempts.Load() > n }, 10*time.Second, time.Millisecond)
	}
	waitTrackerRemoved(t, l, track)
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, appState.State())

	// A later fix finds no tracker to hold the app up for.
	tc.G.MobileLifecycle.UIActive()
	l.LocationUpdate(context.Background(), chat1.Coordinate{Lat: 2, Lon: 2})
	require.Zero(t, tc.G.MobileLifecycle.UIBackground(false, lifecycle.BackgroundTaskDeps{}))
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, appState.State())
}
