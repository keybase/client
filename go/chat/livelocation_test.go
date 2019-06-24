package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/maps"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

type mockChatUI struct {
	libkb.ChatUI
	watchID chat1.LocationWatchID
	watchCh chan struct{}
	clearCh chan chat1.LocationWatchID
}

func newMockChatUI() *mockChatUI {
	return &mockChatUI{
		watchCh: make(chan struct{}, 10),
		clearCh: make(chan chat1.LocationWatchID, 10),
	}
}

func (m *mockChatUI) ChatWatchPosition(context.Context) (chat1.LocationWatchID, error) {
	m.watchCh <- struct{}{}
	m.watchID++
	return m.watchID, nil
}

func (m *mockChatUI) ChatClearWatch(ctx context.Context, watchID chat1.LocationWatchID) error {
	m.clearCh <- watchID
	return nil
}

type mockUnfurler struct {
	types.DummyUnfurler
}

func (m mockUnfurler) UnfurlAndSend(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msg chat1.MessageUnboxed) {

}

func TestChatSrvLiveLocation(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestChatSrvLiveLocation", 1)
	defer ctc.cleanup()

	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	unfurler := mockUnfurler{}
	chatUI := newMockChatUI()
	clock := clockwork.NewFakeClock()
	tc.G.UIRouter = kbtest.NewMockUIRouter(chatUI)
	tc.ChatG.Unfurler = unfurler
	livelocation := maps.NewLiveLocationTracker(tc.Context())
	livelocation.SetClock(clock)
	tc.ChatG.LiveLocationTracker = livelocation
	timeout := 2 * time.Second

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)

	// Start up a live location session
	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/location live 1h",
	}))
	select {
	case <-chatUI.watchCh:
	case <-time.After(timeout):
		require.Fail(t, "no watch position call")
	}

}
