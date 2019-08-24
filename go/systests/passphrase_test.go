// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"fmt"
	"io"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/service"
	"github.com/stretchr/testify/require"
)

func TestPassphraseChange(t *testing.T) {
	tc := setupTest(t, "pp")
	defer tc.Cleanup()

	tc2 := cloneContext(tc)
	defer tc2.Cleanup()

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

	m := libkb.NewMetaContextForTest(*tc)
	_, err := libkb.VerifyPassphraseForLoggedInUser(m, userInfo.passphrase)
	require.NoError(t, err, "verified passphrase")

	oldPassphrase := userInfo.passphrase
	newPassphrase := userInfo.passphrase + userInfo.passphrase
	sui.info.passphrase = newPassphrase
	change := client.NewCmdPassphraseChangeRunner(tc2.G)

	if err := change.Run(); err != nil {
		t.Fatal(err)
	}

	_, err = libkb.VerifyPassphraseForLoggedInUser(m, newPassphrase)
	require.NoError(t, err, "verified passphrase")
	_, err = libkb.VerifyPassphraseForLoggedInUser(m, oldPassphrase)
	require.Error(t, err, "old passphrase failed to verify")

	if err := CtlStop(tc2.G); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}

type serviceHandle struct {
	// Emits nil/err when stopped
	stopCh <-chan error
	svc    *service.Service
}

func startNewService(tc *libkb.TestContext) (*serviceHandle, error) {
	stopCh := make(chan error)
	svc := service.NewService(tc.G, false)
	startCh := svc.GetStartChannel()
	go func() {
		err := svc.Run()
		if err != nil {
			tc.T.Logf("Running the service produced an error: %v", err)
		}
		stopCh <- err
	}()

	// Wait for the service to start
	<-startCh

	return &serviceHandle{
		stopCh: stopCh,
		svc:    svc,
	}, nil
}

// Tests recovering a passphrase on a second machine by logging in with paperkey.
func TestPassphraseRecover(t *testing.T) {
	testPassphraseRecover(t, false /* createDeviceClone */)
}

func TestPassphraseRecoverWithDeviceClone(t *testing.T) {
	testPassphraseRecover(t, true /* createDeviceClone */)
}

func testPassphraseRecover(t *testing.T, createDeviceClone bool) {
	t.Logf("Start")

	// Service contexts.
	// Make a new context with cloneContext for each client session.
	tc1 := setupTest(t, "ppa")
	defer tc1.Cleanup()
	tc2 := setupTest(t, "ppb")
	defer tc2.Cleanup()
	var tcClient *libkb.TestContext

	t.Logf("Starting services")
	s1, err := startNewService(tc1)
	require.NoError(t, err)
	s2, err := startNewService(tc2)
	require.NoError(t, err)

	userInfo := randomUser("pp")

	t.Logf("Signup on tc1")
	tcClient = cloneContext(tc1)
	defer tcClient.Cleanup()

	aSignupUI := signupUI{
		info:         userInfo,
		Contextified: libkb.NewContextified(tc1.G),
	}
	tcClient.G.SetUI(&aSignupUI)
	signup := client.NewCmdSignupRunner(tcClient.G)
	signup.SetTest()
	err = signup.Run()
	require.NoError(t, err)
	tcClient = nil

	// the paper key displayed during signup is in userInfo now
	tc2.G.Log.Debug("signup paper key: %s", userInfo.displayedPaperKey)

	// clone the device on tc1
	m1 := libkb.NewMetaContextForTest(*tc1)
	if createDeviceClone {
		libkb.CreateClonedDevice(*tc1, m1)
	}

	t.Logf("Login on tc2")
	tcClient = cloneContext(tc2)
	defer tcClient.Cleanup()

	aProvisionUI := &testRecoverUIProvision{
		username:   userInfo.username,
		paperkey:   userInfo.displayedPaperKey,
		deviceName: "away thing",
	}
	aUI := genericUI{
		g:           tcClient.G,
		LoginUI:     aProvisionUI,
		ProvisionUI: aProvisionUI,
		SecretUI:    aProvisionUI,
	}
	tcClient.G.SetUI(&aUI)
	login := client.NewCmdLoginRunner(tcClient.G)
	err = login.Run()
	require.NoError(t, err)
	tcClient = nil

	t.Logf("Verify on tc1")
	_, err = libkb.VerifyPassphraseForLoggedInUser(m1, userInfo.passphrase)
	require.NoError(t, err)

	oldPassphrase := userInfo.passphrase
	newPassphrase := userInfo.passphrase + userInfo.passphrase
	t.Logf("Passphrase %q -> %q", oldPassphrase, newPassphrase)

	t.Logf("Recover on tc2")
	tcClient = cloneContext(tc2)
	defer tcClient.Cleanup()

	aRecoverUI := &testRecoverUIRecover{
		Contextified: libkb.NewContextified(tc2.G),
		passphrase:   newPassphrase,
	}
	aUI = genericUI{
		g:           tc2.G,
		TerminalUI:  aRecoverUI,
		SecretUI:    aRecoverUI,
		ProvisionUI: aRecoverUI,
		LoginUI:     aRecoverUI,
	}
	tcClient.G.SetUI(&aUI)
	recoverCmd := client.NewCmdPassphraseRecoverRunner(tcClient.G)
	err = recoverCmd.Run()
	require.NoError(t, err)
	tcClient = nil

	t.Logf("Verify new passphrase on tc2")
	m2 := libkb.NewMetaContextForTest(*tc2)
	_, err = libkb.VerifyPassphraseForLoggedInUser(m2, newPassphrase)
	require.NoError(t, err)

	t.Logf("Verify new passphrase on tc1")
	_, err = libkb.VerifyPassphraseForLoggedInUser(m1, newPassphrase)
	require.NoError(t, err)

	t.Logf("Verify old passphrase on tc1")
	_, err = libkb.VerifyPassphraseForLoggedInUser(m1, oldPassphrase)
	require.Error(t, err, "old passphrase passed verification after passphrase change")

	t.Logf("Stop tc1")
	err = CtlStop(tc1.G)
	require.NoError(t, err)

	t.Logf("Stop tc2")
	err = CtlStop(tc2.G)
	require.NoError(t, err)

	t.Logf("Waiting for services to stop")
	// If a service failed, that's an error
	require.NoError(t, <-s1.stopCh)
	require.NoError(t, <-s2.stopCh)
}

