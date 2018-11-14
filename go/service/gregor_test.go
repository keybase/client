package service

import (
	"crypto/rand"
	"errors"
	"fmt"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/badges"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/gregor"
	grclient "github.com/keybase/client/go/gregor/client"
	"github.com/keybase/client/go/gregor/storage"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func broadcastMessageTesting(t *testing.T, h *gregorHandler, m gregor1.Message) error {
	require.NoError(t, h.BroadcastMessage(context.TODO(), m))
	select {
	case err := <-h.testingEvents.broadcastSentCh:
		return err
	case <-time.After(20 * time.Second):
		require.Fail(t, "broadcast didn't complete")
	}
	return nil
}

func TestGregorHandler(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()

	tc.G.SetService()

	listener := newNlistener(t)
	tc.G.NotifyRouter.SetListener(listener)

	user, err := kbtest.CreateAndSignupFakeUser("gregr", tc.G)
	require.NoError(t, err)

	var h *gregorHandler
	h = newGregorHandler(globals.NewContext(tc.G, &globals.ChatContext{}))
	h.Init()
	h.testingEvents = newTestingEvents()
	require.Equal(t, "gregor", h.HandlerName(), "wrong name")

	kbUID := user.User.GetUID()
	gUID := gregor1.UID(kbUID.ToBytes())

	h.PushHandler(newKBFSFavoritesHandler(tc.G))

	m := gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					Uid_:   gUID,
					MsgID_: newMsgID(),
				},
				Creation_: &gregor1.Item{
					Category_: "kbfs.favorites",
					Body_:     gregor1.Body(`{"action": "delete", "tlf":"/private/t_alice,t_bob"}`),
				},
			},
		},
	}

	broadcastMessageTesting(t, h, m)
	require.Equal(t, 1, len(listener.favoritesChanged), "num faves failure")
	require.Equal(t, kbUID, listener.favoritesChanged[0], "wrong uid")
}

type nlistener struct {
	libkb.NoopNotifyListener
	t                *testing.T
	favoritesChanged []keybase1.UID
	badgeState       chan keybase1.BadgeState
	threadStale      chan []chat1.ConversationStaleUpdate
	testChanTimeout  time.Duration
}

var _ libkb.NotifyListener = (*nlistener)(nil)

func newNlistener(t *testing.T) *nlistener {
	return &nlistener{
		t:               t,
		badgeState:      make(chan keybase1.BadgeState, 1),
		threadStale:     make(chan []chat1.ConversationStaleUpdate, 1),
		testChanTimeout: 20 * time.Second,
	}
}

func (n *nlistener) FavoritesChanged(uid keybase1.UID) {
	n.favoritesChanged = append(n.favoritesChanged, uid)
}
func (n *nlistener) ChatThreadsStale(uid keybase1.UID, cids []chat1.ConversationStaleUpdate) {
	select {
	case n.threadStale <- cids:
	case <-time.After(n.testChanTimeout):
		require.Fail(n.t, "thread send timeout")
	}
}
func (n *nlistener) BadgeState(badgeState keybase1.BadgeState) {
	select {
	case n.badgeState <- badgeState:
	case <-time.After(n.testChanTimeout):
		require.Fail(n.t, "badgestate not read")
	}
}

func (n *nlistener) getBadgeState(t *testing.T) keybase1.BadgeState {
	select {
	case x := <-n.badgeState:
		return x
	case <-time.After(n.testChanTimeout):
		require.Fail(t, "badgestate not received")
		return keybase1.BadgeState{}
	}
}

type showTrackerPopupIdentifyUI struct {
	kbtest.FakeIdentifyUI
	startCh   chan string
	dismissCh chan string
}

func newShowTrackerPopupIdentifyUI() *showTrackerPopupIdentifyUI {
	return &showTrackerPopupIdentifyUI{
		startCh:   make(chan string, 1),
		dismissCh: make(chan string, 1),
	}
}

var _ libkb.IdentifyUI = (*showTrackerPopupIdentifyUI)(nil)

func (ui *showTrackerPopupIdentifyUI) Start(name string, reason keybase1.IdentifyReason, force bool) error {
	ui.startCh <- name
	return nil
}

// Overriding the Dismiss method lets us test that it gets called.
func (ui *showTrackerPopupIdentifyUI) Dismiss(username string, _ keybase1.DismissReason) error {
	ui.dismissCh <- username
	return nil
}

