// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/service"
)

func TestPassphraseChange(t *testing.T) {
	tc := setupTest(t, "pp")
	tc2 := cloneContext(tc)

	libkb.G.LocalDb = nil

	defer tc.Cleanup()

	stopCh := make(chan error)
	svc := service.NewService(tc.G, false)
	startCh := svc.GetStartChannel()
	go func() {
		err := svc.Run()
		if err != nil {
			t.Logf("Running the service produced an error: %v", err)
		}
		stopCh <- err
	}()
	<-startCh

	userInfo := randomUser("pp")

	sui := signupUI{
		info:         userInfo,
		Contextified: libkb.NewContextified(tc2.G),
	}
	tc2.G.SetUI(&sui)
	signup := client.NewCmdSignupRunner(tc2.G)
	signup.SetTest()

	stopper := client.NewCmdCtlStopRunner(tc2.G)

	if err := signup.Run(); err != nil {
		t.Fatal(err)
	}

	if _, err := tc.G.LoginState().VerifyPlaintextPassphrase(userInfo.passphrase); err != nil {
		t.Fatal(err)
	}

	newPassphrase := userInfo.passphrase + userInfo.passphrase
	sui.info.passphrase = newPassphrase
	change := client.NewCmdPassphraseChangeRunner(tc2.G)

	if err := change.Run(); err != nil {
		t.Fatal(err)
	}

	if _, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase); err != nil {
		t.Fatal(err)
	}

	if err := stopper.Run(); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}

func TestPassphraseRecover(t *testing.T) {
	tc := setupTest(t, "pp")
	defer tc.Cleanup()
}

type passphraseUI struct {
	baseNullUI
	newPassphrase string
	sui           *passphraseSecretUI
	libkb.Contextified
}

func (p *passphraseUI) GetSecretUI() libkb.SecretUI {
	if p.sui == nil {
		p.sui = &passphraseSecretUI{
			newPassphrase: p.newPassphrase,
			Contextified:  libkb.NewContextified(p.G()),
		}
	}
	return p.sui
}

func (p *passphraseUI) GetTerminalUI() libkb.TerminalUI {
	x := &passphraseTerminalUI{
		Contextified: libkb.NewContextified(p.G()),
	}
	x.baseTerminalUI.g = p.G()
	return x
}

type passphraseSecretUI struct {
	getPassphraseCalled bool
	newPassphrase       string
	libkb.Contextified
}

func (p *passphraseSecretUI) GetPassphrase(_ keybase1.GUIEntryArg, _ *keybase1.SecretEntryArg) (res keybase1.GetPassphraseRes, err error) {
	p.getPassphraseCalled = true
	p.G().Log.Debug("passphraseSecretUI used to get passphrase (%s)", p.newPassphrase)
	res.Passphrase = p.newPassphrase
	return res, nil
}

type passphraseTerminalUI struct {
	baseTerminalUI
	libkb.Contextified
}
