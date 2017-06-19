package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// Create n TestContexts with logged in users
func setupNTests(t *testing.T, n int) ([]*kbtest.FakeUser, []*libkb.TestContext) {
	require.True(t, n > 0, "must create at least 1 tc")
	var fus []*kbtest.FakeUser
	var tcs []*libkb.TestContext
	for i := 0; i < n; i++ {
		tc := SetupTest(t, "team", 1)
		tcs = append(tcs, &tc)
		fu, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
		require.NoError(t, err)
		fus = append(fus, fu)
	}
	return fus, tcs
}

func TestLoaderDoesntCrash(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	require.NotNil(t, tc.G.GetTeamLoader(), "team loader on G")
	_, err = tc.G.GetTeamLoader().Load(context.TODO(), keybase1.LoadTeamArg{
		ID: "abcdef",
	})
	require.Error(t, err, "load not implemented")
	require.Equal(t, "TODO: implement team loader", err.Error())
}
