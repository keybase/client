// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func TestPassphraseRecoverLoggedIn(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseRecoverGuideAndReset")
	defer tc.Cleanup()
	u := CreateAndSignupFakeUser(tc, "pprec")

	loginUI := &TestLoginUIRecover{}
	uis := libkb.UIs{
		LogUI:       tc.G.UI.GetLogUI(),
		LoginUI:     loginUI,
		SecretUI:    u.NewSecretUI(),
		ProvisionUI: newTestProvisionUINoSecret(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)

	args := []keybase1.RecoverPassphraseArg{
		// 1) Invalid username
		{Username: "doesntexist"},
		// 2) No username (last configured device)
		{},
		// 3) Valid username
		{Username: u.Username},
	}

	for _, arg := range args {
		// The args don't matter - passphrase recover does not work when you
		// are logged in.
		err := NewPassphraseRecover(tc.G, arg).Run(m)
		require.Error(t, err)
		require.IsType(t, err, libkb.LoggedInError{})
	}
}

func TestPassphraseRecoverGuideAndReset(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseRecoverGuideAndReset")
	defer tc.Cleanup()
	u := CreateAndSignupFakeUser(tc, "pprec")
	Logout(tc)

	// Here we're exploring a bunch of flows where the engine will explain to
	// the user how to change their password. Eventually we'll enter the reset
	// pipeline.

	// We're starting off with all the required UIs
	loginUI := &TestLoginUIRecover{}
	uis := libkb.UIs{
		LogUI:       tc.G.UI.GetLogUI(),
		LoginUI:     loginUI,
		SecretUI:    u.NewSecretUI(),
		ProvisionUI: newTestProvisionUINoSecret(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)

	// With autoreset enabled we don't necessarily require the device to be
	// preconfigured with an account, so instead of "NotProvisioned" we expect
	// a "NotFound" here.
	arg := keybase1.RecoverPassphraseArg{
		Username: "doesntexist",
	}
	require.Equal(t, libkb.NotFoundError{},
		NewPassphraseRecover(tc.G, arg).Run(m))

	// Make sure that empty username shows the correct devices
	arg.Username = ""
	loginUI.chooseDevice = keybase1.DeviceTypeV2_DESKTOP
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))
	require.Equal(t, keybase1.DeviceType_DESKTOP, loginUI.lastExplain.Kind)
	require.Equal(t, defaultDeviceName, loginUI.lastExplain.Name)

	// Expect same behaviour for an existing username
	arg.Username = u.Username
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))
	require.Equal(t, keybase1.DeviceType_DESKTOP, loginUI.lastExplain.Kind)
	require.Equal(t, defaultDeviceName, loginUI.lastExplain.Name)

	// Should work even for a user that isnt configured on the device
	tc2 := SetupEngineTest(t, "PassphraseRecoverGuideAndReset2")
	defer tc2.Cleanup()
	u2 := CreateAndSignupFakeUser(tc2, "pprec")
	arg.Username = u2.Username
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))
	require.Equal(t, keybase1.DeviceType_DESKTOP, loginUI.lastExplain.Kind)
	require.Equal(t, defaultDeviceName, loginUI.lastExplain.Name)

	// You should be able to enter the pipeline without a password on both
	// accounts.
	loginUI.Reset()
	loginUI.PassphraseRecovery = true
	loginUI.ResetAccount = keybase1.ResetPromptResponse_CONFIRM_RESET
	loginUI.chooseDevice = keybase1.DeviceTypeV2_NONE
	m = NewMetaContextForTest(tc).WithUIs(uis)

	arg.Username = u.Username
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))
	require.Nil(t, loginUI.lastExplain)
	require.Nil(t, assertAutoreset(tc, u.UID(), libkb.AutoresetEventStart))

	arg.Username = u2.Username
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))
	require.Nil(t, loginUI.lastExplain)
	require.Nil(t, assertAutoreset(tc, u2.UID(), libkb.AutoresetEventStart))
}

func TestPassphraseRecoverPGPOnly(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseRecoverPGPOnly")
	defer tc.Cleanup()
	u := createFakeUserWithPGPOnly(t, tc)

	// If the only way to provision the account is to do it with a password,
	// the flow should immediately go to autoreset.
	loginUI := &TestLoginUIRecover{
		TestLoginUI: libkb.TestLoginUI{
			PassphraseRecovery: true,
			ResetAccount:       keybase1.ResetPromptResponse_CONFIRM_RESET,
		},
	}
	uis := libkb.UIs{
		LogUI:       tc.G.UI.GetLogUI(),
		LoginUI:     loginUI,
		SecretUI:    u.NewSecretUI(),
		ProvisionUI: newTestProvisionUINoSecret(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)

	arg := keybase1.RecoverPassphraseArg{
		Username: u.Username,
	}
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))
	require.Nil(t, loginUI.lastExplain)

	// Should be pending verification
	require.Nil(t, assertAutoreset(tc, u.UID(), libkb.AutoresetEventStart))
}

func TestPassphraseRecoverNoDevices(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseRecoverNoDevices")
	defer tc.Cleanup()
	username, passphrase := createFakeUserWithNoKeys(tc)

	// If the only way to provision the account is to do it with a password,
	// the flow should immediately go to autoreset.
	loginUI := &TestLoginUIRecover{
		TestLoginUI: libkb.TestLoginUI{
			PassphraseRecovery: true,
			ResetAccount:       keybase1.ResetPromptResponse_CONFIRM_RESET,
		},
	}
	uis := libkb.UIs{
		LogUI:       tc.G.UI.GetLogUI(),
		LoginUI:     loginUI,
		SecretUI:    &libkb.TestSecretUI{Passphrase: passphrase},
		ProvisionUI: newTestProvisionUINoSecret(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)

	arg := keybase1.RecoverPassphraseArg{
		Username: username,
	}
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))
	require.Nil(t, loginUI.lastExplain)

	// Should not be in the reset queue
	require.Nil(t, assertAutoreset(tc, libkb.UsernameToUID(username), -1))
}

