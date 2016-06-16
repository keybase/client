// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestPaperKeySubmit(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	// signup and get the paper key
	fu := NewFakeUserOrBust(t, "paper")
	arg := MakeTestSignupEngineRunArg(fu)
	loginUI := &paperLoginUI{Username: fu.Username}
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(&arg, tc.G)
	if err := RunEngine(s, ctx); err != nil {
		tc.T.Fatal(err)
	}

	assertNumDevicesAndKeys(tc, fu, 2, 4)

	Logout(tc)

	paperkey := loginUI.PaperPhrase
	if len(paperkey) == 0 {
		t.Fatal("login ui has no paper key phrase")
	}

	fu.LoginOrBust(tc)

	assertPaperKeyCached(tc, false)

	// submit the paper key
	ctx = &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}
	eng := NewPaperKeySubmit(tc.G, paperkey)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	assertPaperKeyCached(tc, true)
}

func assertPaperKeyCached(tc libkb.TestContext, wantCached bool) {
	var sk, ek libkb.GenericKey
	tc.G.LoginState().Account(func(a *libkb.Account) {
		sk = a.GetUnlockedPaperSigKey()
		ek = a.GetUnlockedPaperEncKey()
	}, "assertPaperKeyCached")

	isCached := sk != nil && ek != nil
	if isCached != wantCached {
		tc.T.Fatalf("paper key cached: %v, expected %v", isCached, wantCached)
	}
}
