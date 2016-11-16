package service

import (
	"bytes"
	"crypto/rand"
	"errors"
	"fmt"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/jonboulle/clockwork"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/gregor/storage"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func TestGregorHandler(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()

	tc.G.SetService()

	listener := &nlistener{}
	tc.G.NotifyRouter.SetListener(listener)

	user, err := kbtest.CreateAndSignupFakeUser("gregr", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	var h *gregorHandler
	if h, err = newGregorHandler(tc.G); err != nil {
		t.Fatal(err)
	}
	if h.HandlerName() != "keybase service" {
		t.Errorf("handler name: %q, expected \"keybase service\"", h.HandlerName())
	}

	kbUID := user.User.GetUID()
	gUID := gregor1.UID(kbUID.ToBytes())

	m := gregor1.Message{
		Oobm_: &gregor1.OutOfBandMessage{
			Uid_:    gUID,
			System_: "kbfs.favorites",
			Body_:   gregor1.Body(`{"action": "delete", "tlf":"/private/t_alice,t_bob"}`),
		},
	}
	if err := h.BroadcastMessage(context.Background(), m); err != nil {
		t.Fatal(err)
	}

	if len(listener.favoritesChanged) != 1 {
		t.Fatalf("num favorites changed uids: %d, expected 1", len(listener.favoritesChanged))
	}
	if listener.favoritesChanged[0].NotEqual(kbUID) {
		t.Errorf("fav change uid: %v, expected %v", listener.favoritesChanged[0], kbUID)
	}
}

type nlistener struct {
	favoritesChanged []keybase1.UID
}

var _ libkb.NotifyListener = (*nlistener)(nil)

func (n *nlistener) Logout()                                                      {}
func (n *nlistener) Login(username string)                                        {}
func (n *nlistener) ClientOutOfDate(to, uri, msg string)                          {}
func (n *nlistener) UserChanged(uid keybase1.UID)                                 {}
func (n *nlistener) TrackingChanged(uid keybase1.UID, username string)            {}
func (n *nlistener) FSActivity(activity keybase1.FSNotification)                  {}
func (n *nlistener) FSEditListResponse(arg keybase1.FSEditListArg)                {}
func (n *nlistener) FSEditListRequest(arg keybase1.FSEditListRequest)             {}
func (n *nlistener) PaperKeyCached(uid keybase1.UID, encKID, sigKID keybase1.KID) {}
func (n *nlistener) FavoritesChanged(uid keybase1.UID) {
	n.favoritesChanged = append(n.favoritesChanged, uid)
}
func (n *nlistener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity) {}
func (n *nlistener) KeyfamilyChanged(uid keybase1.UID)                             {}
func (n *nlistener) PGPKeyInSecretStoreFile()                                      {}
func (n *nlistener) FSSyncStatusResponse(arg keybase1.FSSyncStatusArg)             {}
func (n *nlistener) FSSyncEvent(arg keybase1.FSPathSyncStatus)                     {}
func (n *nlistener) BadgeState(badgeState keybase1.BadgeState)                     {}

type showTrackerPopupIdentifyUI struct {
	kbtest.FakeIdentifyUI
	startedUsername   string
	dismissedUsername string
}

var _ libkb.IdentifyUI = (*showTrackerPopupIdentifyUI)(nil)

func (ui *showTrackerPopupIdentifyUI) Start(name string, reason keybase1.IdentifyReason, force bool) error {
	ui.startedUsername = name
	return nil
}

// Overriding the Dismiss method lets us test that it gets called.
func (ui *showTrackerPopupIdentifyUI) Dismiss(username string, _ keybase1.DismissReason) error {
	ui.dismissedUsername = username
	return nil
}

// Test that when we inject a gregor "show_tracker_popup" message containing a
// given UID into a gregorHandler, the result is that a TrackEngine gets run
// for that user.
func TestShowTrackerPopupMessage(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()

	tc.G.SetService()

	identifyUI := &showTrackerPopupIdentifyUI{}
	router := fakeUIRouter{
		secretUI:   &libkb.TestSecretUI{},
		identifyUI: identifyUI,
	}
	tc.G.SetUIRouter(&router)

	idhandler := NewIdentifyUIHandler(tc.G, 0)
	idhandler.toggleAlwaysAlive(true)

	trackee, err := kbtest.CreateAndSignupFakeUser("gregr", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	// Create another test user to actually perform the track, because we can't track ourselves.
	tracker, err := kbtest.CreateAndSignupFakeUser("gregr", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	var h *gregorHandler
	if h, err = newGregorHandler(tc.G); err != nil {
		t.Fatal(err)
	}

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

	err = h.BroadcastMessage(context.Background(), m)
	if err != nil {
		t.Fatal(err)
	}

	if identifyUI.startedUsername != trackee.Username {
		t.Fatalf("Expected test user %#v to be tracked. Saw %#v. Did the track not happen?", trackee.Username, identifyUI.startedUsername)
	}

	// Assert that the tracker window hasn't been dismissed yet.
	if identifyUI.dismissedUsername != "" {
		t.Fatal("Expected no dismissed username yet.")
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
	err = h.BroadcastMessage(context.Background(), dismissal)
	if err != nil {
		t.Fatal(err)
	}

	// Now assert that the tracker window has been dismissed.
	if identifyUI.dismissedUsername != trackee.User.GetName() {
		t.Fatalf("Expected the tracker window for UID %s to be dismissed. current value: %s", trackee.User.GetUID().String(), identifyUI.dismissedUsername)
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

func (m mockGregord) Sync(_ context.Context, arg gregor1.SyncArg) (gregor1.SyncResult, error) {
	var res gregor1.SyncResult
	msgs, err := m.sm.InBandMessagesSince(arg.UID(), arg.DeviceID(), arg.CTime())
	if err != nil {
		return res, err
	}
	state, err := m.sm.State(arg.UID(), arg.DeviceID(), nil)
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

func (m mockGregord) ConsumeMessage(_ context.Context, msg gregor1.Message) error {
	m.log.Debug("mockGregord: ConsumeMessage: msgID: %s Ctime: %s", msg.ToInBandMessage().Metadata().MsgID(),
		msg.ToInBandMessage().Metadata().CTime())
	_, err := m.sm.ConsumeMessage(msg)
	return err
}
func (m mockGregord) ConsumePublishMessage(_ context.Context, _ gregor1.Message) error {
	return errors.New("unimplemented")
}
func (m mockGregord) Ping(_ context.Context) (string, error) {
	return "pong", nil
}
func (m mockGregord) State(_ context.Context, arg gregor1.StateArg) (gregor1.State, error) {
	state, err := m.sm.State(arg.Uid, arg.Deviceid, arg.TimeOrOffset)
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

func (m mockGregord) newDismissal(uid gregor1.UID, msg gregor1.Message) gregor1.Message {
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

	sm := storage.NewMemEngine(of, fc)

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
	if h, err = newGregorHandler(tc.G); err != nil {
		t.Fatal(err)
	}

	server := newGregordMock(tc.G.Log)

	return h, server, uid
}

func checkMessages(t *testing.T, source string, msgs []gregor.InBandMessage,
	refMsgs []gregor.InBandMessage) {

	if len(msgs) != len(refMsgs) {
		for _, m := range msgs {
			t.Logf("msgID: %s", m.Metadata().MsgID().String())
		}
		t.Fatalf("messages lists unequal size, %d != %d, source: %s", len(msgs), len(refMsgs), source)
	}

	for index, refMsg := range refMsgs {
		msg := msgs[index]
		msgID := msg.Metadata().MsgID()
		refMsgID := refMsg.Metadata().MsgID()

		if !bytes.Equal(msgID.Bytes(), refMsgID.Bytes()) {
			t.Fatalf("message IDs do not match, %s != %s, source: %s", msgID, refMsgID, source)
		}
	}
}

func TestSyncFresh(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 20
	var refMsgs []gregor.InBandMessage
	for i := 0; i < numMsgs; i++ {
		msg := server.newIbm(uid)
		refMsgs = append(refMsgs, msg.ToInBandMessage())
		server.ConsumeMessage(context.TODO(), msg)
	}

	// Sync messages down and see if we get 20
	replayedMessages, consumedMessages, err := h.serverSync(context.TODO(), server)
	if err != nil {
		t.Fatal(err)
	}

	checkMessages(t, "replayed messages", replayedMessages, refMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refMsgs)
}

func TestSyncNonFresh(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 6
	const msgLimit = numMsgs / 2
	var refMsgs []gregor.InBandMessage
	for i := 0; i < numMsgs; i++ {
		msg := server.newIbm(uid)
		server.ConsumeMessage(context.TODO(), msg)
		if i < msgLimit {
			h.BroadcastMessage(context.TODO(), msg)
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
	h.freshReplay = false

	// We should only get half of the messages on a non-fresh sync
	replayedMessages, consumedMessages, err := h.serverSync(context.TODO(), server)
	if err != nil {
		t.Fatal(err)
	}

	checkMessages(t, "replayed messages", replayedMessages, refMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refMsgs)
}

func TestSyncSaveRestoreFresh(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 6
	const msgLimit = numMsgs / 2
	var refReplayMsgs, refConsumeMsgs []gregor.InBandMessage
	for i := 0; i < numMsgs; i++ {
		msg := server.newIbm(uid)
		server.ConsumeMessage(context.TODO(), msg)
		if i < msgLimit {
			h.BroadcastMessage(context.TODO(), msg)
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
	if err = h.gregorCli.Save(); err != nil {
		t.Fatal(err)
	}

	// Create a new gregor handler, this will restore our saved state
	if h, err = newGregorHandler(tc.G); err != nil {
		t.Fatal(err)
	}

	// Sync from the server
	replayedMessages, consumedMessages, err := h.serverSync(context.TODO(), server)
	if err != nil {
		t.Fatal(err)
	}

	checkMessages(t, "replayed messages", replayedMessages, refReplayMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refConsumeMsgs)
}

func TestSyncSaveRestoreNonFresh(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 6
	const msgLimit = numMsgs / 2
	var refReplayMsgs, refConsumeMsgs []gregor.InBandMessage
	for i := 0; i < numMsgs; i++ {
		msg := server.newIbm(uid)
		server.ConsumeMessage(context.TODO(), msg)
		if i < msgLimit {
			h.BroadcastMessage(context.TODO(), msg)
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
	if err = h.gregorCli.Save(); err != nil {
		t.Fatal(err)
	}

	// Create a new gregor handler, this will restore our saved state
	if h, err = newGregorHandler(tc.G); err != nil {
		t.Fatal(err)
	}

	// Turn off fresh replay
	h.freshReplay = false

	// Sync from the server
	replayedMessages, consumedMessages, err := h.serverSync(context.TODO(), server)
	if err != nil {
		t.Fatal(err)
	}

	checkMessages(t, "replayed messages", replayedMessages, refReplayMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refConsumeMsgs)
}

func TestSyncDismissal(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)

	// Consume msg
	msg := server.newIbm(uid)
	server.ConsumeMessage(context.TODO(), msg)

	// Dismiss message
	dismissal := server.newDismissal(uid, msg)
	server.ConsumeMessage(context.TODO(), dismissal)

	// Sync from the server
	replayedMessages, consumedMessages, err := h.serverSync(context.TODO(), server)
	if err != nil {
		t.Fatal(err)
	}

	var refReplayMsgs, refConsumeMsgs []gregor.InBandMessage
	checkMessages(t, "replayed messages", replayedMessages, refReplayMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refConsumeMsgs)
}

func TestSyncDismissalExistingState(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)

	var refReplayMsgs, refConsumeMsgs []gregor.InBandMessage

	// Consume msg
	msg := server.newIbm(uid)
	server.ConsumeMessage(context.TODO(), msg)

	// Broadcast msg
	h.BroadcastMessage(context.TODO(), msg)

	// Consume another message but don't broadcast
	msg2 := server.newIbm(uid)
	server.ConsumeMessage(context.TODO(), msg2)
	refConsumeMsgs = append(refConsumeMsgs, msg2.ToInBandMessage())
	refReplayMsgs = append(refReplayMsgs, msg2.ToInBandMessage())

	// Dismiss message
	dismissal := server.newDismissal(uid, msg)
	server.ConsumeMessage(context.TODO(), dismissal)
	refReplayMsgs = append(refReplayMsgs, dismissal.ToInBandMessage())
	refConsumeMsgs = append(refConsumeMsgs, dismissal.ToInBandMessage())

	// Sync from the server
	h.freshReplay = false
	replayedMessages, consumedMessages, err := h.serverSync(context.TODO(), server)
	if err != nil {
		t.Fatal(err)
	}

	checkMessages(t, "replayed messages", replayedMessages, refReplayMsgs)
	checkMessages(t, "consumed messages", consumedMessages, refConsumeMsgs)
}

func TestSyncFutureDismissals(t *testing.T) {

	tc := libkb.SetupTest(t, "gregor", 2)
	defer tc.Cleanup()
	tc.G.SetService()

	// Set up client and server
	h, server, uid := setupSyncTests(t, tc)

	var refReplayMsgs, refConsumeMsgs []gregor.InBandMessage

	// Consume msg
	msg := server.newIbm(uid)
	server.ConsumeMessage(context.TODO(), msg)
	refConsumeMsgs = append(refConsumeMsgs, msg.ToInBandMessage())
	refReplayMsgs = append(refReplayMsgs, msg.ToInBandMessage())

	// Broadcast msg
	h.BroadcastMessage(context.TODO(), msg)

	// Consume another message but don't broadcast
	msg2 := server.newIbm(uid)
	server.ConsumeMessage(context.TODO(), msg2)

	// Dismiss message
	dismissal := server.newDismissal(uid, msg2)
	server.ConsumeMessage(context.TODO(), dismissal)

	// Sync from the server
	h.freshReplay = false
	replayedMessages, consumedMessages, err := h.serverSync(context.TODO(), server)
	if err != nil {
		t.Fatal(err)
	}

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
	if h, err = newGregorHandler(tc.G); err != nil {
		t.Fatal(err)
	}

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

	if err := h.BroadcastMessage(context.Background(), *m); err != nil {
		t.Fatal(err)
	}

	if err := h.BroadcastMessage(context.Background(), *m2); err != nil {
		t.Fatal(err)
	}

	if err := h.BroadcastMessage(context.Background(), *m); err == nil {
		t.Fatal(err)
	} else {
		errMsg := "ignored repeat message"
		if err.Error() != errMsg {
			t.Fatalf("wrong error message %s != %s", err, errMsg)
		}
	}

}
