package systests

import (
	"strings"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestTeamOpenAutoAddMember(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	own := tt.addUser("own")
	roo := tt.addUser("roo")

	nameStr, err := libkb.RandString("tt", 5)
	require.NoError(t, err)
	nameStr = strings.ToLower(nameStr)

	cli := own.teamsClient
	createRes, err := cli.TeamCreate(context.TODO(), keybase1.TeamCreateArg{
		Name:                 nameStr,
		SendChatNotification: false,
		Open:                 true,
	})

	_ = createRes
	t.Logf("Open team name is %q", nameStr)

	roo.teamsClient.TeamRequestAccess(context.TODO(), keybase1.TeamRequestAccessArg{Name: nameStr})

	own.kickTeamRekeyd()
	own.waitForTeamChangedGregor(nameStr, keybase1.Seqno(2))

	team, err := teams.Load(context.TODO(), own.tc.G, keybase1.LoadTeamArg{
		Name:        nameStr,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	role, err := team.MemberRole(context.TODO(), roo.userVersion())
	require.NoError(t, err)
	require.Equal(t, role, keybase1.TeamRole_READER)
}
