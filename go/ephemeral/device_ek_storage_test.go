package ephemeral

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/erasablekv"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestDeviceEKStorage(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	now := keybase1.ToTime(time.Now())
	testKeys := []keybase1.DeviceEk{
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic0"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  0,
				HashMeta:    keybase1.HashMeta("fakeHashMeta0"),
				Kid:         "",
				Ctime:       now - keybase1.TimeFromSeconds(KeyLifetimeSecs*3),
				DeviceCtime: now - keybase1.TimeFromSeconds(KeyLifetimeSecs*3),
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic1"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  1,
				HashMeta:    keybase1.HashMeta("fakeHashMeta1"),
				Kid:         "",
				Ctime:       now - keybase1.TimeFromSeconds(KeyLifetimeSecs*3),
				DeviceCtime: now - keybase1.TimeFromSeconds(KeyLifetimeSecs*3),
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic2"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  2,
				HashMeta:    keybase1.HashMeta("fakeHashMeta2"),
				Kid:         "",
				Ctime:       now,
				DeviceCtime: now,
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic3"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  3,
				HashMeta:    keybase1.HashMeta("fakeHashMeta3"),
				Kid:         "",
				Ctime:       now,
				DeviceCtime: now,
			},
		},
	}

	m := libkb.NewMetaContextForTest(tc)

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(m, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	s := NewDeviceEKStorage(tc.G)

	for _, test := range testKeys {
		err := s.Put(context.Background(), test.Metadata.Generation, test)
		require.NoError(t, err)

		deviceEK, err := s.Get(context.Background(), test.Metadata.Generation)
		require.NoError(t, err)
		require.Equal(t, test, deviceEK)
	}

	// Test Get nonexistent
	deviceEK, err := s.Get(context.Background(), 5)
	require.Error(t, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	s.ClearCache()
	// Test GetAll
	deviceEKs, err := s.GetAll(context.Background())
	require.NoError(t, err)

	require.Equal(t, len(deviceEKs), 4)
	for _, test := range testKeys {
		deviceEK, ok := deviceEKs[test.Metadata.Generation]
		require.True(t, ok)
		require.Equal(t, deviceEK, test)
	}

	// Test Delete
	require.NoError(t, s.Delete(context.Background(), 2))

	deviceEK, err = s.Get(context.Background(), 2)
	require.Error(t, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	// Test MaxGeneration
	maxGeneration, err := s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 3, maxGeneration)

	require.NoError(t, s.Delete(context.Background(), 3))

	maxGeneration, err = s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 1, maxGeneration)

	// Test delete expired and check that we handle incorrect eldest seqno
	// deletion correctly.
	uv, err := getCurrentUserUV(context.Background(), tc.G)
	require.NoError(t, err)
	erasableStorage := erasablekv.NewFileErasableKVStore(tc.G, deviceEKSubDir)

	// First, let's drop a deviceEK for a different user, this shouldn't be deleted
	badUserKey := fmt.Sprintf("%s-%s-%s-0.ek", deviceEKPrefix, s.G().Env.GetUsername()+"x", uv.EldestSeqno)
	err = erasableStorage.Put(context.Background(), badUserKey, keybase1.DeviceEk{})
	require.NoError(t, err)

	// Now let's add a file with a wrong eldest seqno
	badEldestSeqnoKey := fmt.Sprintf("%s-%s-%s-0.ek", deviceEKPrefix, s.G().Env.GetUsername(), uv.EldestSeqno+1)
	err = erasableStorage.Put(context.Background(), badEldestSeqnoKey, keybase1.DeviceEk{})
	require.NoError(t, err)

	expected := []keybase1.EkGeneration{0, 1}
	expired, err := s.DeleteExpired(context.Background(), merkleRoot)
	require.NoError(t, err)
	require.Equal(t, expected, expired)

	deviceEKsAfterDeleteExpired, err := s.GetAll(context.Background())
	require.NoError(t, err)

	require.Len(t, deviceEKsAfterDeleteExpired, 0)

	var badUserDeviceEK keybase1.DeviceEk
	err = erasableStorage.Get(context.Background(), badUserKey, &badUserDeviceEK)
	require.NoError(t, err)
	require.Equal(t, badUserDeviceEK, keybase1.DeviceEk{})

	var badEldestSeqnoDeviceEK keybase1.DeviceEk
	err = erasableStorage.Get(context.Background(), badEldestSeqnoKey, &badEldestSeqnoDeviceEK)
	require.Error(t, err)
	require.Equal(t, badEldestSeqnoDeviceEK, keybase1.DeviceEk{})
}

// If we change the key format intentionally, we have to introduce some form of
// migration or versioning between the keys. This test should blow up if we
// break it unintentionally.
func TestDeviceEKStorageKeyFormat(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	s := NewDeviceEKStorage(tc.G)
	generation := keybase1.EkGeneration(1)
	uv, err := getCurrentUserUV(context.Background(), tc.G)
	require.NoError(t, err)

	key, err := s.key(context.Background(), generation)
	require.NoError(t, err)
	expected := fmt.Sprintf("deviceEphemeralKey-%s-%s-%d.ek", s.G().Env.GetUsername(), uv.EldestSeqno, generation)
	require.Equal(t, expected, key)
}

func TestDeleteExpiredOffline(t *testing.T) {
	tc, _ := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	now := keybase1.ToTime(time.Now())
	expiredTestKeys := []keybase1.DeviceEk{
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic0"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation: 0,
				HashMeta:   keybase1.HashMeta("fakeHashMeta0"),
				Kid:        "",
				Ctime:      now - keybase1.TimeFromSeconds(KeyLifetimeSecs*3),
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
				Ctime:       now - keybase1.TimeFromSeconds(KeyLifetimeSecs*3),
				DeviceCtime: now - keybase1.TimeFromSeconds(KeyLifetimeSecs*3),
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic2"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation:  2,
				HashMeta:    keybase1.HashMeta("fakeHashMeta2"),
				Kid:         "",
				Ctime:       now,
				DeviceCtime: now,
			},
		},
	}

	s := NewDeviceEKStorage(tc.G)

	for _, test := range expiredTestKeys {
		err := s.Put(context.Background(), test.Metadata.Generation, test)
		require.NoError(t, err)
	}

	expected := []keybase1.EkGeneration{0, 1}
	expired, err := s.DeleteExpired(context.Background(), libkb.MerkleRoot{})
	require.NoError(t, err)
	require.Equal(t, expected, expired)

	deviceEKsAfterDeleteExpired, err := s.GetAll(context.Background())
	require.NoError(t, err)

	require.Len(t, deviceEKsAfterDeleteExpired, 1)
}
