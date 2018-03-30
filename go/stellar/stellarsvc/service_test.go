package stellarsvc

import (
	"context"
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/remote"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
	"github.com/stretchr/testify/require"
)

func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	tc = externalstest.SetupTest(tb, name, depth+1)
	// use an insecure triplesec in tests
	tc.G.NewTriplesec = func(passphrase []byte, salt []byte) (libkb.Triplesec, error) {
		warner := func() { tc.G.Log.Warning("Installing insecure Triplesec with weak stretch parameters") }
		isProduction := func() bool {
			return tc.G.Env.GetRunMode() == libkb.ProductionRunMode
		}
		return insecureTriplesec.NewCipher(passphrase, salt, warner, isProduction)
	}
	return tc
}

func TestCreateWallet(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	created, err := CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.True(t, created)

	created, err = CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.False(t, created)

	t.Logf("Fetch the bundle")
	bundle, _, err := remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.Equal(t, stellar1.BundleRevision(1), bundle.Revision)
	require.Nil(t, bundle.Prev)
	require.NotNil(t, bundle.OwnHash)
	require.Len(t, bundle.Accounts, 1)
	require.True(t, len(bundle.Accounts[0].AccountID) > 0)
	require.Equal(t, stellar1.AccountMode_USER, bundle.Accounts[0].Mode)
	require.True(t, bundle.Accounts[0].IsPrimary)
	require.Len(t, bundle.Accounts[0].Signers, 1)
	require.Equal(t, "", bundle.Accounts[0].Name)

	t.Logf("Lookup the public stellar address as another user")
	u0, err := tcs[1].G.LoadUserByUID(tcs[0].G.ActiveDevice.UID())
	require.NoError(t, err)
	addr := u0.StellarWalletAddress()
	require.NoError(t, err)
	t.Logf("Found account: %v", addr)
	_, err = libkb.MakeNaclSigningKeyPairFromStellarAccountID(*addr)
	require.NoError(t, err, "stellar key should be nacl pubable")
	require.Equal(t, bundle.Accounts[0].AccountID.String(), addr.String(), "addr looked up should match secret bundle")
}

func TestUpkeep(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	created, err := CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.True(t, created)

	bundle, pukGen, err := remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)
	originalID := bundle.OwnHash
	originalPukGen := pukGen

	err = stellar.Upkeep(context.Background(), tcs[0].G)
	require.NoError(t, err)

	bundle, pukGen, err = remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.Equal(t, bundle.OwnHash, originalID, "bundle should be unchanged by no-op upkeep")
	require.Equal(t, originalPukGen, pukGen)

	t.Logf("rotate puk")
	engCtx := &engine.Context{NetContext: context.Background()}
	engArg := &engine.PerUserKeyRollArgs{}
	eng := engine.NewPerUserKeyRoll(tcs[0].G, engArg)
	err = engine.RunEngine(eng, engCtx)
	require.NoError(t, err)
	require.True(t, eng.DidNewKey)

	err = stellar.Upkeep(context.Background(), tcs[0].G)
	require.NoError(t, err)

	bundle, pukGen, err = remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.NotEqual(t, bundle.OwnHash, originalID, "bundle should be new")
	require.NotEqual(t, originalPukGen, pukGen, "bundle should be for new puk")
	require.Equal(t, 2, int(bundle.Revision))
}

// Create n TestContexts with logged in users
// Returns (FakeUsers, TestContexts, CleanupFunction)
func setupNTests(t *testing.T, n int) ([]*kbtest.FakeUser, []*libkb.TestContext, func()) {
	return setupNTestsWithPukless(t, n, 0)
}

func setupNTestsWithPukless(t *testing.T, n, nPukless int) ([]*kbtest.FakeUser, []*libkb.TestContext, func()) {
	require.True(t, n > 0, "must create at least 1 tc")
	require.True(t, n >= nPukless, "more pukless users than total users requested")
	var fus []*kbtest.FakeUser
	var tcs []*libkb.TestContext
	for i := 0; i < n; i++ {
		tc := SetupTest(t, "wall", 1)
		tcs = append(tcs, &tc)
		if i >= n-nPukless {
			tc.Tp.DisableUpgradePerUserKey = true
		}
		fu, err := kbtest.CreateAndSignupFakeUser("wall", tc.G)
		require.NoError(t, err)
		fus = append(fus, fu)
	}
	cleanup := func() {
		for _, tc := range tcs {
			tc.Cleanup()
		}
	}
	for i, fu := range fus {
		t.Logf("U%d: %v %v", i, fu.Username, fu.GetUserVersion())
	}
	return fus, tcs, cleanup
}
