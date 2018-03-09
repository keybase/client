package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDeviceEKKeyring(t *testing.T) {
	tc := SetupTest(t, "deviceEK keyring", 1)
	defer tc.Cleanup()

	tests := []DeviceEK
	{
		{0, []byte("fakeHashMeta0"), []byte("deviceekseed-deviceekseed-devic0"), ""},
		{1, []byte("fakeHashMeta1"), []byte("deviceekseed-deviceekseed-devic1"), ""},
		{2, []byte("fakeHashMeta2"), []byte("deviceekseed-deviceekseed-devic2"), ""},
		{3, []byte("fakeHashMeta3"), []byte("deviceekseed-deviceekseed-devic3"), ""},
	}

	k, err := NewDeviceEKKeyring(tc.G)
	require.NoError(t, err)

	for _, test := range tests {
		err = k.Put(test.Generation, test.Seed, test.HashMeta)
		require.NoError(t, err)

		deviceEK, err := k.Get(test.generation)
		require.NoError(t, err)
		require.Equal(t, test, deviceEK)
	}

	deviceEK, err := k.Get(5)
	require.Error(t, err)
	require.Equal(t, DeviceEK{}, deviceEK)

	deviceEK, err := k.GetAllDeviceEKs()
	require.NoError(t, err)

	require.Equal(t, len(deviceEKs), 4)
	for i, test := range tests {
		deviceEK, ok := deviceEKs[DeviceEKGeneration(i)]
		require.True(t, ok)
		require.Equal(t, deviceEK, test)
	}

	require.NoError(t, k.Delete(0))

	deviceEK, err := k.Get(0)
	require.Error(t, err)
	require.Equal(t, DeviceEK{}, deviceEK)

	maxGeneration, err := k.GetMaxGeneration()
	require.NoError(t, err)
	require.EqualValues(t, 3, maxGeneration)
}
