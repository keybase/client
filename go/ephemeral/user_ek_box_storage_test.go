package ephemeral

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestUserEKBoxStorage(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()
	m := libkb.NewMetaContextForTest(tc)

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(m, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	// Login hooks should have run
	deviceEKStorage := tc.G.GetDeviceEKStorage()
	deviceEKMaxGen, err := deviceEKStorage.MaxGeneration(context.Background())
	require.True(t, deviceEKMaxGen > 0)
	require.NoError(t, err)

	s := tc.G.GetUserEKBoxStorage()
	userEKMaxGen, err := s.MaxGeneration(context.Background())
	require.True(t, userEKMaxGen > 0)
	require.NoError(t, err)

	userEKMetadata, err := publishNewUserEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)

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
	require.True(t, maxGeneration > 0)

	//	NOTE: We don't expose Delete on the interface put on the GlobalContext
	//	since they should never be called, only DeleteExpired should be used.
	//	GetAll is also not exposed since it' only needed for tests.
	rawUserEKBoxStorage := NewUserEKBoxStorage(tc.G)
	userEKs, err := rawUserEKBoxStorage.GetAll(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, maxGeneration, len(userEKs))

	userEK, ok := userEKs[userEKMetadata.Generation]
	require.True(t, ok)

	verifyUserEK(t, userEKMetadata, userEK)

	// Let's delete our deviceEK and verify we can't unbox the userEK
	rawDeviceEKStorage := NewDeviceEKStorage(tc.G)
	err = rawDeviceEKStorage.Delete(context.Background(), deviceEKMaxGen)
	require.NoError(t, err)

	deviceEKStorage.ClearCache()
	deviceEK, err := deviceEKStorage.Get(context.Background(), deviceEKMaxGen)
	require.Error(t, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	bad, err := s.Get(context.Background(), userEKMetadata.Generation)
	require.Error(t, err)
	require.Equal(t, keybase1.UserEk{}, bad)

	// test delete
	err = rawUserEKBoxStorage.Delete(context.Background(), userEKMetadata.Generation)
	require.NoError(t, err)

	userEK, err = rawUserEKBoxStorage.Get(context.Background(), userEKMetadata.Generation)
	require.Error(t, err)

	s.ClearCache()

	maxGeneration, err = s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, userEKMaxGen, maxGeneration)

	expired, err := s.DeleteExpired(context.Background(), merkleRoot)
	expected := []keybase1.EkGeneration(nil)
	require.NoError(t, err)
	require.Equal(t, expected, expired)
}

// If we change the key format intentionally, we have to introduce some form of
// migration or versioning between the keys. This test should blow up if we
// break it unintentionally.
func TestUserEKStorageKeyFormat(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	s := NewUserEKBoxStorage(tc.G)
	uv, err := tc.G.GetMeUV(context.Background())
	require.NoError(t, err)

	key, err := s.dbKey(context.Background())
	require.NoError(t, err)
	expected := fmt.Sprintf("userEphemeralKeyBox-%s-%s", s.G().Env.GetUsername(), uv.EldestSeqno)
	require.Equal(t, expected, key.Key)
}

func TestUserEKBoxStorageDeleteExpiredKeys(t *testing.T) {
	tc := libkb.SetupTest(t, "ephemeral", 2)
	defer tc.Cleanup()

	s := NewUserEKBoxStorage(tc.G)
	now := time.Now()

	// Test empty
	expired := s.getExpiredGenerations(context.Background(), make(keyExpiryMap), now)
	var expected []keybase1.EkGeneration
	expected = nil
	require.Equal(t, expected, expired)

	// Test with a single key that is not expired
	keyMap := keyExpiryMap{
		0: keybase1.ToTime(now),
	}
	expired = s.getExpiredGenerations(context.Background(), keyMap, now)
	expected = nil
	require.Equal(t, expected, expired)

	// Test with a single key that is stale but not expired
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness)),
	}
	expired = s.getExpiredGenerations(context.Background(), keyMap, now)
	expected = nil
	require.Equal(t, expected, expired)

	// Test with a single key that is expired
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-(libkb.MaxEphemeralKeyStaleness + libkb.MinEphemeralKeyLifetime))),
	}
	expired = s.getExpiredGenerations(context.Background(), keyMap, now)
	expected = []keybase1.EkGeneration{0}
	require.Equal(t, expected, expired)

	// Test with an expired and a stale key
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-(libkb.MaxEphemeralKeyStaleness + libkb.MinEphemeralKeyLifetime))),
		1: keybase1.ToTime(now.Add(-(libkb.MinEphemeralKeyLifetime))),
	}
	expired = s.getExpiredGenerations(context.Background(), keyMap, now)
	expected = []keybase1.EkGeneration{0}
	require.Equal(t, expected, expired)

	// edge of deletion
	expired = s.getExpiredGenerations(context.Background(), keyMap, now.Add(-time.Second))
	expected = nil
	require.Equal(t, expected, expired)

	// Test multiple gaps, only the last key is valid though.
	keyMap = make(keyExpiryMap)
	numKeys := 5
	for i := 0; i < numKeys; i++ {
		keyMap[keybase1.EkGeneration((numKeys - i - 1))] = keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness * time.Duration(i)))
	}
	expired = s.getExpiredGenerations(context.Background(), keyMap, now)
	expected = []keybase1.EkGeneration{0, 1, 2}
	require.Equal(t, expected, expired)

	// Test case from bug
	now = keybase1.Time(1528818944000).Time()
	keyMap = keyExpiryMap{
		46: 1528207927000,
		47: 1528294344000,
		48: 1528382176000,
		49: 1528472751000,
		50: 1528724605000,
		51: 1528811030000,
	}
	expired = s.getExpiredGenerations(context.Background(), keyMap, now)
	expected = nil
	require.Equal(t, expected, expired)
}
