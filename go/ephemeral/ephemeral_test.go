package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestNewDeviceEK(t *testing.T) {
	tc := libkb.SetupTest(t, "ephemeral", 2)
	defer tc.Cleanup()
	NewEphemeralStorageAndInstall(tc.G)

	_, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	metadata, err := PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)

	fetchedDevices, err := GetOwnDeviceEKs(context.Background(), tc.G)
	require.NoError(t, err)

	require.Equal(t, 1, len(fetchedDevices))
	require.Equal(t, metadata, fetchedDevices[0])
	require.EqualValues(t, 1, metadata.Generation)

	// If we publish again, we increase the generation
	metadata, err = PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)
	require.EqualValues(t, 2, metadata.Generation)

	s := NewDeviceEKStorage(tc.G)
	// Put our storage in a bad state by deleting the maxGeneration
	err = s.Delete(keybase1.EkGeneration(2))
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the maxGeneration from the server and continue
	metadata, err = PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)
	require.EqualValues(t, 3, metadata.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
