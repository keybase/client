package ephemeral

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestNewTeambotEK(t *testing.T) {
	tc, mctx, botUser := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	teamID := createTeam(tc)
	botUID := botUser.GetUID()
	team, err := teams.Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID: teamID,
	})
	require.NoError(t, err)

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	// Before we've published anything, should get back a nil botkey
	nilMeta, err := fetchLatestTeambotEK(mctx, team, botUID)
	require.NoError(t, err)
	require.Nil(t, nilMeta)

	keyer := NewTeambotEphemeralKeyer()
	publishedMetadata, err := keyer.PublishNewEK(mctx, teamID, merkleRoot)
	require.NoError(t, err)
	typ, err := publishedMetadata.KeyType()
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamEphemeralKeyType_TEAMBOT, typ)

	metaPtr, err := fetchLatestTeambotEK(mctx, team, botUID)
	require.NoError(t, err)
	require.NotNil(t, metaPtr)
	metadata := *metaPtr
	require.Equal(t, metadata, publishedMetadata.Teambot())
	require.EqualValues(t, 1, metadata.Generation)

	teambotEKBoxed, err := keyer.Fetch(mctx, teamID, metadata.Generation, nil)
	require.NoError(t, err)
	typ, err = teambotEKBoxed.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeambot())
	require.Equal(t, metadata, teambotEKBoxed.Teambot().Metadata)

	teambotEK, err := keyer.Unbox(mctx, teambotEKBoxed, nil)
	require.NoError(t, err)
	typ, err = teambotEK.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeambot())

	expectedSeed, err := newTeambotEphemeralSeed(mctx, teamID, botUID, 1)
	require.NoError(t, err)
	require.Equal(t, keybase1.Bytes32(expectedSeed), teambotEK.Teambot().Seed)

	badSeed, err := newTeambotEphemeralSeed(mctx, teamID, botUID, 2)
	require.NoError(t, err)
	require.NotEqual(t, keybase1.Bytes32(badSeed), teambotEK.Teambot().Seed)
}
