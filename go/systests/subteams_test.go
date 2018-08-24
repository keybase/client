package systests

import (
	"testing"

	"fmt"
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestSubteamAdminships(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	al := tt.addUser("al")
	bob := tt.addUser("bob")
	eve := tt.addUser("eve")

	_, teamName := al.createTeam2()

	const subteamBasename = "bb1"
	subteamID, err := teams.CreateSubteam(context.TODO(), al.tc.G, subteamBasename,
		teamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	subTeamName, _ := teamName.Append(subteamBasename)

	t.Logf("Subteam created %s / %s", subteamID.String(), subTeamName.String())

	teams.RotateKey(context.TODO(), al.tc.G, *subteamID)
	teams.RotateKey(context.TODO(), al.tc.G, *subteamID)
	teams.RotateKey(context.TODO(), al.tc.G, *subteamID)

	al.addTeamMember(subTeamName.String(), bob.username, keybase1.TeamRole_WRITER)
	al.addTeamMember(subTeamName.String(), eve.username, keybase1.TeamRole_READER)

	bob.leave(subTeamName.String())

	teams.RotateKey(context.TODO(), al.tc.G, *subteamID)
	teams.RotateKey(context.TODO(), al.tc.G, *subteamID)

	t.Logf("Eve loads team ...")
	fmt.Printf(":: Eve loads team %s ...\n", subteamID.String())

	eve.loadTeam(subTeamName.String(), false)
}
