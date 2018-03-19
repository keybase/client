package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestNewDeviceEK(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	publishedMetadata, err := PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)

	fetchedDevices, err := GetActiveDeviceEKMetadata(context.Background(), tc.G)
	require.NoError(t, err)

	require.Equal(t, 1, len(fetchedDevices))
	for _, fetchedDeviceMetadata := range fetchedDevices {
		require.Equal(t, publishedMetadata, fetchedDeviceMetadata)
	}
	require.EqualValues(t, 1, publishedMetadata.Generation)

	// If we publish again, we increase the generation
	publishedMetadata2, err := PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)
	require.EqualValues(t, 2, publishedMetadata2.Generation)

	s := NewDeviceEKStorage(tc.G)
	// Put our storage in a bad state by deleting the maxGeneration
	err = s.Delete(context.Background(), keybase1.EkGeneration(2))
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata3, err := PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)
	require.EqualValues(t, 3, publishedMetadata3.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
