// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"testing"
)

func TestTrackToken(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	trackWithToken(tc, fu, "t_alice")
}

func trackWithToken(tc libkb.TestContext, fu *FakeUser, username string) {
	idUI := &FakeIdentifyUI{}
	idarg := &keybase1.IdentifyArg{UserAssertion: username}
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
		Token:   res.TrackToken,
		Options: keybase1.TrackOptions{BypassConfirm: true},
	}
	teng := NewTrackToken(&arg, tc.G)
	if err := RunEngine(teng, ctx); err != nil {
		tc.T.Fatal(err)
	}

	defer runUntrack(tc.G, fu, username)
	assertTracking(tc, username)
}

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
