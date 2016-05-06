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

	h := newGregorHandler(tc.G)
	if h.HandlerName() != "keybase service" {
		t.Errorf("handler name: %q, expected \"keybase service\"", h.HandlerName())
	}

	kbUID := keybase1.MakeTestUID(1)
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

type showTrackerIdentifyUI struct {
	kbtest.FakeIdentifyUI
	confirmedUsername string
}

// Overriding the Confirm method does two things: 1) it lets is unconditionally
// approve the track, so that we don't get a "track not confirmed" error, and
// 2) it lets us check that the track went through by setting the confirmed
// flag on the UI.
func (ui *showTrackerIdentifyUI) Confirm(outcome *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	ui.confirmedUsername = outcome.Username
	result := keybase1.ConfirmResult{
		IdentityConfirmed: true,
		RemoteConfirmed:   true,
	}
	return result, nil
}

// Test that when we inject a gregor "show_tracker_popup" message containing a
// given UID into a gregorHandler, the result is that a TrackEngine gets run
// for that user.
func TestShowTrackerPopupMessage(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor")
	defer tc.Cleanup()

	tc.G.SetService()

	identifyUI := &showTrackerIdentifyUI{}
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
	_, err = kbtest.CreateAndSignupFakeUser("gregr", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	h := newGregorHandler(tc.G)

	m := gregor1.Message{
		Ibm_: &gregor1.InBandMessage{
			StateUpdate_: &gregor1.StateUpdateMessage{
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

	if identifyUI.confirmedUsername != trackee.Username {
		t.Fatalf("Expected test user %#v to be tracked. Saw %#v. Did the track not happen?", trackee.Username, identifyUI.confirmedUsername)
	}
}
