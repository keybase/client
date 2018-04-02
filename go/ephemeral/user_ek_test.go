package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestNewUserEK(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(context.Background(), libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	prevStatement, err := fetchUserEKStatement(context.Background(), tc.G)
	require.NoError(t, err)
	prevExisting := prevStatement.ExistingUserEkMetadata
	prevExisting = append(prevExisting, prevStatement.CurrentUserEkMetadata)

	publishedMetadata, err := publishNewUserEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)

	s := tc.G.GetUserEKBoxStorage()
	userEK, err := s.Get(context.Background(), publishedMetadata.Generation)
	require.NoError(t, err)
	require.Equal(t, userEK.Metadata, publishedMetadata)

	statementPtr, err := fetchUserEKStatement(context.Background(), tc.G)
	require.NoError(t, err)
	require.NotNil(t, statementPtr)
	statement := *statementPtr
	currentMetadata := statement.CurrentUserEkMetadata
	require.Equal(t, currentMetadata, publishedMetadata)
	require.Equal(t, statement.ExistingUserEkMetadata, prevExisting)

	// We've stored the result in local storage
	userEKBoxStorage := tc.G.GetUserEKBoxStorage()
	maxGeneration, err := userEKBoxStorage.MaxGeneration(context.Background())
	ek, err := userEKBoxStorage.Get(context.Background(), maxGeneration)
	require.NoError(t, err)
	require.Equal(t, ek.Metadata, publishedMetadata)

	rawStorage := NewUserEKBoxStorage(tc.G)
	// Put our storage in a bad state by deleting the maxGeneration
	err = rawStorage.Delete(context.Background(), maxGeneration)
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata2, err := publishNewUserEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, maxGeneration+1, publishedMetadata2.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
