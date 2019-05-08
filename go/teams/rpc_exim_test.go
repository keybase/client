package teams

import (
	"strings"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamPlusApplicationKeysExim(t *testing.T) {
	tc := SetupTest(t, "TestTeamPlusApplicationKeysExim", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	if err != nil {
		t.Fatal(err)
	}

	name := createTeam(tc)
	team, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name: name,
	})
	if err != nil {
		t.Fatal(err)
	}

	exported, err := team.ExportToTeamPlusApplicationKeys(context.TODO(), keybase1.Time(0),
		keybase1.TeamApplication_KBFS, true)
	if err != nil {
		t.Fatalf("Error during export: %s", err)
	}
	if exported.Name != team.Name().String() {
		t.Fatalf("Got name %s, expected %s", exported.Name, team.Name())
	}
	if !exported.Id.Eq(team.ID) {
		t.Fatalf("Got id %q, expected %q", exported.Id, team.ID)
	}
	expectedKeys, err := team.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_KBFS)
	if err != nil {
		t.Fatal(err)
	}
	if len(exported.ApplicationKeys) != len(expectedKeys) {
		t.Fatalf("Got %v applicationKeys, expected %v", len(exported.ApplicationKeys), len(expectedKeys))
	}
}

func TestImplicitTeamLTPAK(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	u0, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)
	u1, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)
	displayName := strings.Join([]string{u1.Username, u2.Username}, ",")

	for _, public := range []bool{true, false} {
		createdTeam, _, impTeamName, err := LookupOrCreateImplicitTeam(context.Background(), tc.G, displayName, public)
		require.NoError(t, err)
		require.Equal(t, public, impTeamName.IsPublic)

		t.Logf("Created team public: %t, %s %s", public, createdTeam.ID, impTeamName)

		for _, u := range []*kbtest.FakeUser{u1, u2, u0, nil} {
			require.NoError(t, tc.G.Logout(context.TODO()))
			if u != nil {
				require.NoError(t, u.Login(tc.G))
				t.Logf("Testing as user %s", u.Username)
			} else {
				t.Logf("Testing as unlogged user")
			}

			ret, err := LoadTeamPlusApplicationKeys(context.Background(), tc.G, createdTeam.ID,
				keybase1.TeamApplication_KBFS, keybase1.TeamRefreshers{}, true)
			if !public && (u == nil || u == u0) {
				require.Error(t, err)
				continue
			}

			require.NoError(t, err)
			require.True(t, ret.Implicit)
			require.Equal(t, public, ret.Public)
			require.Equal(t, createdTeam.ID, ret.Id)

			if u == nil || u == u0 {
				require.Empty(t, ret.ApplicationKeys)
			} else {
				require.NotEmpty(t, ret.ApplicationKeys)
			}
		}

		require.NoError(t, tc.G.Logout(context.TODO()))
		require.NoError(t, u2.Login(tc.G))
	}
}
