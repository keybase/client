package service

import (
	"testing"

	"golang.org/x/net/context"

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
