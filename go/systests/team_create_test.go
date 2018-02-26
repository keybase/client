package systests

import (
	"testing"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestSubteamChats(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 3)
	ann.signup()
	t.Logf("Signed up ann (%s, %s)", ann.username, ann.uid())
	bob := ctx.installKeybaseForUser("bob", 5)
	bob.signup()
	t.Logf("Signed up bob (%s, %s)", bob.username, bob.uid())

	team := ann.createTeam([]*smuUser{})
	t.Logf("Team created %q", team.name)

	subteamName := team.name + ".subt"
	cli := ann.getTeamsClient()
	_, err := cli.TeamCreate(context.Background(), keybase1.TeamCreateArg{Name: subteamName})
	require.NoError(t, err)

	t.Logf("Subteam created %q", subteamName)

	subteam := smuTeam{name: subteamName}
	ann.addTeamMember(subteam, bob, keybase1.TeamRole_READER)

	// Can we chat after being added to subteam as sole reader? If
	// chats are not initialized in the subteam, sendChat will fail
	// with: "error creating conversation: error from chat server:
	// team readers are unable to create conversations". It's rather
	// imperfect test, ideally we would be checking if there is any
	// existing chat channel in the subteam instead of trying to send
	// chat messages.
	bob.sendChat(subteam, "0")
	bob.readChats(subteam, 1)
}
