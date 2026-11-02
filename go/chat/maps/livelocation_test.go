package maps

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

// lateChatUIRouter has no chat UI registered until ui is set, like the service at startup
// before the app connects.
type lateChatUIRouter struct {
	libkb.UIRouter
	ui chan libkb.ChatUI
}

func (r *lateChatUIRouter) Shutdown() {}

func (r *lateChatUIRouter) GetChatUI() (libkb.ChatUI, error) {
	select {
	case ui := <-r.ui:
		r.ui <- ui
		return ui, nil
	default:
		return nil, nil
	}
}

type watchRecordingChatUI struct {
	utils.NullChatUI
	watches chan chat1.ConversationID
}

func (u *watchRecordingChatUI) ChatWatchPosition(ctx context.Context, convID chat1.ConversationID,
	perm chat1.UIWatchPositionPerm,
) (chat1.LocationWatchID, error) {
	u.watches <- convID
	return 1, nil
}

func TestRestoredLiveLocationAsksAppToWatch(t *testing.T) {
	tc := libkb.SetupTest(t, "TestRestoredLiveLocationAsksAppToWatch", 1)
	defer tc.Cleanup()
	router := &lateChatUIRouter{ui: make(chan libkb.ChatUI, 1)}
	tc.G.SetUIRouter(router)

	l := NewLiveLocationTracker(&globals.Context{GlobalContext: tc.G, ChatContext: &globals.ChatContext{}})
	ctx := context.Background()
	convID := chat1.ConversationID([]byte{0, 0, 1})
	restored := newLocationTrack(convID, 5, time.Now().Add(time.Hour), false, 10, false)

	// The service restores the stored trackers on startup, before the app has
	// registered its chat UI. Storage needs a signed in user, so hand the tracker
	// over the way restoreLocked does.
	l.Lock()
	l.uid = gregor1.UID([]byte{1})
	l.started = true
	l.trackers[restored.Key()] = restored
	l.goTrackerLocked(restored)
	l.Unlock()
	defer func() { <-l.Stop(ctx) }()

	// The app connects and registers its chat UI shortly after.
	time.Sleep(200 * time.Millisecond)
	ui := &watchRecordingChatUI{watches: make(chan chat1.ConversationID, 10)}
	router.ui <- ui

	select {
	case got := <-ui.watches:
		require.Equal(t, convID, got)
	case <-time.After(5 * time.Second):
		require.Fail(t, "the restored live location share never asked the app to watch its position")
	}
}
