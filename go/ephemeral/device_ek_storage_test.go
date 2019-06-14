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

func TestDeviceEKStorage(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	now := time.Now()
	testKeys := []keybase1.DeviceEk{
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic0"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  0,
				HashMeta:    keybase1.HashMeta("fakeHashMeta0"),
				Kid:         "",
				Ctime:       keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness * 3)),
				DeviceCtime: keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness * 3)),
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic1"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  1,
				HashMeta:    keybase1.HashMeta("fakeHashMeta1"),
				Kid:         "",
				Ctime:       keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness * 3)),
				DeviceCtime: keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness * 3)),
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic2"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  2,
				HashMeta:    keybase1.HashMeta("fakeHashMeta2"),
				Kid:         "",
				Ctime:       keybase1.ToTime(now),
				DeviceCtime: keybase1.ToTime(now),
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic3"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  3,
				HashMeta:    keybase1.HashMeta("fakeHashMeta3"),
				Kid:         "",
				Ctime:       keybase1.ToTime(now),
				DeviceCtime: keybase1.ToTime(now),
			},
		},
	}

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	s := NewDeviceEKStorage(mctx)

	for _, test := range testKeys {
		err := s.Put(mctx, test.Metadata.Generation, test)
		require.NoError(t, err)

		deviceEK, err := s.Get(mctx, test.Metadata.Generation)
		require.NoError(t, err)
		require.Equal(t, test, deviceEK)
	}

	// corrupt a key in storage and ensure we get the right error back
	corruptedGeneration := keybase1.EkGeneration(3)
	ek, err := s.Get(mctx, corruptedGeneration)
	require.NoError(t, err)

	ek.Metadata.Generation = 100
	err = s.Put(mctx, corruptedGeneration, ek)
	require.Error(t, err)
	require.IsType(t, EphemeralKeyError{}, err)
	ekErr := err.(EphemeralKeyError)
	expectedErr := newEKCorruptedErr(mctx, DeviceEKStr, corruptedGeneration, 100)
	require.Equal(t, expectedErr.Error(), ekErr.Error())
	require.Equal(t, DefaultHumanErrMsg, ekErr.HumanError())

	// Test GetAll
	deviceEKs, err := s.GetAll(mctx)
	require.NoError(t, err)

	require.Equal(t, len(deviceEKs), len(testKeys))
	for _, test := range testKeys {
		deviceEK, ok := deviceEKs[test.Metadata.Generation]
		require.True(t, ok)
		require.Equal(t, deviceEK, test)
	}

	// Test Delete
	require.NoError(t, s.Delete(mctx, 2))

	deviceEK, err := s.Get(mctx, 2)
	require.Error(t, err)
	require.IsType(t, libkb.UnboxError{}, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	// Test Get nonexistent
	nonexistent, err := s.Get(mctx, keybase1.EkGeneration(len(testKeys)+1))
	require.Error(t, err)
	require.IsType(t, libkb.UnboxError{}, err)
	require.Equal(t, keybase1.DeviceEk{}, nonexistent)

	// include the cached error in the max
	maxGeneration, err := s.MaxGeneration(mctx, true)
	require.NoError(t, err)
	require.EqualValues(t, keybase1.EkGeneration(len(testKeys)+1), maxGeneration)

	// Test MaxGeneration
	maxGeneration, err = s.MaxGeneration(mctx, false)
	require.NoError(t, err)
	require.EqualValues(t, 3, maxGeneration)
	s.ClearCache()

	require.NoError(t, s.Delete(mctx, 3))

	maxGeneration, err = s.MaxGeneration(mctx, false)
	require.NoError(t, err)
	require.EqualValues(t, 1, maxGeneration)

	// Test delete expired and check that we handle incorrect eldest seqno
	// deletion correctly.
	uv, err := tc.G.GetMeUV(context.TODO())
	require.NoError(t, err)
	erasableStorage := libkb.NewFileErasableKVStore(mctx, deviceEKSubDir, deviceEKKeygen)

	// First, let's drop a deviceEK for a different user, this shouldn't be deleted
	badUserKey := fmt.Sprintf("%s-%s-%s-0.ek", deviceEKPrefix, mctx.G().Env.GetUsername()+"x", uv.EldestSeqno)
	err = erasableStorage.Put(mctx, badUserKey, keybase1.DeviceEk{})
	require.NoError(t, err)

	// Now let's add a file with a wrong eldest seqno
	badEldestSeqnoKey := fmt.Sprintf("%s-%s-%s-0.ek", deviceEKPrefix, mctx.G().Env.GetUsername(), uv.EldestSeqno+1)
	err = erasableStorage.Put(mctx, badEldestSeqnoKey, keybase1.DeviceEk{})
	require.NoError(t, err)

	expected := []keybase1.EkGeneration{0, 1}
	expired, err := s.DeleteExpired(mctx, merkleRoot)
	require.NoError(t, err)
	require.Equal(t, expected, expired)

	deviceEKsAfterDeleteExpired, err := s.GetAll(mctx)
	require.NoError(t, err)

	require.Len(t, deviceEKsAfterDeleteExpired, 0)

	var badUserDeviceEK keybase1.DeviceEk
	err = erasableStorage.Get(mctx, badUserKey, &badUserDeviceEK)
	require.NoError(t, err)
	require.Equal(t, badUserDeviceEK, keybase1.DeviceEk{})

	var badEldestSeqnoDeviceEK keybase1.DeviceEk
	err = erasableStorage.Get(mctx, badEldestSeqnoKey, &badEldestSeqnoDeviceEK)
	require.Error(t, err)
	require.IsType(t, libkb.UnboxError{}, err)
	require.Equal(t, badEldestSeqnoDeviceEK, keybase1.DeviceEk{})

	// Verify we store failures in the cache
	t.Logf("cache failures")
	nonexistent, err = s.Get(mctx, maxGeneration+1)
	require.Error(t, err)
	require.IsType(t, libkb.UnboxError{}, err)
	require.Equal(t, keybase1.DeviceEk{}, nonexistent)

	cache, err := s.getCache(mctx)
	require.NoError(t, err)
	require.Len(t, cache, 1)

	cacheItem, ok := cache[maxGeneration+1]
	require.True(t, ok)
	require.Error(t, cacheItem.Err)
	require.IsType(t, libkb.UnboxError{}, cacheItem.Err)
}