type testRecoverUIProvision struct {
	baseNullUI
	username   string
	deviceName string
	paperkey   string
}

func (r *testRecoverUIProvision) GetEmailOrUsername(context.Context, int) (string, error) {
	return r.username, nil
}
func (r *testRecoverUIProvision) PromptRevokePaperKeys(context.Context, keybase1.PromptRevokePaperKeysArg) (ret bool, err error) {
	return false, nil
}
func (r *testRecoverUIProvision) DisplayPaperKeyPhrase(context.Context, keybase1.DisplayPaperKeyPhraseArg) error {
	return nil
}
func (r *testRecoverUIProvision) DisplayPrimaryPaperKey(context.Context, keybase1.DisplayPrimaryPaperKeyArg) error {
	return nil
}
func (r *testRecoverUIProvision) ChooseProvisioningMethod(context.Context, keybase1.ChooseProvisioningMethodArg) (ret keybase1.ProvisionMethod, err error) {
	return keybase1.ProvisionMethod_PASSPHRASE, nil
}
func (r *testRecoverUIProvision) ChooseGPGMethod(context.Context, keybase1.ChooseGPGMethodArg) (ret keybase1.GPGMethod, err error) {
	return ret, nil
}
func (r *testRecoverUIProvision) SwitchToGPGSignOK(context.Context, keybase1.SwitchToGPGSignOKArg) (ret bool, err error) {
	return ret, nil
}
func (r *testRecoverUIProvision) ChooseDeviceType(context.Context, keybase1.ChooseDeviceTypeArg) (ret keybase1.DeviceType, err error) {
	return ret, nil
}
func (r *testRecoverUIProvision) DisplayAndPromptSecret(context.Context, keybase1.DisplayAndPromptSecretArg) (ret keybase1.SecretResponse, err error) {
	return ret, nil
}
func (r *testRecoverUIProvision) DisplaySecretExchanged(context.Context, int) error {
	return nil
}
func (r *testRecoverUIProvision) PromptNewDeviceName(context.Context, keybase1.PromptNewDeviceNameArg) (ret string, err error) {
	return r.deviceName, nil
}
func (r *testRecoverUIProvision) ProvisioneeSuccess(context.Context, keybase1.ProvisioneeSuccessArg) error {
	return nil
}
func (r *testRecoverUIProvision) ProvisionerSuccess(context.Context, keybase1.ProvisionerSuccessArg) error {
	return nil
}
func (r *testRecoverUIProvision) ChooseDevice(ctx context.Context, arg keybase1.ChooseDeviceArg) (ret keybase1.DeviceID, err error) {
	for _, d := range arg.Devices {
		if d.Type == libkb.DeviceTypePaper {
			return d.DeviceID, nil
		}
	}
	return "", nil
}
func (r *testRecoverUIProvision) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (res keybase1.GetPassphraseRes, err error) {
	res.Passphrase = r.paperkey
	return res, nil
}
func (r *testRecoverUIProvision) PromptResetAccount(_ context.Context, arg keybase1.PromptResetAccountArg) (bool, error) {
	return false, nil
}
func (r *testRecoverUIProvision) DisplayResetProgress(_ context.Context, arg keybase1.DisplayResetProgressArg) error {
	return nil
}
func (r *testRecoverUIProvision) PromptPassphraseRecovery(_ context.Context, arg keybase1.PromptPassphraseRecoveryArg) (bool, error) {
	return false, nil
}
func (r *testRecoverUIProvision) ExplainDeviceRecovery(_ context.Context, arg keybase1.ExplainDeviceRecoveryArg) error {
	return nil
}

