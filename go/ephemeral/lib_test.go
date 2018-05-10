package ephemeral

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestKeygenIfNeeded(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	ekLib := NewEKLib(tc.G)
	deviceEKStorage := tc.G.GetDeviceEKStorage()
	userEKBoxStorage := tc.G.GetUserEKBoxStorage()

	expectedDeviceEKGen, err := deviceEKStorage.MaxGeneration(context.Background())
	require.NoError(t, err)
	if expectedDeviceEKGen < 0 {
		expectedDeviceEKGen = 1
		deviceEKNeeded, err := ekLib.NewDeviceEKNeeded(context.Background())
		require.NoError(t, err)
		require.True(t, deviceEKNeeded)

	}

	expectedUserEKGen, err := userEKBoxStorage.MaxGeneration(context.Background())
	require.NoError(t, err)
	if expectedUserEKGen < 0 {
		expectedUserEKGen = 1
		userEKNeeded, err := ekLib.NewUserEKNeeded(context.Background())
		require.NoError(t, err)
		require.True(t, userEKNeeded)
	}

	keygen := func(expectedDeviceEKGen, expectedUserEKGen keybase1.EkGeneration) {
		err := ekLib.KeygenIfNeeded(context.Background())
		require.NoError(t, err)

		// verify deviceEK
		deviceEKNeeded, err := ekLib.NewDeviceEKNeeded(context.Background())
		require.NoError(t, err)
		require.False(t, deviceEKNeeded)

		deviceEKMaxGen, err := deviceEKStorage.MaxGeneration(context.Background())
		require.NoError(t, err)
		require.Equal(t, expectedDeviceEKGen, deviceEKMaxGen)

		// verify userEK
		userEKNeeded, err := ekLib.NewUserEKNeeded(context.Background())
		require.NoError(t, err)
		require.False(t, userEKNeeded)

		userEKMaxGen, err := userEKBoxStorage.MaxGeneration(context.Background())
		require.NoError(t, err)
		require.Equal(t, expectedUserEKGen, userEKMaxGen)
	}

	// If we retry keygen, we don't regenerate keys
	keygen(expectedDeviceEKGen, expectedUserEKGen)
	keygen(expectedDeviceEKGen, expectedUserEKGen)

	rawDeviceEKStorage := NewDeviceEKStorage(tc.G)
	rawUserEKBoxStorage := NewUserEKBoxStorage(tc.G)

	// Let's purge our local userEK store and make sure we don't regenerate
	// (respecting the server max)
	err = rawUserEKBoxStorage.Delete(context.Background(), expectedUserEKGen)
	require.NoError(t, err)
	userEKBoxStorage.ClearCache()
	keygen(expectedDeviceEKGen, expectedUserEKGen)

	// Now let's kill our deviceEK as well, so we should regenerate a new
	// userEK since we can't access the old one
	err = rawDeviceEKStorage.Delete(context.Background(), expectedDeviceEKGen)
	require.NoError(t, err)
	deviceEKStorage.ClearCache()
	expectedDeviceEKGen++
	expectedUserEKGen++
	keygen(expectedDeviceEKGen, expectedUserEKGen)
}

