package service

import (
	"context"
	"testing"

	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	insecureTriplesec "github.com/keybase/go-triplesec-insecure"
	"github.com/test-go/testify/require"
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
	tc := SetupTest(t, "wallet", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("wall", tc.G)
	require.NoError(t, err)

	created, err := CreateWallet(context.Background(), tc.G)
	require.NoError(t, err)
	require.True(t, created)

	created, err = CreateWallet(context.Background(), tc.G)
	require.NoError(t, err)
	require.False(t, created)
}
