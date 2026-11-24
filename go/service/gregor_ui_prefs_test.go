package service

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
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
	log := logger.NewTestLogger(t)
	empty := buildGregorUIPrefs(context.TODO(), log, gregor1.State{})
	require.True(t, empty.AllowAnimatedEmojis)
	require.Empty(t, empty.PinnedConvs)

	prefs := buildGregorUIPrefs(context.TODO(), log, gregorStateOf(
		gregorItem("chatPinnedConvs", `["c1",7,"","c2","c1"]`),
		gregorItem("chatPinnedConvsOther", `["nope"]`),
		gregorItem("exploding:c1", "300"),
		gregorItem("exploding:c2", "garbage"),
		gregorItem("exploding:c3", " 60s"),
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
		PinnedConvs:              []string{"c1", "c2"},
		ExplodingModes:           map[string]int{"c1": 300, "c3": 60},
		UnreadableExplodingModes: []string{"c2"},
		ChosenChannelsTeamnames:  []string{"team1", "team2"},
		BlockButtonsAdders:       map[string]string{"t1": "testuser"},
		TeamAccessRequests:       map[string][]string{"t1": {"testuser", "testuser-mac"}},
		AllowAnimatedEmojis:      false,
	}, prefs)
}

func TestParseLeadingInt(t *testing.T) {
	for _, c := range []struct {
		in   string
		want int
	}{{"300", 300}, {" 300", 300}, {"300s", 300}, {"30.5", 30}, {"+5", 5}, {"-5", -5}, {"0", 0}} {
		got, ok := parseLeadingInt(c.in)
		require.True(t, ok, c.in)
		require.Equal(t, c.want, got, c.in)
	}
	for _, in := range []string{"", "garbage", "-", "s300", "99999999999999999999"} {
		_, ok := parseLeadingInt(in)
		require.False(t, ok, in)
	}
}

// recordingCli is the transport edge to the GUI: it records each notification sent on it.
type recordingCli struct {
	mu   sync.Mutex
	sent []keybase1.PushUIPrefsArg
}

func (c *recordingCli) Call(context.Context, string, any, any, time.Duration) error { return nil }

func (c *recordingCli) CallCompressed(context.Context, string, any, any, rpc.CompressionType, time.Duration) error {
	return nil
}

func (c *recordingCli) Notify(_ context.Context, method string, arg any, _ time.Duration) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if method == "keybase.1.gregorUI.pushUIPrefs" {
		c.sent = append(c.sent, arg.([]any)[0].(keybase1.PushUIPrefsArg))
	}
	return nil
}

func (c *recordingCli) pinned() [][]string {
	c.mu.Lock()
	defer c.mu.Unlock()
	var res [][]string
	for _, a := range c.sent {
		res = append(res, a.Prefs.PinnedConvs)
	}
	return res
}

func newTestGregorUIPrefsHandler(g *libkb.GlobalContext) (*gregorUIPrefsHandler, *recordingCli) {
	cli := &recordingCli{}
	return &gregorUIPrefsHandler{Contextified: libkb.NewContextified(g), cli: keybase1.GregorUIClient{Cli: cli}}, cli
}

func TestGregorUIPrefsHandlerSendsOnChange(t *testing.T) {
	tc := libkb.SetupTest(t, "gregoruiprefs", 1)
	defer tc.Cleanup()
	h, cli := newTestGregorUIPrefsHandler(tc.G)
	gh := &gregorHandler{}
	var seq uint64
	push := func(s gregor1.State, r keybase1.PushReason) {
		seq++
		h.pushStateRead(s, r, gregorStateRead{gh: gh, seq: seq})
	}

	push(gregorStateOf(gregorItem("chatPinnedConvs", `["c1"]`)), keybase1.PushReason_RECONNECTED)
	require.Equal(t, [][]string{{"c1"}}, cli.pinned())

	// an unrelated item changes the state but not the prefs
	push(gregorStateOf(gregorItem("chatPinnedConvs", `["c1"]`), gregorItem("unrelated", "x")),
		keybase1.PushReason_NEW_DATA)
	require.Len(t, cli.pinned(), 1)

	push(gregor1.State{}, keybase1.PushReason_NEW_DATA)
	require.Equal(t, [][]string{{"c1"}, {}}, cli.pinned())

	// the GUI cleared its copy on logout, so a reconnect resends even unchanged prefs
	push(gregor1.State{}, keybase1.PushReason_RECONNECTED)
	require.Len(t, cli.pinned(), 3)
}

