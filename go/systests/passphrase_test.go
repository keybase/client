// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
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

	if err := signup.Run(); err != nil {
		t.Fatal(err)
	}

	if _, err := tc.G.LoginState().VerifyPlaintextPassphrase(userInfo.passphrase); err != nil {
		t.Fatal(err)
	}

	oldPassphrase := userInfo.passphrase
	newPassphrase := userInfo.passphrase + userInfo.passphrase
	sui.info.passphrase = newPassphrase
	change := client.NewCmdPassphraseChangeRunner(tc2.G)

	if err := change.Run(); err != nil {
		t.Fatal(err)
	}

	if _, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase); err != nil {
		t.Fatal(err)
	}

	if _, err := tc.G.LoginState().VerifyPlaintextPassphrase(oldPassphrase); err == nil {
		t.Fatal("old passphrase passed verification after passphrase change")
	}

	if err := client.CtlServiceStop(tc2.G); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}

func TestPassphraseRecover(t *testing.T) {
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

	if err := signup.Run(); err != nil {
		t.Fatal(err)
	}

	if _, err := tc.G.LoginState().VerifyPlaintextPassphrase(userInfo.passphrase); err != nil {
		t.Fatal(err)
	}

	// logout before recovering passphrase
	logout := client.NewCmdLogoutRunner(tc2.G)
	if err := logout.Run(); err != nil {
		t.Fatal(err)
	}

	// the paper key displayed during signup is in userInfo now, and it will be used
	// during passphrase recovery
	tc.G.Log.Debug("signup paper key: %s", userInfo.displayedPaperKey)

	oldPassphrase := userInfo.passphrase
	newPassphrase := userInfo.passphrase + userInfo.passphrase
	sui.info.passphrase = newPassphrase
	recoverCmd := client.NewCmdPassphraseRecoverRunner(tc2.G)

	if err := recoverCmd.Run(); err != nil {
		t.Fatal(err)
	}

	if _, err := tc.G.LoginState().VerifyPlaintextPassphrase(newPassphrase); err != nil {
		t.Fatal(err)
	}

	if _, err := tc.G.LoginState().VerifyPlaintextPassphrase(oldPassphrase); err == nil {
		t.Fatal("old passphrase passed verification after passphrase change")
	}

	if err := client.CtlServiceStop(tc2.G); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}
