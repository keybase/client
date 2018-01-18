package systests

import (
	"testing"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func findMember(user *smuUser, members []keybase1.TeamMemberDetails) *keybase1.TeamMemberDetails {
	for _, member := range members {
		if member.Username == user.username {
			return &member
		}
	}
	return nil
}

func TestTeamList(t *testing.T) {
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	// Step 1 - create the initial team with mix of normal members,
	// reset members, pukless users, social invites etc.

	ann := ctx.installKeybaseForUser("ann", 10)
	ann.signup()
	t.Logf("Signed up ann (%s)", ann.username)

	bob := ctx.installKeybaseForUser("bob", 10)
	bob.signup()
	t.Logf("Signed up bob (%s)", bob.username)

	pam := ctx.installKeybaseForUser("pam", 10)
	pam.signup()
	t.Logf("Signed up pam (%s)", pam.username)

	john := ctx.installKeybaseForUser("john", 10)
	john.signupNoPUK()
	t.Logf("Signed up PUK-less user john (%s)", john.username)

	ed := ctx.installKeybaseForUser("ed", 10)
	ed.signup()
	ed.reset()
	ed.loginAfterResetNoPUK(10)
	t.Logf("Signed up ed (%s), reset, and reprovisioned without PUK", ed.username)

	team := ann.createTeam([]*smuUser{bob, pam})
	t.Logf("Team created (%s)", team.name)

	pam.reset()
	t.Logf("Pam resets (%s)", pam.username)

	ann.addWriter(team, john)
	t.Logf("Adding john (%s)", john.username)

	ann.addWriter(team, ed)
	t.Logf("Adding ed (%s)", ed.username)

	teamCli := ann.getTeamsClient()

	rootername := randomUser("arbitrary").username
	_, err := teamCli.TeamAddMember(context.TODO(), keybase1.TeamAddMemberArg{
		Name:     team.name,
		Username: rootername + "@rooter",
		Role:     keybase1.TeamRole_WRITER,
	})
	require.NoError(t, err)

	t.Logf("Added rooter (%s@rooter)", rootername)

	// Examine results from TeamGet

	details, err := teamCli.TeamGet(context.TODO(), keybase1.TeamGetArg{
		Name:        team.name,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	require.Equal(t, 1, len(details.Members.Owners))
	require.Equal(t, 0, len(details.Members.Admins))
	require.Equal(t, 4, len(details.Members.Writers))
	require.Equal(t, 0, len(details.Members.Readers))

	annMember := findMember(ann, details.Members.Owners)
	require.NotNil(t, annMember)
	require.True(t, annMember.Active)
	require.False(t, annMember.NeedsPUK)

	bobMember := findMember(bob, details.Members.Writers)
	require.NotNil(t, bobMember)
	require.True(t, bobMember.Active)
	require.False(t, bobMember.NeedsPUK)

	pamMember := findMember(pam, details.Members.Writers)
	require.NotNil(t, pamMember)
	require.False(t, pamMember.Active)
	require.False(t, pamMember.NeedsPUK)

	johnMember := findMember(john, details.Members.Writers)
	require.NotNil(t, johnMember)
	require.True(t, johnMember.Active)
	require.True(t, johnMember.NeedsPUK)

	edMember := findMember(ed, details.Members.Writers)
	require.NotNil(t, edMember)
	require.True(t, edMember.Active)
	require.True(t, edMember.NeedsPUK)

	require.Equal(t, 1, len(details.AnnotatedActiveInvites))
	for _, invite := range details.AnnotatedActiveInvites {
		// There should be only one invite
		require.EqualValues(t, rootername, invite.Name)
	}

	// Examine results from TeamList (mostly MemberCount)

	check := func(list *keybase1.AnnotatedTeamList) {
		require.Equal(t, 1, len(list.Teams))
		require.Equal(t, 0, len(list.AnnotatedActiveInvites))

		teamInfo := list.Teams[0]
		require.Equal(t, team.name, teamInfo.FqName)
		require.Equal(t, 5, teamInfo.MemberCount)
	}

	list, err := teamCli.TeamListVerified(context.TODO(), keybase1.TeamListVerifiedArg{})
	require.NoError(t, err)

	check(&list)

	list, err = teamCli.TeamListUnverified(context.TODO(), keybase1.TeamListUnverifiedArg{})
	require.NoError(t, err)

	check(&list)
}

func TestTeamDuplicateUIDList(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()
	ctx := newSMUContext(t)
	defer ctx.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann (%s)", ann.username)

	// We have to disable caching in UIDMapper because after bob
	// resets and provisions, we have no way to be aware of that, and
	// we might see cached bob in subsequent teamList calls.
	ann.tc.G.UIDMapper.SetTestingNoCachingMode(true)

	bob := tt.addPuklessUser("bob")
	t.Logf("Signed up PUK-less user bob (%s)", bob.username)

	team := ann.createTeam()
	t.Logf("Team created (%s)", team)

	ann.addTeamMember(team, bob.username, keybase1.TeamRole_WRITER)

	bob.reset()
	bob.loginAfterReset()

	t.Logf("Bob (%s) resets and reprovisions", bob.username)

	ann.addTeamMember(team, bob.username, keybase1.TeamRole_WRITER)

	teamCli := ann.teamsClient
	t.Logf("teamcli is %v", teamCli)
	details, err := teamCli.TeamGet(context.TODO(), keybase1.TeamGetArg{
		Name:        team,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	// Expecting just the active writer here, and not inactive
	// (because of reset) invite.
	require.Equal(t, 1, len(details.Members.Writers))
	member := details.Members.Writers[0]
	require.True(t, member.Active)
	require.False(t, member.NeedsPUK)

	// Check both functions: slow TeamListVerified, and fast (server
	// trust) TeamList.

	// TeamList reports memberCount of two: ann and bob. Second bob is
	// ignored, because memberCount is set to number of unique UIDs.

	check := func(list *keybase1.AnnotatedTeamList) {
		require.Equal(t, 1, len(list.Teams))
		require.Equal(t, 0, len(list.AnnotatedActiveInvites))

		teamInfo := list.Teams[0]
		require.Equal(t, team, teamInfo.FqName)
		require.Equal(t, 2, teamInfo.MemberCount)
	}

	t.Logf("Calling TeamListVerified")
	list, err := teamCli.TeamListVerified(context.TODO(), keybase1.TeamListVerifiedArg{})
	require.NoError(t, err)

	check(&list)

	t.Logf("Calling TeamList")
	list, err = teamCli.TeamListUnverified(context.TODO(), keybase1.TeamListUnverifiedArg{})
	require.NoError(t, err)

	check(&list)
}

func TestTeamTree(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann (%s)", ann.username)

	team := ann.createTeam()
	t.Logf("Team created (%s)", team)

	TeamNameFromString := func(str string) keybase1.TeamName {
		ret, err := keybase1.TeamNameFromString(str)
		require.NoError(t, err)
		return ret
	}

	createSubteam := func(parentName, subteamName string) string {
		subteam, err := teams.CreateSubteam(context.Background(), ann.tc.G, subteamName, TeamNameFromString(parentName))
		require.NoError(t, err)
		subteamObj, err := teams.Load(context.Background(), ann.tc.G, keybase1.LoadTeamArg{ID: *subteam})
		require.NoError(t, err)
		return subteamObj.Name().String()
	}

	subTeam1 := createSubteam(team, "staff")

	sub1SubTeam1 := createSubteam(subTeam1, "legal")
	sub1SubTeam2 := createSubteam(subTeam1, "hr")

	subTeam2 := createSubteam(team, "offtopic")

	sub2SubTeam1 := createSubteam(subTeam2, "games")
	sub2SubTeam2 := createSubteam(subTeam2, "crypto")
	sub2SubTeam3 := createSubteam(subTeam2, "cryptocurrency")

	checkTeamTree := func(teamName string, expectedTree ...string) {
		set := make(map[string]bool)
		for _, v := range expectedTree {
			set[v] = false
		}
		set[teamName] = false

		tree, err := teams.TeamTree(context.Background(), ann.tc.G, keybase1.TeamTreeArg{Name: TeamNameFromString(teamName)})
		require.NoError(t, err)

		for _, entry := range tree.Entries {
			name := entry.Name.String()
			alreadyFound, exists := set[name]
			if !exists {
				t.Fatalf("Found unexpected team %s in tree of %s", name, teamName)
			} else if alreadyFound {
				t.Fatalf("Duplicate team %s in tree of %s", name, teamName)
			}
			set[name] = true
		}
	}

	checkTeamTree(team, subTeam1, subTeam2, sub1SubTeam1, sub1SubTeam2, sub2SubTeam1, sub2SubTeam2, sub2SubTeam3)
	checkTeamTree(subTeam1, sub1SubTeam1, sub1SubTeam2)
	checkTeamTree(subTeam2, sub2SubTeam1, sub2SubTeam2, sub2SubTeam3)

	checkTeamTree(sub2SubTeam1)
	checkTeamTree(sub2SubTeam2)
	checkTeamTree(sub2SubTeam3)
}
