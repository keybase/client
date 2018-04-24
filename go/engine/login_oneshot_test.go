package engine

import (
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
	ctx := &Context{
		LogUI:    tc.G.UI.GetLogUI(),
		GPGUI:    &gpgtestui{},
		SecretUI: fu.NewSecretUI(),
		LoginUI:  loginUI,
	}
	s := NewSignupEngine(&arg, tc.G)
	err := RunEngine(s, ctx)
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
	err = RunEngine(eng, &Context{})
	require.NoError(t, err)
	assertNumDevicesAndKeys(tc, fu, 2, 4)
	err = AssertProvisioned(tc2)
	require.NoError(t, err)
	testSign(t, tc2)
}
