package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func TestTrackToken(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	trackWithToken(tc, fu, "t_alice")
}

func trackWithToken(tc libkb.TestContext, fu *FakeUser, username string) {
	idUI := &FakeIdentifyUI{
		Fapr: keybase1.FinishAndPromptRes{
			TrackRemote: true,
		},
	}

	idarg := &IDEngineArg{UserAssertion: username}
	ctx := &Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   fu.NewSecretUI(),
	}
	eng := NewIDEngine(idarg, tc.G)
	if err := RunEngine(eng, ctx); err != nil {
		tc.T.Fatal(err)
	}

	res := eng.Result()
	arg := TrackTokenArg{
		Token: res.TrackToken,
	}
	teng := NewTrackToken(&arg, tc.G)
	if err := RunEngine(teng, ctx); err != nil {
		tc.T.Fatal(err)
	}

	defer runUntrack(tc.G, fu, username)
	assertTracked(tc.T, fu, username)
}
