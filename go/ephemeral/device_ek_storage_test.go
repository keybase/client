package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestDeviceEKStorage(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	tests := []keybase1.DeviceEk{
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic0"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation: keybase1.EkGeneration(0),
				HashMeta:   keybase1.HashMeta("fakeHashMeta0"),
				Kid:        keybase1.KID(""),
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic1"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation: keybase1.EkGeneration(1),
				HashMeta:   keybase1.HashMeta("fakeHashMeta1"),
				Kid:        keybase1.KID(""),
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic2"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation: keybase1.EkGeneration(2),
				HashMeta:   keybase1.HashMeta("fakeHashMeta2"),
				Kid:        keybase1.KID(""),
			},
		},
		{
			Seed: keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic3"))),
			Metadata: keybase1.DeviceEkMetadata{
				Generation: keybase1.EkGeneration(3),
				HashMeta:   keybase1.HashMeta("fakeHashMeta3"),
				Kid:        keybase1.KID(""),
			},
		},
	}

	s := NewDeviceEKStorage(tc.G)

	for _, test := range tests {
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

	// Test GetAll
	deviceEKs, err := s.GetAll(context.Background())
	require.NoError(t, err)

	require.Equal(t, len(deviceEKs), 4)
	for _, test := range tests {
		deviceEK, ok := deviceEKs[test.Metadata.Generation]
		require.True(t, ok)
		require.Equal(t, deviceEK, test)
	}

	// Test Delete
	require.NoError(t, s.Delete(context.Background(), keybase1.EkGeneration(0)))

	deviceEK, err = s.Get(context.Background(), keybase1.EkGeneration(0))
	require.Error(t, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	// Test MaxGeneration
	maxGeneration, err := s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 3, maxGeneration)

	require.NoError(t, s.Delete(context.Background(), keybase1.EkGeneration(3)))

	maxGeneration, err = s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 2, maxGeneration)

}
