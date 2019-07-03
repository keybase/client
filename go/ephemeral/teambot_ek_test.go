package ephemeral

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestNewTeambotEK(t *testing.T) {
	tc, mctx, botUser := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	teamID := createTeam(tc)
	botUID := botUser.GetUID()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	// Before we've published anything, should get back a nil botkey
	nilMeta, err := fetchLatestTeambotEK(mctx, teamID, botUID)
	require.NoError(t, err)
	require.Nil(t, nilMeta)

	publishedMetadata, err := publishNewTeambotEK(mctx, teamID, botUID, merkleRoot)
	require.NoError(t, err)

	metaPtr, err := fetchLatestTeambotEK(mctx, teamID, botUID)
	require.NoError(t, err)
	require.NotNil(t, metaPtr)
	metadata := *metaPtr
	require.Equal(t, metadata, publishedMetadata)
	require.EqualValues(t, 1, metadata.Generation)

	keyer := NewTeambotEphemeralKeyer()
	teambotEKBoxed, err := keyer.Fetch(mctx, teamID, metadata.Generation, nil)
	require.NoError(t, err)
	typ, err := teambotEKBoxed.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeambot())
	require.Equal(t, metadata, teambotEKBoxed.Teambot().Metadata)

	teambotEK, err := keyer.Unbox(mctx, teambotEKBoxed, nil)
	require.NoError(t, err)
	typ, err = teambotEK.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeambot())

	teamEK, err := mctx.G().GetEKLib().GetTeamEK(mctx, teamID, teambotEK.Generation(), nil)
	require.NoError(t, err)
	expectedSeed, err := deriveTeambotEKFromTeamEK(mctx, teamEK, botUID)
	require.NoError(t, err)
	require.Equal(t, keybase1.Bytes32(expectedSeed), teambotEK.Teambot().Seed)

	badSeed, err := deriveTeambotEKFromTeamEK(mctx, teamEK, "")
	require.NoError(t, err)
	require.NotEqual(t, keybase1.Bytes32(badSeed), teambotEK.Teambot().Seed)
}
