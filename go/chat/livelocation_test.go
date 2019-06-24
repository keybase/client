package chat

import (
	"context"
	"net/url"
	"strconv"
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
	unfurlCh chan []chat1.Coordinate
}

func newMockUnfurler(g *globals.Context, t *testing.T) *mockUnfurler {
	return &mockUnfurler{
		Contextified: globals.NewContextified(g),
		t:            t,
		unfurlCh:     make(chan []chat1.Coordinate, 10),
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
	slat := u.Query().Get("lat")
	slon := u.Query().Get("lon")
	shouldNotify := false
	if len(livekey) > 0 {
		shouldNotify = true
		m.unfurlCh <- m.G().LiveLocationTracker.GetCoordinates(ctx, types.LiveLocationKey(livekey))
	} else if len(slat) > 0 {
		shouldNotify = true
		lat, err := strconv.ParseFloat(slat, 64)
		require.NoError(m.t, err)
		lon, err := strconv.ParseFloat(slon, 64)
		require.NoError(m.t, err)
		m.unfurlCh <- []chat1.Coordinate{
			chat1.Coordinate{
				Lat: lat,
				Lon: lon,
			},
		}
	}
	if !shouldNotify {
		return
	}
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

func checkCoords(t *testing.T, unfurler *mockUnfurler, refcoords []chat1.Coordinate, timeout time.Duration) {
	select {
	case coords := <-unfurler.unfurlCh:
		require.Equal(t, refcoords, coords)
	case <-time.After(timeout):
		require.Fail(t, "no map unfurl")
	}
}

func updateCoords(livelocation *maps.LiveLocationTracker, coords []chat1.Coordinate,
	allCoords []chat1.Coordinate) []chat1.Coordinate {
	for _, c := range coords {
		livelocation.LocationUpdate(context.TODO(), c)
		allCoords = append(allCoords, c)
	}
	return allCoords
}

func TestChatSrvLiveLocationCurrent(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestChatSrvLiveLocationCurrent", 1)
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

	mustPostLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "/location",
	}))
	select {
	case <-chatUI.watchCh:
	case <-time.After(timeout):
		require.Fail(t, "no watch position call")
	}

	coords := []chat1.Coordinate{
		chat1.Coordinate{
			Lat: 40.800348,
			Lon: -73.968784,
		},
		chat1.Coordinate{
			Lat: 40.798688,
			Lon: -73.973716,
		},
		chat1.Coordinate{
			Lat: 40.795234,
			Lon: -73.976237,
		},
	}
	updateCoords(livelocation, coords, nil)
	// no new map yet
	select {
	case <-unfurler.unfurlCh:
		require.Fail(t, "should not have updated yet")
	default:
	}
	clock.Advance(10 * time.Second)
	checkCoords(t, unfurler, []chat1.Coordinate{coords[2]}, timeout)
	select {
	case <-chatUI.clearCh:
	case <-time.After(timeout):
		require.Fail(t, "no clear call")
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
	timeout := 20 * time.Second

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)

	unfurler := newMockUnfurler(tc.Context(), t)
	tc.ChatG.Unfurler = unfurler
	livelocation := maps.NewLiveLocationTracker(tc.Context())
	livelocation.SetClock(clock)
	tc.ChatG.LiveLocationTracker = livelocation
	tc.ChatG.CommandsSource.(*commands.Source).SetClock(clock)

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
	var allCoords []chat1.Coordinate
	coords := []chat1.Coordinate{chat1.Coordinate{
		Lat: 40.800348,
		Lon: -73.968784,
	}}
	allCoords = updateCoords(livelocation, coords, allCoords)
	checkCoords(t, unfurler, coords, timeout)

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
	allCoords = updateCoords(livelocation, coords, allCoords)
	// no new map yet
	select {
	case <-unfurler.unfurlCh:
		require.Fail(t, "should not have updated yet")
	default:
	}
	// advance clock to get a new map
	clock.Advance(time.Minute)
	checkCoords(t, unfurler, allCoords, timeout)

	// make sure we clear after finishing
	clock.Advance(2 * time.Hour)
	select {
	case <-chatUI.clearCh:
	case <-time.After(timeout):
		require.Fail(t, "no clear call")
	}
}
