package teams

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestTeamRoleList(t *testing.T) {
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

	list, err := m[1].G().GetTeamRoleListManager().Get(m[1])
	require.NoError(t, err)

	expected := keybase1.TeamRoleList{
		Teams: []keybase1.TeamRoleListRow{
			keybase1.TeamRoleListRow{
				TeamID:       teamID,
				Role:         keybase1.TeamRole_ADMIN,
				ImplicitRole: keybase1.TeamRole_NONE,
			},
			keybase1.TeamRoleListRow{
				TeamID:       *subteamID,
				Role:         keybase1.TeamRole_NONE,
				ImplicitRole: keybase1.TeamRole_ADMIN,
			},
		},
		Version: keybase1.UserTeamVersion(1),
	}

	require.Equal(t, expected.Sort(), list.Sort())

	_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String()+"."+subteamName, fus[1].Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)

	expected.Teams[1].Role = keybase1.TeamRole_READER
	expected.Version++

	// In teams/*_test.go, we don't have gregor hooked up, so we have to mock out what happens
	// when a new gregpr notification comes down from the server.
	m[1].G().GetTeamRoleListManager().Update(m[1], expected.Version)

	// Check that the state is eagerly refreshed.
	pollForTrue(t, m[1].G(), func(i int) bool {
		list := m[1].G().GetTeamRoleListManager().(*TeamRoleListManager).Query()
		if list != nil && list.Data.Version == expected.Version {
			require.Equal(t, expected.Sort(), list.Data.Sort())
			return true
		}
		return false
	})

	m[1].G().GetTeamRoleListManager().FlushCache()

	list, err = m[1].G().GetTeamRoleListManager().Get(m[1])
	require.NoError(t, err)
	require.Equal(t, expected, list)
}
