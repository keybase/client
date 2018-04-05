package ephemeral

import (
	"context"
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestNewUserEK(t *testing.T) {
	tc := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(context.Background(), libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	uid := tc.G.Env.GetUID()
	uids := []keybase1.UID{uid}
	prevStatements, err := fetchUserEKStatements(context.Background(), tc.G, uids)
	require.NoError(t, err)
	prevStatement, ok := prevStatements[uid]
	require.True(t, ok)
	prevExisting := prevStatement.ExistingUserEkMetadata
	prevExisting = append(prevExisting, prevStatement.CurrentUserEkMetadata)

	publishedMetadata, err := publishNewUserEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)

	s := tc.G.GetUserEKBoxStorage()
	userEK, err := s.Get(context.Background(), publishedMetadata.Generation)
	require.NoError(t, err)
	require.Equal(t, userEK.Metadata, publishedMetadata)

	statements, err := fetchUserEKStatements(context.Background(), tc.G, uids)
	require.NoError(t, err)
	statement, ok := statements[uid]
	require.True(t, ok)
	require.NotNil(t, statement)
	currentMetadata := statement.CurrentUserEkMetadata
	require.Equal(t, currentMetadata, publishedMetadata)
	require.Equal(t, statement.ExistingUserEkMetadata, prevExisting)

	// We've stored the result in local storage
	userEKBoxStorage := tc.G.GetUserEKBoxStorage()
	maxGeneration, err := userEKBoxStorage.MaxGeneration(context.Background())
	ek, err := userEKBoxStorage.Get(context.Background(), maxGeneration)
	require.NoError(t, err)
	require.Equal(t, ek.Metadata, publishedMetadata)

	rawStorage := NewUserEKBoxStorage(tc.G)
	// Put our storage in a bad state by deleting the maxGeneration
	err = rawStorage.Delete(context.Background(), maxGeneration)
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata2, err := publishNewUserEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, maxGeneration+1, publishedMetadata2.Generation)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata

func TestDeviceRevokeNewUserEK(t *testing.T) {
	tc := libkb.SetupTest(t, "kex2provision", 2)
	defer tc.Cleanup()
	NewEphemeralStorageAndInstall(tc.G)

	// Include a paper key with this test user, so that we have something to
	// revoke.
	user, err := kbtest.CreateAndSignupFakeUserPaper("e", tc.G)
	require.NoError(t, err)

	// Confirm that the user has a userEK.
	uid := tc.G.Env.GetUID()
	uids := []keybase1.UID{uid}
	statements, err := fetchUserEKStatements(context.Background(), tc.G, uids)
	require.NoError(t, err)
	firstStatement, ok := statements[uid]
	require.True(t, ok)
	require.EqualValues(t, firstStatement.CurrentUserEkMetadata.Generation, 1, "should start at userEK gen 1")

	// Load the full user so that we can grab their devices.
	arg := libkb.NewLoadUserByNameArg(tc.G, user.Username)
	fullUser, err := libkb.LoadUser(arg)
	if err != nil {
		tc.T.Fatal(err)
	}
	paperKey := fullUser.GetComputedKeyInfos().PaperDevices()[0]

	// Revoke the paper key.
	revokeEngine := engine.NewRevokeDeviceEngine(engine.RevokeDeviceEngineArgs{ID: paperKey.ID}, tc.G)
	ctx := &engine.Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: user.NewSecretUI(),
	}
	err = engine.RunEngine(revokeEngine, ctx)
	require.NoError(t, err)

	// Finally, confirm that the revocation above rolled a new userEK.
	statements, err = fetchUserEKStatements(context.Background(), tc.G, uids)
	require.NoError(t, err)
	secondStatement, ok := statements[uid]
	require.True(t, ok)
	require.EqualValues(t, secondStatement.CurrentUserEkMetadata.Generation, 2, "after revoke, should have userEK gen 2")
	userEK, err := tc.G.GetUserEKBoxStorage().Get(context.Background(), 2)
	require.NoError(t, err)
	require.Equal(t, secondStatement.CurrentUserEkMetadata, userEK.Metadata)
}

func TestPukRollNewUserEK(t *testing.T) {
	tc := libkb.SetupTest(t, "kex2provision", 2)
	defer tc.Cleanup()
	NewEphemeralStorageAndInstall(tc.G)

	user, err := kbtest.CreateAndSignupFakeUser("e", tc.G)
	require.NoError(t, err)

	// Confirm that the user has a userEK.
	uid := tc.G.Env.GetUID()
	uids := []keybase1.UID{uid}
	statements, err := fetchUserEKStatements(context.Background(), tc.G, uids)
	require.NoError(t, err)
	firstStatement, ok := statements[uid]
	require.True(t, ok)
	require.EqualValues(t, firstStatement.CurrentUserEkMetadata.Generation, 1, "should start at userEK gen 1")

	// Do a PUK roll.
	rollEngine := engine.NewPerUserKeyRoll(tc.G, &engine.PerUserKeyRollArgs{})
	ctx := &engine.Context{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: user.NewSecretUI(),
	}
	err = engine.RunEngine(rollEngine, ctx)
	require.NoError(t, err)

	// Finally, confirm that the roll above also rolled a new userEK.
	statements, err = fetchUserEKStatements(context.Background(), tc.G, uids)
	require.NoError(t, err)
	secondStatement, ok := statements[uid]
	require.True(t, ok)
	require.EqualValues(t, secondStatement.CurrentUserEkMetadata.Generation, 2, "after PUK roll, should have userEK gen 2")
	userEK, err := tc.G.GetUserEKBoxStorage().Get(context.Background(), 2)
	require.NoError(t, err)
	require.Equal(t, secondStatement.CurrentUserEkMetadata, userEK.Metadata)
}