// Test that when we inject a gregor "show_tracker_popup" message containing a
// given UID into a gregorHandler, the result is that a TrackEngine gets run
// for that user.
func TestShowTrackerPopupMessage(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()

	tc.G.SetService()

	identifyUI := newShowTrackerPopupIdentifyUI()
	router := fakeUIRouter{
		secretUI:   &libkb.TestSecretUI{},
		identifyUI: identifyUI,
	}
	tc.G.SetUIRouter(&router)

	idhandler := NewIdentifyUIHandler(tc.G, 0)
	idhandler.toggleAlwaysAlive(true)

	trackee, err := kbtest.CreateAndSignupFakeUser("gregr", tc.G)
	require.NoError(t, err)

	// Create another test user to actually perform the track, because we can't track ourselves.
	tracker, err := kbtest.CreateAndSignupFakeUser("gregr", tc.G)
	require.NoError(t, err)

	var h *gregorHandler
	h = newGregorHandler(globals.NewContext(tc.G, &globals.ChatContext{}))
	h.Init()
	h.testingEvents = newTestingEvents()

	h.PushHandler(idhandler)

	msgID := gregor1.MsgID("my_random_id")
	m := gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					MsgID_: msgID,
					Uid_:   gregor1.UID(tracker.User.GetUID().ToBytes()),
				},
				Creation_: &gregor1.Item{
					Category_: gregor1.Category("show_tracker_popup"),
					Body_:     gregor1.Body(fmt.Sprintf(`{"uid": "%s"}`, trackee.User.GetUID())),
				},
			},
		},
	}

	broadcastMessageTesting(t, h, m)
	select {
	case name := <-identifyUI.startCh:
		require.Equal(t, trackee.Username, name, "wrong username")
	case <-time.After(20 * time.Second):
		require.Fail(t, "no start username")
	}
	select {
	case <-identifyUI.dismissCh:
		require.Fail(t, "no dismiss should have happened")
	default:
	}

	msgIDDis := gregor1.MsgID("my_random_id_dis")
	dismissal := gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					MsgID_: msgIDDis,
					Uid_:   gregor1.UID(tracker.User.GetUID().ToBytes()),
				},
				Dismissal_: &gregor1.Dismissal{
					MsgIDs_: []gregor1.MsgID{msgID},
				},
			},
		},
	}
	broadcastMessageTesting(t, h, dismissal)
	select {
	case name := <-identifyUI.dismissCh:
		require.Equal(t, trackee.User.GetName(), name, "wrong dismiss")
	case <-time.After(20 * time.Second):
		require.Fail(t, "no dismiss username")
	}
}

func newMsgID() gregor1.MsgID {
	ret := make([]byte, 16)
	rand.Read(ret)
	return ret
}

type mockGregord struct {
	sm  gregor.StateMachine
	fc  clockwork.FakeClock
	log logger.Logger
}

func (m mockGregord) SyncAll(ctx context.Context, arg chat1.SyncAllArg) (res chat1.SyncAllResult, err error) {
	sres, err := m.Sync(ctx, gregor1.SyncArg{
		Uid:      arg.Uid,
		Deviceid: arg.DeviceID,
		Ctime:    arg.Ctime,
	})
	if err != nil {
		return res, err
	}

	res.Notification = chat1.NewSyncAllNotificationResWithIncremental(sres)
	return res, nil
}

func (m mockGregord) Sync(ctx context.Context, arg gregor1.SyncArg) (gregor1.SyncResult, error) {
	var res gregor1.SyncResult
	msgs, err := m.sm.InBandMessagesSince(ctx, arg.UID(), arg.DeviceID(), arg.CTime())
	if err != nil {
		return res, err
	}
	state, err := m.sm.State(ctx, arg.UID(), arg.DeviceID(), nil)
	if err != nil {
		return res, err
	}
	hash, err := state.Hash()
	if err != nil {
		return res, err
	}
	for _, msg := range msgs {
		if msg, ok := msg.(gregor1.InBandMessage); ok {
			res.Msgs = append(res.Msgs, msg)
		} else {
			m.log.Warning("Bad cast in serveSync (type=%T): %+v", msg)
		}
	}
	res.Hash = hash
	return res, nil
}

