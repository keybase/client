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

func TestAddMemberWithTeamEK(t *testing.T) {
	runAddMember(t, true /* createTeamEK*/)
}

func TestAddMemberNoTeamEK(t *testing.T) {
	runAddMember(t, false /* createTeamEK*/)
}

func getTeamEK(g *libkb.GlobalContext, teamID keybase1.TeamID, generation keybase1.EkGeneration) (keybase1.TeamEk, error) {
	storage := g.GetTeamEKBoxStorage()
	return storage.Get(context.Background(), teamID, generation)
}

func runAddMember(t *testing.T, createTeamEK bool) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()

	annG := ann.getPrimaryGlobalContext()
	ephemeral.ServiceInit(annG)
	bobG := bob.getPrimaryGlobalContext()
	ephemeral.ServiceInit(bobG)

	team := ann.createTeam([]*smuUser{})
	teamName, err := keybase1.TeamNameFromString(team.name)
	require.NoError(t, err)
	teamID := teamName.ToPrivateTeamID()

	var expectedMetadata keybase1.TeamEkMetadata
	var expectedGeneration keybase1.EkGeneration
	if createTeamEK {
		ekLib := annG.GetEKLib()
		teamEK, err := ekLib.GetOrCreateLatestTeamEK(context.Background(), teamID)
		require.NoError(t, err)

		expectedMetadata = teamEK.Metadata
		expectedGeneration = expectedMetadata.Generation
	} else {
		expectedMetadata = keybase1.TeamEkMetadata{}
		expectedGeneration = 1
	}

	ann.addWriter(team, bob)

	annTeamEK, annErr := getTeamEK(annG, teamID, expectedGeneration)
	bobTeamEK, bobErr := getTeamEK(bobG, teamID, expectedGeneration)
	if createTeamEK {
		require.NoError(t, annErr)
		require.NoError(t, bobErr)
	} else {
		require.Error(t, annErr)
		require.Error(t, bobErr)
	}
	require.Equal(t, bobTeamEK.Metadata, expectedMetadata)
	require.Equal(t, annTeamEK.Metadata, expectedMetadata)
}

func TestRotateWithTeamEK(t *testing.T) {
	runAddMember(t, true /* createTeamEK*/)
}

func TestRotateNoTeamEK(t *testing.T) {
	runAddMember(t, false /* createTeamEK*/)
}

func runRotate(t *testing.T, createTeamEK bool) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUserWithPaper("bob")

	annG := ann.tc.G
	ephemeral.ServiceInit(annG)
	bobG := bob.tc.G
	ephemeral.ServiceInit(bobG)

	teamID, teamName := ann.createTeam2()
	ann.addTeamMember(teamName.String(), bob.username, keybase1.TeamRole_WRITER)

	// After rotate, we should have rolled the teamEK if one existed.
	var expectedGeneration keybase1.EkGeneration
	if createTeamEK {
		ekLib := annG.GetEKLib()
		teamEK, err := ekLib.GetOrCreateLatestTeamEK(context.Background(), teamID)
		require.NoError(t, err)
		expectedGeneration = teamEK.Metadata.Generation + 1
	} else {
		expectedGeneration = 1
	}

	bob.revokePaperKey()
	ann.waitForRotateByID(teamID, keybase1.Seqno(3))

	annStorage := annG.GetTeamEKBoxStorage()
	_, annErr := annStorage.Get(context.Background(), teamID, expectedGeneration)
	if createTeamEK {
		require.NoError(t, annErr)
	} else {
		require.Error(t, annErr)
	}
}
