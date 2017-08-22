package teams

import (
	"fmt"
	"strings"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestLookupImplicitTeams(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	numKBUsers := 3
	var users []*kbtest.FakeUser
	var usernames []string
	for i := 0; i < numKBUsers; i++ {
		u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
		require.NoError(t, err)
		users = append(users, u)
		usernames = append(usernames, u.Username)
	}

	tc.G.SetServices(externals.GetServices())
	lookupAndCreate := func(displayName string, public bool) {
		_, _, err := LookupImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.Error(t, err)
		require.IsType(t, TeamDoesNotExistError{}, err)

		createdTeamID, impTeamName, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.NoError(t, err)
		require.Equal(t, public, !impTeamName.IsPrivate)

		// second time, LookupOrCreate should Lookup the team just created.
		createdTeamID2, impTeamName2, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.NoError(t, err)
		require.Equal(t, createdTeamID, createdTeamID2)
		require.Equal(t, impTeamName, impTeamName2, "public: %v", public)

		lookupTeamID, impTeamName, err := LookupImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.NoError(t, err)
		require.Equal(t, createdTeamID, lookupTeamID)

		team, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
			ID: createdTeamID,
		})
		require.NoError(t, err)
		teamDisplay, err := team.ImplicitTeamDisplayName(context.TODO())
		require.NoError(t, err)
		formatName, err := FormatImplicitTeamName(context.TODO(), tc.G, impTeamName)
		require.NoError(t, err)
		require.Equal(t, teamDisplay, formatName)
	}

	displayName := strings.Join(usernames, ",")
	t.Logf("displayName: %s", displayName)
	lookupAndCreate(displayName, false)
	lookupAndCreate(displayName, true)
	displayName = fmt.Sprintf("mike@twitter,%s,james@github", displayName)
	t.Logf("displayName: %s", displayName)
	lookupAndCreate(displayName, false)
	lookupAndCreate(displayName, true)

	_, _, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, "dksjdskjs/sxs?", false)
	require.Error(t, err)
	_, _, err = LookupOrCreateImplicitTeam(context.TODO(), tc.G, "dksjdskjs/sxs?", true)
	require.Error(t, err)
}
