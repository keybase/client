package ephemeral

import (
	"context"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestDeviceEKStorage(t *testing.T) {
	tc := libkb.SetupTest(t, "deviceEK storage", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	tests := []keybase1.DeviceEk{
		{
			Generation: keybase1.EkGeneration(0),
			HashMeta:   keybase1.HashMeta("fakeHashMeta0"),
			Seed:       keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic0"))),
		},
		{
			Generation: keybase1.EkGeneration(1),
			HashMeta:   keybase1.HashMeta("fakeHashMeta1"),
			Seed:       keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic1"))),
		},
		{
			Generation: keybase1.EkGeneration(2),
			HashMeta:   keybase1.HashMeta("fakeHashMeta2"),
			Seed:       keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic2"))),
		},
		{
			Generation: keybase1.EkGeneration(3),
			HashMeta:   keybase1.HashMeta("fakeHashMeta3"),
			Seed:       keybase1.Bytes32(libkb.MakeByte32([]byte("deviceekseed-deviceekseed-devic3"))),
		},
	}

	s := NewDeviceEKStorage(tc.G)

	for _, test := range tests {
		err = s.Put(context.Background(), test.Generation, test)
		require.NoError(t, err)

		deviceEK, err := s.Get(context.Background(), test.Generation)
		require.NoError(t, err)
		require.Equal(t, test, deviceEK)
	}

	deviceEK, err := s.Get(context.Background(), 5)
	require.Error(t, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	deviceEKs, err := s.GetAll(context.Background())
	require.NoError(t, err)

	require.Equal(t, len(deviceEKs), 4)
	for _, test := range tests {
		deviceEK, ok := deviceEKs[test.Generation]
		require.True(t, ok)
		require.Equal(t, deviceEK, test)
	}

	require.NoError(t, s.Delete(context.Background(), keybase1.EkGeneration(0)))

	deviceEK, err = s.Get(context.Background(), keybase1.EkGeneration(0))
	require.Error(t, err)
	require.Equal(t, keybase1.DeviceEk{}, deviceEK)

	maxGeneration, err := s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 3, maxGeneration)

	require.NoError(t, s.Delete(context.Background(), keybase1.EkGeneration(3)))

	maxGeneration, err = s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 2, maxGeneration)

	// Test noise file corruption
	generation := keybase1.EkGeneration(2)
	username := tc.G.Env.GetUsername().String()
	noiseName := fmt.Sprintf("%s-%s-%d.ek%s", deviceEKPrefix, username, generation, noiseSuffix)
	noiseFilePath := filepath.Join(tc.G.Env.GetDataDir(), noiseName)
	noise, err := ioutil.ReadFile(noiseFilePath)
	require.NoError(t, err)

	// flip one bit
	noise[0] ^= 0x01

	err = ioutil.WriteFile(noiseFilePath, noise, libkb.PermFile)
	require.NoError(t, err)

	s.ClearCache()
	corrupt, err := s.Get(context.Background(), generation)
	require.Error(t, err)
	require.NotEqual(t, corrupt, tests[int(generation)])
}
