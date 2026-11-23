package service

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
)

func gregorStateOf(items ...gregor1.Item) gregor1.State {
	var s gregor1.State
	for i := range items {
		s.Items_ = append(s.Items_, gregor1.ItemAndMetadata{Item_: &items[i]})
	}
	return s
}

func gregorItem(category, body string) gregor1.Item {
	return gregor1.Item{Category_: gregor1.Category(category), Body_: gregor1.Body(body)}
}

func TestBuildGregorUIPrefs(t *testing.T) {
	empty := buildGregorUIPrefs(gregor1.State{})
	require.True(t, empty.AllowAnimatedEmojis)
	require.Empty(t, empty.PinnedConvs)

	prefs := buildGregorUIPrefs(gregorStateOf(
		gregorItem("chatPinnedConvs", `["c1","","c2","c1"]`),
		gregorItem("chatPinnedConvsOther", `["nope"]`),
		gregorItem("exploding:c1", "300"),
		gregorItem("exploding:c2", "garbage"),
		gregorItem("chosenChannelsForTeam", `["team1",2,"team2","team1"]`),
		gregorItem("blockButtons.t1", `{"adder":"testuser"}`),
		gregorItem("blockButtons.t2", `{"adder":3}`),
		gregorItem("blockButtons.t3", `not json`),
		gregorItem("team.request_access:a", `{"id":"t1","username":"testuser-mac"}`),
		gregorItem("team.request_access:b", `{"id":"t1","username":"testuser"}`),
		gregorItem("team.request_access:c", `{"id":"t1","username":"testuser"}`),
		gregorItem("team.request_access:d", `{"id":"t2"}`),
		gregorItem("emojianimations", "\x01"),
		gregorItem("unrelated", "x"),
	))
	require.Equal(t, keybase1.GregorUIPrefs{
		PinnedConvs:             []string{"c1", "c2"},
		ExplodingModes:          map[string]int{"c1": 300},
		ChosenChannelsTeamnames: []string{"team1", "team2"},
		BlockButtonsAdders:      map[string]string{"t1": "testuser"},
		TeamAccessRequests:      map[string][]string{"t1": {"testuser", "testuser-mac"}},
		AllowAnimatedEmojis:     false,
	}, prefs)
}

// recordingCli is the transport edge to the GUI: it records each notification sent on it.
type recordingCli struct {
	mu   sync.Mutex
	sent []keybase1.GregorUIPrefs
}

func (c *recordingCli) Call(context.Context, string, any, any, time.Duration) error { return nil }

func (c *recordingCli) CallCompressed(context.Context, string, any, any, rpc.CompressionType, time.Duration) error {
	return nil
}

func (c *recordingCli) Notify(_ context.Context, method string, arg any, _ time.Duration) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if method == "keybase.1.gregorUI.pushUIPrefs" {
		c.sent = append(c.sent, arg.([]any)[0].(keybase1.PushUIPrefsArg).Prefs)
	}
	return nil
}

func TestGregorUIPrefsHandlerSendsOnChange(t *testing.T) {
	tc := libkb.SetupTest(t, "gregoruiprefs", 1)
	defer tc.Cleanup()
	cli := &recordingCli{}
	h := &gregorUIPrefsHandler{Contextified: libkb.NewContextified(tc.G), cli: keybase1.GregorUIClient{Cli: cli}}

	pinned := gregorStateOf(gregorItem("chatPinnedConvs", `["c1"]`))
	h.PushState(pinned, keybase1.PushReason_RECONNECTED)
	require.Len(t, cli.sent, 1)
	require.Equal(t, []string{"c1"}, cli.sent[0].PinnedConvs)

	// an unrelated item changes the state but not the prefs
	h.PushState(gregorStateOf(gregorItem("chatPinnedConvs", `["c1"]`), gregorItem("unrelated", "x")),
		keybase1.PushReason_NEW_DATA)
	require.Len(t, cli.sent, 1)

	h.PushState(gregor1.State{}, keybase1.PushReason_NEW_DATA)
	require.Len(t, cli.sent, 2)
	require.Empty(t, cli.sent[1].PinnedConvs)

	// the GUI cleared its copy on logout, so a reconnect resends even unchanged prefs
	h.PushState(gregor1.State{}, keybase1.PushReason_RECONNECTED)
	require.Len(t, cli.sent, 3)
}

type layoutRecorder struct {
	types.DummyUIInboxLoader
	mu      sync.Mutex
	updates int
}

func (l *layoutRecorder) UpdateLayout(context.Context, chat1.InboxLayoutReselectMode, string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.updates++
}

func (l *layoutRecorder) count() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.updates
}

// A pin change that arrives in a connect-time sync rebuilds the layout, including a
// dismissal, which the state machine consumes before the in-band replay could see it.
func TestGregorSyncedPinChangesUpdateLayout(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	tc.G.SetService()
	layout := &layoutRecorder{}
	g.UIInboxLoader = layout

	uid := gregor1.UID(newMsgID())
	h := newGregorHandler(g)
	h.Init()
	h.testingEvents = newTestingEvents()
	defer h.Shutdown(context.Background())
	_, err := h.resetGregorClient(context.TODO(), uid, gregor1.DeviceID{})
	require.NoError(t, err)
	server := newGregordMock(g.ExternalG().Log)

	sync := func() {
		ctime := gregor1.Time(0)
		if pctime := h.gregorCli.StateMachineLatestCTime(context.TODO()); pctime != nil {
			ctime = gregor1.ToTime(*pctime)
		}
		sres, err := server.SyncAll(context.TODO(), chat1.SyncAllArg{Uid: uid, DeviceID: gregor1.DeviceID{}, Ctime: ctime})
		require.NoError(t, err)
		_, err = h.serverSync(context.TODO(), server, h.gregorCli, &sres.Notification)
		require.NoError(t, err)
		select {
		case r := <-h.testingEvents.replayThreadCh:
			require.NoError(t, r.err)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no replay event received")
		}
	}

	pins := server.newIbm2(uid, "chatPinnedConvs", gregor1.Body(`["c1"]`))
	require.NoError(t, server.ConsumeMessage(context.TODO(), pins))
	sync()
	require.Equal(t, 1, layout.count())

	// nothing changed: no rebuild
	sync()
	require.Equal(t, 1, layout.count())

	require.NoError(t, server.ConsumeMessage(context.TODO(), server.newDismissal(uid, pins).(gregor1.Message)))
	sync()
	require.Equal(t, 2, layout.count())
}
