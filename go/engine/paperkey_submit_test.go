// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
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
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(&arg, tc.G)
	if err := RunEngine(s, ctx); err != nil {
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
	ctx = &Context{
		LogUI: tc.G.UI.GetLogUI(),
	}
	eng := NewPaperKeySubmit(tc.G, paperkey)
	if err := RunEngine(eng, ctx); err != nil {
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
	paperEncKIDs []keybase1.KID
}

func (n *nlistener) Logout()                                                          {}
func (n *nlistener) Login(username string)                                            {}
func (n *nlistener) ClientOutOfDate(to, uri, msg string)                              {}
func (n *nlistener) UserChanged(uid keybase1.UID)                                     {}
func (n *nlistener) TrackingChanged(uid keybase1.UID, username string)                {}
func (n *nlistener) FSActivity(activity keybase1.FSNotification)                      {}
func (n *nlistener) FavoritesChanged(uid keybase1.UID)                                {}
func (n *nlistener) NewChatActivity(uid keybase1.UID, activity keybase1.ChatActivity) {}
func (n *nlistener) PaperKeyCached(uid keybase1.UID, encKID, sigKID keybase1.KID) {
	n.paperEncKIDs = append(n.paperEncKIDs, encKID)
}
func (n *nlistener) KeyfamilyChanged(uid keybase1.UID) {}
