package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/stretchr/testify/require"
)

func TestNewUserEK(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	// The test user has a PUK, but it's not automatically loaded. We have to
	// explicitly sync it.
	keyring, err := tc.G.GetPerUserKeyring()
	require.NoError(t, err)
	err = keyring.Sync(context.Background())
	require.NoError(t, err)

	_, err = PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)

	// Before we've published any userEK's, GetOwnActiveUserEKMetadata should return nil.
	hopefullyNilUserEK, err := GetOwnActiveUserEKMetadata(context.Background(), tc.G)
	require.NoError(t, err)
	require.Nil(t, hopefullyNilUserEK)

	publishedMetadata, err := PublishNewUserEK(context.Background(), tc.G)
	require.NoError(t, err)

	activeUserEK, err := GetOwnActiveUserEKMetadata(context.Background(), tc.G)
	require.NoError(t, err)
	require.NotNil(t, activeUserEK)
	require.Equal(t, *activeUserEK, publishedMetadata)
	require.EqualValues(t, 1, activeUserEK.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata
