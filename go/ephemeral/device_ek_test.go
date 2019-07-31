package ephemeral

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestNewDeviceEK(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	publishedMetadata, err := publishNewDeviceEK(mctx, merkleRoot)
	require.NoError(t, err)

	s := tc.G.GetDeviceEKStorage()
	deviceEK, err := s.Get(mctx, publishedMetadata.Generation)
	require.NoError(t, err)
	// Clear out DeviceCtime since it won't be present in fetched data, it's
	// only known locally.
	require.NotEqual(t, 0, deviceEK.Metadata.DeviceCtime)
	deviceEK.Metadata.DeviceCtime = 0
	require.Equal(t, deviceEK.Metadata, publishedMetadata)

	fetchedDevices, err := allActiveDeviceEKMetadata(mctx, merkleRoot)
	require.NoError(t, err)

	require.Equal(t, 1, len(fetchedDevices))
	for _, fetchedDeviceMetadata := range fetchedDevices {
		require.Equal(t, publishedMetadata, fetchedDeviceMetadata)
	}
	maxGeneration, err := s.MaxGeneration(mctx, false)
	require.NoError(t, err)

	require.EqualValues(t, maxGeneration, publishedMetadata.Generation)

	// If we publish again, we increase the generation
	publishedMetadata2, err := publishNewDeviceEK(mctx, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, maxGeneration+1, publishedMetadata2.Generation)

	rawStorage := NewDeviceEKStorage(mctx)
	// Put our storage in a bad state by deleting the maxGeneration
	err = rawStorage.Delete(mctx, maxGeneration+1)
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata3, err := publishNewDeviceEK(mctx, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, maxGeneration+2, publishedMetadata3.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
