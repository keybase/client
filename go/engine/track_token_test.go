// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"
	"time"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

func TestTrackTokenIdentify2(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	idUI := &FakeIdentifyUI{}
	username := "t_tracy"
	arg := &keybase1.Identify2Arg{
		UserAssertion: username,
		NeedProofSet:  true,
	}
	ctx := &Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   fu.NewSecretUI(),
	}
	eng := NewResolveThenIdentify2(tc.G, arg)
	if err := RunEngine(eng, ctx); err != nil {
		tc.T.Fatal(err)
	}
	targ := TrackTokenArg{
		Token:   idUI.Token,
		Options: keybase1.TrackOptions{BypassConfirm: true},
	}
	teng := NewTrackToken(&targ, tc.G)
	if err := RunEngine(teng, ctx); err != nil {
		tc.T.Fatal(err)
	}

	defer runUntrack(tc.G, fu, username)
	assertTracking(tc, username)
}

func TestTrackLocalThenLocalTemp(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)
	// to pick up the new clock...
	tc.G.ResetLoginState()

	flakeyAPI := flakeyRooterAPI{orig: tc.G.XAPI, flakeOut: false, G: tc.G}
	tc.G.XAPI = &flakeyAPI

	idUI := &FakeIdentifyUI{}
	username := "t_tracy"

	arg := &keybase1.Identify2Arg{
		UserAssertion: username,
		NeedProofSet:  true,
	}
	ctx := &Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   fu.NewSecretUI(),
	}

	// Identify tracy; all proofs should work
	eng := NewResolveThenIdentify2(tc.G, arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	targ := TrackTokenArg{
		Token:   idUI.Token,
		Options: keybase1.TrackOptions{BypassConfirm: true, LocalOnly: true},
	}

	// Track tracy
	teng := NewTrackToken(&targ, tc.G)
	if err := RunEngine(teng, ctx); err != nil {
		t.Fatal(err)
	}

	defer runUntrack(tc.G, fu, username)

	// Now make her Rooter proof fail with a 429
	flakeyAPI.flakeOut = true
	idUI = &FakeIdentifyUI{}
	ctx.IdentifyUI = idUI

	// Advance so that our previous cached success is out of
	// cache
	fakeClock.Advance(tc.G.Env.GetProofCacheLongDur() + time.Minute)

	eng = NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{noCache: true}

	// Should  get an error
	if err := RunEngine(eng, ctx); err == nil {
		t.Fatal("Expected identify error")
	}

	result, found := idUI.ProofResults["rooter"]
	if !found {
		t.Fatal("Failed to find a rooter proof")
	}
	if pe := libkb.ImportProofError(result.ProofResult); pe == nil {
		t.Fatal("expected a Rooter error result")
	}

	// This is like the UI saying to store the local track
	targ.Options.ExpiringLocal = true
	targ.Token = idUI.Token
	// Track tracy
	teng = NewTrackToken(&targ, tc.G)
	if err := RunEngine(teng, ctx); err != nil {
		t.Fatal(err)
	}

	// Identify should work once more because we signed with failures
	eng = NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{noCache: true}
	var err error
	// Should not get an error
	if err = RunEngine(eng, ctx); err != nil {
		t.Logf("Identify failure: %v", err)
		t.Fatal("Expected to pass identify")
	}

	result, found = idUI.ProofResults["rooter"]
	if !found {
		t.Fatal("Failed to find a rooter proof")
	}
	if result.Diff == nil {
		t.Fatal("Failed to find a rooter proof result diff")
	}
	if result.Diff.Type != keybase1.TrackDiffType_NONE_VIA_TEMPORARY {
		t.Fatal("Failed to find a rooter proof result diff of type TrackDiffType_NONE_VIA_TEMPORARY")
	}
	if pe := libkb.ImportProofError(result.ProofResult); pe == nil {
		t.Fatal("expected a Rooter error result")
	}

	// Advance so that our temporary track is discarded
	fakeClock.Advance(tc.G.Env.GetLocalTrackMaxAge() + time.Minute)

	// Identify should fail once more
	eng = NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{noCache: true}
	// Should get an error
	if err = RunEngine(eng, ctx); err == nil {
		t.Fatal("Expected rooter to fail")
	}
	t.Logf("Identify failure: %v", err)

	result, found = idUI.ProofResults["rooter"]
	if !found {
		t.Fatal("Failed to find a rooter proof")
	}
	if pe := libkb.ImportProofError(result.ProofResult); pe == nil {
		t.Fatal("expected a Rooter error result")
	}

	assertTracking(tc, username)
}

