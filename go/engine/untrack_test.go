package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func runUntrack(g *libkb.GlobalContext, fu *FakeUser, username string) error {
	arg := UntrackEngineArg{
		Username: username,
	}
	ctx := Context{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewUntrackEngine(&arg, g)
	return RunEngine(eng, &ctx)
}

func assertUntracked(t *testing.T, username string) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}
	them, err := libkb.LoadUser(libkb.LoadUserArg{Name: username})
	if err != nil {
		t.Fatal(err)
	}

	s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		t.Fatal(err)
	}
	if s != nil {
		t.Fatal("expected not to get a tracking statement; but got one")
	}

	s, err = libkb.LocalTrackChainLinkFor(me.GetUID(), them.GetUID())
	if err != nil {
		t.Fatal(err)
	}
	if s != nil {
		t.Fatal("expected not to get a local tracking statement; but got one")
	}
}

func untrackAlice(tc libkb.TestContext, fu *FakeUser) {
	err := runUntrack(tc.G, fu, "t_alice")
	if err != nil {
		tc.T.Fatal(err)
	}
	return
}

func untrackBob(tc libkb.TestContext, fu *FakeUser) {
	err := runUntrack(tc.G, fu, "t_bob")
	if err != nil {
		tc.T.Fatal(err)
	}
	return
}

func TestUntrack(t *testing.T) {
	tc := SetupEngineTest(t, "untrack")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "untrk")

	// Local-tracked only.
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: true, BypassConfirm: true}, fu.NewSecretUI())
	assertTracking(t, "t_alice")
	untrackAlice(tc, fu)
	assertUntracked(t, "t_alice")

	// Remote-tracked only.
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: false, BypassConfirm: true}, fu.NewSecretUI())
	untrackAlice(tc, fu)
	assertUntracked(t, "t_alice")

	// Both local- and remote-tracked.
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: true, BypassConfirm: true}, fu.NewSecretUI())
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: false, BypassConfirm: true}, fu.NewSecretUI())
	untrackAlice(tc, fu)
	assertUntracked(t, "t_alice")

	// Assert that we gracefully handle cases where there is nothing to untrack.
	err := runUntrack(tc.G, fu, "t_alice")
	if err == nil {
		t.Fatal("expected untrack error; got no error")
	} else if _, ok := err.(libkb.UntrackError); !ok {
		t.Fatalf("expected an UntrackError; got %s", err)
	}

	err = runUntrack(tc.G, fu, "t_bob")
	if err == nil {
		t.Fatal("expected untrack error; got no error")
	} else if _, ok := err.(libkb.UntrackError); !ok {
		t.Fatalf("expected an UntrackError; got %s", err)
	}
	return
}

func TestUntrackRemoteOnly(t *testing.T) {
	tc := SetupEngineTest(t, "untrack")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "untrk")

	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: false, BypassConfirm: true}, fu.NewSecretUI())
	untrackAlice(tc, fu)
	assertUntracked(t, "t_alice")
}
