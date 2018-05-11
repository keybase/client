// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func TestPaperKeySubmit(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	tc.G.SetService()
	listener := &nlistener{}
	tc.G.NotifyRouter.SetListener(listener)

	// signup and get the paper key
	fu := NewFakeUserOrBust(t, "paper")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	loginUI := &paperLoginUI{Username: fu.Username}
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(tc.G, &arg)
	if err := RunEngine2(NewMetaContextForTest(tc).WithUIs(uis), s); err != nil {
		t.Fatal(err)
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
	m := NewMetaContextForTestWithLogUI(tc)
	eng := NewPaperKeySubmit(tc.G, paperkey)
	if err := RunEngine2(m, eng); err != nil {
		t.Fatal(err)
	}

	assertPaperKeyCached(tc, true)

	if len(listener.paperEncKIDs) != 1 {
		t.Fatalf("num paperkey notifications: %d, expected 1", len(listener.paperEncKIDs))
	}
	if listener.paperEncKIDs[0].NotEqual(eng.pair.encKey.GetKID()) {
		t.Errorf("enc kid from notify: %s, expected %s", listener.paperEncKIDs[0], eng.pair.encKey.GetKID())
	}
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

type nlistener struct {
	libkb.NoopNotifyListener
	paperEncKIDs []keybase1.KID
}

var _ libkb.NotifyListener = (*nlistener)(nil)

func (n *nlistener) PaperKeyCached(uid keybase1.UID, encKID, sigKID keybase1.KID) {
	n.paperEncKIDs = append(n.paperEncKIDs, encKID)
}