func TestPassphraseRecoverChangeWithPaper(t *testing.T) {
	tc1 := SetupEngineTest(t, "PassphraseRecoverChangeWithPaper")
	defer tc1.Cleanup()

	// Prepare two accounts on the same device
	u1, paperkey1 := CreateAndSignupLPK(tc1, "pprec")
	Logout(tc1)
	u2, paperkey2 := CreateAndSignupLPK(tc1, "pprec")
	Logout(tc1)

	// And a third one on another one
	tc2 := SetupEngineTest(t, "PassphraseRecoverChangeWithPaper")
	defer tc2.Cleanup()
	u3, paperkey3 := CreateAndSignupLPK(tc2, "pprec")
	Logout(tc2)

	loginUI := &TestLoginUIRecover{}
	uis := libkb.UIs{
		LogUI:   tc1.G.UI.GetLogUI(),
		LoginUI: loginUI,
		SecretUI: &TestSecretUIRecover{
			T:        t,
			PaperKey: paperkey2,
			Password: "test1234",
		},
		ProvisionUI: newTestProvisionUI(),
	}
	m := NewMetaContextForTest(tc1).WithUIs(uis)
	arg := keybase1.RecoverPassphraseArg{}

	// should work with no username passed on tc1
	arg.Username = ""
	loginUI.chooseDevice = keybase1.DeviceTypeV2_PAPER
	loginUI.Username = u2.Username
	require.NoError(t, NewPassphraseRecover(tc1.G, arg).Run(m))
	require.NoError(t, AssertLoggedIn(tc1))
	require.NoError(t, AssertProvisioned(tc1))
	Logout(tc1)

	// should work the same way with a username passed
	uis.SecretUI = &TestSecretUIRecover{
		T:        t,
		PaperKey: paperkey1,
		Password: "test1234",
	}
	m = m.WithUIs(uis)
	arg.Username = u1.Username
	loginUI.Username = ""
	require.NoError(t, NewPassphraseRecover(tc1.G, arg).Run(m))
	require.NoError(t, AssertLoggedIn(tc1))
	require.NoError(t, AssertProvisioned(tc1))
	Logout(tc1)

	// (3) should fail
	uis.SecretUI = &TestSecretUIRecover{
		T:        t,
		PaperKey: paperkey3,
		Password: "test1234",
	}
	loginUI = &TestLoginUIRecover{
		chooseDevice: keybase1.DeviceTypeV2_PAPER,
	}
	uis.LoginUI = loginUI
	m = m.WithUIs(uis)
	arg.Username = u3.Username

	require.NoError(t, NewPassphraseRecover(tc1.G, arg).Run(m))
	require.Equal(t, 1, loginUI.calledChooseDevice)
	for _, device := range loginUI.lastDevices {
		require.NotEqual(t, keybase1.DeviceTypeV2_PAPER, device.Type)
	}
	require.Error(t, AssertLoggedIn(tc1))
	require.Error(t, AssertProvisioned(tc1))
	require.Nil(t, assertAutoreset(tc1, u3.UID(), -1))
}

type TestSecretUIRecover struct {
	T                  *testing.T
	PaperKey           string
	Password           string
	GetPassphraseCalls int
}

func (t *TestSecretUIRecover) GetPassphrase(p keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	t.GetPassphraseCalls++

	switch p.Type {
	case keybase1.PassphraseType_PAPER_KEY:
		return keybase1.GetPassphraseRes{
			Passphrase:  t.PaperKey,
			StoreSecret: false,
		}, nil
	case keybase1.PassphraseType_PASS_PHRASE,
		keybase1.PassphraseType_VERIFY_PASS_PHRASE:
		return keybase1.GetPassphraseRes{
			Passphrase:  t.Password,
			StoreSecret: false,
		}, nil
	default:
		return keybase1.GetPassphraseRes{}, fmt.Errorf("Invalid passphrase type, got %v", p.Type)
	}
}

type TestLoginUIRecover struct {
	libkb.TestLoginUI

	calledChooseDevice int
	chooseDevice       keybase1.DeviceTypeV2
	lastDevices        []keybase1.Device

	lastExplain *keybase1.ExplainDeviceRecoveryArg
}

func (t *TestLoginUIRecover) ExplainDeviceRecovery(_ context.Context, arg keybase1.ExplainDeviceRecoveryArg) error {
	t.lastExplain = &arg
	return nil
}

func (t *TestLoginUIRecover) Reset() {
	t.lastExplain = nil
}

func (t *TestLoginUIRecover) ChooseDeviceToRecoverWith(_ context.Context, arg keybase1.ChooseDeviceToRecoverWithArg) (keybase1.DeviceID, error) {
	t.calledChooseDevice++
	t.lastDevices = arg.Devices

	if len(arg.Devices) == 0 || t.chooseDevice == keybase1.DeviceTypeV2_NONE {
		return "", nil
	}
	for _, d := range arg.Devices {
		if d.Type == t.chooseDevice {
			return d.DeviceID, nil
		}
	}
	return "", nil
}
