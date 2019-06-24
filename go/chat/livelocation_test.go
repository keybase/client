package chat

import (
	"context"
	"net/url"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/commands"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/maps"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
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
	globals.Contextified
	types.Unfurler
	t        *testing.T
	unfurlCh chan types.LiveLocationKey
}

func newMockUnfurler(g *globals.Context, t *testing.T) *mockUnfurler {
	return &mockUnfurler{
		Contextified: globals.NewContextified(g),
		t:            t,
		unfurlCh:     make(chan types.LiveLocationKey, 10),
	}
}

func (m *mockUnfurler) Prefetch(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgText string) int {
	return 0
}

func (m *mockUnfurler) UnfurlAndSend(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msg chat1.MessageUnboxed) {
	require.True(m.t, msg.IsValid())
	body := msg.Valid().MessageBody
	require.True(m.t, body.IsType(chat1.MessageType_TEXT))
	mapurl := body.Text().Body
	u, err := url.Parse(mapurl)
	require.NoError(m.t, err)
	livekey := u.Query().Get("livekey")
	if len(livekey) > 0 {
		m.unfurlCh <- types.LiveLocationKey(livekey)
		outboxID := storage.GetOutboxIDFromURL(mapurl, convID, msg)
		mvalid := msg.Valid()
		mvalid.ClientHeader.OutboxID = &outboxID
		notMsg := chat1.NewMessageUnboxedWithValid(mvalid)
		activity := chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
			Message: utils.PresentMessageUnboxed(ctx, m.G(), notMsg, uid, convID),
			ConvID:  convID,
		})
		m.G().NotifyRouter.HandleNewChatActivity(ctx, keybase1.UID(uid.String()), chat1.TopicType_CHAT,
			&activity, chat1.ChatActivitySource_LOCAL)
	}
}

func TestChatSrvLiveLocation(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestChatSrvLiveLocation", 1)
	defer ctc.cleanup()

	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	chatUI := newMockChatUI()
	clock := clockwork.NewFakeClock()
	tc.G.UIRouter = kbtest.NewMockUIRouter(chatUI)
	timeout := 2 * time.Second

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)

	unfurler := newMockUnfurler(tc.Context(), t)
	tc.ChatG.Unfurler = unfurler
	livelocation := maps.NewLiveLocationTracker(tc.Context())
	livelocation.SetClock(clock)
	tc.ChatG.LiveLocationTracker = livelocation
	tc.ChatG.CommandsSource.(*commands.Source).SetClock(clock)

	checkCoords := func(coords []chat1.Coordinate) {
		select {
		case key := <-unfurler.unfurlCh:
			require.Equal(t, coords, livelocation.GetCoordinates(context.TODO(), key))
		case <-time.After(timeout):
			require.Fail(t, "no map unfurl")
		}
	}
	var allCoords []chat1.Coordinate
	updateCoords := func(coords []chat1.Coordinate) {
		for _, c := range coords {
			livelocation.LocationUpdate(context.TODO(), c)
			allCoords = append(allCoords, c)
		}
	}

	// Start up a live location session
	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/location live 1h",
	}))
	select {
	case <-chatUI.watchCh:
	case <-time.After(timeout):
		require.Fail(t, "no watch position call")
	}
	// First update always comes through
	coords := []chat1.Coordinate{chat1.Coordinate{
		Lat: 40.800348,
		Lon: -73.968784,
	}}
	updateCoords(coords)
	checkCoords(coords)

	// Throw some updates in
	coords = []chat1.Coordinate{
		chat1.Coordinate{
			Lat: 40.798688,
			Lon: -73.973716,
		},
		chat1.Coordinate{
			Lat: 40.795234,
			Lon: -73.976237,
		},
	}
	updateCoords(coords)
	// no new map yet
	select {
	case <-unfurler.unfurlCh:
		require.Fail(t, "should not have updated yet")
	default:
	}
	// advance clock to get a new map
	clock.Advance(time.Minute)
	checkCoords(allCoords)

	// make sure we clear after finishing
	clock.Advance(2 * time.Hour)
	select {
	case <-chatUI.clearCh:
	case <-time.After(timeout):
		require.Fail(t, "no clear call")
	}
}
