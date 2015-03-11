package engine

import (
	"testing"

	keybase_1 "github.com/keybase/client/protocol/go"
)

func TestPGPTrackEncrypt(t *testing.T) {
	tc := SetupEngineTest(t, "PGPTrackEncrypt")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(t, "login")
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
		Fapr:   keybase_1.FinishAndPromptRes{TrackRemote: true},
	}
	ctx := &Context{IdentifyUI: &idLubaUI{}, TrackUI: trackUI, SecretUI: u.NewSecretUI()}

	eng := NewPGPTrackEncrypt()
	if err := RunEngine(eng, ctx, nil, nil); err != nil {
		t.Fatal(err)
	}
}
