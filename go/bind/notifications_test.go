package keybase

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle"
	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type replyChatHelper struct {
	libkb.ChatHelper
	sendErr error
	sent    []string
}

func (h *replyChatHelper) SendTextByIDNonblock(_ context.Context, _ chat1.ConversationID, _ string, text string,
	_ *chat1.OutboxID, _ *chat1.MessageID,
) (chat1.OutboxID, error) {
	if h.sendErr != nil {
		return nil, h.sendErr
	}
	h.sent = append(h.sent, text)
	return nil, nil
}

type replyInboxSource struct {
	types.InboxSource
	markErr error
	marked  []chat1.MessageID
}

func (s *replyInboxSource) MarkAsRead(_ context.Context, _ chat1.ConversationID, _ gregor1.UID,
	msgID *chat1.MessageID, _ bool,
) error {
	s.marked = append(s.marked, *msgID)
	return s.markErr
}

func TestPostTextReply(t *testing.T) {
	const convID = "0000bbbbccccddddeeeeffff0000aaaabbbbccccddddeeeeffff0000aaaabbbb"
	setup := func(t *testing.T, loggedIn bool) (*globals.Context, *replyChatHelper, *replyInboxSource) {
		tc := libkb.SetupTest(t, "PostTextReply", 0)
		t.Cleanup(tc.Cleanup)
		helper := &replyChatHelper{}
		inbox := &replyInboxSource{}
		tc.G.ChatHelper = helper
		if loggedIn {
			uid := keybase1.MakeTestUID(1)
			deviceID := keybase1.DeviceID("00000000000000000000000000000018")
			sigKey, err := libkb.GenerateNaclSigningKeyPair()
			require.NoError(t, err)
			encKey, err := libkb.GenerateNaclDHKeyPair()
			require.NoError(t, err)
			require.NoError(t, tc.G.ActiveDevice.Set(libkb.NewMetaContextForTest(tc),
				keybase1.UserVersion{Uid: uid, EldestSeqno: 1}, deviceID,
				sigKey, encKey, "testuser-device", 0, libkb.KeychainModeNone))
			require.NoError(t, tc.G.Env.GetConfigWriter().SetUserConfig(
				libkb.NewUserConfig(uid, "testuser", nil, deviceID), true))
			require.NoError(t, tc.G.Env.GetConfigWriter().SwitchUser("testuser"))
		}
		return globals.NewContext(tc.G, &globals.ChatContext{InboxSource: inbox}), helper, inbox
	}
	ctx := context.Background()

	t.Run("sends and marks read", func(t *testing.T) {
		gc, helper, inbox := setup(t, true)
		require.NoError(t, postTextReply(ctx, gc, convID, "testuser", 5, "hi"))
		require.Equal(t, []string{"hi"}, helper.sent)
		require.Equal(t, []chat1.MessageID{5}, inbox.marked)
	})
	t.Run("send error is returned", func(t *testing.T) {
		gc, helper, inbox := setup(t, true)
		helper.sendErr = errors.New("outbox full")
		require.EqualError(t, postTextReply(ctx, gc, convID, "testuser", 5, "hi"), "outbox full")
		require.Empty(t, inbox.marked)
	})
	t.Run("mark read failure doesn't fail a sent reply", func(t *testing.T) {
		gc, helper, inbox := setup(t, true)
		inbox.markErr = errors.New("offline")
		require.NoError(t, postTextReply(ctx, gc, convID, "testuser", 5, "hi"))
		require.Equal(t, []string{"hi"}, helper.sent)
	})
	t.Run("logged out doesn't send", func(t *testing.T) {
		gc, helper, _ := setup(t, false)
		require.ErrorAs(t, postTextReply(ctx, gc, convID, "testuser", 5, "hi"), &libkb.LoginRequiredError{})
		require.Empty(t, helper.sent)
	})
	t.Run("invalid message ID doesn't send", func(t *testing.T) {
		gc, helper, _ := setup(t, true)
		require.Error(t, postTextReply(ctx, gc, convID, "testuser", -1, "hi"))
		require.Empty(t, helper.sent)
	})
}