// If we change the key format intentionally, we have to introduce some form of
// migration or versioning between the keys. This test should blow up if we
// break it unintentionally.
func TestDeviceEKStorageKeyFormat(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	s := NewDeviceEKStorage(mctx)
	generation := keybase1.EkGeneration(1)
	uv, err := tc.G.GetMeUV(context.TODO())
	require.NoError(t, err)

	key, err := s.key(mctx, generation)
	require.NoError(t, err)
	expected := fmt.Sprintf("deviceEphemeralKey-%s-%s-%d.ek", mctx.G().Env.GetUsername(), uv.EldestSeqno, generation)
	require.Equal(t, expected, key)
}

func TestDeleteExpiredOffline(t *testing.T) {
	tc, mctx, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	now := time.Now()
	expiredTestKeys := []keybase1.DeviceEk{
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic0"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation: 0,
				HashMeta:   keybase1.HashMeta("fakeHashMeta0"),
				Kid:        "",
				Ctime:      keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness * 3)),
				// Although we are 'offline' and can't get a merkleRoot, we
				// correctly delete this key since we fall back to the Ctime
				DeviceCtime: -1,
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic1"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  1,
				HashMeta:    keybase1.HashMeta("fakeHashMeta1"),
				Kid:         "",
				Ctime:       keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness * 3)),
				DeviceCtime: keybase1.ToTime(now.Add(-libkb.MaxEphemeralKeyStaleness * 3)),
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic2"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  2,
				HashMeta:    keybase1.HashMeta("fakeHashMeta2"),
				Kid:         "",
				Ctime:       keybase1.ToTime(now),
				DeviceCtime: keybase1.ToTime(now),
			},
		},
	}

	s := NewDeviceEKStorage(mctx)

	for _, test := range expiredTestKeys {
		err := s.Put(mctx, test.Metadata.Generation, test)
		require.NoError(t, err)
	}

	expected := []keybase1.EkGeneration{0, 1}
	expired, err := s.DeleteExpired(mctx, libkb.MerkleRoot{})
	require.NoError(t, err)
	require.Equal(t, expected, expired)

	deviceEKsAfterDeleteExpired, err := s.GetAll(mctx)
	require.NoError(t, err)

	require.Len(t, deviceEKsAfterDeleteExpired, 1)
}

func TestDeviceEKStorageDeleteExpiredKeys(t *testing.T) {
	tc := libkb.SetupTest(t, "ephemeral", 2)
	defer tc.Cleanup()
	mctx := libkb.NewMetaContextForTest(tc)
	s := NewDeviceEKStorage(mctx)
	now := time.Now()

	// Test empty
	expired := s.getExpiredGenerations(mctx, make(keyExpiryMap), now)
	var expected []keybase1.EkGeneration
	expected = nil
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
		0: keybase1.ToTime(now.Add(-(2*libkb.MaxEphemeralKeyStaleness + libkb.MinEphemeralKeyLifetime))),
	}
	expired = s.getExpiredGenerations(mctx, keyMap, now)
	expected = []keybase1.EkGeneration{0}
	require.Equal(t, expected, expired)

	// Test with one stale and one expired key
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-(2*libkb.MaxEphemeralKeyStaleness + libkb.MinEphemeralKeyLifetime))),
		1: keybase1.ToTime(now.Add(-(libkb.MaxEphemeralKeyStaleness + libkb.MinEphemeralKeyLifetime))),
	}
	expired = s.getExpiredGenerations(mctx, keyMap, now)
	expected = []keybase1.EkGeneration{0}
	require.Equal(t, expected, expired)

	// Test with one expired key, one stale, and one that has reached libkb.MinEphemeralKeyLifetime
	keyMap = keyExpiryMap{
		0: keybase1.ToTime(now.Add(-(2*libkb.MaxEphemeralKeyStaleness + libkb.MinEphemeralKeyLifetime))),
		1: keybase1.ToTime(now.Add(-(libkb.MaxEphemeralKeyStaleness + libkb.MinEphemeralKeyLifetime))),
		2: keybase1.ToTime(now.Add(-libkb.MinEphemeralKeyLifetime)),
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
		keyMap[keybase1.EkGeneration((numKeys - i - 1))] = keybase1.ToTime(now.Add(-(libkb.MaxEphemeralKeyStaleness*time.Duration(i) + libkb.MinEphemeralKeyLifetime)))
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
