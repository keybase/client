package service

import (
	"testing"

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
	err = handler.UserSetContactSettings(ctx, keybase1.ContactSettings{
		Enabled:              true,
		AllowFolloweeDegrees: 2,
		Teams: []keybase1.TeamContactSettings{
			{TeamID: *teamID,
				AllowFolloweesOfTeamMembers: false,
				Enabled:                     true,
			}},
	})
	require.NoError(t, err)

	// get
	res, err = handler.UserGetContactSettings(ctx)
	require.NoError(t, err)
	require.Equal(t, true, res.Enabled)
	require.Equal(t, 2, res.AllowFolloweeDegrees)
	require.Equal(t, 1, len(res.Teams))
	require.Equal(t, *teamID, res.Teams[0].TeamID)
	require.Equal(t, false, res.Teams[0].AllowFolloweesOfTeamMembers)
	require.Equal(t, true, res.Teams[0].Enabled)
}
