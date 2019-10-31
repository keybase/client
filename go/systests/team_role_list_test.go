package systests

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestTeamRoleList(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	tt.addUser("ann")
	tt.addUser("bob")

	teamID, teamName := tt.users[0].createTeam2()
	tt.users[0].addTeamMember(teamName.String(), tt.users[1].username, keybase1.TeamRole_ADMIN)

	expected := keybase1.TeamRoleList{
		Teams: []keybase1.TeamRoleListRow{
			{
				TeamID:       teamID,
				Role:         keybase1.TeamRole_ADMIN,
				ImplicitRole: keybase1.TeamRole_NONE,
			},
		},
		Version: keybase1.UserTeamVersion(1),
	}

	select {
	case vers := <-tt.users[1].notifications.teamRoleListCh:
		t.Logf("got notification")
		require.Equal(t, expected.Version, vers)
	case <-time.After(10 * time.Second):
		t.Fatal("failed to get notification after 10s wait")
	}

	pollForTrue(t, tt.users[1].tc.G, func(i int) bool {
		list := tt.users[1].tc.G.GetTeamRoleListManager().(*teams.TeamRoleListManager).Query()
		if list != nil && list.Data.Version == expected.Version {
			require.Equal(t, expected.Sort(), list.Data.Sort())
			return true
		}
		return false
	})
}
