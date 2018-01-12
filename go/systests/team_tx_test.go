package systests

import (
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"

	"github.com/davecgh/go-spew/spew"
)

func TestTeamTransactions(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann (%s)", ann.username)

	bob := tt.addPuklessUser("bob")
	t.Logf("Signed up PUK-less user bob (%s)", bob.username)

	team := ann.createTeam()
	t.Logf("Team created (%s)", team)

	teamObj, err := teams.Load(context.Background(), ann.tc.G, keybase1.LoadTeamArg{
		Name:      team,
		NeedAdmin: true,
	})
	require.NoError(t, err)

	tx := teams.CreateAddMemberTx(teamObj)
	tx.AddMemberTransaction(context.Background(), ann.tc.G, bob.username, keybase1.TeamRole_WRITER)

	spew.Dump(tx.DebugPayloads())
}
