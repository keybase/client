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

func checkAliceProofs(t *testing.T, idUI *FakeIdentifyUI, res *IdentifyRes) {
	checkKeyedProfile(t, idUI, res, "alice", true, map[string]string{
		"github":  "kbtester2",
		"twitter": "tacovontaco",
	})
}

func checkBobProofs(t *testing.T, idUI *FakeIdentifyUI, res *IdentifyRes) {
	checkKeyedProfile(t, idUI, res, "bob", true, map[string]string{
		"github":  "kbtester1",
		"twitter": "kbtester1",
	})
}

func checkCharlieProofs(t *testing.T, idUI *FakeIdentifyUI, res *IdentifyRes) {
	checkKeyedProfile(t, idUI, res, "charlie", true, map[string]string{
		"github":  "tacoplusplus",
		"twitter": "tacovontaco",
	})
}

func checkDougProofs(t *testing.T, idUI *FakeIdentifyUI, res *IdentifyRes) {
	checkKeyedProfile(t, idUI, res, "doug", false, map[string]string{})
}

func checkKeyedProfile(t *testing.T, idUI *FakeIdentifyUI, result *IdentifyRes, name string, hasImg bool, expectedProofs map[string]string) {
	if exported := result.User.Export(); !reflect.DeepEqual(idUI.User, exported) {
		t.Fatal("LaunchNetworkChecks User not equal to result user.", idUI.User, exported)
	}

	if hasImg && result.User.Image == nil {
		t.Fatal("Missing user image.")
	} else if !hasImg && result.User.Image != nil {
		t.Fatal("User has an image but shouldn't")
	}

	if !reflect.DeepEqual(expectedProofs, idUI.Proofs) {
		t.Fatal("Wrong proofs.", expectedProofs, idUI.Proofs)
	}
}

func checkDisplayKeys(t *testing.T, idUI *FakeIdentifyUI, callCount, keyCount int) {
	if idUI.DisplayKeyCalls != callCount {
		t.Errorf("DisplayKey calls: %d.  expected %d.", idUI.DisplayKeyCalls, callCount)
	}

	if len(idUI.Keys) != keyCount {
		t.Errorf("keys: %d, expected %d.", len(idUI.Keys), keyCount)
		for k, v := range idUI.Keys {
			t.Logf("key: %+v, %+v", k, v)
		}
	}

	for k := range idUI.Keys {
		if k.PgpFingerprint == nil {
			t.Errorf("key %v: not pgp.  only pgp keys should be displayed.", k)
		}
	}
}

func TestIdAlice(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify("t_alice")
	if err != nil {
		t.Fatal(err)
	}
	checkAliceProofs(t, idUI, result)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdBob(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify("t_bob")
	if err != nil {
		t.Fatal(err)
	}
	checkBobProofs(t, idUI, result)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdCharlie(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify("t_charlie")
	if err != nil {
		t.Fatal(err)
	}
	checkCharlieProofs(t, idUI, result)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdDoug(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify("t_doug")
	if err != nil {
		t.Fatal(err)
	}
	checkDougProofs(t, idUI, result)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdEllen(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, _, err := runIdentify("t_ellen")
	if err == nil {
		t.Fatal("Expected no public key found error.")
	} else if _, ok := err.(libkb.NoKeyError); !ok {
		t.Fatal("Expected no public key found error. Got instead:", err)
	}
	checkDisplayKeys(t, idUI, 0, 0)
}

// TestIdPGPNotEldest creates a user with a pgp key that isn't
// eldest key, then runs identify to make sure the pgp key is
// still displayed.
func TestIdPGPNotEldest(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()

	// create new user, then add pgp key
	u := CreateAndSignupFakeUser(t, "login")
	secui := libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{LogUI: G.UI.GetLogUI(), SecretUI: secui}
	key := armorKey(t, tc, u.Email)
	e := NewPGPSaveArmored(key, true, true)
	if err := RunEngine(e, ctx, nil, nil); err != nil {
		t.Fatal(err)
	}

	idUI, _, err := runIdentify(u.Username)
	if err != nil {
		t.Fatal(err)
	}

	checkDisplayKeys(t, idUI, 1, 1)
}

type FakeIdentifyUI struct {
	Proofs          map[string]string
	User            *keybase_1.User
	Fapr            keybase_1.FinishAndPromptRes
	Keys            map[keybase_1.FOKID]*keybase_1.TrackDiff
	DisplayKeyCalls int
}

func (ui *FakeIdentifyUI) FinishWebProofCheck(proof keybase_1.RemoteProof, result keybase_1.LinkCheckResult) {
	ui.Proofs[proof.Key] = proof.Value
}
func (ui *FakeIdentifyUI) FinishSocialProofCheck(proof keybase_1.RemoteProof, result keybase_1.LinkCheckResult) {
	ui.Proofs[proof.Key] = proof.Value
}
func (ui *FakeIdentifyUI) FinishAndPrompt(*keybase_1.IdentifyOutcome) (res keybase_1.FinishAndPromptRes, err error) {
	res = ui.Fapr
	return
}
func (ui *FakeIdentifyUI) DisplayCryptocurrency(keybase_1.Cryptocurrency) {
}
func (ui *FakeIdentifyUI) DisplayKey(kid keybase_1.FOKID, td *keybase_1.TrackDiff) {
	if ui.Keys == nil {
		ui.Keys = make(map[keybase_1.FOKID]*keybase_1.TrackDiff)
	}
	ui.Keys[kid] = td
	ui.DisplayKeyCalls++
}
func (ui *FakeIdentifyUI) ReportLastTrack(*keybase_1.TrackSummary) {
}
func (ui *FakeIdentifyUI) Start(username string) {
}
func (ui *FakeIdentifyUI) LaunchNetworkChecks(id *keybase_1.Identity, user *keybase_1.User) {
	ui.User = user
}
func (ui *FakeIdentifyUI) DisplayTrackStatement(string) (err error) {
	return
}
func (ui *FakeIdentifyUI) SetStrict(b bool) {
}
