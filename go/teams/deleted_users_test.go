package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// This test is in teams package because masking deleted users'
// sigchain is tightly related to teams and implicit teams. Sigchain
// of a deleted user is only accessible to users who used to be team
// mates at any point in time prior to deletion, but only in current
// reset incarnation of requesting user.

func TestDeletedUser(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 3)
	defer cleanup()

	teamname := createTeam(*tcs[0])
	t.Logf("Created team %q", teamname)

	// Add user 1 and user 2 to team.
	require.NoError(t, SetRoleWriter(context.Background(), tcs[0].G, teamname, fus[1].Username))
	require.NoError(t, SetRoleWriter(context.Background(), tcs[0].G, teamname, fus[2].Username))

	// User 1 leaves the team (signs team link!) and deletes themself.
	require.NoError(t, Leave(context.Background(), tcs[1].G, teamname, true /* permanent */))
	kbtest.DeleteAccount(*tcs[1], fus[1])

	// See if user 2 can still load team.
	_, err := Load(context.Background(), tcs[2].G, keybase1.LoadTeamArg{
		Name:        teamname,
		ForceRepoll: true,
	})
	require.NoError(t, err)
}
