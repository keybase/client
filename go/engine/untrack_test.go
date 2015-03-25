package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func runUntrack(fu *FakeUser, username string) (err error) {
	arg := UntrackEngineArg{
		TheirName: username,
	}
	ctx := Context{
		LogUI:    G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewUntrackEngine(&arg)
	err = RunEngine(eng, &ctx)
	return
}

func assertUntracked(t *testing.T, fu *FakeUser, theirName string) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}
	them, err := libkb.LoadUser(libkb.LoadUserArg{Name: theirName})
	if err != nil {
		t.Fatal(err)
	}

	s, err := me.GetTrackingStatementFor(them.GetName(), them.GetUid())
	if err != nil {
		t.Fatal(err)
	}
	if s != nil {
		t.Fatal("expected not to get a tracking statement; but got one")
	}

	s, err = libkb.GetLocalTrack(me.GetUid(), them.GetUid())
	if err != nil {
		t.Fatal(err)
	}
	if s != nil {
		t.Fatal("expected not to get a local tracking statement; but got one")
	}
}

func untrackAlice(t *testing.T, fu *FakeUser) {
	err := runUntrack(fu, "t_alice")
	if err != nil {
		t.Fatal(err)
	}
	return
}

func TestUntrack(t *testing.T) {
	tc := SetupEngineTest(t, "untrack")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(t, "untrk")

	// Local-tracked only.
	trackAliceWithOptions(t, fu, TrackOptions{TrackLocalOnly: true})
	assertTracked(t, fu, "t_alice")
	untrackAlice(t, fu)
	assertUntracked(t, fu, "t_alice")

	// Remote-tracked only.
	trackAliceWithOptions(t, fu, TrackOptions{TrackLocalOnly: false})
	untrackAlice(t, fu)
	assertUntracked(t, fu, "t_alice")

	// Both local- and remote-tracked.
	trackAliceWithOptions(t, fu, TrackOptions{TrackLocalOnly: true})
	trackAliceWithOptions(t, fu, TrackOptions{TrackLocalOnly: false})
	untrackAlice(t, fu)
	assertUntracked(t, fu, "t_alice")

	// Assert that we gracefully handle cases where there is nothing to untrack.
	err := runUntrack(fu, "t_alice")
	if err == nil {
		t.Fatal("expected untrack error; got no error")
	} else if _, ok := err.(libkb.UntrackError); !ok {
		t.Fatalf("expected an UntrackError; got %s", err.Error())
	}

	err = runUntrack(fu, "t_bob")
	if err == nil {
		t.Fatal("expected untrack error; got no error")
	} else if _, ok := err.(libkb.UntrackError); !ok {
		t.Fatalf("expected an UntrackError; got %s", err.Error())
	}
	return
}
