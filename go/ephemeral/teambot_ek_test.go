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
	botua, err := kbtest.CreateAndSignupFakeUser("t", tc2.G)
	require.NoError(t, err)
	botuaUID := botua.GetUID()

	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	res, err := teams.AddMember(context.TODO(), mctx.G(), team.Name().String(),
		botua.Username, keybase1.TeamRole_RESTRICTEDBOT, &keybase1.TeamBotSettings{})
	require.NoError(t, err)
	require.Equal(t, botua.Username, res.User.Username)

	merkleRootPtr, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	ek, _, err := mctx.G().GetEKLib().GetOrCreateLatestTeambotEK(mctx, teamID, botuaUID.ToBytes())
	require.NoError(t, err)
	typ, err := ek.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeambot())

	metaPtr, wrongKID, err := fetchLatestTeambotEK(mctx2, teamID)
	require.NoError(t, err)
	require.NotNil(t, metaPtr)
	require.False(t, wrongKID)
	metadata := *metaPtr
	require.Equal(t, ek.Teambot().Metadata, metadata)

	ek, _, err = mctx.G().GetEKLib().GetOrCreateLatestTeamEK(mctx, teamID)
	require.NoError(t, err)
	typ, err = ek.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeam())
	teamEK := ek.Team()

	// bot users don't have access to team secrets so they can't get the teamEK
	_, _, err = mctx2.G().GetEKLib().GetOrCreateLatestTeamEK(mctx2, teamID)
	require.Error(t, err)

	// this fails as well since bots can't sign things on behalf of the team
	// either, even if we pass a valid teamEK from the non-bot
	_, err = publishNewTeambotEK(mctx2, teamID, botuaUID, teamEK, merkleRoot)
	require.Error(t, err)

	keyer := NewTeambotEphemeralKeyer()
	teambotEKBoxed, err := keyer.Fetch(mctx2, teamID, metadata.Generation, nil)
	require.NoError(t, err)
	typ, err = teambotEKBoxed.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeambot())
	require.Equal(t, metadata, teambotEKBoxed.Teambot().Metadata)

	teambotEK, err := keyer.Unbox(mctx2, teambotEKBoxed, nil)
	require.NoError(t, err)
	typ, err = teambotEK.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeambot())

	// this fails for the bot user
	_, err = mctx2.G().GetEKLib().GetTeamEK(mctx2, teamID, teambotEK.Generation(), nil)
	require.Error(t, err)

	ek, err = mctx.G().GetEKLib().GetTeamEK(mctx, teamID, teambotEK.Generation(), nil)
	require.NoError(t, err)
	typ, err = ek.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeam())
	teamEK = ek.Team()
	require.NoError(t, err)
	expectedSeed := deriveTeambotEKFromTeamEK(mctx, teamEK, botuaUID)
	require.Equal(t, keybase1.Bytes32(expectedSeed), teambotEK.Teambot().Seed)

	badSeed := deriveTeambotEKFromTeamEK(mctx, teamEK, "")
	require.NotEqual(t, keybase1.Bytes32(badSeed), teambotEK.Teambot().Seed)
}
