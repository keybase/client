package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	tc = libkb.SetupTest(tb, name, depth+1)
	tc.G.SetServices(externals.GetServices())
	NewTeamLoaderAndInstall(tc.G)
	return tc
}

func GetForTestByStringName(ctx context.Context, g *libkb.GlobalContext, name string) (*Team, error) {
	return Load(ctx, g, keybase1.LoadTeamArg{
		Name:        name,
		ForceRepoll: true,
	})
}

func createTeamName(t *testing.T, root string, parts ...string) keybase1.TeamName {
	name, err := keybase1.TeamNameFromString(root)
	require.NoError(t, err)
	require.True(t, name.IsRootTeam(), "team name must be root %v", root)
	for _, part := range parts {
		name, err = name.Append(part)
		require.NoError(t, err)
	}
	return name
}

// Create n TestContexts with logged in users
// Returns (FakeUsers, TestContexts, CleanupFunction)
func setupNTests(t *testing.T, n int) ([]*kbtest.FakeUser, []*libkb.TestContext, func()) {
	return setupNTestsWithPukless(t, n, 0)
}

// nPukless is how many users start out with no PUK.
// Those users appear at the end of the list
func setupNTestsWithPukless(t *testing.T, n, nPukless int) ([]*kbtest.FakeUser, []*libkb.TestContext, func()) {
	require.True(t, n > 0, "must create at least 1 tc")
	require.True(t, n >= nPukless, "more pukless users than total users requested")
	var fus []*kbtest.FakeUser
	var tcs []*libkb.TestContext
	for i := 0; i < n; i++ {
		tc := SetupTest(t, "team", 1)
		tcs = append(tcs, &tc)
		if i >= n-nPukless {
			tc.Tp.DisableUpgradePerUserKey = true
		}
		fu, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
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