// setupLocalGregor gives a gregor handler whose client state is changed directly, with no server.
func setupLocalGregor(t *testing.T) (libkb.TestContext, *gregorHandler, gregor1.UID, func(cat, body string)) {
	tc, g := setupGregorTest(t)
	uid := gregor1.UID(newMsgID())
	h := newGregorHandler(g)
	h.Init()
	t.Cleanup(func() { h.Shutdown(context.Background()) })
	_, err := h.resetGregorClient(context.TODO(), uid, gregor1.DeviceID{})
	require.NoError(t, err)
	msgs := newGregordMock(g.ExternalG().Log)
	last := map[string]gregor1.Message{}
	set := func(cat, body string) {
		if prev, ok := last[cat]; ok {
			dismissal := msgs.newDismissal(uid, prev).(gregor1.Message)
			require.NoError(t, h.gregorCli.StateMachineConsumeMessage(context.TODO(), dismissal))
		}
		m := msgs.newIbm2(uid, gregor1.Category(cat), gregor1.Body(body))
		require.NoError(t, h.gregorCli.StateMachineConsumeMessage(context.TODO(), m))
		last[cat] = m
	}
	return tc, h, uid, set
}

// Two pushes read the state in one order and can reach the handler in the other: the older read
// must not overwrite the newer prefs.
func TestGregorUIPrefsPushesKeepReadOrder(t *testing.T) {
	tc, gh, uid, set := setupLocalGregor(t)
	defer tc.Cleanup()
	h, cli := newTestGregorUIPrefsHandler(tc.G)

	set("chatPinnedConvs", `["c1"]`)
	older, olderRead, err := gh.readStateForPush(context.TODO())
	require.NoError(t, err)
	set("chatPinnedConvs", `["c2"]`)
	newer, newerRead, err := gh.readStateForPush(context.TODO())
	require.NoError(t, err)

	h.pushStateRead(newer, keybase1.PushReason_NEW_DATA, newerRead)
	h.pushStateRead(older, keybase1.PushReason_NEW_DATA, olderRead)
	require.Equal(t, [][]string{{"c2"}}, cli.pinned())
	require.Equal(t, keybase1.UID(uid.String()), cli.sent[0].Uid)
}

// A push read before logout must not reach the GUI or the layout after it.
func TestGregorReadsFromEndedSessionAreDropped(t *testing.T) {
	tc, gh, _, set := setupLocalGregor(t)
	defer tc.Cleanup()
	h, cli := newTestGregorUIPrefsHandler(tc.G)
	layout := &layoutRecorder{shown: true}
	gh.G().UIInboxLoader = layout

	set("chatPinnedConvs", `["c1"]`)
	s, read, err := gh.readStateForPush(context.TODO())
	require.NoError(t, err)
	require.NoError(t, gh.Reset())

	h.pushStateRead(s, keybase1.PushReason_NEW_DATA, read)
	gh.updateLayoutOnPinsChange(context.TODO(), s, read)
	require.Empty(t, cli.pinned())
	require.Equal(t, 0, layout.count())
	require.Nil(t, gh.lastPins)
}

type layoutRecorder struct {
	types.DummyUIInboxLoader
	mu      sync.Mutex
	shown   bool
	updates int
}

func (l *layoutRecorder) UpdateShownLayout(context.Context, chat1.InboxLayoutReselectMode, string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if !l.shown {
		return false
	}
	l.updates++
	return true
}

func (l *layoutRecorder) setShown(shown bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.shown = shown
}

func (l *layoutRecorder) count() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.updates
}

// No layout is rebuilt before one is shown, and the pins only count as applied once a rebuild
// was queued, so the first push after the layout is shown still catches a change.
func TestGregorPinChangesWaitForAShownLayout(t *testing.T) {
	tc, gh, _, set := setupLocalGregor(t)
	defer tc.Cleanup()
	layout := &layoutRecorder{}
	gh.G().UIInboxLoader = layout
	push := func() {
		s, read, err := gh.readStateForPush(context.TODO())
		require.NoError(t, err)
		gh.updateLayoutOnPinsChange(context.TODO(), s, read)
	}

	set("chatPinnedConvs", `["c1"]`)
	push()
	require.Equal(t, 0, layout.count())

	layout.setShown(true)
	push()
	require.Equal(t, 1, layout.count())
	push()
	require.Equal(t, 1, layout.count())

	// an older read arriving late doesn't count as a change back
	set("chatPinnedConvs", `["c2"]`)
	olderS, olderRead, err := gh.readStateForPush(context.TODO())
	require.NoError(t, err)
	set("chatPinnedConvs", `["c3"]`)
	push()
	require.Equal(t, 2, layout.count())
	gh.updateLayoutOnPinsChange(context.TODO(), olderS, olderRead)
	require.Equal(t, 2, layout.count())
	require.Equal(t, []chat1.ConvIDStr{"c3"}, gh.lastPins)
}

// A pin change that arrives in a connect-time sync rebuilds the layout, including a
// dismissal, which the state machine consumes before the in-band replay could see it.
func TestGregorSyncedPinChangesUpdateLayout(t *testing.T) {
	tc, g := setupGregorTest(t)
	defer tc.Cleanup()
	tc.G.SetService()
	layout := &layoutRecorder{shown: true}
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
