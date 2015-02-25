package engine

import (
	"reflect"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
)

func runIdentify(username string) (idUI *FakeIdentifyUI, res *IdentifyRes, err error) {
	idUI = &FakeIdentifyUI{Proofs: make(map[string]string)}
	arg := IdentifyEngineArg{
		User: username,
	}
	ctx := Context{
		LogUI:      G.UI.GetLogUI(),
		IdentifyUI: idUI,
	}
	eng := NewIdentifyEngine(&arg)
	err = RunEngine(eng, &ctx, nil, nil)
	res = eng.Result()
	return
}

func TestIdAlice(t *testing.T) {
	tc := libkb.SetupTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify("t_alice")
	if err != nil {
		t.Fatal(err)
	}
	// TODO: Lots of duplicated checks in all these tests. Refactor somehow.
	if exported := result.User.Export(); !reflect.DeepEqual(idUI.User, exported) {
		t.Fatal("LaunchNetworkChecks User not equal to result user.", idUI.User, exported)
	}
	if result.User.Image == nil {
		t.Fatal("Missing user image.")
	}
	expectedProofs := map[string]string{
		"github":  "kbtester2",
		"twitter": "tacovontaco",
	}
	if !reflect.DeepEqual(expectedProofs, idUI.Proofs) {
		t.Fatal("Wrong proofs.", expectedProofs, idUI.Proofs)
	}
}

func TestIdBob(t *testing.T) {
	tc := libkb.SetupTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify("t_bob")
	if err != nil {
		t.Fatal(err)
	}
	if exported := result.User.Export(); !reflect.DeepEqual(idUI.User, exported) {
		t.Fatal("LaunchNetworkChecks User not equal to result user.", idUI.User, exported)
	}
	if result.User.Image == nil {
		t.Fatal("Missing user image.")
	}
	expectedProofs := map[string]string{
		"github":  "kbtester1",
		"twitter": "kbtester1",
	}
	if !reflect.DeepEqual(expectedProofs, idUI.Proofs) {
		t.Fatal("Wrong proofs.", expectedProofs, idUI.Proofs)
	}
}

func TestIdCharlie(t *testing.T) {
	tc := libkb.SetupTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify("t_charlie")
	if err != nil {
		t.Fatal(err)
	}
	if exported := result.User.Export(); !reflect.DeepEqual(idUI.User, exported) {
		t.Fatal("LaunchNetworkChecks User not equal to result user.", idUI.User, exported)
	}
	if result.User.Image == nil {
		t.Fatal("Missing user image.")
	}
	expectedProofs := map[string]string{
		"github":  "tacoplusplus",
		"twitter": "tacovontaco",
	}
	if !reflect.DeepEqual(expectedProofs, idUI.Proofs) {
		t.Fatal("Wrong proofs.", expectedProofs, idUI.Proofs)
	}
}

func TestIdDoug(t *testing.T) {
	tc := libkb.SetupTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify("t_doug")
	if err != nil {
		t.Fatal(err)
	}
	if exported := result.User.Export(); !reflect.DeepEqual(idUI.User, exported) {
		t.Fatal("LaunchNetworkChecks User not equal to result user.", idUI.User, exported)
	}
	if result.User.Image != nil {
		t.Fatal("User image should be nil", result.User.Image)
	}
	expectedProofs := map[string]string{}
	if !reflect.DeepEqual(expectedProofs, idUI.Proofs) {
		t.Fatal("Wrong proofs.", expectedProofs, idUI.Proofs)
	}
}

func TestIdEllen(t *testing.T) {
	tc := libkb.SetupTest(t, "id")
	defer tc.Cleanup()
	_, _, err := runIdentify("t_ellen")
	if err == nil {
		t.Fatal("Expected no public key found error.")
	} else if _, ok := err.(libkb.NoKeyError); !ok {
		t.Fatal("Expected no public key found error. Got instead:", err)
	}
}

type FakeIdentifyUI struct {
	Proofs map[string]string
	User   *keybase_1.User
}

func (ui *FakeIdentifyUI) FinishWebProofCheck(proof keybase_1.RemoteProof, result keybase_1.LinkCheckResult) {
	ui.Proofs[proof.Key] = proof.Value
}
func (ui *FakeIdentifyUI) FinishSocialProofCheck(proof keybase_1.RemoteProof, result keybase_1.LinkCheckResult) {
	ui.Proofs[proof.Key] = proof.Value
}
func (ui *FakeIdentifyUI) FinishAndPrompt(*keybase_1.IdentifyOutcome) (res keybase_1.FinishAndPromptRes, err error) {
	return
}
func (ui *FakeIdentifyUI) DisplayCryptocurrency(keybase_1.Cryptocurrency) {
}
func (ui *FakeIdentifyUI) DisplayKey(keybase_1.FOKID, *keybase_1.TrackDiff) {
}
func (ui *FakeIdentifyUI) ReportLastTrack(*keybase_1.TrackSummary) {
}
func (ui *FakeIdentifyUI) Start() {
}
func (ui *FakeIdentifyUI) LaunchNetworkChecks(id *keybase_1.Identity, user *keybase_1.User) {
	ui.User = user
}
func (ui *FakeIdentifyUI) DisplayTrackStatement(string) (err error) {
	return
}
func (ui *FakeIdentifyUI) SetUsername(username string) {
}
func (ui *FakeIdentifyUI) SetStrict(b bool) {
}
