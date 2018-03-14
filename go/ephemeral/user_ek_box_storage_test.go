package ephemeral

import (
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestUserEKBoxStorage(t *testing.T) {
	t.Skip() // TODO remove after rebase
	tc := libkb.SetupTest(t, "user ek storage", 2)
	defer tc.Cleanup()

	NewEphemeralStorageAndInstall(tc.G)

	_, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	// The test user has a PUK, but it's not automatically loaded. We have to
	// explicitly sync it.
	keyring, err := tc.G.GetPerUserKeyring()
	require.NoError(t, err)
	err = keyring.Sync(context.Background())
	require.NoError(t, err)

	deviceEKMetadata, err := PublishNewDeviceEK(context.Background(), tc.G)
	require.NoError(t, err)

	// TODO Uncomment after rebase
	//userEKMetadata, err := PublishNewUserEK(context.Background(), tc.G)
	//require.NoError(t, err)
	userEKMetadata := keybase1.UserEkMetadata{} // TODO remove after rebase

	s := tc.G.GetUserEKBoxStorage()

	// Test Get nonexistent
	nonexistent, err := s.Get(context.Background(), userEKMetadata.Generation+1)
	require.Error(t, err)
	require.Equal(t, keybase1.UserEk{}, nonexistent)

	// Test get valid & unbox
	userEK, err := s.Get(context.Background(), userEKMetadata.Generation)
	require.NoError(t, err)
	require.NotNil(t, userEK) // TODO remove after rebase

	// TODO Uncomment after rebase
	//keypair, err := UserEKSeed(userEK.Seed).DeriveDHKey()
	//if err != nil {
	//	return userEK, err
	//	require.Equal(t, userEKMetadata.Kid, keypair.GetKID())

	//	NOTE: We don't expose Delete on the interface put on the GlobalContext
	//	since they should never be called, only DeleteExpired should be used.
	//	GetAll is also not exposed since it' only needed for tests.
	rawUserEKBoxStorage := NewUserEKBoxStorage(tc.G)

	userEKs, err := rawUserEKBoxStorage.GetAll(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, len(userEKs))

	// Test MaxGeneration
	maxGeneration, err := s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 1, maxGeneration)

	// TODO Uncomment after rebase
	// userEK, ok := userEKs[userEKMetadata.Generation]
	// require.True(t, ok)
	// require.Equal(t, userEKMetadata.Kid, userEK.Keypair.GetKID())
	//keypair, err := UserEKSeed(userEK.Seed).DeriveDHKey()
	//if err != nil {
	//	return userEK, err
	//	require.Equal(t, userEKMetadata.Kid, keypair.GetKID())

	// Let's delete our deviceEK and verify we can't unbox the userEK
	// Put our storage in a bad state by deleting the maxGeneration
	rawDeviceEKStorage := NewDeviceEKStorage(tc.G)
	err = rawDeviceEKStorage.Delete(context.Background(), deviceEKMetadata.Generation)
	require.NoError(t, err)

	bad, err := s.Get(context.Background(), userEKMetadata.Generation)
	require.Error(t, err)
	require.Equal(t, keybase1.UserEk{}, bad)

	// test delete
	err = rawUserEKBoxStorage.Delete(context.Background(), userEKMetadata.Generation)
	require.Error(t, err)

	userEKs, err = rawUserEKBoxStorage.GetAll(context.Background())
	require.NoError(t, err)
	require.Equal(t, 0, len(userEKs))

	maxGeneration, err = s.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, 0, maxGeneration)
}
