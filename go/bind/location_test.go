package keybase

import (
	"context"
	"encoding/base64"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/maps"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
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
	ctx := context.Background()
	lifecycletest.ToBackground(tc.G.MobileLifecycle)

	startTracking := func(msgID chat1.MessageID) types.LiveLocationKey {
		tracker.StartTracking(ctx, chat1.ConversationID("conv"), msgID, clock.Now().Add(time.Hour))
		select {
		case <-watcher.starts:
		case <-time.After(10 * time.Second):
			require.Fail(t, "native watch never started")
		}
		return types.LiveLocationKey(base64.StdEncoding.EncodeToString(
			fmt.Appendf(nil, "%s:%d", chat1.ConversationID("conv"), msgID)))
	}
	stopTracking := func() {
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
	fix := func(lat float64) chat1.Coordinate { return chat1.Coordinate{Lat: lat, Lon: -73.25, Accuracy: 12} }
	// waitRecorded waits for the tracker at key to take the fix at lat, and
	// returns its coordinates. The tracker also takes the last coordinate it
	// has when it starts, which can repeat the first fix; repeats are dropped.
	waitRecorded := func(key types.LiveLocationKey, lat float64) (res []chat1.Coordinate) {
		require.Eventually(t, func() bool {
			coords := tracker.GetCoordinates(ctx, key)
			return coords[len(coords)-1] == fix(lat)
		}, 10*time.Second, time.Millisecond, "coordinate never reached the tracker")
		for _, c := range tracker.GetCoordinates(ctx, key) {
			if len(res) == 0 || res[len(res)-1] != c {
				res = append(res, c)
			}
		}
		return res
	}

	key := startTracking(1)
	// The first fix is recorded even in the background.
	locationUpdate(tracker, 40.5, -73.25, 12)
	require.Equal(t, []chat1.Coordinate{fix(40.5)}, waitRecorded(key, 40.5))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, tc.G.MobileAppState.State())
	// About 11m north, too short a move to record in the background, then
	// about 111m further. The coordinates arrive in order, so once the last one
	// is in, the short move would be too.
	locationUpdate(tracker, 40.5001, -73.25, 12)
	locationUpdate(tracker, 40.5011, -73.25, 12)
	require.Equal(t, []chat1.Coordinate{fix(40.5), fix(40.5011)}, waitRecorded(key, 40.5011))
	stopTracking()

	// A new watch records its first fix however short the move.
	key = startTracking(2)
	locationUpdate(tracker, 40.5012, -73.25, 12)
	waitRecorded(key, 40.5012)
	stopTracking()
}

type recordingLiveLocationTracker struct {
	types.LiveLocationTracker
	sync.Mutex
	coords []chat1.Coordinate
}

func (r *recordingLiveLocationTracker) NativeLocationUpdate(_ context.Context, coord chat1.Coordinate) {
	r.Lock()
	defer r.Unlock()
	r.coords = append(r.coords, coord)
}

func (r *recordingLiveLocationTracker) Coords() []chat1.Coordinate {
	r.Lock()
	defer r.Unlock()
	return append([]chat1.Coordinate(nil), r.coords...)
}

func TestLocationUpdateGuards(t *testing.T) {
	resetConnStateForTest(t)
	savedChatCtx := kbChatCtx
	t.Cleanup(func() { kbChatCtx = savedChatCtx })
	setInitComplete := func(v bool) {
		initMutex.Lock()
		defer initMutex.Unlock()
		initComplete = v
	}

	tc := libkb.SetupTest(t, "LocationUpdateGuards", 0)
	defer tc.Cleanup()
	tracker := &recordingLiveLocationTracker{}
	kbCtx = tc.G
	kbChatCtx = &globals.ChatContext{LiveLocationTracker: tracker}

	setInitComplete(true)
	LocationUpdate(1, 2, 3)
	require.Empty(t, tracker.Coords(), "dropped while logged out")

	sigKey, err := libkb.GenerateNaclSigningKeyPair()
	require.NoError(t, err)
	encKey, err := libkb.GenerateNaclDHKeyPair()
	require.NoError(t, err)
	uv := keybase1.UserVersion{Uid: keybase1.MakeTestUID(1), EldestSeqno: 1}
	require.NoError(t, tc.G.ActiveDevice.Set(libkb.NewMetaContextForTest(tc), uv, keybase1.DeviceID("dev"),
		sigKey, encKey, "testuser-device", 0, libkb.KeychainModeNone))

	setInitComplete(false)
	LocationUpdate(1, 2, 3)
	require.Empty(t, tracker.Coords(), "dropped before Init completes")

	setInitComplete(true)
	LocationUpdate(1, 2, 3)
	require.Equal(t, []chat1.Coordinate{{Lat: 1, Lon: 2, Accuracy: 3}}, tracker.Coords())
}
