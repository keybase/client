package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSecretStoreDeviceEK(t *testing.T) {
	tc := SetupTest(t, "secret store deviceEK", 1)
	defer tc.Cleanup()
	tests := []struct {
		generation DeviceEKGeneration
		secret     []byte
	}{
		{0, []byte("alice_first_sec_first_sec_first_")},
		{1, []byte("charliecharliecharliecharliechar")},
		{2, []byte("alice_next_secret_alice_next_sec")},
	}

	s := NewSecretStoreDeviceEK(tc.G)
	for _, test := range tests {
		deviceSecret, err := newDeviceEphermeralSeedFromBytes(test.secret)
		require.NoError(t, err)

		err = s.StoreSecret(test.generation, deviceSecret)
		require.NoError(t, err)

		retrievedSecret, err := s.RetrieveSecret(test.generation)
		require.NoError(t, err)
		require.Equal(t, deviceSecret, retrievedSecret)
	}

	deviceSecret, err := s.RetrieveSecret(5)
	require.Error(t, err)
	require.Equal(t, DeviceEphemeralSeed{}, deviceSecret)

	deviceSecrets, err := s.GetAllDeviceEKs()
	require.NoError(t, err)

	require.Equal(t, len(deviceSecrets), 3)
	for i, test := range tests {
		expectedSecret, err := newDeviceEphermeralSeedFromBytes(test.secret)
		require.NoError(t, err)
		secret, ok := deviceSecrets[DeviceEKGeneration(i)]
		require.True(t, ok)
		require.Equal(t, secret, expectedSecret)
	}

	require.NoError(t, s.ClearSecret(0))

	secret, err := s.RetrieveSecret(0)
	require.Error(t, err)
	require.Equal(t, DeviceEphemeralSeed{}, secret)

	maxGeneration, err := s.GetMaxGeneration()
	require.NoError(t, err)
	require.EqualValues(t, 2, maxGeneration)
}
