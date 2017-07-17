// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func runIdentify(tc *libkb.TestContext, username string) (idUI *FakeIdentifyUI, res *keybase1.Identify2Res, err error) {
	idUI = &FakeIdentifyUI{}
	arg := keybase1.Identify2Arg{
		UserAssertion: username,
		AlwaysBlock:   true,
	}

	ctx := Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
	}

	eng := NewResolveThenIdentify2(tc.G, &arg)
	err = RunEngine(eng, &ctx)
	if err != nil {
		return idUI, nil, err
	}
	res = eng.Result()
	return idUI, res, nil
}

func checkAliceProofs(tb testing.TB, idUI *FakeIdentifyUI, user *keybase1.UserPlusKeys) {
	checkKeyedProfile(tb, idUI, user, "alice", true, map[string]string{
		"github":  "kbtester2",
		"twitter": "tacovontaco",
	})
}

func checkBobProofs(tb testing.TB, idUI *FakeIdentifyUI, user *keybase1.UserPlusKeys) {
	checkKeyedProfile(tb, idUI, user, "bob", true, map[string]string{
		"github":  "kbtester1",
		"twitter": "kbtester1",
	})
}

func checkCharlieProofs(t *testing.T, idUI *FakeIdentifyUI, user *keybase1.UserPlusKeys) {
	checkKeyedProfile(t, idUI, user, "charlie", true, map[string]string{
		"github":  "tacoplusplus",
		"twitter": "tacovontaco",
	})
}

func checkDougProofs(t *testing.T, idUI *FakeIdentifyUI, user *keybase1.UserPlusKeys) {
	checkKeyedProfile(t, idUI, user, "doug", false, nil)
}

