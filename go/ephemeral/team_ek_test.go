package ephemeral

import (
	"context"
	"encoding/hex"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func createTeam(tc libkb.TestContext) keybase1.TeamID {
	teams.ServiceInit(tc.G)

	b, err := libkb.RandBytes(4)
	require.NoError(tc.T, err)
	name := hex.EncodeToString(b)
	teamID, err := teams.CreateRootTeam(context.TODO(), tc.G, name, keybase1.TeamSettings{})
	require.NoError(tc.T, err)
	require.NotNil(tc.T, teamID)

	return *teamID
}

func TestNewTeamEK(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(context.Background(), libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	teamID := createTeam(tc)

	// Before we've published any teamEK's, ActiveTeamEKMetadata should return nil.
	nilStatement, err := fetchTeamEKStatement(context.Background(), tc.G, teamID)
	require.NoError(t, err)
	require.Nil(t, nilStatement)

	_, err = publishNewDeviceEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)

	_, err = publishNewUserEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)

	publishedMetadata, err := publishNewTeamEK(context.Background(), tc.G, teamID, merkleRoot)
	require.NoError(t, err)

	statementPtr, err := fetchTeamEKStatement(context.Background(), tc.G, teamID)
	require.NoError(t, err)
	require.NotNil(t, statementPtr)
	statement := *statementPtr
	currentMetadata := statement.CurrentTeamEkMetadata
	require.Equal(t, currentMetadata, publishedMetadata)
	require.EqualValues(t, 1, currentMetadata.Generation)
	require.Equal(t, statement.ExistingTeamEkMetadata, []keybase1.TeamEkMetadata{})

	s := NewTeamEKBoxStorage(tc.G)
	// Put our storage in a bad state by deleting the maxGeneration
	err = s.Delete(context.Background(), teamID, keybase1.EkGeneration(1))
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata2, err := publishNewTeamEK(context.Background(), tc.G, teamID, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, 2, publishedMetadata2.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