// pendingDeliveryDeps reports a message still sending, so a push window that
// may hand over to a background task does.
func pendingDeliveryDeps() lifecycle.BackgroundTaskDeps {
	return lifecycle.BackgroundTaskDeps{
		Stay: func() bool { return true },
		ActiveDeliveries: func(context.Context) ([]chat1.OutboxRecord, error) {
			return make([]chat1.OutboxRecord, 1), nil
		},
		NextFailure:   func() (chan []chat1.OutboxRecord, func()) { return make(chan []chat1.OutboxRecord), func() {} },
		NotifyFailure: func([]chat1.OutboxRecord) {},
	}
}

func TestBackgroundNotificationOpensAndClosesPushWindow(t *testing.T) {
	const (
		fg  = keybase1.MobileAppState_FOREGROUND
		bg  = keybase1.MobileAppState_BACKGROUND
		bga = keybase1.MobileAppState_BACKGROUNDACTIVE
	)
	for _, platform := range []lifecycletest.Platform{lifecycletest.IOS, lifecycletest.Android} {
		t.Run(platform.String(), func(t *testing.T) {
			tc := libkb.SetupTest(t, "PushWindow", 0)
			defer tc.Cleanup()
			h := lifecycletest.NewHarness(t, libkb.NewMobileAppState(tc.G), platform)
			defer h.Close()
			h.Controller.UIInactive()
			lifecycletest.ToBackground(h.Controller)
			require.Equal(t, bg, h.AppState.State())
			seen := len(h.Recorder.States())

			unboxFailed := errors.New("unbox failed")
			var during keybase1.MobileAppState
			err := runPushWindow(h.Controller, platform.String(), pendingDeliveryDeps(), func(uiActive bool) error {
				require.False(t, uiActive)
				during = h.AppState.State()
				return unboxFailed
			})
			require.ErrorIs(t, err, unboxFailed)
			if platform == lifecycletest.IOS {
				require.Equal(t, bg, during, "iOS handles the push without holding the app up")
				require.Equal(t, bg, h.AppState.State())
				h.Recorder.Sync(t)
				require.Len(t, h.Recorder.States(), seen, "the push never reached the controller")
			} else {
				require.Equal(t, bga, during, "the push is handled in BACKGROUNDACTIVE")
				require.Equal(t, bga, h.AppState.State(), "a background task keeps sending")
				h.Controller.BackgroundTaskExpired(func() {})
				require.Equal(t, bg, h.AppState.State(), "the background task held the app, not the push window")
			}

			h.Controller.UIActive()
			ran := false
			require.NoError(t, runPushWindow(h.Controller, platform.String(), pendingDeliveryDeps(), func(uiActive bool) error {
				require.Equal(t, platform == lifecycletest.Android, uiActive, "only Android's work asks")
				ran = true
				return nil
			}))
			require.True(t, ran, "the work runs while the UI is active")
			require.Equal(t, fg, h.AppState.State())
		})
	}
}

type recordingPusher struct {
	PushNotifier
	displayed []string
}

func (p *recordingPusher) DisplayChatNotification(n *ChatNotification) {
	p.displayed = append(p.displayed, n.ConvID)
}

func TestBackgroundNotificationActiveSkipsDisplayButAcks(t *testing.T) {
	for _, goos := range []string{"android", "ios"} {
		t.Run(goos, func(t *testing.T) {
			pusher := &recordingPusher{}
			acks := 0
			ack := func() { acks++ }
			show := func(convID string, uiActive bool) bool {
				return displayOnce(convID+"||1", &ChatNotification{ConvID: convID}, pusher, goos, uiActive, ack)
			}
			// The seen cache is global, so each run needs its own push ids.
			run := fmt.Sprintf("%s/%d/", t.Name(), time.Now().UnixNano())
			active := run + "active"
			require.False(t, show(active, true))
			if goos == "android" {
				require.Empty(t, pusher.displayed, "the app already shows the message")
			} else {
				require.Equal(t, []string{active}, pusher.displayed,
					"iOS displays to remove the server's generic notification; the local one never shows while active")
			}
			require.Equal(t, 1, acks, "the push is acked so the server's fallback doesn't show it")
			displayed := len(pusher.displayed)

			require.True(t, show(active, false), "a push handled while active isn't shown later")
			require.Len(t, pusher.displayed, displayed)
			require.Equal(t, 2, acks)

			background := run + "background"
			require.False(t, show(background, false))
			require.Equal(t, background, pusher.displayed[len(pusher.displayed)-1])
			require.Len(t, pusher.displayed, displayed+1)
			require.Equal(t, 3, acks)
		})
	}
}
