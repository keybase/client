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
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	m := libkb.NewMetaContextForTest(tc)
	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(m, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	teamID := createTeam(tc)

	// Before we've published any teamEK's, fetchTeamEKStatement should return nil.
	nilStatement, _, _, err := fetchTeamEKStatement(context.Background(), tc.G, teamID)
	require.NoError(t, err)
	require.Nil(t, nilStatement)

	publishedMetadata, err := publishNewTeamEK(context.Background(), tc.G, teamID, merkleRoot)
	require.NoError(t, err)

	statementPtr, _, _, err := fetchTeamEKStatement(context.Background(), tc.G, teamID)
	require.NoError(t, err)
	require.NotNil(t, statementPtr)
	statement := *statementPtr
	currentMetadata := statement.CurrentTeamEkMetadata
	require.Equal(t, currentMetadata, publishedMetadata)
	require.EqualValues(t, 1, currentMetadata.Generation)
	require.Equal(t, statement.ExistingTeamEkMetadata, []keybase1.TeamEkMetadata{})

	// We've stored the result in local storage
	teamEKBoxStorage := tc.G.GetTeamEKBoxStorage()
	maxGeneration, err := teamEKBoxStorage.MaxGeneration(context.Background(), teamID)
	require.NoError(t, err)
	ek, err := teamEKBoxStorage.Get(context.Background(), teamID, maxGeneration)
	require.NoError(t, err)
	require.Equal(t, ek.Metadata, publishedMetadata)

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
