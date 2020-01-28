package service

import (
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestCheckPassphrase(t *testing.T) {
	tc := libkb.SetupTest(t, "pche", 3)
	defer tc.Cleanup()

	fu, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)
	ctx := context.Background()
	ret, err := handler.PassphraseCheck(ctx, keybase1.PassphraseCheckArg{
		Passphrase: fu.Passphrase,
	})
	require.NoError(t, err)
	require.True(t, ret)

	// Bad passphrase should come back as ret=false and no error.
	ret, err = handler.PassphraseCheck(ctx, keybase1.PassphraseCheckArg{
		Passphrase: fu.Passphrase + " ",
	})
	require.NoError(t, err)
	require.False(t, ret)

	// Other errors should come back as errors.
	kbtest.Logout(tc)
	_, err = handler.PassphraseCheck(ctx, keybase1.PassphraseCheckArg{
		Passphrase: fu.Passphrase + " ",
	})
	require.Error(t, err)
}

func TestRecoverUsernameWithEmail(t *testing.T) {
	tc := libkb.SetupTest(t, "recu", 3)
	defer tc.Cleanup()

	fu, err := kbtest.CreateAndSignupFakeUser("rcu", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)
	ctx := context.Background()

	// We are not going to check if the email was sent, but we
	// are testing if we can call this RPC on both logged and
	// unlogged session.

	err = handler.RecoverUsernameWithEmail(ctx, keybase1.RecoverUsernameWithEmailArg{
		Email: fu.Email,
	})
	require.NoError(t, err)

	kbtest.Logout(tc)

	err = handler.RecoverUsernameWithEmail(ctx, keybase1.RecoverUsernameWithEmailArg{
		Email: fu.Email,
	})
	require.NoError(t, err)

	// `"bad"+fu.Email will receive an email saying a "username was requested
	// but no user exists in keybase" rather than returning an error so we don't
	// expose to the caller if an email exists in the system or not.
	err = handler.RecoverUsernameWithEmail(ctx, keybase1.RecoverUsernameWithEmailArg{
		Email: "bad+" + fu.Email,
	})
	require.NoError(t, err)
}

func TestContactSettingsAPI(t *testing.T) {
	tc := libkb.SetupTest(t, "cset", 3)
	defer tc.Cleanup()

	// setup
	user, err := kbtest.CreateAndSignupFakeUser("cset", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)
	ctx := context.Background()

	teamName := user.Username + "t"
	teamID, err := teams.CreateRootTeam(ctx, tc.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	require.NotNil(t, teamID)

	// get
	res, err := handler.UserGetContactSettings(ctx)
	require.NoError(t, err)

	// set
	settings := keybase1.ContactSettings{
		Enabled:              true,
		AllowGoodTeams:       true,
		AllowFolloweeDegrees: 2,
		Teams: []keybase1.TeamContactSettings{
			{TeamID: *teamID,
				Enabled: true,
			}},
	}
	expectedSettings := settings
	err = handler.UserSetContactSettings(ctx, settings)
	require.NoError(t, err)

	// get
	res, err = handler.UserGetContactSettings(ctx)
	require.NoError(t, err)
	res.Version = nil
	require.Equal(t, expectedSettings, res)
}

func TestContactSettingsAPIBadInputs(t *testing.T) {
	tc := libkb.SetupTest(t, "cset", 3)
	defer tc.Cleanup()

	// setup
	user, err := kbtest.CreateAndSignupFakeUser("cset", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)
	ctx := context.Background()

	teamName := user.Username + "t"
	teamID, err := teams.CreateRootTeam(ctx, tc.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	require.NotNil(t, teamID)

	// set enabled=true, allowFolloweeDegrees>2
	settings := keybase1.ContactSettings{
		Enabled:              true,
		AllowGoodTeams:       true,
		AllowFolloweeDegrees: 3,
		Teams:                nil,
	}
	err = handler.UserSetContactSettings(ctx, settings)
	require.Error(t, err)
}

func TestCancelReset(t *testing.T) {
	tc := libkb.SetupTest(t, "arst", 3)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("arst", tc.G)
	require.NoError(t, err)

	handler := NewAccountHandler(nil, tc.G)

	// Can't reset if we are not in autoreset, but it shouldn't log us out or
	// anything like that.
	err = handler.CancelReset(context.Background(), 0)
	require.Error(t, err)
	_, isLoggedOutErr := err.(UserWasLoggedOutError)
	require.False(t, isLoggedOutErr)
	require.True(t, tc.G.ActiveDevice.UID().Exists())

	{
		// Make special tc to start resetting our user, because we can't
		// enroll to reset from a logged-in device.
		tc2 := libkb.SetupTest(t, "arst", 3)
		defer tc2.Cleanup()

		uis := libkb.UIs{
			SecretUI: &libkb.TestSecretUI{},
			LogUI:    tc.G.UI.GetLogUI(),
			LoginUI:  &libkb.TestLoginUI{},
		}
		eng := engine.NewAccountReset(tc2.G, user.Username)
		eng.SetPassphrase(user.Passphrase)
		err = engine.RunEngine2(libkb.NewMetaContextForTest(tc2).WithUIs(uis), eng)
		require.NoError(t, err)
	}

	err = handler.CancelReset(context.Background(), 0)
	require.NoError(t, err)
}

func TestCancelAutoresetWhenRevoked(t *testing.T) {
	// `CancelReset` RPC is special in a way that it calls
	// `LogoutAndDeprovisionIfRevoked` to log out if user is revoked (because
	// the reset has already been completed for example). This is needed
	// because GUI can be stuck in "Autoreset modal" mode, and `CancelReset` is
	// the only RPC that user can trigger from that state.

	tc1 := libkb.SetupTest(t, "arst", 3)
	defer tc1.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("arst", tc1.G)
	require.NoError(t, err)

	tc2 := libkb.SetupTest(t, "lockdown_second", 3)
	defer tc2.Cleanup()
	kbtest.ProvisionNewDeviceKex(&tc1, &tc2, user, keybase1.DeviceTypeV2_DESKTOP)

	// Reset account using tc1.
	kbtest.ResetAccount(tc1, user)

	// tc2 does not know that account has been reset (no service tasks / gregor
	// notifications in this test). Assume user clicks "Cancel reset" in the
	// modal window.

	handler := NewAccountHandler(nil, tc2.G)
	ctx := context.Background()

	// We should be logged in now.
	require.True(t, tc2.G.ActiveDevice.UID().Exists())

	err = handler.CancelReset(ctx, 0)
	require.Error(t, err)
	require.IsType(t, UserWasLoggedOutError{}, err)

	// `CancelReset` should have logged us out.
	require.True(t, tc2.G.ActiveDevice.UID().IsNil())
}
