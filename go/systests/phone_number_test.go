package systests

import (
	"context"
	"fmt"
	"net/url"
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamWithPhoneNumber(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")

	phone := kbtest.GenerateTestPhoneNumber()
	impteamName := fmt.Sprintf("%s@phone,%s", phone, ann.username)
	teamID, err := ann.lookupImplicitTeam(true /* create */, impteamName, false /* public */)
	require.NoError(t, err)

	t.Logf("Created team %s -> %s", impteamName, teamID)

	teamObj := ann.loadTeamByID(teamID, true /* admin */)
	require.Equal(t, 1, teamObj.NumActiveInvites())
	var invite keybase1.TeamInvite
	for _, invite = range teamObj.GetActiveAndObsoleteInvites() {
		// Get first invite to local var
	}
	require.EqualValues(t, phone, invite.Name)
	invCat, err := invite.Type.C()
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamInviteCategory_PHONE, invCat)

	name, err := teamObj.ImplicitTeamDisplayName(context.Background())
	require.NoError(t, err)
	require.Len(t, name.Writers.KeybaseUsers, 1)
	require.Len(t, name.Writers.UnresolvedUsers, 1)
	require.Equal(t, impteamName, name.String())
}

func TestResolvePhoneToUser(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")
	tt.logUserNames()

	phone := kbtest.GenerateTestPhoneNumber()

	assertion := fmt.Sprintf("%s@phone", phone)
	for _, u := range tt.users {
		_, res, err := u.tc.G.Resolver.ResolveUser(u.MetaContext(), assertion)
		require.Error(t, err)
		require.IsType(t, libkb.ResolutionError{}, err)
		require.Contains(t, err.Error(), assertion)
		require.Contains(t, err.Error(), "No resolution found")
		require.Empty(t, res.GetUID())
		require.Empty(t, res.GetUsername())
	}

	cli := &client.CmdAddPhoneNumber{
		Contextified: libkb.NewContextified(bob.tc.G),
		PhoneNumber:  "+" + phone,
	}
	err := cli.Run()
	require.NoError(t, err)

	code, err := kbtest.GetPhoneVerificationCode(bob.MetaContext(), keybase1.PhoneNumber("+"+phone))
	require.NoError(t, err)

	cli2 := &client.CmdVerifyPhoneNumber{
		Contextified: libkb.NewContextified(bob.tc.G),
		PhoneNumber:  "+" + phone,
		Code:         code,
	}
	err = cli2.Run()
	require.NoError(t, err)

	for _, u := range tt.users {
		usr, res, err := u.tc.G.Resolver.ResolveUser(u.MetaContext(), assertion)
		require.NoError(t, err)
		require.Equal(t, bob.username, res.GetUsername())
		require.Equal(t, bob.username, usr.Username)
		require.Equal(t, bob.uid, res.GetUID())
		require.Equal(t, bob.uid, usr.Uid)
		require.True(t, res.IsServerTrust())
	}

	// Try to create impteam with now-resolvable phone number.
	impteamName := fmt.Sprintf("%s,%s", assertion, ann.username)
	lookupRes, err := ann.lookupImplicitTeam2(true /* create */, impteamName, false /* public */)
	require.NoError(t, err)
	require.Equal(t, fmt.Sprintf("%s,%s", ann.username, bob.username), lookupRes.DisplayName.String())
}

func TestInvalidPhoneNumberResolve(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	_, _, err := ann.tc.G.Resolver.ResolveUser(ann.MetaContext(), "111@phone")
	require.Error(t, err)
	require.IsType(t, libkb.ResolutionError{}, err)
	resErr := err.(libkb.ResolutionError)
	require.Equal(t, libkb.ResolutionErrorInvalidInput, resErr.Kind)
}

func TestImplicitTeamWithEmail(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")

	email := "michal@keyba.se"
	assertion := fmt.Sprintf("%s@email", url.QueryEscape(email))

	impteamName := fmt.Sprintf("%s,%s", ann.username, assertion)
	teamID, err := ann.lookupImplicitTeam(true /* create */, impteamName, false /* public */)
	require.NoError(t, err)

	teamObj := ann.loadTeamByID(teamID, true /* admin */)
	require.Equal(t, 1, teamObj.NumActiveInvites())
	var invite keybase1.TeamInvite
	for _, invite = range teamObj.GetActiveAndObsoleteInvites() {
		// Get first invite to local var
	}
	require.EqualValues(t, email, invite.Name)
	invCat, err := invite.Type.C()
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamInviteCategory_EMAIL, invCat)

	name, err := teamObj.ImplicitTeamDisplayName(context.Background())
	require.NoError(t, err)
	require.Len(t, name.Writers.KeybaseUsers, 1)
	require.Len(t, name.Writers.UnresolvedUsers, 1)
	require.Equal(t, impteamName, name.String())
}
