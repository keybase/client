package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestNewTeambotEK(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	tc2 := libkb.SetupTest(t, "NewTeambotEK", 2)
	defer tc2.Cleanup()
	mctx2 := libkb.NewMetaContextForTest(tc2)
	NewEphemeralStorageAndInstall(mctx2)
	teams.ServiceInit(mctx2.G())

	teamID := createTeam(tc)
	botUser, err := kbtest.CreateAndSignupFakeUser("t", tc2.G)
	require.NoError(t, err)
	botUID := botUser.GetUID()

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	res, err := teams.AddMember(context.TODO(), mctx.G(), team.Name().String(),
		botUser.Username, keybase1.TeamRole_BOT)
	require.NoError(t, err)
	require.Equal(t, botUser.Username, res.User.Username)

	merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	// Before we've published anything, should get back a nil botkey
	nilMeta, err := fetchLatestTeambotEK(mctx2, teamID)
	require.NoError(t, err)
	require.Nil(t, nilMeta)

	teamEK, _, err := mctx.G().GetEKLib().GetOrCreateLatestTeamEK(mctx, teamID)
	require.NoError(t, err)
	publishedMetadata, err := publishNewTeambotEK(mctx, teamID, botUID, teamEK, merkleRoot)
	require.NoError(t, err)

	// bot users don't have access to team secrets so they can't get the teamEK
	_, _, err = mctx2.G().GetEKLib().GetOrCreateLatestTeamEK(mctx2, teamID)
	require.Error(t, err)

	// this fails as well since bots can't sign things on behalf of the team
	// either, even if we pass a valid teamEK from the non-bot
	_, err = publishNewTeambotEK(mctx2, teamID, botUID, teamEK, merkleRoot)
	require.Error(t, err)

	metaPtr, err := fetchLatestTeambotEK(mctx2, teamID)
	require.NoError(t, err)
	require.NotNil(t, metaPtr)
	metadata := *metaPtr
	require.Equal(t, publishedMetadata, metadata)
	require.EqualValues(t, 1, metadata.Generation)

	keyer := NewTeambotEphemeralKeyer()
	teambotEKBoxed, err := keyer.Fetch(mctx2, teamID, metadata.Generation, nil)
	require.NoError(t, err)
	typ, err := teambotEKBoxed.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeambot())
	require.Equal(t, metadata, teambotEKBoxed.Teambot().Metadata)

	teambotEK, err := keyer.Unbox(mctx2, teambotEKBoxed, nil)
	require.NoError(t, err)
	typ, err = teambotEK.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeambot())

	// this fails for the bot user
	teamEK, err = mctx2.G().GetEKLib().GetTeamEK(mctx2, teamID, teambotEK.Generation(), nil)
	require.Error(t, err)

	teamEK, err = mctx.G().GetEKLib().GetTeamEK(mctx, teamID, teambotEK.Generation(), nil)
	require.NoError(t, err)
	expectedSeed, err := deriveTeambotEKFromTeamEK(mctx, teamEK, botUID)
	require.NoError(t, err)
	require.Equal(t, keybase1.Bytes32(expectedSeed), teambotEK.Teambot().Seed)

	badSeed, err := deriveTeambotEKFromTeamEK(mctx, teamEK, "")
	require.NoError(t, err)
	require.NotEqual(t, keybase1.Bytes32(badSeed), teambotEK.Teambot().Seed)
}
