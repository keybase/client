package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestNewDeviceEK(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	m := libkb.NewMetaContextForTest(tc)
	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(m, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	publishedMetadata, err := publishNewDeviceEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)

	s := tc.G.GetDeviceEKStorage()
	deviceEK, err := s.Get(context.Background(), publishedMetadata.Generation)
	require.NoError(t, err)
	// Clear out DeviceCtime since it won't be present in fetched data, it's
	// only known locally.
	require.NotEqual(t, 0, deviceEK.Metadata.DeviceCtime)
	deviceEK.Metadata.DeviceCtime = 0
	require.Equal(t, deviceEK.Metadata, publishedMetadata)

	fetchedDevices, err := allActiveDeviceEKMetadata(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)

	require.Equal(t, 1, len(fetchedDevices))
	for _, fetchedDeviceMetadata := range fetchedDevices {
		require.Equal(t, publishedMetadata, fetchedDeviceMetadata)
	}
	maxGeneration, err := s.MaxGeneration(context.Background())
	require.NoError(t, err)

	require.EqualValues(t, maxGeneration, publishedMetadata.Generation)

	// If we publish again, we increase the generation
	publishedMetadata2, err := publishNewDeviceEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, maxGeneration+1, publishedMetadata2.Generation)

	rawStorage := NewDeviceEKStorage(tc.G)
	// Put our storage in a bad state by deleting the maxGeneration
	err = rawStorage.Delete(context.Background(), keybase1.EkGeneration(maxGeneration+1))
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata3, err := publishNewDeviceEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, maxGeneration+2, publishedMetadata3.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
