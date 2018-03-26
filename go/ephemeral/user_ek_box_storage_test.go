package ephemeral

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestUserEKBoxStorage(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(context.Background(), libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	deviceEKMetadata, err := publishNewDeviceEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)

	userEKMetadata, err := publishNewUserEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)

	s := tc.G.GetUserEKBoxStorage()

	// Test Get nonexistent
	nonexistent, err := s.Get(context.Background(), userEKMetadata.Generation+1)
	require.Error(t, err)
	require.Equal(t, keybase1.UserEk{}, nonexistent)

	// Test get valid & unbox
	s.ClearCache()
	userEK, err := s.Get(context.Background(), userEKMetadata.Generation)
	require.NoError(t, err)

	verifyUserEK(t, userEKMetadata, userEK)

	// Test MaxGeneration
	maxGeneration, err := s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 1, maxGeneration)

	//	NOTE: We don't expose Delete on the interface put on the GlobalContext
	//	since they should never be called, only DeleteExpired should be used.
	//	GetAll is also not exposed since it' only needed for tests.
	rawUserEKBoxStorage := NewUserEKBoxStorage(tc.G)
	userEKs, err := rawUserEKBoxStorage.GetAll(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, len(userEKs))

	userEK, ok := userEKs[userEKMetadata.Generation]
	require.True(t, ok)

	verifyUserEK(t, userEKMetadata, userEK)

	// Let's delete our deviceEK and verify we can't unbox the userEK
	rawDeviceEKStorage := NewDeviceEKStorage(tc.G)
	err = rawDeviceEKStorage.Delete(context.Background(), deviceEKMetadata.Generation)
	require.NoError(t, err)

	deviceStorage := tc.G.GetDeviceEKStorage()
	deviceStorage.ClearCache()
	deviceEK, err := deviceStorage.Get(context.Background(), deviceEKMetadata.Generation)
	require.Error(t, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	bad, err := s.Get(context.Background(), userEKMetadata.Generation)
	require.Error(t, err)
	require.Equal(t, keybase1.UserEk{}, bad)

	// test delete
	err = rawUserEKBoxStorage.Delete(context.Background(), userEKMetadata.Generation)
	require.NoError(t, err)

	userEKs, err = rawUserEKBoxStorage.GetAll(context.Background())
	require.NoError(t, err)
	require.Equal(t, 0, len(userEKs))

	s.ClearCache()

	maxGeneration, err = s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, -1, maxGeneration)

	expired, err := s.DeleteExpired(context.Background(), merkleRoot)
	expected := []keybase1.EkGeneration(nil)
	require.NoError(t, err)
	require.Equal(t, expected, expired)
}
