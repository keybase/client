package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

func runIdentify(username string) (res *IdentifyRes, err error) {
	arg := IdentifyEngineArg{
		User: username,
	}
	ctx := Context{
		LogUI:      G.UI.GetLogUI(),
		IdentifyUI: FakeIdentifyUI{},
	}
	eng := NewIdentifyEngine(&arg)
	err = RunEngine(eng, &ctx, nil, nil)
	res = eng.Result()
	return
}

func TestIdAlice(t *testing.T) {
	tc := libkb.SetupTest(t, "id")
	defer tc.Cleanup()
	_, err := runIdentify("t_alice")
	if err != nil {
		t.Fatal(err)
	}
}

func TestIdBob(t *testing.T) {
	tc := libkb.SetupTest(t, "id")
	defer tc.Cleanup()
	_, err := runIdentify("t_bob")
	if err != nil {
		t.Fatal(err)
	}
}

func TestIdCharlie(t *testing.T) {
	tc := libkb.SetupTest(t, "id")
	defer tc.Cleanup()
	_, err := runIdentify("t_charlie")
	if err != nil {
		t.Fatal(err)
	}
}

func TestIdDoug(t *testing.T) {
	tc := libkb.SetupTest(t, "id")
	defer tc.Cleanup()
	_, err := runIdentify("t_doug")
	if err != nil {
		t.Fatal(err)
	}
}

func TestIdEllen(t *testing.T) {
	tc := libkb.SetupTest(t, "id")
	defer tc.Cleanup()
	_, err := runIdentify("t_ellen")
	if err == nil {
		t.Fatal("Expected no public key found error.")
	} else if _, ok := err.(libkb.NoKeyError); !ok {
		t.Fatal("Expected no public key found error. Got instead:", err)
	}
}

type FakeIdentifyUI struct {
}

func (ui FakeIdentifyUI) FinishWebProofCheck(proof keybase_1.RemoteProof, result keybase_1.LinkCheckResult) {
}
func (ui FakeIdentifyUI) FinishSocialProofCheck(proof keybase_1.RemoteProof, result keybase_1.LinkCheckResult) {
}
func (ui FakeIdentifyUI) FinishAndPrompt(*keybase_1.IdentifyOutcome) (res keybase_1.FinishAndPromptRes, err error) {
	return
}
func (ui FakeIdentifyUI) DisplayCryptocurrency(keybase_1.Cryptocurrency) {
}
func (ui FakeIdentifyUI) DisplayKey(keybase_1.FOKID, *keybase_1.TrackDiff) {
}
func (ui FakeIdentifyUI) ReportLastTrack(*keybase_1.TrackSummary) {
}
func (ui FakeIdentifyUI) Start() {
}
func (ui FakeIdentifyUI) LaunchNetworkChecks(*keybase_1.Identity) {
}
func (ui FakeIdentifyUI) DisplayTrackStatement(string) (err error) {
	return
}
func (ui FakeIdentifyUI) SetUsername(username string) {
}
func (ui FakeIdentifyUI) SetStrict(b bool) {
}
