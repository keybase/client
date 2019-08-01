package ephemeral

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestUserEKBoxStorage(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	// Login hooks should have run
	deviceEKStorage := tc.G.GetDeviceEKStorage()
	deviceEKMaxGen, err := deviceEKStorage.MaxGeneration(mctx, false)
	require.True(t, deviceEKMaxGen > 0)
	require.NoError(t, err)

	s := tc.G.GetUserEKBoxStorage()
	userEKMaxGen, err := s.MaxGeneration(mctx, false)
	require.True(t, userEKMaxGen > 0)
	require.NoError(t, err)

	userEKMetadata, err := publishNewUserEK(mctx, merkleRoot)
	require.NoError(t, err)

	// Test get valid & unbox
	userEK, err := s.Get(mctx, userEKMetadata.Generation, nil)
	require.NoError(t, err)

	verifyUserEK(t, userEKMetadata, userEK)

	// Test Get nonexistent
	nonexistent, err := s.Get(mctx, userEKMetadata.Generation+1, nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr := err.(EphemeralKeyError)
	require.Equal(t, DefaultHumanErrMsg, ekErr.HumanError())
	require.Equal(t, keybase1.UserEk{}, nonexistent)

	// include the cached error in the max
	maxGeneration, err := s.MaxGeneration(mctx, true)
	require.NoError(t, err)
	require.Equal(t, userEKMetadata.Generation+1, maxGeneration)

	// Test MaxGeneration
	maxGeneration, err = s.MaxGeneration(mctx, false)
	require.NoError(t, err)
	require.True(t, maxGeneration > 0)

	//	NOTE: We don't expose Delete on the interface put on the GlobalContext
	//	since they should never be called, only DeleteExpired should be used.
	//	GetAll is also not exposed since it' only needed for tests.
	rawUserEKBoxStorage := NewUserEKBoxStorage()
	userEKs, err := rawUserEKBoxStorage.GetAll(mctx)
	require.NoError(t, err)
	require.EqualValues(t, maxGeneration, len(userEKs))

	userEK, ok := userEKs[userEKMetadata.Generation]
	require.True(t, ok)

	verifyUserEK(t, userEKMetadata, userEK)

	// Let's delete our deviceEK and verify we can't unbox the userEK
	rawDeviceEKStorage := NewDeviceEKStorage(mctx)
	err = rawDeviceEKStorage.Delete(mctx, deviceEKMaxGen)
	require.NoError(t, err)

	deviceEKStorage.ClearCache()
	deviceEK, err := deviceEKStorage.Get(mctx, deviceEKMaxGen)
	require.Error(t, err)
	require.IsType(t, libkb.UnboxError{}, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	bad, err := s.Get(mctx, userEKMetadata.Generation, nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr = err.(EphemeralKeyError)
	require.Equal(t, DefaultHumanErrMsg, ekErr.HumanError())
	require.Equal(t, keybase1.UserEk{}, bad)

	// test delete
	err = rawUserEKBoxStorage.Delete(mctx, userEKMetadata.Generation)
	require.NoError(t, err)

	userEK, err = rawUserEKBoxStorage.Get(mctx, userEKMetadata.Generation, nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr = err.(EphemeralKeyError)
	require.Equal(t, DefaultHumanErrMsg, ekErr.HumanError())
	require.Equal(t, keybase1.UserEk{}, userEK)

	s.ClearCache()

	maxGeneration, err = s.MaxGeneration(mctx, false)
	require.NoError(t, err)
	require.EqualValues(t, userEKMaxGen, maxGeneration)

	expired, err := s.DeleteExpired(mctx, merkleRoot)
	expected := []keybase1.EkGeneration(nil)
	require.NoError(t, err)
	require.Equal(t, expected, expired)

	// Verify we store failures in the cache
	t.Logf("cache failures")
	nonexistent, err = rawUserEKBoxStorage.Get(mctx, userEKMetadata.Generation+1, nil)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr = err.(EphemeralKeyError)
	require.Equal(t, DefaultHumanErrMsg, ekErr.HumanError())
	require.Equal(t, keybase1.UserEk{}, nonexistent)

	cache, err := rawUserEKBoxStorage.getCache(mctx)
	require.NoError(t, err)
	require.Len(t, cache, 3)

	cacheItem, ok := cache[userEKMetadata.Generation+1]
	require.True(t, ok)
	require.True(t, cacheItem.HasError())
}

// If we change the key format intentionally, we have to introduce some form of
// migration or versioning between the keys. This test should blow up if we
// break it unintentionally.
func TestUserEKStorageKeyFormat(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	s := NewUserEKBoxStorage()
	uv, err := tc.G.GetMeUV(context.TODO())
	require.NoError(t, err)

	key, err := s.dbKey(mctx)
	require.NoError(t, err)
	expected := fmt.Sprintf("userEphemeralKeyBox-%s-%s-%d", mctx.G().Env.GetUsername(), uv.EldestSeqno, userEKBoxStorageDBVersion)
	require.Equal(t, expected, key.Key)
}

func TestUserEKBoxStorageDeleteExpiredKeys(t *testing.T) {
	tc := libkb.SetupTest(t, "ephemeral", 2)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)

	s := NewUserEKBoxStorage()
	now := time.Now()

	// Test empty
	expired := s.getExpiredGenerations(mctx, make(keyExpiryMap), now)
	expected := []keybase1.EkGeneration(nil)
	require.Equal(t, expected, expired)

	// Test with a single key that is not expired
	keyMap := keyExpiryMap{
		0: keybase1.ToTime(now),
	}
	expired = s.getExpiredGenerations(mctx, keyMap, now)
	expected = nil
	require.Equal(t, expected, expired)

	// Test with a single key that is stale but not expired
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness)),
	}
	expired = s.getExpiredGenerations(mctx, keyMap, now)
	expected = nil
	require.Equal(t, expected, expired)

	// Test with a single key that is expired
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-(libkb.MaxEphemeralKeyStaleness + libkb.MinEphemeralKeyLifetime))),
	}
	expired = s.getExpiredGenerations(mctx, keyMap, now)
	expected = []keybase1.EkGeneration{0}
	require.Equal(t, expected, expired)

	// Test with an expired and a stale key
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-(libkb.MaxEphemeralKeyStaleness + libkb.MinEphemeralKeyLifetime))),
		1: keybase1.ToTime(now.Add(-(libkb.MinEphemeralKeyLifetime))),
	}
	expired = s.getExpiredGenerations(mctx, keyMap, now)
	expected = []keybase1.EkGeneration{0}
	require.Equal(t, expected, expired)

	// edge of deletion
	expired = s.getExpiredGenerations(mctx, keyMap, now.Add(-time.Second))
	expected = nil
	require.Equal(t, expected, expired)

	// Test multiple gaps, only the last key is valid though.
	keyMap = make(keyExpiryMap)
	numKeys := 5
	for i := 0; i < numKeys; i++ {
		keyMap[keybase1.EkGeneration((numKeys - i - 1))] = keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness * time.Duration(i)))
	}
	expired = s.getExpiredGenerations(mctx, keyMap, now)
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
	expired = s.getExpiredGenerations(mctx, keyMap, now)
	expected = nil
	require.Equal(t, expected, expired)
}
