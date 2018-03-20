package ephemeral

import (
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestUserEKBoxStorage(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	deviceEKMetadata, err := PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)

	userEKMetadata, err := PublishNewUserEK(context.Background(), tc.G)
	require.NoError(t, err)

	s := tc.G.GetUserEKBoxStorage()

	// Test Get nonexistent
	nonexistent, err := s.Get(context.Background(), userEKMetadata.Generation+1)
	require.Error(t, err)
	require.Equal(t, keybase1.UserEk{}, nonexistent)

	// Test get valid & unbox
	userEK, err := s.Get(context.Background(), userEKMetadata.Generation)
	require.NoError(t, err)

	seed := UserEKSeed(userEK.Seed)
	keypair, err := seed.DeriveDHKey()
	require.NoError(t, err)
	require.Equal(t, userEKMetadata.Kid, keypair.GetKID())

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

	seed = UserEKSeed(userEK.Seed)
	keypair, err = seed.DeriveDHKey()
	require.NoError(t, err)
	require.Equal(t, userEKMetadata.Kid, keypair.GetKID())

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
	require.EqualValues(t, 0, maxGeneration)

	expired, err := s.DeleteExpired(context.Background(), nil)
	expected := []keybase1.EkGeneration(nil)
	require.NoError(t, err)
	require.Equal(t, expected, expired)
}
