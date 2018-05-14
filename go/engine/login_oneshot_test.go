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
	Logout(tc)

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
	testSign(t, tc2)
	err = m.LogoutIfRevoked()
	require.NoError(t, err)
	testSign(t, tc2)
}