func TestTrackRemoteThenLocalTemp(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	// Tracking remote means we have to agree what time it is
	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)
	// to pick up the new clock...
	tc.G.ResetLoginState()

	flakeyAPI := flakeyRooterAPI{orig: tc.G.XAPI, flakeOut: false, G: tc.G}
	tc.G.XAPI = &flakeyAPI

	idUI := &FakeIdentifyUI{}
	username := "t_tracy"

	arg := &keybase1.Identify2Arg{
		UserAssertion: username,
		NeedProofSet:  true,
	}
	ctx := &Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   fu.NewSecretUI(),
	}

	// Identify tracy; all proofs should work
	eng := NewResolveThenIdentify2(tc.G, arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	// Leaving LocalOnly off here will result in remote tracking
	targ := TrackTokenArg{
		Token:   idUI.Token,
		Options: keybase1.TrackOptions{BypassConfirm: true},
	}

	// Track tracy
	teng := NewTrackToken(&targ, tc.G)
	if err := RunEngine(teng, ctx); err != nil {
		t.Fatal(err)
	}

	defer runUntrack(tc.G, fu, username)

	// Now make her Rooter proof fail with a 429
	flakeyAPI.flakeOut = true
	idUI = &FakeIdentifyUI{}
	ctx.IdentifyUI = idUI

	// Advance so that our previous cached success is out of
	// cache
	fakeClock.Advance(tc.G.Env.GetProofCacheLongDur() + time.Minute)

	eng = NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{noCache: true}

	// Should  get an error
	if err := RunEngine(eng, ctx); err == nil {
		t.Fatal("Expected identify error")
	}

	result, found := idUI.ProofResults["rooter"]
	if !found {
		t.Fatal("Failed to find a rooter proof")
	}
	if pe := libkb.ImportProofError(result.ProofResult); pe == nil {
		t.Fatal("expected a Rooter error result")
	}

	// This is like the UI saying to store the local track
	targ.Options.ExpiringLocal = true
	targ.Token = idUI.Token
	// Track tracy
	teng = NewTrackToken(&targ, tc.G)
	if err := RunEngine(teng, ctx); err != nil {
		t.Fatal(err)
	}

	// Identify should work once more because we signed with failures
	eng = NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{noCache: true}
	var err error
	// Should not get an error
	if err = RunEngine(eng, ctx); err != nil {
		t.Logf("Identify failure: %v", err)
		t.Fatal("Expected to pass identify")
	}

	result, found = idUI.ProofResults["rooter"]
	if !found {
		t.Fatal("Failed to find a rooter proof")
	}
	if pe := libkb.ImportProofError(result.ProofResult); pe == nil {
		t.Fatal("expected a Rooter error result")
	}

	// Advance so that our temporary track is discarded
	// cache
	fakeClock.Advance(tc.G.Env.GetLocalTrackMaxAge() + time.Minute)

	// Identify should fail once more
	eng = NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{noCache: true}
	// Should get an error
	if err = RunEngine(eng, ctx); err == nil {
		t.Fatal("Expected rooter to fail")
	}
	t.Logf("Identify failure: %v", err)

	result, found = idUI.ProofResults["rooter"]
	if !found {
		t.Fatal("Failed to find a rooter proof")
	}
	if pe := libkb.ImportProofError(result.ProofResult); pe == nil {
		t.Fatal("expected a Rooter error result")
	}

	assertTracking(tc, username)
}

