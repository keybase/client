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

func TestEphemeralNewTeamEKNotif(t *testing.T) {
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

func TestEphemeralAddMemberWithTeamEK(t *testing.T) {
	runAddMember(t, true /* createTeamEK*/)
}

func TestEphemeralAddMemberNoTeamEK(t *testing.T) {
	runAddMember(t, false /* createTeamEK*/)
}

func getTeamEK(g *libkb.GlobalContext, teamID keybase1.TeamID, generation keybase1.EkGeneration) (keybase1.TeamEk, error) {
	return g.GetTeamEKBoxStorage().Get(context.Background(), teamID, generation, nil)
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
		require.IsType(t, ephemeral.EphemeralKeyError{}, annErr)
		ekErr := annErr.(ephemeral.EphemeralKeyError)
		require.Equal(t, ephemeral.DefaultHumanErrMsg, ekErr.HumanError())

		require.Error(t, bobErr)
		require.IsType(t, ephemeral.EphemeralKeyError{}, bobErr)
		ekErr = bobErr.(ephemeral.EphemeralKeyError)
		require.Equal(t, ephemeral.DefaultHumanErrMsg, ekErr.HumanError())
	}
	require.Equal(t, bobTeamEK.Metadata, expectedMetadata)
	require.Equal(t, annTeamEK.Metadata, expectedMetadata)
}

func TestEphemeralResetMember(t *testing.T) {
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
	bob.loginAfterReset(10)
	bobG = bob.getPrimaryGlobalContext()
	bobTeamEK, bobErr := getTeamEK(bobG, teamID, expectedGeneration)
	require.Error(t, bobErr)
	require.IsType(t, libkb.AppStatusError{}, bobErr)
	appStatusErr := bobErr.(libkb.AppStatusError)
	require.Equal(t, appStatusErr.Code, libkb.SCNotFound)

	// Also add joe who has a valid userEK
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
	require.NoError(t, bobErr)
	require.Equal(t, bobTeamEK.Metadata, expectedMetadata2)

	joeTeamEk, joeErr := getTeamEK(joeG, teamID, expectedGeneration2)
	require.NoError(t, joeErr)
	require.Equal(t, joeTeamEk.Metadata, expectedMetadata2)
}

func TestEphemeralRotateWithTeamEK(t *testing.T) {
	runRotate(t, true /* createTeamEK*/)
}

func TestEphemeralRotateNoTeamEK(t *testing.T) {
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
	teamEK, err := storage.Get(context.Background(), teamID, expectedGeneration, nil)
	if createTeamEK {
		require.NoError(t, err)
	} else {
		require.Error(t, err)
		require.IsType(t, ephemeral.EphemeralKeyError{}, err)
		ekErr := err.(ephemeral.EphemeralKeyError)
		require.Equal(t, ephemeral.DefaultHumanErrMsg, ekErr.HumanError())
		require.Equal(t, teamEK, keybase1.TeamEk{})
	}
}

