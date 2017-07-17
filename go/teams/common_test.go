package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	ret := libkb.SetupTest(tb, name, depth+1)
	NewTeamLoaderAndInstall(ret.G)
	return ret
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
