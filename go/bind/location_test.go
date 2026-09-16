package keybase

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/maps"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

type countingLocationWatcher struct{ starts, stops chan struct{} }

func (w countingLocationWatcher) StartWatching() { w.starts <- struct{}{} }
func (w countingLocationWatcher) StopWatching()  { w.stops <- struct{}{} }

type nilCtxFactory struct{}

func (nilCtxFactory) NewKeyFinder() types.KeyFinder   { return nil }
func (nilCtxFactory) NewUPAKFinder() types.UPAKFinder { return nil }

func TestLocationUpdateReachesTrackers(t *testing.T) {
	t.Setenv("KEYBASE_APP_TYPE", string(libkb.MobileAppType))
	tc := libkb.SetupTest(t, "LocationUpdateReachesTrackers", 0)
	defer tc.Cleanup()
	tc.G.ChatHelper = kbtest.NewMockChatHelper()
	tc.G.SetUIRouter(kbtest.NewMockUIRouter(nil))
	watcher := countingLocationWatcher{starts: make(chan struct{}, 10), stops: make(chan struct{}, 10)}
	var nativeWatcher NativeLocationWatcher = watcher
	g := globals.NewContext(tc.G, &globals.ChatContext{CtxFactory: nilCtxFactory{}, LocationWatcher: nativeWatcher})
	tracker := maps.NewLiveLocationTracker(g)
	clock := clockwork.NewFakeClock()
	tracker.SetClock(clock)
	tracker.TestingCoordsAddedCh = make(chan struct{}, 10)
	ctx := context.Background()
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)

	tracker.StartTracking(ctx, chat1.ConversationID("conv"), 1, clock.Now().Add(time.Hour))
	select {
	case <-watcher.starts:
	case <-time.After(10 * time.Second):
		require.Fail(t, "native watch never started")
	}

	locationUpdate(tracker, 40.5, -73.25, 12)
	select {
	case <-tracker.TestingCoordsAddedCh:
	case <-time.After(10 * time.Second):
		require.Fail(t, "coordinate never reached the tracker")
	}
	require.Equal(t, []chat1.Coordinate{{Lat: 40.5, Lon: -73.25, Accuracy: 12}},
		tracker.GetCoordinates(ctx, "not a tracker"))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, tc.G.MobileAppState.State())

	tracker.StopAllTracking(ctx)
	select {
	case <-tracker.Stop(ctx):
	case <-time.After(10 * time.Second):
		require.Fail(t, "tracker did not stop")
	}
	select {
	case <-watcher.stops:
	default:
		require.Fail(t, "native watch never stopped")
	}
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, tc.G.MobileAppState.State())
}
