package teams

import (
	"encoding/hex"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamGet(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	kbtest.CreateAndSignupFakeUser("team", tc.G)

	name := createTeam(tc)

	_, err := GetForTestByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
}

func TestTeamApplicationKey(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	kbtest.CreateAndSignupFakeUser("team", tc.G)

	name := createTeam(tc)

	team, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name: name,
	})
	if err != nil {
		t.Fatal(err)
	}

	chatKey, err := team.ChatKey(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if chatKey.Application != keybase1.TeamApplication_CHAT {
		t.Errorf("key application: %d, expected %d", chatKey.Application, keybase1.TeamApplication_CHAT)
	}
	if chatKey.Generation() != 1 {
		t.Errorf("key generation: %d, expected 1", chatKey.Generation())
	}
	if len(chatKey.Key) != 32 {
		t.Errorf("key length: %d, expected 32", len(chatKey.Key))
	}
}

func TestTeamGetRepeat(t *testing.T) {
	t.Skip("not needed")
	// in order to try to repro in CI, run this 10 times
	for i := 0; i < 10; i++ {
		tc := SetupTest(t, "team", 1)
		defer tc.Cleanup()

		kbtest.CreateAndSignupFakeUser("team", tc.G)

		name := createTeam(tc)

		_, err := GetForTestByStringName(context.TODO(), tc.G, name)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestTeamGetWhileCreate(t *testing.T) {
	t.Skip("this found create team bug")
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	kbtest.CreateAndSignupFakeUser("team", tc.G)

	name := createTeam(tc)

	for i := 0; i < 100; i++ {
		go createTeam(tc)
		time.Sleep(10 * time.Millisecond)
	}

	for i := 0; i < 100; i++ {
		_, err := GetForTestByStringName(context.TODO(), tc.G, name)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestTeamGetConcurrent(t *testing.T) {
	t.Skip("this is slow but it passes")
	work := make(chan bool)

	for i := 0; i < 10; i++ {
		go func() {
			for x := range work {
				_ = x
				teamGet(t)
			}
		}()
	}

	for j := 0; j < 100; j++ {
		work <- true
	}
}

// Test loading when you have become an admin after
// having already cached the team as a non-admin.
func TestGetMaybeAdminByStringName(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates a team")
	teamName, _ := createTeam2(*tcs[0])

	t.Logf("U0 creates a subteam")
	_, err := CreateSubteam(context.TODO(), tcs[0].G, "abc", teamName)
	require.NoError(t, err)

	t.Logf("U0 adds U1 as a reader")
	_, err = AddMember(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
	require.NoError(t, err)

	t.Logf("U1 loads and is a reader")
	team, err := Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		Name: teamName.String(),
	})
	require.NoError(t, err)
	role, err := team.MemberRole(context.TODO(), fus[1].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_READER, role, "still a reader")
	require.Equal(t, 0, len(team.chain().inner.SubteamLog), "doesn't know about any subteams")

	t.Logf("U0 makes U1 an admin")
	err = SetRoleAdmin(context.TODO(), tcs[0].G, teamName.String(), fus[1].Username)
	require.NoError(t, err)

	t.Logf("U1 loads from the cache, and doesn't realize they're an admin")
	team, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
		Name: teamName.String(),
	})
	require.NoError(t, err)
	role, err = team.MemberRole(context.TODO(), fus[1].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_READER, role, "cached as a reader")
	require.Equal(t, 0, len(team.chain().inner.SubteamLog), "still doesn't know about any subteams")

	t.Logf("U1 loads and realizes they're an admin")
	team, err = GetMaybeAdminByStringName(context.TODO(), tcs[1].G, teamName.String())
	require.NoError(t, err)
	role, err = team.MemberRole(context.TODO(), fus[1].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_ADMIN, role, "still an admin")
	require.Equal(t, 1, len(team.chain().inner.SubteamLog), "has loaded previously-stubbed admin links")
}

func teamGet(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	kbtest.CreateAndSignupFakeUser("team", tc.G)

	name := createTeam(tc)

	_, err := GetForTestByStringName(context.TODO(), tc.G, name)
	if err != nil {
		t.Fatal(err)
	}
}

func createTeam(tc libkb.TestContext) string {
	b, err := libkb.RandBytes(4)
	if err != nil {
		tc.T.Fatal(err)
	}
	name := hex.EncodeToString(b)
	err = CreateRootTeam(context.TODO(), tc.G, name)
	if err != nil {
		tc.T.Fatal(err)
	}
	return name
}

func createTeam2(tc libkb.TestContext) (keybase1.TeamName, keybase1.TeamID) {
	teamNameS := createTeam(tc)
	teamName, err := keybase1.TeamNameFromString(teamNameS)
	require.NoError(tc.T, err)
	return teamName, teamName.ToTeamID()
}
