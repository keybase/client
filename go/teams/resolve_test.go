package teams

import (
	"context"
	"fmt"
	"github.com/stretchr/testify/require"
	"testing"
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
