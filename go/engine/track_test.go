package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func runTrack(tc libkb.TestContext, fu *FakeUser, username string) (idUI *FakeIdentifyUI, them *libkb.User, err error) {
	return runTrackWithOptions(tc, fu, username, TrackOptions{}, false)
}

func runTrackWithOptions(tc libkb.TestContext, fu *FakeUser, username string, options TrackOptions, forceRemoteCheck bool) (idUI *FakeIdentifyUI, them *libkb.User, err error) {
	idUI = &FakeIdentifyUI{
		Fapr: keybase1.FinishAndPromptRes{
			TrackLocal:  options.TrackLocalOnly,
			TrackRemote: !options.TrackLocalOnly,
		},
	}

	arg := &TrackEngineArg{
		TheirName:        username,
		Options:          options,
		ForceRemoteCheck: forceRemoteCheck,
	}
	ctx := &Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   fu.NewSecretUI(),
	}

	eng := NewTrackEngine(arg, tc.G)
	err = RunEngine(eng, ctx)
	them = eng.User()
	return
}

func assertTracking(t *testing.T, theirName string) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}
	them, err := libkb.LoadUser(libkb.LoadUserArg{Name: theirName})
	if err != nil {
		t.Fatal(err)
	}
	s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		t.Fatal(err)
	}
	if s == nil {
		t.Fatal("expected a tracking statement; but didn't see one")
	}
}

func assertNotTracking(t *testing.T, theirName string) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		t.Fatal(err)
	}
	them, err := libkb.LoadUser(libkb.LoadUserArg{Name: theirName})
	if err != nil {
		t.Fatal(err)
	}
	s, err := me.TrackChainLinkFor(them.GetName(), them.GetUID())
	if err != nil {
		t.Fatal(err)
	}
	if s != nil {
		t.Errorf("a tracking statement exists for %s -> %s", me.GetName(), them.GetName())
	}
}

func trackAlice(tc libkb.TestContext, fu *FakeUser) {
	trackAliceWithOptions(tc, fu, TrackOptions{})
}

func trackAliceWithOptions(tc libkb.TestContext, fu *FakeUser, options TrackOptions) {
	idUI, res, err := runTrackWithOptions(tc, fu, "t_alice", options, false)
	if err != nil {
		tc.T.Fatal(err)
	}
	checkAliceProofs(tc.T, idUI, res)
	assertTracking(tc.T, "t_alice")
	return
}

func trackBob(tc libkb.TestContext, fu *FakeUser) {
	trackBobWithOptions(tc, fu, TrackOptions{})
}

func trackBobWithOptions(tc libkb.TestContext, fu *FakeUser, options TrackOptions) {
	idUI, res, err := runTrackWithOptions(tc, fu, "t_bob", options, false)
	if err != nil {
		tc.T.Fatal(err)
	}
	checkBobProofs(tc.T, idUI, res)
	assertTracking(tc.T, "t_bob")
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

func TestTrackLocal(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	_, them, err := runTrackWithOptions(tc, fu, "t_alice", TrackOptions{TrackLocalOnly: true}, false)
	if err != nil {
		t.Fatal(err)
	}

	me, err := libkb.LoadMe(libkb.LoadUserArg{})
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
