// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/service"
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

func TestSecretUI(t *testing.T) {
	tc := setupTest(t, "secret_ui")
	tc1 := cloneContext(tc)
	tc2 := cloneContext(tc)

	// Make sure we're not using G anywhere in our tests.
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

	// Wait for the server to start up
	<-startCh

	var err error
	check := func() {
		if err != nil {
			t.Fatal(err)
		}
	}

	sui := newSecretUI()
	cli, xp, err := client.GetRPCClientWithContext(tc2.G)
	check()
	srv := rpc.NewServer(xp, nil)
	err = srv.Register(keybase1.SecretUiProtocol(sui))
	check()
	ncli := keybase1.DelegateUiCtlClient{Cli: cli}
	err = ncli.RegisterSecretUI(context.TODO())
	check()

	// run login command
	loginCmdUI := &loginCmdUI{
		Contextified: libkb.NewContextified(tc2.G),
	}
	tc2.G.SetUI(loginCmdUI)
	cmd := client.NewCmdLoginRunner(tc2.G)
	err = cmd.Run()
	if err == nil {
		t.Fatal("login worked, when it should have failed")
	}

	// check that delegate ui was called:
	if !sui.getKeybasePassphrase {
		t.Logf("secret ui: %+v", sui)
		t.Error("delegate secret UI GetKeybasePassphrase was not called during login cmd")
	}

	stopper := client.NewCmdCtlStopRunner(tc1.G)
	if err := stopper.Run(); err != nil {
		t.Errorf("Error in stopping service: %v", err)
	}

	// If the server failed, it's also an error
	err = <-stopCh
	check()
}

type secretUI struct {
	getKeybasePassphrase  bool
	getNewPassphrase      bool
	getPaperKeyPassphrase bool
	getSecret             bool
	getPassphrase         bool
}

// secretUI implements the keybase1.IdentifyUiInterface
var _ keybase1.SecretUiInterface = (*secretUI)(nil)

func newSecretUI() *secretUI {
	return &secretUI{}
}

func (s *secretUI) GetKeybasePassphrase(context.Context, keybase1.GetKeybasePassphraseArg) (res keybase1.GetPassphraseRes, err error) {
	s.getKeybasePassphrase = true
	return res, nil
}

func (s *secretUI) GetNewPassphrase(context.Context, keybase1.GetNewPassphraseArg) (res keybase1.GetPassphraseRes, err error) {
	s.getNewPassphrase = true
	return res, nil
}

func (s *secretUI) GetPaperKeyPassphrase(context.Context, keybase1.GetPaperKeyPassphraseArg) (string, error) {
	s.getPaperKeyPassphrase = true
	return "", nil
}

func (s *secretUI) GetSecret(context.Context, keybase1.GetSecretArg) (res keybase1.SecretEntryRes, err error) {
	s.getSecret = true
	return res, nil
}

func (s *secretUI) GetPassphrase(context.Context, keybase1.GetPassphraseArg) (res keybase1.GetPassphraseRes, err error) {
	s.getPassphrase = true
	return res, nil
}

type loginCmdUI struct {
	baseNullUI
	libkb.Contextified
}

func (u *loginCmdUI) GetLoginUI() libkb.LoginUI {
	return &loginUI{Contextified: libkb.NewContextified(u.G())}
}

func (u *loginCmdUI) GetProvisionUI(libkb.KexRole) libkb.ProvisionUI {
	return &provisionUI{Contextified: libkb.NewContextified(u.G())}
}

type loginUI struct {
	libkb.Contextified
}

func (u *loginUI) DisplayPaperKeyPhrase(context.Context, keybase1.DisplayPaperKeyPhraseArg) error {
	return nil
}
func (u *loginUI) DisplayPrimaryPaperKey(context.Context, keybase1.DisplayPrimaryPaperKeyArg) error {
	return nil
}
func (u *loginUI) PromptRevokePaperKeys(context.Context, keybase1.PromptRevokePaperKeysArg) (bool, error) {
	return false, nil
}
func (u *loginUI) GetEmailOrUsername(context.Context, int) (string, error) {
	return "t_alice", nil
}

type provisionUI struct {
	libkb.Contextified
}

func (u *provisionUI) ChooseProvisioningMethod(context.Context, keybase1.ChooseProvisioningMethodArg) (keybase1.ProvisionMethod, error) {
	return keybase1.ProvisionMethod_PASSPHRASE, nil
}
func (u *provisionUI) ChooseDeviceType(context.Context, int) (r keybase1.DeviceType, e error) {
	return
}
func (u *provisionUI) DisplayAndPromptSecret(context.Context, keybase1.DisplayAndPromptSecretArg) (r keybase1.SecretResponse, e error) {
	return
}
func (u *provisionUI) DisplaySecretExchanged(context.Context, int) error {
	return nil
}
func (u *provisionUI) PromptNewDeviceName(context.Context, keybase1.PromptNewDeviceNameArg) (string, error) {
	return "", nil
}
func (u *provisionUI) ProvisioneeSuccess(context.Context, keybase1.ProvisioneeSuccessArg) error {
	return nil
}
func (u *provisionUI) ProvisionerSuccess(context.Context, keybase1.ProvisionerSuccessArg) error {
	return nil
}
