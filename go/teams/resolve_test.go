package teams

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestOurResolve(t *testing.T) {
	_, nm, g, cleanup := createUserAndRootTeam(t)
	defer cleanup()
	id := RootTeamIDFromName(nm)

	ctx := context.TODO()
	nm2, err := ResolveIDToName(ctx, g, id)
	require.NoError(t, err)
	require.True(t, nm.Eq(nm2))

	id2, err := ResolveNameToID(ctx, g, nm)
	require.NoError(t, err)
	require.True(t, id.Eq(id2))

	r2input := fmt.Sprintf("team:%s", nm.String())
	rres := g.Resolver.ResolveFullExpressionNeedUsername(ctx, r2input)
	require.NoError(t, rres.GetError())
	require.True(t, rres.GetTeamID().Exists())
	require.Equal(t, rres.UserOrTeam().Name, nm.String())
	require.Equal(t, rres.UserOrTeam().Id.String(), id2.String())
}

// Test that verifyResolveResult would catch an bad (unverifiable) resolution.
func TestVerifyResolveEvilServer(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	t.Logf("check good assertion")
	assertion, err := externals.AssertionParseAndOnly("t_tracy@rooter")
	require.NoError(t, err)
	err = verifyResolveResult(context.TODO(), tcs[0].G, libkb.ResolvedAssertion{
		Assertion: assertion,
		UID:       keybase1.UID("eb72f49f2dde6429e5d78003dae0c919"),
	})
	require.NoError(t, err)

	t.Logf("check bad assertion")
	assertion, err = externals.AssertionParseAndOnly("beluga@rooter")
	require.NoError(t, err)
	err = verifyResolveResult(context.TODO(), tcs[0].G, libkb.ResolvedAssertion{
		Assertion: assertion,
		UID:       keybase1.UID("eb72f49f2dde6429e5d78003dae0c919"),
	})
	require.Error(t, err)
	require.IsType(t, libkb.UnmetAssertionError{}, err)
	require.Regexp(t, `Unmet remote assertions`, err)
}
