package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"testing"
)

func runTrack(fu *FakeUser, username string) (idUI *FakeIdentifyUI, res *IdentifyRes, err error) {
	idUI = &FakeIdentifyUI{
		Proofs: make(map[string]string),
		Fapr:   keybase_1.FinishAndPromptRes{TrackRemote: true},
	}
	arg := TrackEngineArg{
		TheirName: username,
	}
	ctx := Context{
		LogUI:    G.UI.GetLogUI(),
		TrackUI:  idUI,
		SecretUI: fu.NewSecretUI(),
	}
	eng := NewTrackEngine(&arg)
	err = RunEngine(eng, &ctx, nil, nil)
	res = eng.Result()
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
		t.Fatal("expeted a tracking statement; but didn't see one")
	}

}

func trackAlice(t *testing.T, fu *FakeUser) {
	idUI, res, err := runTrack(fu, "t_alice")
	if err != nil {
		t.Fatal(err)
	}
	checkAliceProofs(t, idUI, res)
	assertTracked(t, fu, "t_alice")
	return
}

func trackBob(t *testing.T, fu *FakeUser) {
	idUI, res, err := runTrack(fu, "t_bob")
	if err != nil {
		t.Fatal(err)
	}
	checkBobProofs(t, idUI, res)
	assertTracked(t, fu, "t_bob")
	return
}

func TestTrack(t *testing.T) {
	tc := libkb.SetupTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(t, "track")

	trackAlice(t, fu)

	// Assert that we gracefully handle the case of no login
	G.LoginState.Logout()
	_, _, err := runTrack(fu, "t_bob")
	if err == nil {
		t.Fatal("expected logout error; got no error")
	} else if _, ok := err.(libkb.LoginRequiredError); !ok {
		t.Fatalf("expected a LoginRequireError; got %s", err.Error())
	}
	fu.LoginOrBust(t)
	trackBob(t, fu)
	return
}
