package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func runTrack(tc libkb.TestContext, fu *FakeUser, username string) (idUI *FakeIdentifyUI, them *libkb.User, err error) {
	return runTrackWithOptions(tc, fu, username, keybase1.TrackOptions{BypassConfirm: true}, fu.NewSecretUI(), false)
}

func runTrackWithOptions(tc libkb.TestContext, fu *FakeUser, username string, options keybase1.TrackOptions, secretUI libkb.SecretUI, forceRemoteCheck bool) (idUI *FakeIdentifyUI, them *libkb.User, err error) {
	idUI = &FakeIdentifyUI{}

	arg := &TrackEngineArg{
		UserAssertion:    username,
		Options:          options,
		ForceRemoteCheck: forceRemoteCheck,
	}
	ctx := &Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   secretUI,
	}

	eng := NewTrackEngine(arg, tc.G)
	err = RunEngine(eng, ctx)
	them = eng.User()
	return
}

func assertTracking(tc libkb.TestContext, username string) {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		tc.T.Fatal(err)
	}
	them, err := libkb.LoadUser(libkb.LoadUserArg{Name: username})
	if err != nil {
		tc.T.Fatal(err)
	}
	s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		tc.T.Fatal(err)
	}
	if s == nil {
		tc.T.Fatal("expected a tracking statement; but didn't see one")
	}
}

func assertNotTracking(tc libkb.TestContext, username string) {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		tc.T.Fatal(err)
	}
	them, err := libkb.LoadUser(libkb.LoadUserArg{Name: username})
	if err != nil {
		tc.T.Fatal(err)
	}
	s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		tc.T.Fatal(err)
	}
	if s != nil {
		tc.T.Errorf("a tracking statement exists for %s -> %s", me.GetName(), them.GetName())
	}
}

func trackAlice(tc libkb.TestContext, fu *FakeUser) {
	trackAliceWithOptions(tc, fu, keybase1.TrackOptions{BypassConfirm: true}, fu.NewSecretUI())
}

func trackAliceWithOptions(tc libkb.TestContext, fu *FakeUser, options keybase1.TrackOptions, secretUI libkb.SecretUI) {
	idUI, res, err := runTrackWithOptions(tc, fu, "t_alice", options, secretUI, false)
	if err != nil {
		tc.T.Fatal(err)
	}
	checkAliceProofs(tc.T, idUI, res)
	assertTracking(tc, "t_alice")
	return
}

func trackBob(tc libkb.TestContext, fu *FakeUser) {
	trackBobWithOptions(tc, fu, keybase1.TrackOptions{BypassConfirm: true}, fu.NewSecretUI())
}

func trackBobWithOptions(tc libkb.TestContext, fu *FakeUser, options keybase1.TrackOptions, secretUI libkb.SecretUI) {
	idUI, res, err := runTrackWithOptions(tc, fu, "t_bob", options, secretUI, false)
	if err != nil {
		tc.T.Fatal(err)
	}
	checkBobProofs(tc.T, idUI, res)
	assertTracking(tc, "t_bob")
	return
}

func TestTrack(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	trackAlice(tc, fu)
	defer untrackAlice(tc, fu)

	// Assert that we gracefully handle the case of no login
	Logout(tc)
	_, _, err := runTrack(tc, fu, "t_bob")
	if err == nil {
		t.Fatal("expected logout error; got no error")
	} else if _, ok := err.(libkb.LoginRequiredError); !ok {
		t.Fatalf("expected a LoginRequireError; got %s", err)
	}
	fu.LoginOrBust(tc)
	trackBob(tc, fu)
	defer untrackBob(tc, fu)

	// try tracking a user with no keys
	_, _, err = runTrack(tc, fu, "t_ellen")
	if err == nil {
		t.Errorf("expected error tracking t_ellen, got nil")
	}
	return
}

// tests tracking a user that doesn't have a public key (#386)
func TestTrackNoPubKey(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")
	Logout(tc)

	tracker := CreateAndSignupFakeUser(tc, "track")
	_, _, err := runTrack(tc, tracker, fu.Username)
	if err != nil {
		t.Fatalf("error tracking user w/ no pgp key: %s", err)
	}
}

func TestTrackMultiple(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	trackAlice(tc, fu)
	defer untrackAlice(tc, fu)

	trackAlice(tc, fu)
}

// see issue #578
func TestTrackRetrack(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
	}, "clear stream cache")

	idUI := &FakeIdentifyUI{}
	secretUI := fu.NewSecretUI()

	var err error
	fu.User, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	seqnoBefore := fu.User.GetSigChainLastKnownSeqno()

	arg := &TrackEngineArg{
		UserAssertion: "t_alice",
		Options:       keybase1.TrackOptions{BypassConfirm: true},
	}
	ctx := &Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   secretUI,
	}

	eng := NewTrackEngine(arg, tc.G)
	err = RunEngine(eng, ctx)
	if err != nil {
		t.Fatal(err)
	}

	if !secretUI.CalledGetSecret {
		t.Errorf("expected get secret call")
	}

	fu.User, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	seqnoAfter := fu.User.GetSigChainLastKnownSeqno()

	if seqnoAfter == seqnoBefore {
		t.Errorf("seqno after track: %d, expected > %d", seqnoAfter, seqnoBefore)
	}

	Logout(tc)
	fu.LoginOrBust(tc)
	// clear out the passphrase cache
	tc.G.LoginState().Account(func(a *libkb.Account) {
		a.ClearStreamCache()
	}, "clear stream cache")

	// reset the flag
	secretUI.CalledGetSecret = false

	eng = NewTrackEngine(arg, tc.G)
	err = RunEngine(eng, ctx)
	if err != nil {
		t.Fatal(err)
	}

	if secretUI.CalledGetSecret {
		t.Errorf("get secret called on retrack")
	}

	fu.User, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true})
	if err != nil {
		t.Fatal(err)
	}
	seqnoRetrack := fu.User.GetSigChainLastKnownSeqno()

	if seqnoRetrack > seqnoAfter {
		t.Errorf("seqno after retrack: %d, expected %d", seqnoRetrack, seqnoAfter)
	}
}

func TestTrackLocal(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	_, them, err := runTrackWithOptions(tc, fu, "t_alice", keybase1.TrackOptions{LocalOnly: true, BypassConfirm: true}, fu.NewSecretUI(), false)
	if err != nil {
		t.Fatal(err)
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}

	s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		t.Fatal(err)
	}
	if s == nil {
		t.Fatal("no tracking statement")
	}
	if s.IsRemote() {
		t.Errorf("tracking statement is remote, expected local")
	}
}

// Make sure the track engine uses the secret store.
func TestTrackWithSecretStore(t *testing.T) {
	testEngineWithSecretStore(t, func(
		tc libkb.TestContext, fu *FakeUser, secretUI libkb.SecretUI) {
		trackAliceWithOptions(tc, fu, keybase1.TrackOptions{BypassConfirm: true}, secretUI)
		untrackAlice(tc, fu)
	})
}
