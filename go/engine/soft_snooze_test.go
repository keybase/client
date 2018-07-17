// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
)

type flakeyRooterAPI struct {
	orig     libkb.ExternalAPI
	flakeOut bool
	hardFail bool
	G        *libkb.GlobalContext
}

func newFlakeyRooterAPI(x libkb.ExternalAPI) *flakeyRooterAPI {
	return &flakeyRooterAPI{
		orig: x,
	}
}

func (e *flakeyRooterAPI) GetText(arg libkb.APIArg) (*libkb.ExternalTextRes, error) {
	e.G.Log.Debug("| flakeyRooterAPI.GetText, hard = %v, flake = %v", e.hardFail, e.flakeOut)
	return e.orig.GetText(arg)
}

func (e *flakeyRooterAPI) Get(m libkb.MetaContext, arg libkb.APIArg) (res *libkb.ExternalAPIRes, err error) {
	m.CDebugf("| flakeyRooterAPI.Get, hard = %v, flake = %v", e.hardFail, e.flakeOut)
	// Show an error if we're in flakey mode
	if strings.Contains(arg.Endpoint, "rooter") {
		if e.hardFail {
			return &libkb.ExternalAPIRes{HTTPStatus: 404}, &libkb.APIError{Msg: "NotFound", Code: 404}
		}
		if e.flakeOut {
			return &libkb.ExternalAPIRes{HTTPStatus: 429}, &libkb.APIError{Msg: "Ratelimited", Code: 429}
		}
	}

	return e.orig.Get(m, arg)
}

func (e *flakeyRooterAPI) GetHTML(arg libkb.APIArg) (res *libkb.ExternalHTMLRes, err error) {
	e.G.Log.Debug("| flakeyRooterAPI.GetHTML, hard = %v, flake = %v", e.hardFail, e.flakeOut)
	return e.orig.GetHTML(arg)
}

func (e *flakeyRooterAPI) Post(arg libkb.APIArg) (res *libkb.ExternalAPIRes, err error) {
	return e.orig.Post(arg)
}

func (e *flakeyRooterAPI) PostHTML(arg libkb.APIArg) (res *libkb.ExternalHTMLRes, err error) {
	return e.orig.PostHTML(arg)
}

func TestSoftSnooze(t *testing.T) {
	tc := SetupEngineTest(t, "track")
	defer tc.Cleanup()
	sigVersion := libkb.GetDefaultSigVersion(tc.G)

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)
	fu := CreateAndSignupFakeUser(tc, "track")

	flakeyAPI := flakeyRooterAPI{orig: tc.G.XAPI, flakeOut: false, G: tc.G}
	tc.G.XAPI = &flakeyAPI

	idUI := &FakeIdentifyUI{}
	username := "t_tracy"
	arg := &keybase1.Identify2Arg{
		UserAssertion:    username,
		NeedProofSet:     true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
	}
	uis := libkb.UIs{
		LogUI:      tc.G.UI.GetLogUI(),
		IdentifyUI: idUI,
		SecretUI:   fu.NewSecretUI(),
	}
	// Identify tracy; all proofs should work
	eng := NewResolveThenIdentify2(tc.G, arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	sv := keybase1.SigVersion(sigVersion)
	targ := TrackTokenArg{
		Token:   idUI.Token,
		Options: keybase1.TrackOptions{BypassConfirm: true, SigVersion: &sv},
	}

	// Track tracy
	teng := NewTrackToken(tc.G, &targ)
	if err := RunEngine2(m, teng); err != nil {
		t.Fatal(err)
	}

	defer runUntrack(tc, fu, username, sigVersion)

	// Now make her Rooter proof flakey / fail with a 429
	flakeyAPI.flakeOut = true
	idUI = &FakeIdentifyUI{}
	m = m.WithIdentifyUI(idUI)

	// Advance so that our previous cached success is out of
	// cache on its own, but still can override a 429-like soft failure.
	fakeClock.Advance(tc.G.Env.GetProofCacheMediumDur() + time.Minute)

	eng = NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{noCache: true}
	// Should not get an error
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}
	result, found := idUI.ProofResults["rooter"]
	if !found {
		t.Fatal("Failed to find a rooter proof")
	}
	if pe := libkb.ImportProofError(result.SnoozedResult); pe == nil {
		t.Fatal("expected a snoozed error result")
	}

	// Now time out the success that allowed us to circumvent
	// the soft failure.
	fakeClock.Advance(tc.G.Env.GetProofCacheLongDur())
	eng = NewResolveThenIdentify2(tc.G, arg)
	eng.testArgs = &Identify2WithUIDTestArgs{noCache: true}
	idUI = &FakeIdentifyUI{}
	m = m.WithIdentifyUI(idUI)
	if err := RunEngine2(m, eng); err == nil {
		t.Fatal("Expected a failure in our proof")
	}

	result, found = idUI.ProofResults["rooter"]
	if !found {
		t.Fatal("Failed to find a rooter proof")
	}
	if pe := libkb.ImportProofError(result.ProofResult); pe == nil {
		t.Fatal("expected a Rooter error result")
	}
	if !idUI.BrokenTracking {
		t.Fatal("expected broken tracking!")
	}

	assertTracking(tc, username)
}
