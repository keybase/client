package service

import (
	"errors"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/jonboulle/clockwork"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/gregor"
	"github.com/keybase/gregor/protocol/gregor1"
	grpc "github.com/keybase/gregor/rpc"
	"github.com/keybase/gregor/storage"
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

func (n *nlistener) Logout()                                           {}
func (n *nlistener) Login(username string)                             {}
func (n *nlistener) ClientOutOfDate(to, uri, msg string)               {}
func (n *nlistener) UserChanged(uid keybase1.UID)                      {}
func (n *nlistener) TrackingChanged(uid keybase1.UID, username string) {}
func (n *nlistener) FSActivity(activity keybase1.FSNotification)       {}
func (n *nlistener) FavoritesChanged(uid keybase1.UID) {
	n.favoritesChanged = append(n.favoritesChanged, uid)
}

type showTrackerPopupIdentifyUI struct {
	kbtest.FakeIdentifyUI
	startedUsername   string
	dismissedUsername string
}

var _ libkb.IdentifyUI = (*showTrackerPopupIdentifyUI)(nil)

func (ui *showTrackerPopupIdentifyUI) Start(name string, reason keybase1.IdentifyReason) {
	ui.startedUsername = name
}

// Overriding the Dismiss method lets us test that it gets called.
func (ui *showTrackerPopupIdentifyUI) Dismiss(username string, _ keybase1.DismissReason) {
	ui.dismissedUsername = username
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
	const mlen = 20
	var letters = []byte("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
	var res = make([]byte, mlen)
	for i := 0; i < mlen; i++ {
		res[i] = letters[rand.Intn(len(letters))]
	}
	return res
}

type mockGregord struct {
	sm  gregor.StateMachine
	fc  clockwork.FakeClock
	log logger.Logger
}

func (m mockGregord) Sync(_ context.Context, arg gregor1.SyncArg) (gregor1.SyncResult, error) {
	return grpc.Sync(m.sm, rpc.SimpleLogOutput{}, arg)
}
func (m mockGregord) ConsumeMessage(_ context.Context, msg gregor1.Message) error {
	m.log.Debug("CONSUME")
	_, err := m.sm.ConsumeMessage(msg)
	return err
}
func (m mockGregord) ConsumePublishMessage(_ context.Context, _ gregor1.Message) error {
	return errors.New("unimplemented")
}
func (m mockGregord) Ping(_ context.Context) (string, error) {
	return "pong", nil
}

func (m mockGregord) newIbm(uid gregor1.UID, msgid gregor1.MsgID) gregor1.Message {
	m.fc.Advance(time.Minute)
	return gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
				Md_: gregor1.Metadata{
					Uid_:   uid,
					MsgID_: msgid,
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

func newGregordMock(logger logger.Logger) mockGregord {
	var of gregor1.ObjFactory
	fc := clockwork.NewFakeClock()

	sm := storage.NewMemEngine(of, fc)

	return mockGregord{sm: sm, fc: fc, log: logger}
}

func TestSyncBasic(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor")
	defer tc.Cleanup()

	tc.G.SetService()

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

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 20
	for i := 0; i < numMsgs; i++ {
		msgid := newMsgID()
		msg := server.newIbm(uid, msgid)
		server.ConsumeMessage(context.TODO(), msg)
	}

	// Sync messages down and see if we get 20
	var syncedMsgs int
	if syncedMsgs, err = h.reSync(context.TODO(), server); err != nil {
		t.Fatal(err)
	}

	if syncedMsgs != numMsgs {
		t.Fatalf("synced messages does not equal consumed, %d != %d", syncedMsgs, numMsgs)
	}
}

func TestSyncBroadcast(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor")
	defer tc.Cleanup()

	tc.G.SetService()

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

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 6
	for i := 0; i < numMsgs; i++ {
		msgid := newMsgID()
		msg := server.newIbm(uid, msgid)
		server.ConsumeMessage(context.TODO(), msg)
		if i < numMsgs/2 {
			h.BroadcastMessage(context.TODO(), msg)
		}
	}

	// Turn off fresh sync
	h.freshSync = false

	// Sync messages down and see if we get 20
	var syncedMsgs int
	if syncedMsgs, err = h.reSync(context.TODO(), server); err != nil {
		t.Fatal(err)
	}

	if syncedMsgs != numMsgs/2+1 {
		t.Fatalf("syncMsgs should be half of numMsgs, %d, %d", syncedMsgs, numMsgs/2+1)
	}
}

func TestSyncSaveRestore(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor")
	defer tc.Cleanup()

	tc.G.SetService()

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

	//Consume a bunch of messages to the server, and we'll sync them down
	const numMsgs = 6
	for i := 0; i < numMsgs; i++ {
		msgid := newMsgID()
		msg := server.newIbm(uid, msgid)
		server.ConsumeMessage(context.TODO(), msg)
		if i < numMsgs/2 {
			h.BroadcastMessage(context.TODO(), msg)
		}
	}

	// Try saving
	if err := h.gregorCli.Save(); err != nil {
		t.Fatal(err)
	}

	// Create a new gregor handler, this will restore our saved state
	if h, err = newGregorHandler(tc.G); err != nil {
		t.Fatal(err)
	}

	var state gregor.State
	if state, err = h.gregorCli.StateMachineState(nil); err != nil {
		t.Fatal(err)
	}

	items, err := state.Items()
	if err != nil {
		t.Fatal(err)
	}

	if len(items) != numMsgs/2 {
		t.Fatalf("restore brought back the wrong number of items: %d != %d",
			len(items), numMsgs/2)
	}

	// Sync from the server
	var syncedMsgs int
	if syncedMsgs, err = h.reSync(context.TODO(), server); err != nil {
		t.Fatal(err)
	}

	if state, err = h.gregorCli.StateMachineState(nil); err != nil {
		t.Fatal(err)
	}

	items, err = state.Items()
	if err != nil {
		t.Fatal(err)
	}

	if len(items) != numMsgs {
		t.Fatal("wrong number of items after sync, %d != %d", len(items), numMsgs)
	}

	if syncedMsgs != numMsgs {
		t.Fatal("wrong number of items synced from server, %d != %d", syncedMsgs, numMsgs)
	}
}