func (m mockGregord) ConsumeMessage(ctx context.Context, msg gregor1.Message) error {
	m.log.Debug("mockGregord: ConsumeMessage: msgID: %s Ctime: %s", msg.ToInBandMessage().Metadata().MsgID(),
		msg.ToInBandMessage().Metadata().CTime())
	_, err := m.sm.ConsumeMessage(ctx, msg)
	return err
}

func (m mockGregord) ConsumeMessageMulti(ctx context.Context, arg gregor1.ConsumeMessageMultiArg) error {
	return errors.New("unimplemented")
}

func (m mockGregord) ConsumePublishMessage(_ context.Context, _ gregor1.Message) error {
	return errors.New("unimplemented")
}
func (m mockGregord) Ping(_ context.Context) (string, error) {
	return "pong", nil
}
func (m mockGregord) State(ctx context.Context, arg gregor1.StateArg) (gregor1.State, error) {
	state, err := m.sm.State(ctx, arg.Uid, arg.Deviceid, arg.TimeOrOffset)
	if err != nil {
		return gregor1.State{}, err
	}
	return state.(gregor1.State), nil
}
func (m mockGregord) StateByCategoryPrefix(_ context.Context, _ gregor1.StateByCategoryPrefixArg) (gregor1.State, error) {
	return gregor1.State{}, errors.New("unimplemented")
}
func (m mockGregord) Version(_ context.Context, _ gregor1.UID) (string, error) {
	return "mock", nil
}
func (m mockGregord) DescribeConnectedUsers(ctx context.Context, arg []gregor1.UID) ([]gregor1.ConnectedUser, error) {
	return nil, nil
}
func (m mockGregord) DescribeConnectedUsersInternal(ctx context.Context, arg []gregor1.UID) ([]gregor1.ConnectedUser, error) {
	return nil, nil
}

func (m mockGregord) newIbm(uid gregor1.UID) gregor1.Message {
	m.fc.Advance(time.Minute)
	return gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					Uid_:   uid,
					MsgID_: newMsgID(),
					Ctime_: gregor1.ToTime(m.fc.Now()),
				},
				Creation_: &gregor1.Item{
					Category_: "unknown!",
					Body_:     gregor1.Body([]byte("HIHIHI")),
				},
			},
		},
	}
}

func (m mockGregord) newIbm2(uid gregor1.UID, category gregor1.Category, body gregor1.Body) gregor1.Message {
	m.fc.Advance(time.Minute)
	return gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					Uid_:   uid,
					MsgID_: newMsgID(),
					Ctime_: gregor1.ToTime(m.fc.Now()),
				},
				Creation_: &gregor1.Item{
					Category_: category,
					Body_:     body,
				},
			},
		},
	}
}

func (m mockGregord) newDismissal(uid gregor1.UID, msg gregor.Message) gregor.Message {
	m.fc.Advance(time.Minute)
	dismissalID := msg.ToInBandMessage().Metadata().MsgID().(gregor1.MsgID)
	return gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					Uid_:   uid,
					MsgID_: newMsgID(),
					Ctime_: gregor1.ToTime(m.fc.Now()),
				},
				Dismissal_: &gregor1.Dismissal{
					MsgIDs_: []gregor1.MsgID{dismissalID},
				},
			},
		},
	}
}

func newGregordMock(logger logger.Logger) mockGregord {
	var of gregor1.ObjFactory
	fc := clockwork.NewFakeClock()

	sm := storage.NewMemEngine(of, fc, logger)

	return mockGregord{sm: sm, fc: fc, log: logger}
}

func setupSyncTests(t *testing.T, tc libkb.TestContext) (*gregorHandler, mockGregord, gregor1.UID) {
	var err error
	user, err := kbtest.CreateAndSignupFakeUser("gregr", tc.G)
	if err != nil {
		t.Fatal(err)
	}
	uid := gregor1.UID(user.User.GetUID().ToBytes())

	var h *gregorHandler
	h = newGregorHandler(globals.NewContext(tc.G, &globals.ChatContext{}))
	h.Init()
	h.testingEvents = newTestingEvents()

	server := newGregordMock(tc.G.Log)

	return h, server, uid
}

func checkMessages(t *testing.T, source string, msgs []gregor.InBandMessage,
	refMsgs []gregor.InBandMessage) {
	require.Len(t, msgs, len(refMsgs))
	for index, refMsg := range refMsgs {
		msg := msgs[index]
		msgID := msg.Metadata().MsgID()
		refMsgID := refMsg.Metadata().MsgID()
		require.Equal(t, refMsgID.Bytes(), msgID.Bytes())
	}
}

