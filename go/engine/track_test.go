package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func runTrack(fu *FakeUser, username string) (idUI *FakeIdentifyUI, res *IDRes, err error) {
	return runTrackWithOptions(fu, username, TrackOptions{})
}

func runTrackWithOptions(fu *FakeUser, username string, options TrackOptions) (idUI *FakeIdentifyUI, res *IDRes, err error) {
	idUI = &FakeIdentifyUI{
		Fapr: keybase1.FinishAndPromptRes{
			TrackLocal:  options.TrackLocalOnly,
			TrackRemote: !options.TrackLocalOnly,
		},
	}
	arg := TrackEngineArg{
		TheirName: username,
		Options:   options,
	}
	ctx := Context{
		LogUI:      G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   fu.NewSecretUI(),
	}
	eng := NewTrackEngine(&arg, G)
	err = RunEngine(eng, &ctx)
	res = eng.res
	return
}

func assertTracked(t *testing.T, fu *FakeUser, theirName string) {
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
	if s == nil {
		t.Fatal("expected a tracking statement; but didn't see one")
	}
}

func trackAlice(t *testing.T, fu *FakeUser) {
	trackAliceWithOptions(t, fu, TrackOptions{})
}

func trackAliceWithOptions(t *testing.T, fu *FakeUser, options TrackOptions) {
	idUI, res, err := runTrackWithOptions(fu, "t_alice", options)
	if err != nil {
		t.Fatal(err)
	}
	checkAliceProofs(t, idUI, res)
	assertTracked(t, fu, "t_alice")
	return
}

func trackBob(t *testing.T, fu *FakeUser) {
	trackBobWithOptions(t, fu, TrackOptions{})
}

func trackBobWithOptions(t *testing.T, fu *FakeUser, options TrackOptions) {
	idUI, res, err := runTrackWithOptions(fu, "t_bob", options)
	if err != nil {
		t.Fatal(err)
	}
	checkBobProofs(t, idUI, res)
	assertTracked(t, fu, "t_bob")
	return
}

func TestTrack(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(t, "track")

	trackAlice(t, fu)
	defer untrackAlice(t, fu)

	// Assert that we gracefully handle the case of no login
	G.Logout()
	_, _, err := runTrack(fu, "t_bob")
	if err == nil {
		t.Fatal("expected logout error; got no error")
	} else if _, ok := err.(libkb.LoginRequiredError); !ok {
		t.Fatalf("expected a LoginRequireError; got %s", err.Error())
	}
	fu.LoginOrBust(t)
	trackBob(t, fu)
	defer untrackBob(t, fu)

	// try tracking a user with no keys
	_, _, err = runTrack(fu, "t_ellen")
	if err == nil {
		t.Errorf("expected error tracking t_ellen, got nil")
	}
	return
}

// tests tracking a user that doesn't have a public key (#386)
func TestTrackNoPubKey(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(t, "track")
	G.Logout()

	tracker := CreateAndSignupFakeUser(t, "track")
	_, _, err := runTrack(tracker, fu.Username)
	if err != nil {
		t.Fatalf("error tracking user w/ no pgp key: %s", err)
	}
}
