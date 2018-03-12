package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestNewDeviceEK(t *testing.T) {
	tc := libkb.SetupTest(t, "ephemeral", 2)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	metadata, err := PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)

	fetchedDevices, err := GetOwnDeviceEKs(context.Background(), tc.G)
	require.NoError(t, err)

	require.Equal(t, 1, len(fetchedDevices))
	require.Equal(t, metadata, fetchedDevices[0])
	require.Equal(t, 1, metadata.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