func doServerSync(t *testing.T, h *gregorHandler, srv mockGregord) ([]gregor.InBandMessage, []gregor.InBandMessage) {
	_, token, _, _ := h.loggedIn(context.TODO())
	pctime := h.gregorCli.StateMachineLatestCTime(context.TODO())
	ctime := gregor1.Time(0)
	if pctime != nil {
		ctime = gregor1.ToTime(*pctime)
	}
	sres, err := srv.SyncAll(context.TODO(), chat1.SyncAllArg{
		Uid:      h.gregorCli.User.(gregor1.UID),
		DeviceID: h.gregorCli.Device.(gregor1.DeviceID),
		Session:  gregor1.SessionToken(token),
		Ctime:    ctime,
	})
	require.NoError(t, err)
	c, err := h.serverSync(context.TODO(), srv, h.gregorCli, &sres.Notification)
	require.NoError(t, err)
	require.NotNil(t, h.testingEvents)
	select {
	case r := <-h.testingEvents.replayThreadCh:
		require.NoError(t, r.err)
		return r.replayed, c
	case <-time.After(20 * time.Second):
		require.Fail(t, "no replay event received")
		return nil, nil
	}
}

func TestSyncFresh(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 20
	var refMsgs []gregor.InBandMessage
	for i := 0; i < numMsgs; i++ {
		msg := server.newIbm(uid)
		refMsgs = append(refMsgs, msg.ToInBandMessage())
		server.ConsumeMessage(context.TODO(), msg)
	}

	// Sync messages down and see if we get 20
	replayedMessages, consumedMessages := doServerSync(t, h, server)
	checkMessages(t, "replayed messages", replayedMessages, refMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refMsgs)
}

func TestSyncNonFresh(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 6
	const msgLimit = numMsgs / 2
	var refMsgs []gregor.InBandMessage
	for i := 0; i < numMsgs; i++ {
		msg := server.newIbm(uid)
		server.ConsumeMessage(context.TODO(), msg)
		if i < msgLimit {
			broadcastMessageTesting(t, h, msg)
			// We end up picking up the last one in the sync, since its
			// CTime is equal to when we start the sync, so just add it
			if i == msgLimit-1 {
				refMsgs = append(refMsgs, msg.ToInBandMessage())
			}
		} else {
			refMsgs = append(refMsgs, msg.ToInBandMessage())
		}
	}

	// Turn off fresh replay
	h.firstConnect = false

	// We should only get half of the messages on a non-fresh sync
	replayedMessages, consumedMessages := doServerSync(t, h, server)
	checkMessages(t, "replayed messages", replayedMessages, refMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refMsgs)
}

func TestSyncSaveRestoreFresh(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 6
	const msgLimit = numMsgs / 2
	var refReplayMsgs, refConsumeMsgs []gregor.InBandMessage
	for i := 0; i < numMsgs; i++ {
		msg := server.newIbm(uid)
		server.ConsumeMessage(context.TODO(), msg)
		if i < msgLimit {
			broadcastMessageTesting(t, h, msg)
			// We end up picking up the last one in the sync, since its
			// CTime is equal to when we start the sync, so just add it
			if i == msgLimit-1 {
				refConsumeMsgs = append(refConsumeMsgs, msg.ToInBandMessage())
			}
		} else {
			refConsumeMsgs = append(refConsumeMsgs, msg.ToInBandMessage())
		}
		refReplayMsgs = append(refReplayMsgs, msg.ToInBandMessage())
	}

	// Try saving
	var err error
	if err = h.gregorCli.Save(context.TODO()); err != nil {
		t.Fatal(err)
	}

	// Create a new gregor handler, this will restore our saved state
	h = newGregorHandler(globals.NewContext(tc.G, &globals.ChatContext{}))
	h.testingEvents = newTestingEvents()
	h.Init()

	// Sync from the server
	replayedMessages, consumedMessages := doServerSync(t, h, server)
	checkMessages(t, "replayed messages", replayedMessages, refReplayMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refConsumeMsgs)
}

