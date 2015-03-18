package engine

import (
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

func TestPGPEncrypt(t *testing.T) {
	tc := SetupEngineTest(t, "PGPEncrypt")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(t, "login")
	trackUI := &FakeIdentifyUI{
		Proofs: make(map[string]string),
		Fapr:   keybase_1.FinishAndPromptRes{TrackRemote: true},
	}
	ctx := &Context{IdentifyUI: trackUI, SecretUI: u.NewSecretUI()}

	sink := libkb.NewBufferCloser()
	arg := &PGPEncryptArg{
		Recips: []string{"t_alice", "t_bob+kbtester1@twitter", "t_charlie+tacovontaco@twitter"},
		Source: strings.NewReader("track and encrypt, track and encrypt"),
		Sink:   sink,
		NoSelf: false,
		NoSign: true,
	}

	eng := NewPGPEncrypt(arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	out := sink.Bytes()
	if len(out) == 0 {
		t.Fatal("no output")
	}
}