func TestEphemeralRotateSkipTeamEKRoll(t *testing.T) {
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
	teamEKPostRoll, err := teamEKBoxStorage.Get(context.Background(), teamID, teamEKPreRoll.Metadata.Generation, nil)
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

func TestEphemeralNewUserEKAndTeamEKAfterRevokes(t *testing.T) {
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
	userEKPreRevoke, err := userEKBoxStorage.Get(context.Background(), gen, nil)
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
	userEKPostRevoke, err := userEKBoxStorage.Get(context.Background(), userEKPreRevoke.Metadata.Generation, nil)
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

func readdToTeamWithEKs(t *testing.T, leave bool) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	// Make standalone user that will not run gregor. This is
	// important in the *leave* case, where we want to observe
	// effects of team key and EK not being rotated.
	user1 := makeUserStandalone(t, "user1", standaloneUserArgs{
		disableGregor:            true,
		suppressTeamChatAnnounce: true,
	})
	user2 := tt.addUser("wtr")

	teamID, teamName := user1.createTeam2()
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user2.waitForNewlyAddedToTeamByID(teamID)

	ephemeral.ServiceInit(user1.tc.G)
	ekLib := user1.tc.G.GetEKLib()
	teamEK, err := ekLib.GetOrCreateLatestTeamEK(context.Background(), teamID)
	require.NoError(t, err)

	currentGen := teamEK.Metadata.Generation
	var expectedGen keybase1.EkGeneration
	if leave {
		user2.leave(teamName.String())
		expectedGen = currentGen // user left, no one to rotate keys.
	} else {
		user1.removeTeamMember(teamName.String(), user2.username)
		expectedGen = currentGen + 1 // admin removes user, rotates TK and EK
	}

	// After leaving user2 won't have access to the current teamEK
	_, err = user2.tc.G.GetTeamEKBoxStorage().Get(context.Background(), teamID, currentGen, nil)
	require.Error(t, err)
	require.IsType(t, libkb.AppStatusError{}, err)
	appStatusErr := err.(libkb.AppStatusError)
	require.Equal(t, appStatusErr.Code, libkb.SCNotFound)

	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user2.waitForNewlyAddedToTeamByID(teamID)

	// Test that user1 and user2 both have access to the currentTeamEK
	// (whether we recreated or reboxed)
	teamEK2U1, err := user1.tc.G.GetTeamEKBoxStorage().Get(context.Background(), teamID, expectedGen, nil)
	require.NoError(t, err)

	teamEK2U2, err := user2.tc.G.GetTeamEKBoxStorage().Get(context.Background(), teamID, expectedGen, nil)
	require.NoError(t, err)

	require.Equal(t, teamEK2U1, teamEK2U2)
}

func TestEphemeralTeamMemberLeaveAndReadd(t *testing.T) {
	readdToTeamWithEKs(t, true /* leave */)
}

func TestEphemeralTeamMemberRemoveAndReadd(t *testing.T) {
	readdToTeamWithEKs(t, false /* leave */)
}

func TestEphemeralAfterEKError(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	user1 := makeUserStandalone(t, "user1", standaloneUserArgs{
		disableGregor:            true,
		suppressTeamChatAnnounce: true,
	})
	teamID, teamName := user1.createTeam2()
	g1 := user1.tc.G
	ephemeral.ServiceInit(g1)
	ctx := context.Background()
	merkleRoot, err := g1.GetMerkleClient().FetchRootFromServer(libkb.NewMetaContextForTest(*user1.tc), libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	// Force two team EKs to be created and then create/add u2 to the team.
	// They should not be able to access the first key since they were added
	// after (they are reboxed for the second as part of the add
	teamEKMetadata1, err := ephemeral.ForcePublishNewTeamEKForTesting(ctx, g1, teamID, *merkleRoot)
	require.NoError(t, err)
	teamEKMetadata2, err := ephemeral.ForcePublishNewTeamEKForTesting(ctx, g1, teamID, *merkleRoot)
	require.NoError(t, err)

	user2 := tt.addUserWithPaper("u2")
	user1.addTeamMember(teamName.String(), user2.username, keybase1.TeamRole_WRITER)
	user2.waitForNewlyAddedToTeamByID(teamID)

	g2 := user2.tc.G
	_, err = g2.GetTeamEKBoxStorage().Get(ctx, teamID, teamEKMetadata1.Generation, nil)
	require.Error(t, err)
	require.IsType(t, ephemeral.EphemeralKeyError{}, err)
	ekErr := err.(ephemeral.EphemeralKeyError)
	require.Equal(t, libkb.SCEphemeralMemberAfterEK, ekErr.StatusCode)

	teamEK2, err := g2.GetTeamEKBoxStorage().Get(ctx, teamID, teamEKMetadata2.Generation, nil)
	require.NoError(t, err)
	require.Equal(t, teamEKMetadata2, teamEK2.Metadata)

	// Force a second userEK so when the new device is provisioned it is only
	// reboxed for the second userEK. Try to access the first userEK and fail.
	userEKMetdata, err := ephemeral.ForcePublishNewUserEKForTesting(ctx, g2, *merkleRoot)
	require.NoError(t, err)
	newDevice := user2.provisionNewDevice()
	require.NoError(t, err)
	g2 = newDevice.tctx.G

	_, err = g2.GetUserEKBoxStorage().Get(ctx, userEKMetdata.Generation-1, nil)
	require.Error(t, err)
	require.IsType(t, ephemeral.EphemeralKeyError{}, err)
	ekErr = err.(ephemeral.EphemeralKeyError)
	require.Equal(t, libkb.SCEphemeralDeviceAfterEK, ekErr.StatusCode)
}