func TestSyncSaveRestoreNonFresh(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 6
	const msgLimit = numMsgs / 2
	var refReplayMsgs, refConsumeMsgs []gregor.InBandMessage
	for i := 0; i < numMsgs; i++ {
		msg := server.newIbm(uid)
		server.ConsumeMessage(context.TODO(), msg)
		if i < msgLimit {
			broadcastMessageTesting(t, h, msg)
			// We end up picking up the last one in the sync, since its
			// CTime is equal to when we start the sync, so just add it
			if i == msgLimit-1 {
				refConsumeMsgs = append(refConsumeMsgs, msg.ToInBandMessage())
				refReplayMsgs = append(refReplayMsgs, msg.ToInBandMessage())
			}
		} else {
			refConsumeMsgs = append(refConsumeMsgs, msg.ToInBandMessage())
			refReplayMsgs = append(refReplayMsgs, msg.ToInBandMessage())
		}
	}

	// Try saving
	var err error
	if err = h.gregorCli.Save(context.TODO()); err != nil {
		t.Fatal(err)
	}

	// Create a new gregor handler, this will restore our saved state
	h = newGregorHandler(globals.NewContext(tc.G, nil))
	h.testingEvents = newTestingEvents()
	h.Init()

	// Turn off fresh replay
	h.firstConnect = false

	// Sync from the server
	replayedMessages, consumedMessages := doServerSync(t, h, server)
	checkMessages(t, "replayed messages", replayedMessages, refReplayMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refConsumeMsgs)
}

func TestSyncDismissal(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()

	// Consume msg
	msg := server.newIbm(uid)
	server.ConsumeMessage(context.TODO(), msg)

	// Dismiss message
	dismissal := server.newDismissal(uid, msg)
	server.ConsumeMessage(context.TODO(), dismissal.(gregor1.Message))

	// Sync from the server
	replayedMessages, consumedMessages := doServerSync(t, h, server)
	var refReplayMsgs, refConsumeMsgs []gregor.InBandMessage
	checkMessages(t, "replayed messages", replayedMessages, refReplayMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refConsumeMsgs)
}

type dummyRemoteClient struct {
	chat1.RemoteClient
}

func (d dummyRemoteClient) GetUnreadUpdateFull(ctx context.Context, vers chat1.InboxVers) (chat1.UnreadUpdateFull, error) {
	return chat1.UnreadUpdateFull{}, nil
}

func TestGregorBadgesIBM(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()
	listener := newNlistener(t)
	tc.G.NotifyRouter.SetListener(listener)

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()
	h.badger = badges.NewBadger(tc.G)
	t.Logf("client setup complete")

	t.Logf("server message")
	// One with type: created
	msg := server.newIbm2(uid, gregor1.Category("tlf"), gregor1.Body([]byte(`{"type": "created"}`)))
	require.NoError(t, server.ConsumeMessage(context.TODO(), msg))
	// One with some other random type.
	msg = server.newIbm2(uid, gregor1.Category("tlf"), gregor1.Body([]byte(`{"type": "bogusnogus"}`)))
	require.NoError(t, server.ConsumeMessage(context.TODO(), msg))

	// Sync from the server
	t.Logf("client sync")
	_, err := h.serverSync(context.TODO(), server, h.gregorCli, nil)
	require.NoError(t, err)
	t.Logf("client sync complete")

	ri := func() chat1.RemoteInterface {
		return dummyRemoteClient{RemoteClient: chat1.RemoteClient{Cli: h.cli}}
	}
	require.NoError(t, h.badger.Resync(context.TODO(), ri, h.gregorCli, nil))

	bs := listener.getBadgeState(t)
	require.Equal(t, 1, bs.NewTlfs, "one new tlf")

	t.Logf("server dismissal")
	_ = server.newDismissal(uid, msg)
	require.NoError(t, server.ConsumeMessage(context.TODO(), msg))

	t.Logf("client sync")
	_, err = h.serverSync(context.TODO(), server, h.gregorCli, nil)
	require.NoError(t, err)
	t.Logf("client sync complete")

	require.NoError(t, h.badger.Resync(context.TODO(), ri, h.gregorCli, nil))

	bs = listener.getBadgeState(t)
	require.Equal(t, 1, bs.NewTlfs, "no more badges")
}

