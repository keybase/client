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

// Test TeamGet on a team that you implicitly admin but
// are not an explicit member of.
func TestTeamDetailsAsImplicitAdmin(t *testing.T) {
	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	t.Logf("creates a team")
	teamName, _ := createTeam2(*tcs[0])

	t.Logf("creates a subteam")
	_, err := CreateSubteam(context.Background(), tcs[0].G, "bbb", teamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	t.Logf("loads the subteam")
	team, err := Details(context.Background(), tcs[0].G, teamName.String()+".bbb")
	require.NoError(t, err)
	require.Len(t, team.Members.Owners, 0, "should be no team members in subteam")
	require.Len(t, team.Members.Admins, 0, "should be no team members in subteam")
	require.Len(t, team.Members.Writers, 0, "should be no team members in subteam")
	require.Len(t, team.Members.Readers, 0, "should be no team members in subteam")
}

// Test loading when you have become an admin after
// having already cached the team as a non-admin.
func TestGetMaybeAdminByStringName(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	t.Logf("U0 creates a team")
	teamName, _ := createTeam2(*tcs[0])

	t.Logf("U0 creates a subteam")
	_, err := CreateSubteam(context.TODO(), tcs[0].G, "abc", teamName, keybase1.TeamRole_NONE /* addSelfAs */)
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
	team, err = GetMaybeAdminByStringName(context.TODO(), tcs[1].G, teamName.String(), false /*isPublic*/)
	require.NoError(t, err)
	role, err = team.MemberRole(context.TODO(), fus[1].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_ADMIN, role, "still an admin")
	require.Equal(t, 1, len(team.chain().inner.SubteamLog), "has loaded previously-stubbed admin links")
}

func TestGetTeamIDByName(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	teamName, teamID := createTeam2(*tcs[0])
	subteamName, subteamID := createSubteam(tcs[0], teamName, "hello")

	// Test as owner of team and subteam
	mctx := libkb.NewMetaContextForTest(*tcs[0])
	res, err := GetTeamIDByNameRPC(mctx, teamName.String())
	require.NoError(t, err)
	require.Equal(t, teamID, res)

	res, err = GetTeamIDByNameRPC(mctx, subteamName.String())
	require.NoError(t, err)
	require.Equal(t, subteamID, res)

	// Test as unrelated user
	mctx = libkb.NewMetaContextForTest(*tcs[1])
	res, err = GetTeamIDByNameRPC(mctx, teamName.String())
	require.Error(t, err)

	res, err = GetTeamIDByNameRPC(mctx, subteamName.String())
	require.Error(t, err)

	// Add user 1 as a reader to root team
	_, err = AddMember(context.Background(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_READER)
	require.NoError(t, err)

	res, err = GetTeamIDByNameRPC(mctx, teamName.String())
	require.NoError(t, err)
	require.Equal(t, teamID, res)

	// Try to get subteam id, should still fail.
	res, err = GetTeamIDByNameRPC(mctx, subteamName.String())
	require.Error(t, err)
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
	require.NoError(tc.T, err)

	name := hex.EncodeToString(b)
	_, err = CreateRootTeam(context.TODO(), tc.G, name, keybase1.TeamSettings{})
	require.NoError(tc.T, err)

	return name
}

func createTeam2(tc libkb.TestContext) (keybase1.TeamName, keybase1.TeamID) {
	teamNameS := createTeam(tc)
	teamName, err := keybase1.TeamNameFromString(teamNameS)
	require.NoError(tc.T, err)
	id := teamName.ToPrivateTeamID()
	tc.T.Logf("created team %s: %s", id, teamName)
	return teamName, id
}

func createSubteam(tc *libkb.TestContext, parent keybase1.TeamName, subteamNamePart string) (keybase1.TeamName, keybase1.TeamID) {
	subteamName, err := parent.Append(subteamNamePart)
	require.NoError(tc.T, err)
	subteamID, err := CreateSubteam(context.TODO(), tc.G, subteamNamePart, parent, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(tc.T, err)
	return subteamName, *subteamID
}
