package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestLoginOneshot(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()
	fu := NewFakeUserOrBust(t, "paper")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	arg.StoreSecret = true
	loginUI := &paperLoginUI{Username: fu.Username}
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(tc.G, &arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, s)
	require.NoError(t, err)
	require.True(t, len(loginUI.PaperPhrase) > 0)

	assertNumDevicesAndKeys(tc, fu, 2, 4)
	assertSecretStored(tc, fu.Username)
	Logout(tc)
	assertSecretNotStored(tc, fu.Username)

	tc2 := SetupEngineTest(t, "login")
	defer tc2.Cleanup()

	eng := NewLoginOneshot(tc2.G, keybase1.LoginOneshotArg{
		Username: fu.NormalizedUsername().String(),
		PaperKey: loginUI.PaperPhrase,
	})
	m = NewMetaContextForTest(tc2)
	err = RunEngine2(m, eng)
	require.NoError(t, err)
	assertNumDevicesAndKeys(tc, fu, 2, 4)
	err = AssertProvisioned(tc2)
	require.NoError(t, err)

	// assert paper key generation works
	uis = libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: fu.NewSecretUI(),
	}
	eng2 := NewPaperKey(tc.G)
	m = m.WithUIs(uis)
	err = RunEngine2(m, eng2)
	require.NoError(t, err)
	require.NotZero(t, len(eng2.Passphrase()))

	testSign(t, tc2)
	trackAlice(tc2, fu, 2)
	err = m.LogoutAndDeprovisionIfRevoked()
	require.NoError(t, err)
	testSign(t, tc2)

}

// Test for the case that we hit, where a user has a regular keybase service + electron running,
// and also a bot running on the same machine in oneshot mode. If the oneshot bot logs out,
// it shouldn't molest the system keystore.  This tests repros and tests that case.
func TestLoginOneshotNoLogout(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()
	fu := NewFakeUserOrBust(t, "paper")
	arg := MakeTestSignupEngineRunArg(fu)
	arg.SkipPaper = false
	arg.StoreSecret = true
	loginUI := &paperLoginUI{Username: fu.Username}
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(tc.G, &arg)
	m := NewMetaContextForTest(tc).WithUIs(uis)
	err := RunEngine2(m, s)
	require.NoError(t, err)
	require.True(t, len(loginUI.PaperPhrase) > 0)

	assertNumDevicesAndKeys(tc, fu, 2, 4)
	assertSecretStored(tc, fu.Username)

	tc2 := SetupEngineTest(t, "login")
	tc2.G.Env.Test.DevelName = tc.G.Env.Test.DevelName

	// Assert that tc2 and tc share the same keychain, since they are
	// on the same machine with the above testing flag override. This only
	// works on Darwin due to the global nature of the keychain.
	if libkb.RuntimeGroup() == keybase1.RuntimeGroup_DARWINLIKE {
		assertSecretStored(tc2, fu.Username)
	}
	defer tc2.Cleanup()

	eng := NewLoginOneshot(tc2.G, keybase1.LoginOneshotArg{
		Username: fu.NormalizedUsername().String(),
		PaperKey: loginUI.PaperPhrase,
	})
	m = NewMetaContextForTest(tc2)
	err = RunEngine2(m, eng)
	require.NoError(t, err)
	assertNumDevicesAndKeys(tc, fu, 2, 4)
	err = AssertProvisioned(tc2)
	require.NoError(t, err)

	// This is the crux of the test --- logout in the oneshot regime (via Logout(tc2))
	// but make sure that the standard install isn't touched. Hence, we need to clear
	// the memory store to make sure it also doesn't get in the way of the test.
	tc.G.SecretStore().ClearMem()
	assertSecretStored(tc, fu.Username)
	Logout(tc2)
	tc.G.SecretStore().ClearMem()
	assertSecretStored(tc, fu.Username)
}