func TestGregorTeamBadges(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()
	listener := newNlistener(t)
	tc.G.NotifyRouter.SetListener(listener)

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()
	h.badger = badges.NewBadger(tc.G)
	t.Logf("client setup complete")

	t.Logf("server message")
	teamID := keybase1.MakeTestTeamID(1, false)
	fakeUID := keybase1.MakeTestUID(1)
	msg := server.newIbm2(uid, gregor1.Category("team.newly_added_to_team"), gregor1.Body([]byte(`[{"id": "`+teamID+`","name": "teamname"}]`)))
	require.NoError(t, server.ConsumeMessage(context.TODO(), msg))
	msg = server.newIbm2(uid, gregor1.Category("team.request_access"), gregor1.Body([]byte(`[{"id": "`+teamID+`","name": "teamname"}]`)))
	require.NoError(t, server.ConsumeMessage(context.TODO(), msg))
	msg = server.newIbm2(uid, gregor1.Category("team.member_out_from_reset"), gregor1.Body([]byte(`{"reset_user": {"uid":"`+fakeUID.String()+`","username":"alice"},"team_name": "teamname"}`)))
	require.NoError(t, server.ConsumeMessage(context.TODO(), msg))

	// Sync from the server
	t.Logf("client sync")
	_, err := h.serverSync(context.TODO(), server, h.gregorCli, nil)
	require.NoError(t, err)
	t.Logf("client sync complete")

	ri := func() chat1.RemoteInterface {
		return dummyRemoteClient{RemoteClient: chat1.RemoteClient{Cli: h.cli}}
	}
	require.NoError(t, h.badger.Resync(context.TODO(), ri, h.gregorCli, nil))

	bs := listener.getBadgeState(t)
	require.Equal(t, 1, len(bs.NewTeamNames), "one new team name")
	require.Equal(t, "teamname", bs.NewTeamNames[0])
	require.Equal(t, 1, len(bs.NewTeamAccessRequests), "one team access request")
	require.Equal(t, "teamname", bs.NewTeamAccessRequests[0])
	require.Equal(t, 1, len(bs.TeamsWithResetUsers), "one team member out due to reset")
	require.Equal(t, "teamname", bs.TeamsWithResetUsers[0].Teamname)
	require.Equal(t, "alice", bs.TeamsWithResetUsers[0].Username)
	require.Equal(t, msg.ToInBandMessage().Metadata().MsgID(), bs.TeamsWithResetUsers[0].Id)
}

// TestGregorBadgesOOBM doesn't actually use out of band messages.
// Instead it feeds chat updates directly to badger. So it's a pretty weak test.
func TestGregorBadgesOOBM(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()
	listener := newNlistener(t)
	tc.G.NotifyRouter.SetListener(listener)

	// Set up client and server
	h, _, _ := setupSyncTests(t, tc)
	defer h.Shutdown()
	h.badger = badges.NewBadger(tc.G)
	t.Logf("client setup complete")

	t.Logf("sending first chat update")
	h.badger.PushChatUpdate(context.TODO(), chat1.UnreadUpdate{
		ConvID:         chat1.ConversationID(`a`),
		UnreadMessages: 2,
	}, 0)
	_ = listener.getBadgeState(t)

	t.Logf("sending second chat update")
	h.badger.PushChatUpdate(context.TODO(), chat1.UnreadUpdate{
		ConvID:         chat1.ConversationID(`b`),
		UnreadMessages: 2,
	}, 1)

	bs := listener.getBadgeState(t)
	require.Equal(t, 2, badgeStateStats(bs).UnreadChatConversations, "unread chat convs")
	require.Equal(t, 4, badgeStateStats(bs).UnreadChatMessages, "unread chat messages")

	t.Logf("resyncing")
	// Instead of calling badger.Resync, reach in and twiddle the knobs.
	h.badger.State().UpdateWithChatFull(context.TODO(), chat1.UnreadUpdateFull{
		InboxVers: chat1.InboxVers(4),
		Updates: []chat1.UnreadUpdate{
			{ConvID: chat1.ConversationID(`b`), UnreadMessages: 0},
			{ConvID: chat1.ConversationID(`c`), UnreadMessages: 3},
		},
		InboxSyncStatus: chat1.SyncInboxResType_CLEAR,
	})
	h.badger.Send(context.TODO())
	bs = listener.getBadgeState(t)
	require.Equal(t, 1, badgeStateStats(bs).UnreadChatConversations, "unread chat convs")
	require.Equal(t, 3, badgeStateStats(bs).UnreadChatMessages, "unread chat messages")

	t.Logf("clearing")
	h.badger.Clear(context.TODO())
	bs = listener.getBadgeState(t)
	require.Equal(t, 0, badgeStateStats(bs).UnreadChatConversations, "unread chat convs")
	require.Equal(t, 0, badgeStateStats(bs).UnreadChatMessages, "unread chat messages")
}

