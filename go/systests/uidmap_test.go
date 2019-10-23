package systests

import (
	"testing"
	"time"

	"github.com/keybase/client/go/uidmap"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

func TestLoadingUserCachesServiceMap(t *testing.T) {
	const tTracy = keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")

	tc := setupTest(t, "smap")
	defer tc.Cleanup()

	getPkgs := func() map[keybase1.UID]libkb.UserServiceSummaryPackage {
		return tc.G.ServiceMapper.MapUIDsToServiceSummaries(
			context.Background(),
			tc.G,
			[]keybase1.UID{tTracy},
			time.Duration(0),             // never stale
			uidmap.DisallowNetworkBudget, // no network calls
		)
	}

	pkgs := getPkgs()
	require.Len(t, pkgs, 0)

	arg := libkb.NewLoadUserArg(tc.G).WithName("t_tracy")
	user, err := libkb.LoadUser(arg)
	require.NoError(t, err)
	require.Equal(t, tTracy, user.GetUID())

	pkgs = getPkgs()
	require.Contains(t, pkgs, tTracy)

	// Exact maps depend on remote_identities on the test server.
	tracyPkg := pkgs[tTracy]
	require.Equal(t, "tacoplusplus", tracyPkg.ServiceMap["github"])
	require.Equal(t, "t_tracy", tracyPkg.ServiceMap["rooter"])
	require.Equal(t, "tacovontaco", tracyPkg.ServiceMap["twitter"])
}
