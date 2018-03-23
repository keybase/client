package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestNewUserEK(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(context.Background(), libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	_, err = publishNewDeviceEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)

	// Before we've published any userEK's, activeUserEKMetadata should return nil.
	nilStatement, err := fetchUserEKStatement(context.Background(), tc.G)
	require.NoError(t, err)
	require.Nil(t, nilStatement)

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
	require.EqualValues(t, 1, currentMetadata.Generation)
	require.Equal(t, statement.ExistingUserEkMetadata, []keybase1.UserEkMetadata{})

	rawStorage := NewUserEKBoxStorage(tc.G)
	// Put our storage in a bad state by deleting the maxGeneration
	err = rawStorage.Delete(context.Background(), keybase1.EkGeneration(1))
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata2, err := publishNewUserEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, 2, publishedMetadata2.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