func TestNewTeamEKNeeded(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	teamID := createTeam(tc)
	ekLib := NewEKLib(tc.G)
	deviceEKStorage := tc.G.GetDeviceEKStorage()
	userEKBoxStorage := tc.G.GetUserEKBoxStorage()
	teamEKBoxStorage := tc.G.GetTeamEKBoxStorage()

	// We don't have any keys, so we should need a new teamEK
	needed, err := ekLib.NewTeamEKNeeded(context.Background(), teamID)
	require.NoError(t, err)
	require.True(t, needed)

	expectedTeamEKGen, err := teamEKBoxStorage.MaxGeneration(context.Background(), teamID)
	require.NoError(t, err)
	if expectedTeamEKGen < 0 {
		expectedTeamEKGen = 1
	}

	expectedDeviceEKGen, err := deviceEKStorage.MaxGeneration(context.Background())
	require.NoError(t, err)
	if expectedDeviceEKGen < 0 {
		expectedDeviceEKGen = 1
	}

	expectedUserEKGen, err := userEKBoxStorage.MaxGeneration(context.Background())
	require.NoError(t, err)
	if expectedUserEKGen < 0 {
		expectedUserEKGen = 1
	}

	assertKeyGenerations := func(expectedDeviceEKGen, expectedUserEKGen, expectedTeamEKGen keybase1.EkGeneration) {
		teamEK, err := ekLib.GetOrCreateLatestTeamEK(context.Background(), teamID)
		require.NoError(t, err)

		// verify deviceEK
		deviceEKNeeded, err := ekLib.NewDeviceEKNeeded(context.Background())
		require.NoError(t, err)
		require.False(t, deviceEKNeeded)

		deviceEKMaxGen, err := deviceEKStorage.MaxGeneration(context.Background())
		require.NoError(t, err)
		require.Equal(t, expectedDeviceEKGen, deviceEKMaxGen)

		// verify userEK
		userEKNeeded, err := ekLib.NewUserEKNeeded(context.Background())
		require.NoError(t, err)
		require.False(t, userEKNeeded)

		userEKMaxGen, err := userEKBoxStorage.MaxGeneration(context.Background())
		require.NoError(t, err)
		require.Equal(t, expectedUserEKGen, userEKMaxGen)

		// verify teamEK
		teamEKGen, err := teamEKBoxStorage.MaxGeneration(context.Background(), teamID)
		require.NoError(t, err)
		require.Equal(t, expectedTeamEKGen, teamEKGen)
		require.Equal(t, expectedTeamEKGen, teamEK.Metadata.Generation)

		teamEKNeeded, err := ekLib.NewTeamEKNeeded(context.Background(), teamID)
		require.NoError(t, err)
		require.False(t, teamEKNeeded)
	}

	// If we retry keygen, we don't regenerate keys
	assertKeyGenerations(expectedDeviceEKGen, expectedUserEKGen, expectedTeamEKGen)
	assertKeyGenerations(expectedDeviceEKGen, expectedUserEKGen, expectedTeamEKGen)

	rawDeviceEKStorage := NewDeviceEKStorage(tc.G)
	rawUserEKBoxStorage := NewUserEKBoxStorage(tc.G)
	rawTeamEKBoxStorage := NewTeamEKBoxStorage(tc.G)

	// Let's purge our local teamEK store and make sure we don't regenerate
	// (respecting the server max)
	err = rawTeamEKBoxStorage.Delete(context.Background(), teamID, expectedTeamEKGen)
	require.NoError(t, err)
	teamEKBoxStorage.ClearCache()
	assertKeyGenerations(expectedDeviceEKGen, expectedUserEKGen, expectedTeamEKGen)

	// Now let's kill our userEK, we should gracefully not regenerate
	// since we can still fetch the userEK from the server.
	err = rawUserEKBoxStorage.Delete(context.Background(), expectedUserEKGen)
	require.NoError(t, err)
	tc.G.GetDeviceEKStorage().ClearCache()
	assertKeyGenerations(expectedDeviceEKGen, expectedUserEKGen, expectedTeamEKGen)

	// Now let's kill our deviceEK as well, and we should generate all new keys
	err = rawDeviceEKStorage.Delete(context.Background(), expectedDeviceEKGen)
	require.NoError(t, err)
	tc.G.GetDeviceEKStorage().ClearCache()
	expectedDeviceEKGen++
	expectedUserEKGen++
	expectedTeamEKGen++
	assertKeyGenerations(expectedDeviceEKGen, expectedUserEKGen, expectedTeamEKGen)

	// If we try to access an older teamEK that we cannot access, we don't
	// create a new teamEK
	teamEK, err := ekLib.GetTeamEK(context.Background(), teamID, expectedTeamEKGen-1)
	require.Error(t, err)
	require.Equal(t, teamEK, keybase1.TeamEk{})
	assertKeyGenerations(expectedDeviceEKGen, expectedUserEKGen, expectedTeamEKGen)

	// Now let's kill our deviceEK, so we can no longer access the latest teamEK
	// and will generate a new one and verify it is the new valid max.
	err = rawDeviceEKStorage.Delete(context.Background(), expectedDeviceEKGen)
	require.NoError(t, err)
	tc.G.GetDeviceEKStorage().ClearCache()

	teamEK, err = ekLib.GetTeamEK(context.Background(), teamID, expectedTeamEKGen)
	require.Error(t, err)
	require.Equal(t, teamEK, keybase1.TeamEk{})

	expectedDeviceEKGen++
	expectedUserEKGen++
	expectedTeamEKGen++
	assertKeyGenerations(expectedDeviceEKGen, expectedUserEKGen, expectedTeamEKGen)
}

func TestCleanupStaleUserAndDeviceEKs(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
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

	ekLib := NewEKLib(tc.G)
	err = ekLib.CleanupStaleUserAndDeviceEKs(context.Background())
	require.NoError(t, err)

	deviceEK, err := s.Get(context.Background(), 0)
	require.Error(t, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	err = ekLib.CleanupStaleUserAndDeviceEKs(context.Background())
	require.NoError(t, err)
}
