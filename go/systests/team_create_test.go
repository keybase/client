package systests

import (
	"testing"

	"golang.org/x/net/context"

	client "github.com/keybase/client/go/client"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"

	"github.com/stretchr/testify/require"
)

func TestSubteamChats(t *testing.T) {
	t.Skip()
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

func TestSubteamCreateAndStay(t *testing.T) {
	// Test CreateTeam API w.r.t JoinSubteam. We should stay find
	// ourselves in new team as admin.
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann %s", ann.username)

	parentName := ann.createTeam()
	subteamName := parentName + ".test"

	var err error
	create := client.NewCmdTeamCreateRunner(ann.tc.G)
	create.TeamName, err = keybase1.TeamNameFromString(subteamName)
	require.NoError(t, err)
	create.JoinSubteam = true
	err = create.Run()
	require.NoError(t, err)

	t.Logf("Created subteam %s", subteamName)

	teamObj := ann.loadTeam(subteamName, false /* admin */)
	role, err := teamObj.MemberRole(context.Background(), ann.userVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_ADMIN, role, "got back wrong role")
	require.EqualValues(t, 1, teamObj.CurrentSeqno(), "expecting just one link in team")
}
