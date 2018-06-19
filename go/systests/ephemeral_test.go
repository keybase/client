package systests

import (
	"testing"
	"time"

	"github.com/keybase/client/go/engine"
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
	return g.GetTeamEKBoxStorage().Get(context.Background(), teamID, generation)
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

func TestResetMember(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	joe := ctx.installKeybaseForUser("joe", 10)
	joe.signup()

	annG := ann.getPrimaryGlobalContext()
	ephemeral.ServiceInit(annG)
	bobG := bob.getPrimaryGlobalContext()
	ephemeral.ServiceInit(bobG)
	joeG := joe.getPrimaryGlobalContext()
	ephemeral.ServiceInit(joeG)

	team := ann.createTeam([]*smuUser{bob})
	teamName, err := keybase1.TeamNameFromString(team.name)
	require.NoError(t, err)
	teamID := teamName.ToPrivateTeamID()

	// Reset bob, invaliding any userEK he has.
	bob.reset()

	annEkLib := annG.GetEKLib()
	teamEK, err := annEkLib.GetOrCreateLatestTeamEK(context.Background(), teamID)
	require.NoError(t, err)

	expectedMetadata := teamEK.Metadata
	expectedGeneration := expectedMetadata.Generation

	annTeamEK, annErr := getTeamEK(annG, teamID, expectedGeneration)
	require.Equal(t, annTeamEK.Metadata, expectedMetadata)
	require.NoError(t, annErr)

	// Bob should not have access to this teamEK since he's no longer in the
	// team after resetting.
	bobTeamEK, bobErr := getTeamEK(bobG, teamID, expectedGeneration)
	require.Error(t, bobErr)

	// Readd bob to the team, who has no userEKs
	// Also add joe who has a valid userEK
	bob.loginAfterReset(10)
	ann.addWriter(team, bob)
	ann.addWriter(team, joe)

	// ann now makes a new teamEk which joe can access but bob cannot
	teamEK2, err := annEkLib.GetOrCreateLatestTeamEK(context.Background(), teamID)
	require.NoError(t, err)

	expectedMetadata2 := teamEK2.Metadata
	expectedGeneration2 := expectedMetadata2.Generation
	// We can't require that the next generation is exactly 1 greater than the
	// previous, because there's a race where a CLKR sneaks in here.
	require.True(t, expectedGeneration < expectedGeneration2)

	annTeamEK, annErr = getTeamEK(annG, teamID, expectedGeneration2)
	require.Equal(t, annTeamEK.Metadata, expectedMetadata2)
	require.NoError(t, annErr)

	bobTeamEK, bobErr = getTeamEK(bobG, teamID, expectedGeneration2)
	require.Error(t, bobErr)
	require.Equal(t, bobTeamEK.Metadata, keybase1.TeamEkMetadata{})

	joeTeamEk, joeErr := getTeamEK(joeG, teamID, expectedGeneration2)
	require.NoError(t, joeErr)
	require.Equal(t, joeTeamEk.Metadata, expectedMetadata2)
}

func TestRotateWithTeamEK(t *testing.T) {
	runRotate(t, true /* createTeamEK*/)
}

func TestRotateNoTeamEK(t *testing.T) {
	runRotate(t, false /* createTeamEK*/)
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

	ann.addTeamMember(teamName.String(), bob.username, keybase1.TeamRole_WRITER)

	bob.revokePaperKey()
	ann.waitForRotateByID(teamID, keybase1.Seqno(3))

	storage := annG.GetTeamEKBoxStorage()
	teamEK, err := storage.Get(context.Background(), teamID, expectedGeneration)
	var expectedMaxGeneration keybase1.EkGeneration
	if createTeamEK {
		require.NoError(t, err)
		expectedMaxGeneration = teamEK.Metadata.Generation
	} else {
		require.Error(t, err)
		require.Equal(t, teamEK, keybase1.TeamEk{})
		expectedMaxGeneration = -1
	}
	maxGeneration, err := storage.MaxGeneration(context.Background(), teamID)
	require.NoError(t, err)
	require.Equal(t, maxGeneration, expectedMaxGeneration)
}

func TestRotateSkipTeamEKRoll(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUserWithPaper("bob")

	annG := ann.tc.G
	ephemeral.ServiceInit(annG)
	bobG := bob.tc.G
	ephemeral.ServiceInit(bobG)

	teamID, teamName := ann.createTeam2()

	// Get our ephemeral keys before the revoke and ensure we can still access
	// them after.
	ekLib := annG.GetEKLib()
	teamEKPreRoll, err := ekLib.GetOrCreateLatestTeamEK(context.Background(), teamID)
	require.NoError(t, err)

	// This is a hack to skip the teamEK generation during the PTK roll.
	// We want to validate that we can create a new teamEK after this roll even
	// though our existing teamEK is signed by a (now) invalid PTK
	annG.SetEKLib(nil)

	ann.addTeamMember(teamName.String(), bob.username, keybase1.TeamRole_WRITER)

	bob.revokePaperKey()
	ann.waitForRotateByID(teamID, keybase1.Seqno(3))
	annG.SetEKLib(ekLib)

	// Ensure that we access the old teamEK even though it was signed by a
	// non-latest PTK
	teamEKBoxStorage := annG.GetTeamEKBoxStorage()
	teamEKBoxStorage.ClearCache()
	_, err = annG.LocalDb.Nuke() // Force us to refetch and verify the key from the server
	require.NoError(t, err)
	teamEKPostRoll, err := teamEKBoxStorage.Get(context.Background(), teamID, teamEKPreRoll.Metadata.Generation)
	require.NoError(t, err)
	require.Equal(t, teamEKPreRoll, teamEKPostRoll)

	// After rotating, ensure we can create a new TeamEK without issue.
	needed, err := ekLib.NewTeamEKNeeded(context.Background(), teamID)
	require.NoError(t, err)
	require.True(t, needed)

	merkleRoot, err := annG.GetMerkleClient().FetchRootFromServer(libkb.NewMetaContextForTest(*ann.tc), libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	metadata, err := ephemeral.ForcePublishNewTeamEKForTesting(context.Background(), annG, teamID, *merkleRoot)
	require.NoError(t, err)
	require.Equal(t, teamEKPreRoll.Metadata.Generation+1, metadata.Generation)
}

func TestNewUserEKAndTeamEKAfterRevokes(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUserWithPaper("ann")

	teamID, _ := ann.createTeam2()

	annG := ann.tc.G
	ephemeral.ServiceInit(annG)
	ekLib := annG.GetEKLib()

	_, err := ekLib.GetOrCreateLatestTeamEK(context.Background(), teamID)
	require.NoError(t, err)
	userEKBoxStorage := annG.GetUserEKBoxStorage()
	gen, err := userEKBoxStorage.MaxGeneration(context.Background())
	require.NoError(t, err)
	userEKPreRevoke, err := userEKBoxStorage.Get(context.Background(), gen)
	require.NoError(t, err)

	// Provision a new device that we can revoke.
	newDevice := ann.provisionNewDevice()

	// Revoke it.
	revokeEngine := engine.NewRevokeDeviceEngine(annG, engine.RevokeDeviceEngineArgs{
		ID:        newDevice.deviceKey.DeviceID,
		ForceSelf: true,
		ForceLast: false,
		// We don't need a UserEK here since we force generate it below
		SkipUserEKForTesting: true,
	})
	uis := libkb.UIs{
		LogUI:    annG.Log,
		SecretUI: ann.newSecretUI(),
	}
	m := libkb.NewMetaContextForTest(*ann.tc).WithUIs(uis)
	err = engine.RunEngine2(m, revokeEngine)
	require.NoError(t, err)

	// Ensure that we access the old userEKs even though it was signed by a
	// non-latest PUK
	userEKBoxStorage.ClearCache()
	_, err = annG.LocalDb.Nuke() // Force us to refetch and verify the key from the server
	require.NoError(t, err)
	userEKPostRevoke, err := userEKBoxStorage.Get(context.Background(), userEKPreRevoke.Metadata.Generation)
	require.NoError(t, err)
	require.Equal(t, userEKPreRevoke, userEKPostRevoke)

	// Now provision a new userEK. This makes sure that we don't get confused
	// by the revoked device's deviceEKs.
	merkleRoot, err := annG.GetMerkleClient().FetchRootFromServer(libkb.NewMetaContextForTest(*ann.tc), libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	_, err = ephemeral.ForcePublishNewUserEKForTesting(context.Background(), annG, *merkleRoot)
	require.NoError(t, err)

	// And do the same for the teamEK, just to be sure.
	_, err = ephemeral.ForcePublishNewTeamEKForTesting(context.Background(), annG, teamID, *merkleRoot)
	require.NoError(t, err)
}
