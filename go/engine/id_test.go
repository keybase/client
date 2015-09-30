package engine

import (
	"reflect"
	"sync"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

func runIdentify(tc *libkb.TestContext, username string) (idUI *FakeIdentifyUI, res *IDRes, err error) {
	idUI = &FakeIdentifyUI{}
	arg := IDEngineArg{
		UserAssertion: username,
	}
	ctx := Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
	}
	eng := NewIDEngine(&arg, tc.G)
	err = RunEngine(eng, &ctx)
	res = eng.Result()
	return
}

func checkAliceProofs(tb testing.TB, idUI *FakeIdentifyUI, user *libkb.User) {
	checkKeyedProfile(tb, idUI, user, "alice", true, map[string]string{
		"github":  "kbtester2",
		"twitter": "tacovontaco",
	})
}

func checkBobProofs(tb testing.TB, idUI *FakeIdentifyUI, user *libkb.User) {
	checkKeyedProfile(tb, idUI, user, "bob", true, map[string]string{
		"github":  "kbtester1",
		"twitter": "kbtester1",
	})
}

func checkCharlieProofs(t *testing.T, idUI *FakeIdentifyUI, user *libkb.User) {
	checkKeyedProfile(t, idUI, user, "charlie", true, map[string]string{
		"github":  "tacoplusplus",
		"twitter": "tacovontaco",
	})
}

func checkDougProofs(t *testing.T, idUI *FakeIdentifyUI, user *libkb.User) {
	checkKeyedProfile(t, idUI, user, "doug", false, nil)
}

func checkKeyedProfile(tb testing.TB, idUI *FakeIdentifyUI, them *libkb.User, name string, hasImg bool, expectedProofs map[string]string) {
	if exported := them.Export(); !reflect.DeepEqual(idUI.User, exported) {
		tb.Fatal("LaunchNetworkChecks User not equal to result user.", idUI.User, exported)
	}

	if !reflect.DeepEqual(expectedProofs, idUI.Proofs) {
		tb.Fatal("Wrong proofs.", expectedProofs, idUI.Proofs)
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

	// this doesn't work anymore:
	//	for k := range idUI.Keys {
	//		if k.PGPFingerprint == nil {
	//			t.Errorf("key %v: not pgp.  only pgp keys should be displayed.", k)
	//		}
	//	}
}

func TestIdAlice(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify(&tc, "t_alice")
	if err != nil {
		t.Fatal(err)
	}
	checkAliceProofs(t, idUI, result.User)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdBob(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify(&tc, "t_bob")
	if err != nil {
		t.Fatal(err)
	}
	checkBobProofs(t, idUI, result.User)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdCharlie(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify(&tc, "t_charlie")
	if err != nil {
		t.Fatal(err)
	}
	checkCharlieProofs(t, idUI, result.User)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdDoug(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify(&tc, "t_doug")
	if err != nil {
		t.Fatal(err)
	}
	checkDougProofs(t, idUI, result.User)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdEllen(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, _, err := runIdentify(&tc, "t_ellen")
	if err == nil {
		t.Fatal("Expected no public key found error.")
	} else if _, ok := err.(libkb.NoActiveKeyError); !ok {
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
	u := CreateAndSignupFakeUser(tc, "login")
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), SecretUI: u.NewSecretUI()}
	_, _, key := armorKey(t, tc, u.Email)
	eng, err := NewPGPKeyImportEngineFromBytes([]byte(key), true, tc.G)
	if err != nil {
		t.Fatal(err)
	}
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	Logout(tc)

	idUI, _, err := runIdentify(&tc, u.Username)
	if err != nil {
		t.Fatal(err)
	}

	checkDisplayKeys(t, idUI, 1, 1)
}

type FakeIdentifyUI struct {
	Proofs          map[string]string
	User            *keybase1.User
	Confirmed       bool
	Keys            map[libkb.PGPFingerprint]*keybase1.TrackDiff
	DisplayKeyCalls int
	Outcome         *keybase1.IdentifyOutcome
	sync.Mutex
}

func (ui *FakeIdentifyUI) FinishWebProofCheck(proof keybase1.RemoteProof, result keybase1.LinkCheckResult) {
	ui.Lock()
	defer ui.Unlock()
	if ui.Proofs == nil {
		ui.Proofs = make(map[string]string)
	}
	ui.Proofs[proof.Key] = proof.Value
}

func (ui *FakeIdentifyUI) FinishSocialProofCheck(proof keybase1.RemoteProof, result keybase1.LinkCheckResult) {
	ui.Lock()
	defer ui.Unlock()
	if ui.Proofs == nil {
		ui.Proofs = make(map[string]string)
	}
	ui.Proofs[proof.Key] = proof.Value
}
func (ui *FakeIdentifyUI) Confirm(outcome *keybase1.IdentifyOutcome) (confirmed bool, err error) {
	ui.Lock()
	defer ui.Unlock()
	ui.Outcome = outcome
	confirmed = outcome.TrackOptions.BypassConfirm
	return
}
func (ui *FakeIdentifyUI) DisplayCryptocurrency(keybase1.Cryptocurrency) {
}

func (ui *FakeIdentifyUI) DisplayKey(ik keybase1.IdentifyKey) {
	ui.Lock()
	defer ui.Unlock()
	if ui.Keys == nil {
		ui.Keys = make(map[libkb.PGPFingerprint]*keybase1.TrackDiff)
	}
	fp := libkb.ImportPGPFingerprintSlice(ik.PGPFingerprint)

	ui.Keys[*fp] = ik.TrackDiff
	ui.DisplayKeyCalls++
}
func (ui *FakeIdentifyUI) ReportLastTrack(*keybase1.TrackSummary) {
}
func (ui *FakeIdentifyUI) Start(username string) {
}
func (ui *FakeIdentifyUI) Finish() {}
func (ui *FakeIdentifyUI) LaunchNetworkChecks(id *keybase1.Identity, user *keybase1.User) {
	ui.Lock()
	defer ui.Unlock()
	ui.User = user
}
func (ui *FakeIdentifyUI) DisplayTrackStatement(string) (err error) {
	return
}
func (ui *FakeIdentifyUI) SetStrict(b bool) {
}
