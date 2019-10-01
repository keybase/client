package ephemeral

import (
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func publishAndVerifyUserEK(mctx libkb.MetaContext, t *testing.T,
	merkleRoot libkb.MerkleRoot, uid keybase1.UID) keybase1.EkGeneration {

	publishedMetadata, err := publishNewUserEK(mctx, merkleRoot)
	require.NoError(t, err)

	s := mctx.G().GetUserEKBoxStorage()
	userEK, err := s.Get(mctx, publishedMetadata.Generation, nil)
	require.NoError(t, err)
	require.Equal(t, userEK.Metadata, publishedMetadata)

	uids := []keybase1.UID{uid}
	statements, err := fetchUserEKStatements(mctx, uids)
	require.NoError(t, err)
	statement, ok := statements[uid]
	require.True(t, ok)
	require.NotNil(t, statement)
	currentMetadata := statement.CurrentUserEkMetadata
	require.Equal(t, currentMetadata, publishedMetadata)

	// We've stored the result in local storage
	userEKBoxStorage := mctx.G().GetUserEKBoxStorage()
	maxGeneration, err := userEKBoxStorage.MaxGeneration(mctx, false)
	require.NoError(t, err)
	ek, err := userEKBoxStorage.Get(mctx, maxGeneration, nil)
	require.NoError(t, err)
	require.Equal(t, ek.Metadata, publishedMetadata)
	return maxGeneration
}

func TestNewUserEK(t *testing.T) {
	tc, mctx, user := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr

	uid := tc.G.Env.GetUID()
	maxGeneration := publishAndVerifyUserEK(mctx, t, merkleRoot, uid)

	rawStorage := NewUserEKBoxStorage()
	// Put our storage in a bad state by deleting the maxGeneration
	err = rawStorage.Delete(mctx, maxGeneration)
	require.NoError(t, err)

	// If we publish in a bad local state, we can successfully get the
	// maxGeneration from the server and continue
	publishedMetadata2, err := publishNewUserEK(mctx, merkleRoot)
	require.NoError(t, err)
	require.EqualValues(t, maxGeneration+1, publishedMetadata2.Generation)

	// Reset the user and verify we can generate a new userEK correctly
	kbtest.ResetAccount(tc, user)
	err = user.Login(tc.G)
	require.NoError(t, err)
	// create a new device ek
	err = mctx.G().GetEKLib().KeygenIfNeeded(mctx)
	require.NoError(t, err)

	publishAndVerifyUserEK(mctx, t, merkleRoot, uid)
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
	mctx := libkb.NewMetaContextForTest(tc)
	NewEphemeralStorageAndInstall(mctx)

	// Include a paper key with this test user, so that we have something to
	// revoke.
	user, err := kbtest.CreateAndSignupFakeUserPaper("e", tc.G)
	require.NoError(t, err)
	err = mctx.G().GetEKLib().KeygenIfNeeded(mctx)
	require.NoError(t, err)

	// Confirm that the user has a userEK.
	uid := tc.G.Env.GetUID()
	uids := []keybase1.UID{uid}
	statements, err := fetchUserEKStatements(mctx, uids)
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
	mctx = mctx.WithUIs(uis)
	err = engine.RunEngine2(mctx, revokeEngine)
	require.NoError(t, err)

	// Finally, confirm that the revocation above rolled a new userEK.
	if !skipUserEKForTesting {
		statements, err = fetchUserEKStatements(mctx, uids)
		require.NoError(t, err)
		statement, ok = statements[uid]
		require.True(t, ok)
		require.EqualValues(t, statement.CurrentUserEkMetadata.Generation, 2, "after revoke, should have userEK gen 2")
		userEK, err := tc.G.GetUserEKBoxStorage().Get(mctx, 2, nil)
		require.NoError(t, err)
		require.Equal(t, statement.CurrentUserEkMetadata, userEK.Metadata)
	}

	// Confirm that we can make a new userEK after rolling the PUK
	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr
	lib := tc.G.GetEKLib()
	ekLib, ok := lib.(*EKLib)
	require.True(t, ok)
	// disable background keygen
	err = ekLib.Shutdown(mctx)
	require.NoError(t, err)
	needed, err := ekLib.NewUserEKNeeded(mctx)
	require.NoError(t, err)
	require.Equal(t, skipUserEKForTesting, needed)
	publishAndVerifyUserEK(mctx, t, merkleRoot, uid)
}

func TestPukRollNewUserEK(t *testing.T) {
	tc, mctx, user := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	// Confirm that the user has a userEK.
	uid := tc.G.Env.GetUID()
	uids := []keybase1.UID{uid}
	statements, err := fetchUserEKStatements(mctx, uids)
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
	mctx = mctx.WithUIs(uis)
	err = engine.RunEngine2(mctx, rollEngine)
	require.NoError(t, err)

	// Finally, confirm that the roll above also rolled a new userEK.
	statements, err = fetchUserEKStatements(mctx, uids)
	require.NoError(t, err)
	secondStatement, ok := statements[uid]
	require.True(t, ok)
	require.EqualValues(t, secondStatement.CurrentUserEkMetadata.Generation, 2, "after PUK roll, should have userEK gen 2")
	userEK, err := tc.G.GetUserEKBoxStorage().Get(mctx, 2, nil)
	require.NoError(t, err)
	require.Equal(t, secondStatement.CurrentUserEkMetadata, userEK.Metadata)

	// Confirm that we can make a new userEK after rolling the PUK
	merkleRootPtr, err := tc.G.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr
	publishAndVerifyUserEK(mctx, t, merkleRoot, uid)
}

func TestDeprovision(t *testing.T) {
	tc, mctx, user := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	// Confirm that the user has a userEK.
	uid := tc.G.Env.GetUID()
	uids := []keybase1.UID{uid}
	statements, err := fetchUserEKStatements(mctx, uids)
	require.NoError(t, err)
	firstStatement, ok := statements[uid]
	require.True(t, ok)
	require.EqualValues(t, firstStatement.CurrentUserEkMetadata.Generation, 1, "should start at userEK gen 1")

	// make a paper key to log back in with
	uis := libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		LoginUI:  &libkb.TestLoginUI{},
		SecretUI: &libkb.TestSecretUI{},
	}
	eng := engine.NewPaperKey(tc.G)
	mctx = mctx.WithUIs(uis)
	err = engine.RunEngine2(mctx, eng)
	require.NoError(t, err)
	require.NotEqual(t, 0, len(eng.Passphrase()), "empty passphrase")

	// self provision to have a device to create the userEK for
	provLoginUI := &libkb.TestLoginUI{Username: user.Username}
	uis = libkb.UIs{
		ProvisionUI: &kbtest.TestProvisionUI{},
		LogUI:       tc.G.Log,
		SecretUI:    user.NewSecretUI(),
		LoginUI:     provLoginUI,
	}
	mctx = mctx.WithUIs(uis)
	libkb.CreateClonedDevice(tc, mctx)
	newName := "uncloneme"
	eng1 := engine.NewSelfProvisionEngine(tc.G, newName)
	err = engine.RunEngine2(mctx, eng1)
	require.NoError(t, err)
	require.Equal(t, mctx.ActiveDevice().Name(), newName)

	eng2 := engine.NewDeprovisionEngine(tc.G, user.Username, true /* doRevoke */, libkb.LogoutOptions{})
	uis = libkb.UIs{
		LogUI:    tc.G.UI.GetLogUI(),
		SecretUI: user.NewSecretUI(),
	}
	mctx = mctx.WithUIs(uis)
	err = engine.RunEngine2(mctx, eng2)
	require.NoError(t, err)

	// log back in
	secretUI := user.NewSecretUI()
	secretUI.Passphrase = eng.Passphrase()
	provisionUI := &kbtest.TestProvisionUI{}
	provisionUI.DeviceType = "backup"
	uis = libkb.UIs{
		ProvisionUI: provisionUI,
		LogUI:       tc.G.UI.GetLogUI(),
		GPGUI:       &kbtest.GPGTestUI{},
		SecretUI:    secretUI,
		LoginUI:     &libkb.TestLoginUI{Username: user.Username},
	}
	eng3 := engine.NewLogin(tc.G, libkb.DeviceTypeDesktop, user.Username, keybase1.ClientType_CLI)
	mctx = mctx.WithUIs(uis)
	err = engine.RunEngine2(mctx, eng3)
	require.NoError(t, err)

	// Finally, confirm that the deprovision above also created a new userEK.
	statements, err = fetchUserEKStatements(mctx, uids)
	require.NoError(t, err)
	secondStatement, ok := statements[uid]
	require.True(t, ok)
	require.EqualValues(t, secondStatement.CurrentUserEkMetadata.Generation, 2, "after PUK roll, should have userEK gen 2")
}