type testRecoverUIRecover struct {
	libkb.Contextified
	kbtest.TestProvisionUI
	libkb.TestLoginUI
	passphrase string
}

func (n *testRecoverUIRecover) Prompt(pd libkb.PromptDescriptor, s string) (ret string, err error) {
	n.G().Log.Debug("Terminal Prompt %d: %s -> %s (%v)\n", pd, s, ret, libkb.ErrToOk(err))
	return ret, fmt.Errorf("unexpected prompt")
}
func (n *testRecoverUIRecover) PromptPassword(pd libkb.PromptDescriptor, _ string) (string, error) {
	return "", fmt.Errorf("unexpected prompt password")
}
func (n *testRecoverUIRecover) PromptPasswordMaybeScripted(pd libkb.PromptDescriptor, _ string) (string, error) {
	return "", fmt.Errorf("unexpected prompt password")
}
func (n *testRecoverUIRecover) Output(s string) error {
	n.G().Log.Debug("Terminal Output: %s", s)
	return nil
}
func (n *testRecoverUIRecover) OutputDesc(od libkb.OutputDescriptor, s string) error {
	n.G().Log.Debug("Terminal Output %d: %s", od, s)
	return nil
}
func (n *testRecoverUIRecover) Printf(f string, args ...interface{}) (int, error) {
	s := fmt.Sprintf(f, args...)
	n.G().Log.Debug("Terminal Printf: %s", s)
	return len(s), nil
}
func (n *testRecoverUIRecover) PrintfUnescaped(f string, args ...interface{}) (int, error) {
	s := fmt.Sprintf(f, args...)
	n.G().Log.Debug("Terminal PrintfUnescaped: %s", s)
	return len(s), nil
}
func (n *testRecoverUIRecover) Write(b []byte) (int, error) {
	n.G().Log.Debug("Terminal write: %s", string(b))
	return len(b), nil
}
func (n *testRecoverUIRecover) OutputWriter() io.Writer {
	return n
}
func (n *testRecoverUIRecover) UnescapedOutputWriter() io.Writer {
	return n
}
func (n *testRecoverUIRecover) ErrorWriter() io.Writer {
	return n
}
func (n *testRecoverUIRecover) PromptYesNo(pd libkb.PromptDescriptor, s string, def libkb.PromptDefault) (ret bool, err error) {
	n.G().Log.Debug("Terminal PromptYesNo %d: %s -> %s (%v)\n", pd, s, ret, libkb.ErrToOk(err))
	return ret, fmt.Errorf("unexpected prompt yes/no")
}
func (n *testRecoverUIRecover) PromptForConfirmation(prompt string) error {
	return nil
}
func (n *testRecoverUIRecover) Tablify(headings []string, rowfunc func() []string) {
	libkb.Tablify(n.OutputWriter(), headings, rowfunc)
}
func (n *testRecoverUIRecover) TerminalSize() (width int, height int) {
	return 80, 24
}
func (n *testRecoverUIRecover) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (res keybase1.GetPassphraseRes, err error) {
	res.Passphrase = n.passphrase
	return res, nil
}
