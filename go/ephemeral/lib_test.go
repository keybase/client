package ephemeral

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestKeygenIfNeeded(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	ekLib := NewEKLib(tc.G)
	userEKBoxStorage := NewUserEKBoxStorage(tc.G)
	deviceEKStorage := NewDeviceEKStorage(tc.G)
	keygen := func() {
		err := ekLib.KeygenIfNeeded(context.Background())
		require.NoError(t, err)

		deviceEKs, err := deviceEKStorage.GetAll(context.Background())
		require.NoError(t, err)
		require.Equal(t, 1, len(deviceEKs))

		userEKs, err := userEKBoxStorage.GetAll(context.Background())
		require.NoError(t, err)
		require.Equal(t, 1, len(userEKs))
	}

	// If we retry keygen, we don't regenerate keys
	keygen()
	keygen()

	// Let's purge our local userEK store and make sure we don't regenerate
	// (respecting the server max)
	userEKs, err := userEKBoxStorage.GetAll(context.Background())
	require.NoError(t, err)
	for generation := range userEKs {
		userEKBoxStorage.Delete(context.Background(), generation)
	}
	tc.G.GetUserEKBoxStorage().ClearCache()
	keygen()

	// Now let's kill our deviceEK as well, so we should regenerate a new
	// userEK since we can't access the old one
	deviceEKs, err := deviceEKStorage.GetAll(context.Background())
	require.NoError(t, err)
	for generation := range deviceEKs {
		deviceEKStorage.Delete(context.Background(), generation)
	}
	keygen()
}

func TestCleanupStaleUserAndDeviceEKs(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	seed, err := newDeviceEphemeralSeed()
	require.NoError(t, err)
	s := tc.G.GetDeviceEKStorage()
	ctimeExpired := keybase1.TimeFromSeconds(time.Now().Unix() - KeyLifetimeSecs*3)
	err = s.Put(context.Background(), 0, keybase1.DeviceEk{
		Seed: keybase1.Bytes32(seed),
		Metadata: keybase1.DeviceEkMetadata{
			Ctime: ctimeExpired,
		},
	})
	require.NoError(t, err)

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(context.Background(), libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	ekLib := NewEKLib(tc.G)
	err = ekLib.CleanupStaleUserAndDeviceEKs(context.Background(), merkleRoot)
	require.NoError(t, err)

	deviceEK, err := s.Get(context.Background(), 0)
	require.Error(t, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	err = ekLib.CleanupStaleUserAndDeviceEKs(context.Background(), merkleRoot)
	require.NoError(t, err)
}
