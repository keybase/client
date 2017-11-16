// Team Add Member Best Effort Test

package systests

import (
	"testing"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestAMInvalidEldest(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()

	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()

	pam := ctx.installKeybaseForUser("pam", 10)
	pam.signup()

	team := ann.createTeam([]*smuUser{bob})
	t.Logf("Created team name is %q", team)

	annCtx := ann.getPrimaryGlobalContext()
	teamLoadArg := keybase1.LoadTeamArg{
		Name:        team.name,
		ForceRepoll: true,
	}
	teamObj, err := teams.Load(context.TODO(), annCtx, teamLoadArg)
	require.NoError(t, err)
	require.EqualValues(t, 2, teamObj.CurrentSeqno()) // start link is 2

	t.Logf("Sending two UVs, expecting no members to be added.")
	// Adding two UVs:
	// - one with bad eldest seqno
	// - one for a user that is already in a team with higher role
	uvs := []keybase1.UserVersion{teams.NewUserVersion(pam.uid(), 5), teams.NewUserVersion(bob.uid(), 1)}
	err = teams.AddMembersBestEffort(context.TODO(), annCtx, teamObj.ID, keybase1.TeamRole_READER, uvs, false)
	require.NoError(t, err)

	teamObj, err = teams.Load(context.TODO(), annCtx, teamLoadArg)
	require.NoError(t, err)
	require.EqualValues(t, 2, teamObj.CurrentSeqno()) // should not have posted any links

	// Reset bob and re-add him using AddMembersBestEffort
	bob.reset()
	bob.loginAfterReset(10)

	// Wait for CLKR and RotateKey link.
	kickTeamRekeyd(ann.getPrimaryGlobalContext(), t)
	ann.pollForMembershipUpdate(team, keybase1.PerTeamKeyGeneration(2))

	t.Logf("Sending one UV, expecing one member to be added and an old version of member to be removed.")
	uvs = []keybase1.UserVersion{teams.NewUserVersion(bob.uid(), 6)}
	err = teams.AddMembersBestEffort(context.TODO(), annCtx, teamObj.ID, keybase1.TeamRole_READER, uvs, false)
	require.NoError(t, err)

	teamObj, err = teams.Load(context.TODO(), annCtx, teamLoadArg)
	require.NoError(t, err)
	require.EqualValues(t, 4, teamObj.CurrentSeqno()) // expecting to see new rotatekey link (from clkr) and changemembersip

	members, err := teamObj.Members()
	require.NoError(t, err)
	require.Equal(t, 2, len(members.AllUIDs())) // only ann and "new" bob (old one got removed)
}
