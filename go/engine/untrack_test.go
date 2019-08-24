// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func runUntrack(tc libkb.TestContext, fu *FakeUser, username string, sigVersion libkb.SigVersion) error {
	arg := UntrackEngineArg{
		Username:   libkb.NewNormalizedUsername(username),
		SigVersion: sigVersion,
	}
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewUntrackEngine(tc.G, &arg)
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	return RunEngine2(m, eng)
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

	m := NewMetaContextForTest(tc)
	s, err := me.TrackChainLinkFor(m, them.GetNormalizedName(), them.GetUID())
	if err != nil {
		tc.T.Fatal(err)
	}
	if s != nil {
		tc.T.Fatal("expected not to get a tracking statement; but got one")
	}

	s, err = libkb.LocalTrackChainLinkFor(m, me.GetUID(), them.GetUID())
	if err != nil {
		tc.T.Fatal(err)
	}
	if s != nil {
		tc.T.Fatal("expected not to get a local tracking statement; but got one")
	}
}

func untrackAlice(tc libkb.TestContext, fu *FakeUser, sigVersion libkb.SigVersion) {
	err := runUntrack(tc, fu, "t_alice", sigVersion)
	if err != nil {
		tc.T.Fatal(err)
	}
}

func untrackBob(tc libkb.TestContext, fu *FakeUser, sigVersion libkb.SigVersion) {
	err := runUntrack(tc, fu, "t_bob", sigVersion)
	if err != nil {
		tc.T.Fatal(err)
	}
}

func TestUntrack(t *testing.T) {
	doWithSigChainVersions(func(sigVersion libkb.SigVersion) {
		_testUntrack(t, sigVersion)
	})
}
func _testUntrack(t *testing.T, sigVersion libkb.SigVersion) {
	tc := SetupEngineTest(t, "untrack")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "untrk")

	// Local-tracked only.
	sv := keybase1.SigVersion(sigVersion)
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: true, BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI())
	assertTracking(tc, "t_alice")
	untrackAlice(tc, fu, sigVersion)
	assertUntracked(tc, "t_alice")

	// Remote-tracked only.
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: false, BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI())
	untrackAlice(tc, fu, sigVersion)
	assertUntracked(tc, "t_alice")

	// Both local- and remote-tracked.
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: true, BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI())
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: false, BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI())
	untrackAlice(tc, fu, sigVersion)
	assertUntracked(tc, "t_alice")

	// Assert that we gracefully handle cases where there is nothing to untrack.
	err := runUntrack(tc, fu, "t_alice", sigVersion)
	if err == nil {
		t.Fatal("expected untrack error; got no error")
	} else if _, ok := err.(libkb.UntrackError); !ok {
		t.Fatalf("expected an UntrackError; got %s", err)
	}

	err = runUntrack(tc, fu, "t_bob", sigVersion)
	if err == nil {
		t.Fatal("expected untrack error; got no error")
	} else if _, ok := err.(libkb.UntrackError); !ok {
		t.Fatalf("expected an UntrackError; got %s", err)
	}
}

func TestUntrackRemoteOnly(t *testing.T) {
	tc := SetupEngineTest(t, "untrack")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)
	fu := CreateAndSignupFakeUser(tc, "untrk")

	sv := keybase1.SigVersion(sigVersion)
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{LocalOnly: false, BypassConfirm: true, SigVersion: &sv}, fu.NewSecretUI())
	untrackAlice(tc, fu, sigVersion)
	assertUntracked(tc, "t_alice")
}
