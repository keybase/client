// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func TestPassphraseRecoverLegacy(t *testing.T) {
	tc := SetupEngineTest(t, "PassphraseRecover")
	defer tc.Cleanup()
	u, paperkey := CreateAndSignupLPK(tc, "pprec")

	// Should not do anything logged in, even if we pass an invalid username
	// If it did anything, it would crash due to lack of UIs.
	uis := libkb.UIs{}
	arg := keybase1.RecoverPassphraseArg{}
	m := NewMetaContextForTest(tc).WithUIs(uis)
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))

	// Run the same thing but with a specified username:
	// 1) A valid one
	arg.Username = u.Username
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))
	// 2) An invalid one
	arg.Username = "doesntexist"
	require.NoError(t, NewPassphraseRecover(tc.G, arg).Run(m))

	// Log out to make the engine actually work
	Logout(tc)

	// Prepare some UIs to make all of this actually work
	uis = libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: u.NewSecretUI(),
	}
	m = m.WithUIs(uis)

	// Now an invalid username should result in a NotProvisioned error
	arg.Username = "doesntexist"
	require.Equal(t, libkb.NotProvisionedError{}, NewPassphraseRecover(tc.G, arg).Run(m))

	// This also applies to any account which was not provisioned on the device
	tc2 := SetupEngineTest(t, "PassphraseRecover2")
	defer tc2.Cleanup()
	u2 := CreateAndSignupFakeUser(tc2, "pprec")
	arg.Username = u2.Username
	require.Equal(t, libkb.NotProvisionedError{}, NewPassphraseRecover(tc.G, arg).Run(m))

	// Both "" and u.Username should result in getting into the LoginWithPaperKey flow
	// These tries should both fail with RetryExhausted, since we're not passing a paper key.

	// First test out an empty string, so that it defaults to the currently configured user
	arg.Username = ""
	require.Equal(t, libkb.RetryExhaustedError{}, NewPassphraseRecover(tc.G, arg).Run(m))

	// And the actual username
	arg.Username = u.Username
	require.Equal(t, libkb.RetryExhaustedError{}, NewPassphraseRecover(tc.G, arg).Run(m))

	// Now we're getting into actual password changing, but we want to fail on new password input
	uis.SecretUI = &TestSecretUIRecover{
		T:        t,
		PaperKey: paperkey,
	}
	m = m.WithUIs(uis)
	require.IsType(t, libkb.PassphraseError{}, NewPassphraseRecover(tc.G, arg).Run(m))
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