func TestTrackFailTempRecover(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	fakeClock := clockwork.NewFakeClock()
	tc.G.SetClock(fakeClock)
	// to pick up the new clock...
	tc.G.ResetLoginState()

	flakeyAPI := flakeyRooterAPI{orig: tc.G.XAPI, flakeOut: false, G: tc.G}
	tc.G.XAPI = &flakeyAPI

	idUI := &FakeIdentifyUI{}
	username := "t_tracy"

	arg := &keybase1.Identify2Arg{
		UserAssertion: username,
		NeedProofSet:  true,
	}
	ctx := &Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   fu.NewSecretUI(),
	}

	// Identify tracy; all proofs should work
	eng := NewResolveThenIdentify2(tc.G, arg)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	targ := TrackTokenArg{
		Token:   idUI.Token,
		Options: keybase1.TrackOptions{BypassConfirm: true, LocalOnly: true},
	}

	// Track tracy
	teng := NewTrackToken(&targ, tc.G)
	if err := RunEngine(teng, ctx); err != nil {
		t.Fatal(err)
	}

	defer runUntrack(tc.G, fu, username)

	// Now make her Rooter proof fail with a 429
	flakeyAPI.flakeOut = true
	idUI = &FakeIdentifyUI{}
	ctx.IdentifyUI = idUI

	// Advance so that our previous cached success is out of
	// cache
	fakeClock.Advance(tc.G.Env.GetProofCacheLongDur() + time.Minute)

	eng = NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{noCache: true}

	// Should  get an error
	if err := RunEngine(eng, ctx); err == nil {
		t.Fatal("Expected identify error")
	}

	result, found := idUI.ProofResults["rooter"]
	if !found {
		t.Fatal("Failed to find a rooter proof")
	}
	pe := libkb.ImportProofError(result.ProofResult)
	if pe == nil {
		t.Fatal("expected a Rooter error result")
	}

	t.Logf("Rooter proof result, error: %v, -- %v", result, pe)
	if result.Diff != nil {
		t.Logf("Rooter proof result diff: %v", result.Diff)
	}
	// This is like the UI saying to store the local track
	targ.Options.ExpiringLocal = true

	targ.Token = idUI.Token
	// Track tracy
	teng = NewTrackToken(&targ, tc.G)
	if err := RunEngine(teng, ctx); err != nil {
		t.Fatal(err)
	}

	// Now make her Rooter proof work again
	flakeyAPI.flakeOut = false

	// Identify should work because of the original, permanent track
	eng = NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{noCache: true}
	var err error
	// Should not get an error
	if err = RunEngine(eng, ctx); err != nil {
		t.Logf("Identify failure: %v", err)
		t.Fatal("Expected to pass identify")
	}

	// There shouldn't be a Diff in the result, but if there is, make sure
	// it isn't due to temporary tracking
	result, found = idUI.ProofResults["rooter"]
	if !found || result.Diff.Type != keybase1.TrackDiffType_NONE {
		t.Fatalf("Expected a TrackDiffType_NONE")
	}

	// Advance the clock to make sure local temp track goes away
	fakeClock.Advance(tc.G.Env.GetLocalTrackMaxAge() + time.Minute)

	if err := eng.i2eng.createIdentifyState(ctx); err != nil {
		t.Fatal(err)
	}
	if eng.i2eng.state.TrackLookup() == nil {
		t.Fatalf("Expected permanent LocalTrackChainLinkFor %s", username)
	}
	if eng.i2eng.state.TmpTrackLookup() != nil {
		t.Fatalf("Expected no temporary LocalTrackChainLinkFor %s", username)
	}
	assertTracking(tc, username)
}

type FakeGregorDismisser struct {
	dismissedMsgID gregor.MsgID
}

var _ libkb.GregorDismisser = (*FakeGregorDismisser)(nil)

func (d *FakeGregorDismisser) DismissItem(id gregor.MsgID) error {
	d.dismissedMsgID = id
	return nil
}

func TestTrackWithTokenDismissesGregor(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	dismisser := &FakeGregorDismisser{}
	tc.G.GregorDismisser = dismisser

	msgID := gregor1.MsgID("my_random_id")
	responsibleGregorItem := gregor1.ItemAndMetadata{
		// All we need for this test is the msgID, to check for dismissal.
		Md_: &gregor1.Metadata{
			MsgID_: msgID,
		},
	}

	idUI := &FakeIdentifyUI{}
	username := "t_tracy"
	arg := &keybase1.Identify2Arg{
		UserAssertion: username,
		NeedProofSet:  true,
	}
	ctx := &Context{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   fu.NewSecretUI(),
	}
	eng := NewResolveThenIdentify2(tc.G, arg)
	eng.SetResponsibleGregorItem(&responsibleGregorItem)
	if err := RunEngine(eng, ctx); err != nil {
		tc.T.Fatal(err)
	}
	targ := TrackTokenArg{
		Token:   idUI.Token,
		Options: keybase1.TrackOptions{BypassConfirm: true},
	}
	teng := NewTrackToken(&targ, tc.G)
	if err := RunEngine(teng, ctx); err != nil {
		tc.T.Fatal(err)
	}

	// Check that the dismissed ID matches what we defined above.
	if msgID.String() != dismisser.dismissedMsgID.String() {
		tc.T.Fatalf("Dismissed msgID (%s) != responsible msgID (%s)", msgID.String(), dismisser.dismissedMsgID.String())
	}
}
