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
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	teamID := createTeam(tc)

	// Before we've published any teamEK's, fetchTeamEKStatement should return
	// nil.
	nilStatement, _, _, err := fetchTeamEKStatement(mctx, teamID)
	require.NoError(t, err)
	require.Nil(t, nilStatement)

	publishedMetadata, err := publishNewTeamEK(mctx, teamID, merkleRoot)
	require.NoError(t, err)

	statementPtr, _, _, err := fetchTeamEKStatement(mctx, teamID)
	require.NoError(t, err)
	require.NotNil(t, statementPtr)
	statement := *statementPtr
	currentMetadata := statement.CurrentTeamEkMetadata
	require.Equal(t, currentMetadata, publishedMetadata)
	require.EqualValues(t, 1, currentMetadata.Generation)

	// We've stored the result in local storage
	teamEKBoxStorage := tc.G.GetTeamEKBoxStorage()
	maxGeneration, err := teamEKBoxStorage.MaxGeneration(mctx, teamID, false)
	require.NoError(t, err)
	ek, err := teamEKBoxStorage.Get(mctx, teamID, maxGeneration, nil)
	require.NoError(t, err)
	typ, err := ek.KeyType()
	require.NoError(t, err)
	require.True(t, typ.IsTeam())
	teamEK := ek.Team()
	require.NoError(t, err)
	require.Equal(t, teamEK.Metadata, publishedMetadata)

	s := NewTeamEKBoxStorage(NewTeamEphemeralKeyer())
	// Put our storage in a bad state by deleting the maxGeneration
	err = s.Delete(mctx, teamID, keybase1.EkGeneration(1))
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata2, err := publishNewTeamEK(mctx, teamID, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, 2, publishedMetadata2.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
