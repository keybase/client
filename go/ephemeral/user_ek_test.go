package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestNewUserEK(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	_, err := PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)

	// Before we've published any userEK's, GetActiveUserEKMetadata should return nil.
	hopefullyNilUserEK, err := GetActiveUserEKMetadata(context.Background(), tc.G)
	require.NoError(t, err)
	require.Nil(t, hopefullyNilUserEK)

	publishedMetadata, err := PublishNewUserEK(context.Background(), tc.G)
	require.NoError(t, err)

	activeUserEK, err := GetActiveUserEKMetadata(context.Background(), tc.G)
	require.NoError(t, err)
	require.NotNil(t, activeUserEK)
	require.Equal(t, *activeUserEK, publishedMetadata)
	require.EqualValues(t, 1, activeUserEK.Generation)

	s := NewUserEKBoxStorage(tc.G)
	// Put our storage in a bad state by deleting the maxGeneration
	err = s.Delete(context.Background(), keybase1.EkGeneration(1))
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata2, err := PublishNewUserEK(context.Background(), tc.G)
	require.NoError(t, err)
	require.EqualValues(t, 2, publishedMetadata2.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
