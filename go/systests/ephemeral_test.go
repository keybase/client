package systests

import (
	"testing"
	"time"

	"github.com/keybase/client/go/ephemeral"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func TestNewTeamEKNotif(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	user1 := tt.addUser("one")
	user2 := tt.addUser("wtr")

	teamID, teamName := user1.createTeam2()
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)

	ephemeral.ServiceInit(user1.tc.G)
	ekLib := user1.tc.G.GetEKLib()

	teamEK, err := ekLib.GetOrCreateLatestTeamEK(context.Background(), teamID)
	require.NoError(t, err)

	expectedArg := keybase1.NewTeamEkArg{
		Id:         teamID,
		Generation: teamEK.Metadata.Generation,
	}

	checkNewTeamEKNotifications(user1.tc, user1.notifications, expectedArg)
	checkNewTeamEKNotifications(user2.tc, user2.notifications, expectedArg)

}

func checkNewTeamEKNotifications(tc *libkb.TestContext, notifications *teamNotifyHandler, expectedArg keybase1.NewTeamEkArg) {
	for {
		select {
		case arg := <-notifications.newTeamEKCh:
			require.Equal(tc.T, expectedArg, arg)
			return
		case <-time.After(500 * time.Millisecond * libkb.CITimeMultiplier(tc.G)):
			tc.T.Fatal("no notification on newTeamEK")
		}
	}
}
