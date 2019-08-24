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

func TestPassphraseRecoverLegacy(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseRecoverLegacy")
	defer tc.Cleanup()
	u, paperkey := CreateAndSignupLPK(tc, "pprec")

	// Changing the password is covered by systests, here we're only
	// testing the typical recovery flow where user only has a paper key.
	Logout(tc)

	// Prepare some UIs to make all of this actually work
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: u.NewSecretUI(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)

	// Now an invalid username should result in a NotProvisioned error
	arg := keybase1.RecoverPassphraseArg{
		Username: "doesntexist",
	}
	require.Equal(t, libkb.NotProvisionedError{},
		NewPassphraseRecover(tc.G, arg).Run(m))

	// This also applies to any account which was not provisioned on the device
	tc2 := SetupEngineTest(t, "PassphraseRecoverLegacy2")
	defer tc2.Cleanup()
	u2 := CreateAndSignupFakeUser(tc2, "pprec")
	arg.Username = u2.Username
	require.Equal(t, libkb.NotProvisionedError{},
		NewPassphraseRecover(tc.G, arg).Run(m))

	// Both "" and u.Username should get the user into the LoginWithPaperKey
	// flow. These tries should both fail with RetryExhausted, since we're not
	// passing a paper key.

	// First test out an empty string, so that it defaults to the currently
	// configured user
	arg.Username = ""
	require.Equal(t, libkb.RetryExhaustedError{},
		NewPassphraseRecover(tc.G, arg).Run(m))

	// And the actual username
	arg.Username = u.Username
	require.Equal(t, libkb.RetryExhaustedError{},
		NewPassphraseRecover(tc.G, arg).Run(m))

	// Now we're getting into actual password changing, but we want to fail
	// on new password input
	uis.SecretUI = &TestSecretUIRecover{
		T:        t,
		PaperKey: paperkey,
	}
	m = m.WithUIs(uis)
	require.IsType(t, libkb.PassphraseError{},
		NewPassphraseRecover(tc.G, arg).Run(m))
	// We should not be logged in even though paperKey login succeeded
	AssertLoggedInLPK(&tc, false)
	AssertDeviceKeysLock(&tc, false)

	// And successfully change the password with a password that's long enough
	uis.SecretUI = &TestSecretUIRecover{
		T:        t,
		PaperKey: paperkey,
		Password: "test1234",
	}
	m = m.WithUIs(uis)
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))
	require.NoError(t, AssertLoggedIn(tc))
	require.NoError(t, AssertProvisioned(tc))
}

func TestPassphraseRecoverLoggedIn(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseRecoverGuideAndReset")
	defer tc.Cleanup()
	libkb.AddEnvironmentFeatureForTest(tc, libkb.EnvironmentFeatureAutoresetPipeline)
	u := CreateAndSignupFakeUser(tc, "pprec")

	// Any input should result in a noop.
	loginUI := &TestLoginUIRecover{}
	uis := libkb.UIs{
		LogUI:       tc.G.UI.GetLogUI(),
		LoginUI:     loginUI,
		SecretUI:    u.NewSecretUI(),
		ProvisionUI: newTestProvisionUINoSecret(),
	}
	m := NewMetaContextForTest(tc).WithUIs(uis)

	// 1) Invalid username
	arg := keybase1.RecoverPassphraseArg{
		Username: "doesntexist",
	}
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))

	// 2) No username (last configured device)
	arg = keybase1.RecoverPassphraseArg{}
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))

	// 3) Valid username
	arg = keybase1.RecoverPassphraseArg{
		Username: u.Username,
	}
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))
}

func TestPassphraseRecoverGuideAndReset(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseRecoverGuideAndReset")
	defer tc.Cleanup()
	libkb.AddEnvironmentFeatureForTest(tc, libkb.EnvironmentFeatureAutoresetPipeline)
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
	loginUI.ResetAccount = true
	uis.ProvisionUI = newTestProvisionUIChooseNoDevice()
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

func TestPassphraseRecoverNoDevices(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseRecoverNoDevices")
	defer tc.Cleanup()
	libkb.AddEnvironmentFeatureForTest(tc, libkb.EnvironmentFeatureAutoresetPipeline)
	u := createFakeUserWithPGPOnly(t, tc)

	// If the only way to provision the account is to do it with a password,
	// the flow should immediately go to autoreset.
	loginUI := &TestLoginUIRecover{
		TestLoginUI: libkb.TestLoginUI{
			PassphraseRecovery: true,
			ResetAccount:       true,
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
	require.Nil(t, assertAutoreset(tc, u.UID(), libkb.AutoresetEventStart))
}

func TestPassphraseRecoverChangeWithPaper(t *testing.T) {
	tc1 := SetupEngineTest(t, "PassphraseRecoverChangeWithPaper")
	defer tc1.Cleanup()
	libkb.AddEnvironmentFeatureForTest(tc1, libkb.EnvironmentFeatureAutoresetPipeline)

	// Prepare two accounts on the same device
	u1, paperkey1 := CreateAndSignupLPK(tc1, "pprec")
	Logout(tc1)
	_, paperkey2 := CreateAndSignupLPK(tc1, "pprec")
	Logout(tc1)

	// And a third one on another one
	tc2 := SetupEngineTest(t, "PassphraseRecoverChangeWithPaper")
	defer tc2.Cleanup()
	u3, paperkey3 := CreateAndSignupLPK(tc2, "pprec")
	Logout(tc2)

	loginUI := &TestLoginUIRecover{}
	provisionUI := newTestProvisionUIPaper()
	uis := libkb.UIs{
		LogUI:   tc1.G.UI.GetLogUI(),
		LoginUI: loginUI,
		SecretUI: &TestSecretUIRecover{
			T:        t,
			PaperKey: paperkey2,
			Password: "test1234",
		},
		ProvisionUI: provisionUI,
	}
	m := NewMetaContextForTest(tc1).WithUIs(uis)
	arg := keybase1.RecoverPassphraseArg{}

	// (2) should work with no username passed on tc1
	arg.Username = ""
	require.NoError(t, NewPassphraseRecover(tc1.G, arg).Run(m))
	require.NoError(t, AssertLoggedIn(tc1))
	require.NoError(t, AssertProvisioned(tc1))
	Logout(tc1)

	// (1) should work the same way with a username passed
	uis.SecretUI = &TestSecretUIRecover{
		T:        t,
		PaperKey: paperkey1,
		Password: "test1234",
	}
	m = m.WithUIs(uis)
	arg.Username = u1.Username
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
	provisionUI = newTestProvisionUIPaper()
	uis.ProvisionUI = provisionUI
	m = m.WithUIs(uis)
	arg.Username = u3.Username

	require.NoError(t, NewPassphraseRecover(tc1.G, arg).Run(m))
	require.Equal(t, 1, provisionUI.calledChooseDevice)
	for _, device := range provisionUI.lastDevices {
		require.NotEqual(t, libkb.DeviceTypePaper, device.Type)
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

	lastExplain *keybase1.ExplainDeviceRecoveryArg
}

func (t *TestLoginUIRecover) ExplainDeviceRecovery(_ context.Context, arg keybase1.ExplainDeviceRecoveryArg) error {
	t.lastExplain = &arg
	return nil
}

func (t *TestLoginUIRecover) Reset() {
	t.lastExplain = nil
}