func TestSyncDismissalExistingState(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()

	var refReplayMsgs, refConsumeMsgs []gregor.InBandMessage

	// Consume msg
	msg := server.newIbm(uid)
	server.ConsumeMessage(context.TODO(), msg)

	// Broadcast msg
	broadcastMessageTesting(t, h, msg)

	// Consume another message but don't broadcast
	msg2 := server.newIbm(uid)
	server.ConsumeMessage(context.TODO(), msg2)
	refConsumeMsgs = append(refConsumeMsgs, msg2.ToInBandMessage())
	refReplayMsgs = append(refReplayMsgs, msg2.ToInBandMessage())

	// Dismiss message
	dismissal := server.newDismissal(uid, msg)
	server.ConsumeMessage(context.TODO(), dismissal.(gregor1.Message))
	refReplayMsgs = append(refReplayMsgs, dismissal.ToInBandMessage())
	refConsumeMsgs = append(refConsumeMsgs, dismissal.ToInBandMessage())

	// Sync from the server
	h.firstConnect = false
	replayedMessages, consumedMessages := doServerSync(t, h, server)
	checkMessages(t, "replayed messages", replayedMessages, refReplayMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refConsumeMsgs)
}

func TestSyncFutureDismissals(t *testing.T) {

	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()

	var refReplayMsgs, refConsumeMsgs []gregor.InBandMessage

	// Consume msg
	msg := server.newIbm(uid)
	server.ConsumeMessage(context.TODO(), msg)
	refConsumeMsgs = append(refConsumeMsgs, msg.ToInBandMessage())
	refReplayMsgs = append(refReplayMsgs, msg.ToInBandMessage())

	// Broadcast msg
	broadcastMessageTesting(t, h, msg)

	// Consume another message but don't broadcast
	msg2 := server.newIbm(uid)
	server.ConsumeMessage(context.TODO(), msg2)

	// Dismiss message
	dismissal := server.newDismissal(uid, msg2)
	server.ConsumeMessage(context.TODO(), dismissal.(gregor1.Message))

	// Sync from the server
	h.firstConnect = false
	replayedMessages, consumedMessages := doServerSync(t, h, server)
	checkMessages(t, "replayed messages", replayedMessages, refReplayMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refConsumeMsgs)
}

