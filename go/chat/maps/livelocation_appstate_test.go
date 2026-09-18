package maps

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestLiveLocationTrackerBackgroundActive(t *testing.T) {
	t.Setenv("KEYBASE_APP_TYPE", string(libkb.MobileAppType))
	tc := libkb.SetupTest(t, "LiveLocationTrackerBackgroundActive", 0)
	defer tc.Cleanup()
	appState := tc.G.MobileAppState
	l := NewLiveLocationTracker(globals.NewContext(tc.G, &globals.ChatContext{}))
	ctx := context.Background()
	coord := func(lat float64) chat1.Coordinate { return chat1.Coordinate{Lat: lat, Lon: 1} }
	addTracker := func(msgID chat1.MessageID) *locationTrack {
		track := newLocationTrack(chat1.ConversationID("conv"), msgID, time.Now().Add(time.Hour), false, 10, false)
		l.Lock()
		defer l.Unlock()
		l.trackers[track.Key()] = track
		return track
	}
	removeTracker := func(track *locationTrack) {
		l.Lock()
		defer l.Unlock()
		l.removeTrackerLocked(ctx, track)
	}

	lc := tc.G.MobileLifecycle
	require.Zero(t, lc.UIBackground(false, lifecycle.BackgroundTaskDeps{}))
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, appState.State())
	l.LocationUpdate(ctx, coord(1))
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, appState.State(), "no trackers, no hold")

	first := addTracker(1)
	second := addTracker(2)
	l.LocationUpdate(ctx, coord(2))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State())
	removeTracker(first)
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State(), "still tracking")
	removeTracker(second)
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, appState.State())

	// A fix in the foreground holds too, so backgrounding keeps the work running.
	lc.UIActive()
	third := addTracker(3)
	l.LocationUpdate(ctx, coord(3))
	require.Equal(t, keybase1.MobileAppState_FOREGROUND, appState.State())
	require.Zero(t, lc.UIBackground(false, lifecycle.BackgroundTaskDeps{}))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State())
	removeTracker(third)
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, appState.State())
}

// WillTerminate is the one controller event that ends a live location hold. A
// fix after it opens a new one, rather than counting on the ended hold.
func TestLiveLocationTrackerHoldSurvivesWillTerminate(t *testing.T) {
	t.Setenv("KEYBASE_APP_TYPE", string(libkb.MobileAppType))
	tc := libkb.SetupTest(t, "LiveLocationTrackerWillTerminate", 0)
	defer tc.Cleanup()
	appState := tc.G.MobileAppState
	l := NewLiveLocationTracker(globals.NewContext(tc.G, &globals.ChatContext{}))
	ctx := context.Background()
	coord := func(lat float64) chat1.Coordinate { return chat1.Coordinate{Lat: lat, Lon: 1} }

	track := newLocationTrack(chat1.ConversationID("conv"), 1, time.Now().Add(time.Hour), false, 10, false)
	l.Lock()
	l.trackers[track.Key()] = track
	l.Unlock()

	lc := tc.G.MobileLifecycle
	require.Zero(t, lc.UIBackground(false, lifecycle.BackgroundTaskDeps{}))
	l.LocationUpdate(ctx, coord(1))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State())

	lc.WillTerminate(func() {})
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, appState.State(), "WillTerminate left a hold open")

	l.LocationUpdate(ctx, coord(2))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State(),
		"a fix after WillTerminate did not open a new hold")
}
