package service

import (
	"fmt"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/gregor/protocol/gregor1"
)

func TestGregorHandler(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor")
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
	tc := libkb.SetupTest(t, "gregor")
	defer tc.Cleanup()

	tc.G.SetService()

	identifyUI := &showTrackerPopupIdentifyUI{}
	router := fakeUIRouter{
		secretUI:   &libkb.TestSecretUI{},
		identifyUI: identifyUI,
	}
	tc.G.SetUIRouter(&router)

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
