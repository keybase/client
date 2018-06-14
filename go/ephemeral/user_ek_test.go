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

func publishAndVerifyUserEK(t *testing.T, tc libkb.TestContext, merkleRoot libkb.MerkleRoot, uid keybase1.UID, existingMetadata []keybase1.UserEkMetadata) keybase1.EkGeneration {

	uids := []keybase1.UID{uid}
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
	require.Equal(t, existingMetadata, statement.ExistingUserEkMetadata)

	// We've stored the result in local storage
	userEKBoxStorage := tc.G.GetUserEKBoxStorage()
	maxGeneration, err := userEKBoxStorage.MaxGeneration(context.Background())
	require.NoError(t, err)
	ek, err := userEKBoxStorage.Get(context.Background(), maxGeneration)
	require.NoError(t, err)
	require.Equal(t, ek.Metadata, publishedMetadata)
	return maxGeneration
}

func getExistingMetadata(t *testing.T, tc libkb.TestContext, uid keybase1.UID) []keybase1.UserEkMetadata {
	uids := []keybase1.UID{uid}
	prevStatements, err := fetchUserEKStatements(context.Background(), tc.G, uids)
	require.NoError(t, err)
	prevStatement, ok := prevStatements[uid]
	require.True(t, ok)
	existingMetadata := prevStatement.ExistingUserEkMetadata
	return append(existingMetadata, prevStatement.CurrentUserEkMetadata)
}

func TestNewUserEK(t *testing.T) {
	tc, user := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	m := libkb.NewMetaContextForTest(tc)
	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(m, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	uid := tc.G.Env.GetUID()
	existingMetadata := getExistingMetadata(t, tc, uid)
	maxGeneration := publishAndVerifyUserEK(t, tc, merkleRoot, uid, existingMetadata)

	rawStorage := NewUserEKBoxStorage(tc.G)
	// Put our storage in a bad state by deleting the maxGeneration
	err = rawStorage.Delete(context.Background(), maxGeneration)
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata2, err := publishNewUserEK(context.Background(), tc.G, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, maxGeneration+1, publishedMetadata2.Generation)

	// Reset the user and verify we can generate a new userEK correctly
	kbtest.ResetAccount(tc, user)
	err = user.Login(tc.G)
	require.NoError(t, err)

	existingMetadata2 := getExistingMetadata(t, tc, uid)
	publishAndVerifyUserEK(t, tc, merkleRoot, uid, existingMetadata2)
}

// TODO: test cases chat verify we can detect invalid signatures and bad metadata

// Test revoking a device/rolling the PUK both skipping and not skipping the
// userEkGeneration during the revoke to simulate revoking a device without
// userEK support.
func TestDeviceRevokeNewUserEK(t *testing.T) {
	testDeviceRevoke(t, false /* skipUserEKForTesting */)
}

func TestDeviceRevokeNoNewUserEK(t *testing.T) {
	testDeviceRevoke(t, true /* skipUserEKForTesting */)
}

func testDeviceRevoke(t *testing.T, skipUserEKForTesting bool) {
	tc := libkb.SetupTest(t, "testDeviceRevoke", 2)
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
	statement, ok := statements[uid]
	require.True(t, ok)
	require.EqualValues(t, statement.CurrentUserEkMetadata.Generation, 1, "should start at userEK gen 1")

	// Load the full user so that we can grab their devices.
	arg := libkb.NewLoadUserByNameArg(tc.G, user.Username)
	fullUser, err := libkb.LoadUser(arg)
	if err != nil {
		tc.T.Fatal(err)
	}
	paperKey := fullUser.GetComputedKeyInfos().PaperDevices()[0]

	// Revoke the paper key.
	revokeEngine := engine.NewRevokeDeviceEngine(tc.G, engine.RevokeDeviceEngineArgs{
		ID:                   paperKey.ID,
		SkipUserEKForTesting: skipUserEKForTesting,
	})
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: user.NewSecretUI(),
	}
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, revokeEngine)
	require.NoError(t, err)

	// Finally, confirm that the revocation above rolled a new userEK.
	if !skipUserEKForTesting {
		statements, err = fetchUserEKStatements(context.Background(), tc.G, uids)
		require.NoError(t, err)
		statement, ok = statements[uid]
		require.True(t, ok)
		require.EqualValues(t, statement.CurrentUserEkMetadata.Generation, 2, "after revoke, should have userEK gen 2")
		userEK, err := tc.G.GetUserEKBoxStorage().Get(context.Background(), 2)
		require.NoError(t, err)
		require.Equal(t, statement.CurrentUserEkMetadata, userEK.Metadata)
	}

	// Confirm that we can make a new userEK after rolling the PUK
	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(m, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr
	var existingMetadata []keybase1.UserEkMetadata
	ekLib := NewEKLib(tc.G)
	needed, err := ekLib.NewUserEKNeeded(context.Background())
	require.NoError(t, err)
	if skipUserEKForTesting {
		require.True(t, needed)
		existingMetadata = []keybase1.UserEkMetadata{}
	} else {
		require.False(t, needed)
		existingMetadata = statement.ExistingUserEkMetadata
		existingMetadata = append(existingMetadata, statement.CurrentUserEkMetadata)
	}
	publishAndVerifyUserEK(t, tc, merkleRoot, uid, existingMetadata)
}

func TestPukRollNewUserEK(t *testing.T) {
	tc, user := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

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
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: user.NewSecretUI(),
	}
	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	err = engine.RunEngine2(m, rollEngine)
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

	// Confirm that we can make a new userEK after rolling the PUK
	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(m, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr
	existingMetadata := secondStatement.ExistingUserEkMetadata
	existingMetadata = append(existingMetadata, secondStatement.CurrentUserEkMetadata)
	publishAndVerifyUserEK(t, tc, merkleRoot, uid, existingMetadata)
}
