package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestIdentifyLite(t *testing.T) {
	tc, _, name := memberSetup(t)
	defer tc.Cleanup()

	team, err := GetForTestByStringName(context.Background(), tc.G, name)
	require.NoError(t, err)

	// test identify by assertion only
	assertions := []string{"team:" + name, "tid:" + team.ID.String()}
	for _, assertion := range assertions {
		au, err := libkb.ParseAssertionURL(tc.G.MakeAssertionContext(libkb.NewMetaContext(context.Background(), tc.G)), assertion, true)
		require.NoError(t, err)
		res, err := IdentifyLite(context.Background(), tc.G, keybase1.IdentifyLiteArg{Assertion: assertion}, au)
		require.NoError(t, err)
		require.Equal(t, name, res.Ul.Name, "assertion: %s, id lite name: %s, expected %s", assertion, res.Ul.Name, name)

		require.Equal(t, team.ID.String(), res.Ul.Id.String(), "assertion: %s, id lite id: %s, expected %s", assertion, res.Ul.Id, team.ID)
	}

	// test identify by id and assertions
	for _, assertion := range assertions {
		au, err := libkb.ParseAssertionURL(tc.G.MakeAssertionContext(libkb.NewMetaContext(context.Background(), tc.G)), assertion, true)
		require.NoError(t, err)
		res, err := IdentifyLite(context.Background(), tc.G, keybase1.IdentifyLiteArg{Id: team.ID.AsUserOrTeam(), Assertion: assertion}, au)
		require.NoError(t, err)
		require.Equal(t, name, res.Ul.Name, "assertion: %s, id lite name: %s, expected %s", assertion, res.Ul.Name, name)

		require.Equal(t, team.ID.String(), res.Ul.Id.String(), "assertion: %s, id lite id: %s, expected %s", assertion, res.Ul.Id, team.ID)
	}

	// test identify by id only
	var empty libkb.AssertionKeybase
	res, err := IdentifyLite(context.Background(), tc.G, keybase1.IdentifyLiteArg{Id: team.ID.AsUserOrTeam()}, empty)
	require.NoError(t, err)
	require.Equal(t, name, res.Ul.Name, "id lite name: %s, expected %s", res.Ul.Name, name)

	require.Equal(t, team.ID.String(), res.Ul.Id.String(), "id lite id: %s, expected %s", res.Ul.Id, team.ID)
}