func TestBroadcastRepeat(t *testing.T) {

	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()

	tc.G.SetService()

	_, err := kbtest.CreateAndSignupFakeUser("gregr", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	var h *gregorHandler
	h = newGregorHandler(globals.NewContext(tc.G, nil))
	h.Init()
	h.testingEvents = newTestingEvents()

	m, err := h.templateMessage()
	if err != nil {
		t.Fatal(err)
	}
	m.Ibm_.StateUpdate_.Creation_ = &gregor1.Item{
		Category_: gregor1.Category("mike"),
		Body_:     gregor1.Body([]byte("mike")),
	}

	m2, err := h.templateMessage()
	if err != nil {
		t.Fatal(err)
	}
	m2.Ibm_.StateUpdate_.Creation_ = &gregor1.Item{
		Category_: gregor1.Category("mike!!"),
		Body_:     gregor1.Body([]byte("mike!!")),
	}

	broadcastMessageTesting(t, h, *m)
	broadcastMessageTesting(t, h, *m2)
	err = broadcastMessageTesting(t, h, *m)
	require.Error(t, err)
	require.Equal(t, "ignored repeat message", err.Error())
}

type BadgeStateStats struct {
	UnreadChatConversations int
	UnreadChatMessages      int
}

func badgeStateStats(bs keybase1.BadgeState) (res BadgeStateStats) {
	for _, c := range bs.Conversations {
		res.UnreadChatMessages += c.UnreadMessages
		if c.UnreadMessages > 0 {
			res.UnreadChatConversations++
		}
	}
	return
}

func TestLocalDismissals(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()

	var refReplayMsgs []gregor.InBandMessage
	var refConsumeMsgs []gregor.InBandMessage
	msg := server.newIbm(uid)
	require.NoError(t, server.ConsumeMessage(context.TODO(), msg))
	refConsumeMsgs = append(refConsumeMsgs, msg.ToInBandMessage())
	refReplayMsgs = append(refReplayMsgs, msg.ToInBandMessage())

	lmsg := server.newIbm(uid)
	require.NoError(t, server.ConsumeMessage(context.TODO(), lmsg))
	refConsumeMsgs = append(refConsumeMsgs, lmsg.ToInBandMessage())

	require.NoError(t, h.LocalDismissItem(context.TODO(), lmsg.ToInBandMessage().Metadata().MsgID()))

	replayedMessages, consumedMessages := doServerSync(t, h, server)
	checkMessages(t, "replayed messages", replayedMessages, refReplayMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refConsumeMsgs)

	dis := server.newDismissal(uid, lmsg)
	require.NoError(t, server.ConsumeMessage(context.TODO(), dis.(gregor1.Message)))
	require.NoError(t, broadcastMessageTesting(t, h, dis.(gregor1.Message)))

	gcli, err := h.getGregorCli()
	require.NoError(t, err)
	lds, err := gcli.Sm.LocalDismissals(context.TODO(), uid)
	require.NoError(t, err)
	require.Zero(t, len(lds))
}

type flakeyIncomingClient struct {
	gregor1.IncomingInterface

	offline bool
	client  func() gregor1.IncomingInterface
}

func newFlakeyIncomingClient(client func() gregor1.IncomingInterface) flakeyIncomingClient {
	return flakeyIncomingClient{
		client: client,
	}
}

func (f flakeyIncomingClient) ConsumeMessage(ctx context.Context, m gregor1.Message) error {
	if f.offline {
		return errors.New("offline")
	}
	return f.client().ConsumeMessage(ctx, m)
}

func TestOfflineConsume(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()
	h, server, uid := setupSyncTests(t, tc)
	defer h.Shutdown()

	fclient := newFlakeyIncomingClient(func() gregor1.IncomingInterface { return server })
	fc := clockwork.NewFakeClock()
	client := grclient.NewClient(uid, nil, func() gregor.StateMachine {
		return storage.NewMemEngine(gregor1.ObjFactory{}, clockwork.NewRealClock(), tc.G.GetLog())
	}, storage.NewLocalDB(tc.G), func() gregor1.IncomingInterface { return fclient }, tc.G.GetLog(), fc)
	tev := grclient.NewTestingEvents()
	client.TestingEvents = tev
	h.gregorCli = client

	// Try to consume offline
	t.Logf("offline")
	fclient.offline = true
	msg := server.newIbm(uid)
	require.NoError(t, client.ConsumeMessage(context.TODO(), msg))
	serverState, err := server.State(context.TODO(), gregor1.StateArg{
		Uid: uid,
	})
	require.NoError(t, err)
	require.Zero(t, len(serverState.Items_))
	clientState, err := client.StateMachineState(context.TODO(), gregor1.TimeOrOffset{}, true)
	require.NoError(t, err)
	items, err := clientState.Items()
	require.NoError(t, err)
	require.Equal(t, 1, len(items))
	require.Equal(t, msg.ToInBandMessage().Metadata().MsgID().String(),
		items[0].Metadata().MsgID().String())
	select {
	case <-tev.OutboxSend:
		require.Fail(t, "should not have sent")
	default:
	}

	// Come back online
	t.Logf("online")
	fclient.offline = false
	fc.Advance(10 * time.Minute)
	select {
	case msg := <-tev.OutboxSend:
		require.Equal(t, msg.ToInBandMessage().Metadata().MsgID().String(),
			items[0].Metadata().MsgID().String())
	case <-time.After(20 * time.Second):
		require.Fail(t, "no send")
	}
	serverState, err = server.State(context.TODO(), gregor1.StateArg{
		Uid: uid,
	})
	require.NoError(t, err)
	require.NoError(t, broadcastMessageTesting(t, h, msg))
	require.Equal(t, 1, len(serverState.Items_))
	require.Equal(t, msg.ToInBandMessage().Metadata().MsgID().String(),
		serverState.Items_[0].Metadata().MsgID().String())
	clientState, err = client.StateMachineState(context.TODO(), gregor1.TimeOrOffset{}, true)
	require.NoError(t, err)
	items, err = clientState.Items()
	require.NoError(t, err)
	require.Equal(t, 1, len(items))
	require.Equal(t, msg.ToInBandMessage().Metadata().MsgID().String(),
		items[0].Metadata().MsgID().String())

}
