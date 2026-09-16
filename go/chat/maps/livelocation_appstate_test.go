package maps

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"

	"github.com/keybase/client/go/libkb"
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

	appState.Update(keybase1.MobileAppState_BACKGROUND)
	l.LocationUpdate(ctx, coord(1))
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, appState.State(), "no trackers, no claim")

	first := addTracker(1)
	second := addTracker(2)
	l.LocationUpdate(ctx, coord(2))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State())
	removeTracker(first)
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State(), "still tracking")
	removeTracker(second)
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, appState.State())

	// A foreground while tracking leaves the state to the foreground.
	third := addTracker(3)
	l.LocationUpdate(ctx, coord(3))
	require.Equal(t, keybase1.MobileAppState_BACKGROUNDACTIVE, appState.State())
	appState.Update(keybase1.MobileAppState_FOREGROUND)
	removeTracker(third)
	require.Equal(t, keybase1.MobileAppState_FOREGROUND, appState.State())
}
