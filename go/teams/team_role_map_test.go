package teams

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestTeamRoleMap(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])
	m := make([]libkb.MetaContext, 2)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}
	t.Logf("add B to the team so they can load it")
	_, err := AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)
	subteamName := "abc"
	subteamID, err := CreateSubteam(m[0].Ctx(), tcs[0].G, subteamName, teamName, keybase1.TeamRole_WRITER)
	require.NoError(t, err)

	received, err := m[1].G().GetTeamRoleMapManager().Get(m[1], false)
	require.NoError(t, err)

	expected := keybase1.TeamRoleMapAndVersion{
		Teams:   make(map[keybase1.TeamID]keybase1.TeamRolePair),
		Version: keybase1.UserTeamVersion(2),
	}
	expected.Teams[teamID] = keybase1.TeamRolePair{
		Role:         keybase1.TeamRole_ADMIN,
		ImplicitRole: keybase1.TeamRole_NONE,
	}
	expected.Teams[*subteamID] = keybase1.TeamRolePair{
		Role:         keybase1.TeamRole_NONE,
		ImplicitRole: keybase1.TeamRole_ADMIN,
	}

	require.Equal(t, expected, received)

	_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String()+"."+subteamName, fus[1].Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)

	expected.Teams[*subteamID] = keybase1.TeamRolePair{
		Role:         keybase1.TeamRole_READER,
		ImplicitRole: keybase1.TeamRole_ADMIN,
	}
	expected.Version++

	// In teams/*_test.go, we don't have gregor hooked up, so we have to mock out what happens
	// when a new gregpr notification comes down from the server.
	err = m[1].G().GetTeamRoleMapManager().Update(m[1], expected.Version)
	require.NoError(t, err)

	// Check that the state is eagerly refreshed.
	pollForTrue(t, m[1].G(), func(i int) bool {
		received := m[1].G().GetTeamRoleMapManager().(*TeamRoleMapManager).Query()
		if received != nil && received.Data.Version == expected.Version {
			require.Equal(t, expected.Teams, received.Data.Teams)
			return true
		}
		return false
	})

	m[1].G().GetTeamRoleMapManager().FlushCache()

	received, err = m[1].G().GetTeamRoleMapManager().Get(m[1], false)
	require.NoError(t, err)
	require.Equal(t, expected, received)
}