func checkKeyedProfile(tb testing.TB, idUI *FakeIdentifyUI, them *keybase1.UserPlusKeys, name string, hasImg bool, expectedProofs map[string]string) {
	if them == nil {
		tb.Fatal("nil 'them' user")
	}
	exported := &keybase1.User{
		Uid:      them.Uid,
		Username: them.Username,
	}
	if !reflect.DeepEqual(idUI.User, exported) {
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
}

func TestIdAlice(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify(&tc, "t_alice")
	if err != nil {
		t.Fatal(err)
	}
	checkAliceProofs(t, idUI, &result.Upk)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdBob(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify(&tc, "t_bob")
	if err != nil {
		t.Fatal(err)
	}
	checkBobProofs(t, idUI, &result.Upk)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdCharlie(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify(&tc, "t_charlie")
	if err != nil {
		t.Fatal(err)
	}
	checkCharlieProofs(t, idUI, &result.Upk)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdDoug(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, result, err := runIdentify(&tc, "t_doug")
	if err != nil {
		t.Fatal(err)
	}
	checkDougProofs(t, idUI, &result.Upk)
	checkDisplayKeys(t, idUI, 1, 1)
}

func TestIdEllen(t *testing.T) {
	tc := SetupEngineTest(t, "id")
	defer tc.Cleanup()
	idUI, _, err := runIdentify(&tc, "t_ellen")
	if err != nil {
		t.Fatal(err)
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
	ProofResults    map[string]keybase1.LinkCheckResult
	User            *keybase1.User
	Confirmed       bool
	Keys            map[libkb.PGPFingerprint]*keybase1.TrackDiff
	DisplayKeyCalls int
	DisplayKeyDiffs []*keybase1.TrackDiff
	Outcome         *keybase1.IdentifyOutcome
	StartCount      int
	Token           keybase1.TrackToken
	BrokenTracking  bool
	DisplayTLFArg   keybase1.DisplayTLFCreateWithInviteArg
	DisplayTLFCount int
	sync.Mutex
}

func (ui *FakeIdentifyUI) FinishWebProofCheck(proof keybase1.RemoteProof, result keybase1.LinkCheckResult) error {
	ui.Lock()
	defer ui.Unlock()
	if ui.Proofs == nil {
		ui.Proofs = make(map[string]string)
	}
	ui.Proofs[proof.Key] = proof.Value

	if ui.ProofResults == nil {
		ui.ProofResults = make(map[string]keybase1.LinkCheckResult)
	}
	ui.ProofResults[proof.Key] = result
	if result.BreaksTracking {
		ui.BrokenTracking = true
	}
	return nil
}

func (ui *FakeIdentifyUI) FinishSocialProofCheck(proof keybase1.RemoteProof, result keybase1.LinkCheckResult) error {
	ui.Lock()
	defer ui.Unlock()
	if ui.Proofs == nil {
		ui.Proofs = make(map[string]string)
	}
	ui.Proofs[proof.Key] = proof.Value
	if ui.ProofResults == nil {
		ui.ProofResults = make(map[string]keybase1.LinkCheckResult)
	}
	ui.ProofResults[proof.Key] = result
	if result.BreaksTracking {
		ui.BrokenTracking = true
	}
	return nil
}

func (ui *FakeIdentifyUI) Confirm(outcome *keybase1.IdentifyOutcome) (result keybase1.ConfirmResult, err error) {
	ui.Lock()
	defer ui.Unlock()

	// Do a short sleep. This helps trigger bugs when other code is racing
	// against the UI here. (Note from Jack: In the bug I initially added this
	// for, 10ms was just enough to trigger it. I'm adding in an extra factor
	// of 10.)
	time.Sleep(100 * time.Millisecond)

	ui.Outcome = outcome
	result.IdentityConfirmed = outcome.TrackOptions.BypassConfirm
	result.RemoteConfirmed = outcome.TrackOptions.BypassConfirm && !outcome.TrackOptions.ExpiringLocal
	return
}
func (ui *FakeIdentifyUI) DisplayCryptocurrency(keybase1.Cryptocurrency) error {
	return nil
}

func (ui *FakeIdentifyUI) DisplayKey(ik keybase1.IdentifyKey) error {
	ui.Lock()
	defer ui.Unlock()
	if ui.Keys == nil {
		ui.Keys = make(map[libkb.PGPFingerprint]*keybase1.TrackDiff)
	}

	fp := libkb.ImportPGPFingerprintSlice(ik.PGPFingerprint)
	if fp != nil {
		ui.Keys[*fp] = ik.TrackDiff
	}

	if ik.TrackDiff != nil {
		ui.DisplayKeyDiffs = append(ui.DisplayKeyDiffs, ik.TrackDiff)
	}

	ui.DisplayKeyCalls++
	return nil
}
func (ui *FakeIdentifyUI) ReportLastTrack(*keybase1.TrackSummary) error {
	return nil
}

func (ui *FakeIdentifyUI) Start(username string, _ keybase1.IdentifyReason, _ bool) error {
	ui.Lock()
	defer ui.Unlock()
	ui.StartCount++
	return nil
}

func (ui *FakeIdentifyUI) Cancel() error {
	return nil
}

func (ui *FakeIdentifyUI) Finish() error {
	return nil
}

func (ui *FakeIdentifyUI) Dismiss(_ string, _ keybase1.DismissReason) error {
	return nil
}

func (ui *FakeIdentifyUI) LaunchNetworkChecks(id *keybase1.Identity, user *keybase1.User) error {
	ui.Lock()
	defer ui.Unlock()
	ui.User = user
	return nil
}

func (ui *FakeIdentifyUI) DisplayTrackStatement(string) error {
	return nil
}

func (ui *FakeIdentifyUI) DisplayUserCard(keybase1.UserCard) error {
	return nil
}

func (ui *FakeIdentifyUI) ReportTrackToken(tok keybase1.TrackToken) error {
	ui.Token = tok
	return nil
}

func (ui *FakeIdentifyUI) SetStrict(b bool) {
}

func (ui *FakeIdentifyUI) DisplayTLFCreateWithInvite(arg keybase1.DisplayTLFCreateWithInviteArg) error {
	ui.DisplayTLFCount++
	ui.DisplayTLFArg = arg
	return nil
}
