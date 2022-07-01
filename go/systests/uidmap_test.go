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

func TestServiceMapRevokedProofs(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("alice")
	bob := tt.addUser("bob")

	getPkgs := func() map[keybase1.UID]libkb.UserServiceSummaryPackage {
		return bob.tc.G.ServiceMapper.MapUIDsToServiceSummaries(
			context.Background(),
			bob.tc.G,
			[]keybase1.UID{alice.uid},
			time.Duration(0),             // never stale
			uidmap.DisallowNetworkBudget, // no network calls
		)
	}

	// We got nothing on first try because we've never loaded the user and we
	// disallow network in MapUIDsToServiceSummaries.
	pkgs := getPkgs()
	require.Len(t, pkgs, 0)

	loadUser := func() {
		arg := libkb.NewLoadUserArg(bob.tc.G).WithName(alice.username)
		user, err := libkb.LoadUser(arg)
		require.NoError(t, err)
		require.Equal(t, alice.uid, user.GetUID())
	}

	// Try again, after loading user.
	loadUser()
	pkgs = getPkgs()
	require.Contains(t, pkgs, alice.uid)
	require.Len(t, pkgs[alice.uid].ServiceMap, 0) // no proofs yet

	// Alice proves
	alice.proveRooter()
	alice.proveGubbleSocial()

	// Reload user and try again
	loadUser()
	pkgs = getPkgs()
	require.Contains(t, pkgs, alice.uid)
	alicePkg := pkgs[alice.uid]
	require.Len(t, alicePkg.ServiceMap, 2)
	require.Equal(t, alice.username, alicePkg.ServiceMap["gubble.social"])
	require.Equal(t, alice.username, alicePkg.ServiceMap["rooter"])

	// Alice revokes
	alice.revokeServiceProof("rooter")

	loadUser()
	pkgs = getPkgs()
	require.Contains(t, pkgs, alice.uid)
	alicePkg = pkgs[alice.uid]
	require.Len(t, alicePkg.ServiceMap, 1)
	require.Equal(t, alice.username, alicePkg.ServiceMap["gubble.social"])
	require.NotContains(t, alicePkg.ServiceMap, "rooter")
}
