// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func runUntrack(g *libkb.GlobalContext, fu *FakeUser, username string) error {
	arg := UntrackEngineArg{
		Username: libkb.NewNormalizedUsername(username),
	}
	ctx := Context{
		LogUI:    g.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewUntrackEngine(&arg, g)
	return RunEngine(eng, &ctx)
}

func assertUntracked(tc libkb.TestContext, username string) {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		tc.T.Fatal(err)
	}
	them, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(tc.G, username))
	if err != nil {
		tc.T.Fatal(err)
	}

	s, err := me.TrackChainLinkFor(them.GetNormalizedName(), them.GetUID())
	if err != nil {
		tc.T.Fatal(err)
	}
	if s != nil {
		tc.T.Fatal("expected not to get a tracking statement; but got one")
	}

	s, err = libkb.LocalTrackChainLinkFor(me.GetUID(), them.GetUID(), tc.G)
	if err != nil {
		tc.T.Fatal(err)
	}
	if s != nil {
		tc.T.Fatal("expected not to get a local tracking statement; but got one")
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
	assertTracking(tc, "t_alice")
	untrackAlice(tc, fu)
	assertUntracked(tc, "t_alice")

	// Remote-tracked only.
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: false, BypassConfirm: true}, fu.NewSecretUI())
	untrackAlice(tc, fu)
	assertUntracked(tc, "t_alice")

	// Both local- and remote-tracked.
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: true, BypassConfirm: true}, fu.NewSecretUI())
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: false, BypassConfirm: true}, fu.NewSecretUI())
	untrackAlice(tc, fu)
	assertUntracked(tc, "t_alice")

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
	assertUntracked(tc, "t_alice")
}
