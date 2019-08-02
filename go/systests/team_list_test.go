package systests

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
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

	ann.setUIDMapperNoCachingMode(true)

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
		Name: team.name,
	})
	require.NoError(t, err)

	require.Equal(t, 1, len(details.Members.Owners))
	require.Equal(t, 0, len(details.Members.Admins))
	require.Equal(t, 4, len(details.Members.Writers))
	require.Equal(t, 0, len(details.Members.Readers))
	require.Equal(t, 0, len(details.Members.Bots))
	require.Equal(t, 0, len(details.Members.RestrictedBots))

	annMember := findMember(ann, details.Members.Owners)
	require.NotNil(t, annMember)
	require.True(t, annMember.Status.IsActive())
	require.False(t, annMember.NeedsPUK)

	bobMember := findMember(bob, details.Members.Writers)
	require.NotNil(t, bobMember)
	require.True(t, bobMember.Status.IsActive())
	require.False(t, bobMember.NeedsPUK)

	pamMember := findMember(pam, details.Members.Writers)
	require.NotNil(t, pamMember)
	require.True(t, pamMember.Status.IsReset())
	require.False(t, pamMember.NeedsPUK)

	johnMember := findMember(john, details.Members.Writers)
	require.NotNil(t, johnMember)
	require.True(t, johnMember.Status.IsActive())
	require.True(t, johnMember.NeedsPUK)

	edMember := findMember(ed, details.Members.Writers)
	require.NotNil(t, edMember)
	require.True(t, edMember.Status.IsActive())
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

func TestTeamListOpenTeamFilter(t *testing.T) {
	// Open teams filter out inactive members to the rpc.
	tt := newTeamTester(t)
	defer tt.cleanup()

	standaloneArgs := standaloneUserArgs{
		disableGregor:            true,
		suppressTeamChatAnnounce: true,
	}

	ann := makeUserStandalone(t, "ann", standaloneArgs)
	bob := makeUserStandalone(t, "bob", standaloneArgs)
	tom := makeUserStandalone(t, "tom", standaloneArgs)

	team := ann.createTeam()
	t.Logf("Team created %q", team)
	ann.teamSetSettings(team, keybase1.TeamSettings{
		Open:   true,
		JoinAs: keybase1.TeamRole_WRITER,
	})

	ann.addTeamMember(team, bob.username, keybase1.TeamRole_ADMIN)
	ann.addTeamMember(team, tom.username, keybase1.TeamRole_WRITER)
	ann.tc.G.UIDMapper.SetTestingNoCachingMode(true)

	bob.reset()
	tom.reset()

	details, err := ann.teamsClient.TeamGet(context.Background(), keybase1.TeamGetArg{
		Name: team,
	})
	require.NoError(t, err)

	require.Len(t, details.Members.Owners, 1)
	require.Len(t, details.Members.Admins, 1)
	// Reset writer is filtered out because it's an open team.
	require.Len(t, details.Members.Writers, 0)
}

func TestTeamListOpenTeams(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann (%s)", ann.username)

	team1 := ann.createTeam()
	t.Logf("Team 1 created (%s)", team1)

	team2 := ann.createTeam()
	t.Logf("Team 2 created (%s)", team2)

	ann.teamSetSettings(team2, keybase1.TeamSettings{
		Open:   true,
		JoinAs: keybase1.TeamRole_WRITER,
	})

	check := func(list *keybase1.AnnotatedTeamList) {
		require.Equal(t, 2, len(list.Teams))
		require.Equal(t, 0, len(list.AnnotatedActiveInvites))
		for _, teamInfo := range list.Teams {
			if teamInfo.FqName == team1 {
				require.False(t, teamInfo.IsOpenTeam)
			} else if teamInfo.FqName == team2 {
				require.True(t, teamInfo.IsOpenTeam)
			} else {
				t.Fatalf("Unexpected team name %v", teamInfo)
			}

			require.Equal(t, 1, teamInfo.MemberCount)
		}
	}

	teamCli := ann.teamsClient

	list, err := teamCli.TeamListVerified(context.Background(), keybase1.TeamListVerifiedArg{})
	require.NoError(t, err)

	check(&list)

	list, err = teamCli.TeamListUnverified(context.Background(), keybase1.TeamListUnverifiedArg{})
	require.NoError(t, err)

	check(&list)
}

func TestTeamDuplicateUIDList(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

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
	details, err := teamCli.TeamGet(context.TODO(), keybase1.TeamGetArg{
		Name: team,
	})
	require.NoError(t, err)

	// Expecting just the active writer here, and not inactive
	// (because of reset) invite.
	require.Equal(t, 1, len(details.Members.Writers))
	member := details.Members.Writers[0]
	require.True(t, member.Status.IsActive())
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

func setupNestedSubteams(t *testing.T, user *userPlusDevice) (teamNames []keybase1.TeamName) {
	teamStr := user.createTeam()
	t.Logf("Team created (%s)", teamStr)

	team, err := keybase1.TeamNameFromString(teamStr)
	require.NoError(t, err)

	createSubteam := func(parentName keybase1.TeamName, subteamName string) keybase1.TeamName {
		subteam, err := teams.CreateSubteam(context.Background(), user.tc.G, subteamName, parentName, keybase1.TeamRole_NONE /* addSelfAs */)
		require.NoError(t, err)
		subteamObj, err := teams.Load(context.Background(), user.tc.G, keybase1.LoadTeamArg{ID: *subteam})
		require.NoError(t, err)
		return subteamObj.Name()
	}

	subTeam1 := createSubteam(team, "staff")

	sub1SubTeam1 := createSubteam(subTeam1, "legal")
	sub1SubTeam2 := createSubteam(subTeam1, "hr")

	subTeam2 := createSubteam(team, "offtopic")

	sub2SubTeam1 := createSubteam(subTeam2, "games")
	sub2SubTeam2 := createSubteam(subTeam2, "crypto")
	sub2SubTeam3 := createSubteam(subTeam2, "cryptocurrency")
	return []keybase1.TeamName{team, subTeam1, subTeam2, sub1SubTeam1, sub1SubTeam2, sub2SubTeam1, sub2SubTeam2, sub2SubTeam3}
}

func TestTeamTree(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann (%s)", ann.username)

	allNestedTeamNames := setupNestedSubteams(t, ann)

	checkTeamTree := func(teamName keybase1.TeamName, expectedTree ...keybase1.TeamName) {
		set := make(map[string]bool)
		for _, v := range expectedTree {
			set[v.String()] = false
		}

		tree, err := teams.TeamTree(context.Background(), ann.tc.G, keybase1.TeamTreeArg{Name: teamName})
		require.NoError(t, err)
		require.Equal(t, len(expectedTree), len(tree.Entries))

		for _, entry := range tree.Entries {
			name := entry.Name.String()
			alreadyFound, exists := set[name]
			require.True(t, exists, "Found unexpected team %s in tree of %s", name, teamName)
			require.False(t, alreadyFound, "Duplicate team %s in tree of %s", name, teamName)
			set[name] = true
		}
	}

	for _, teamOrSubteam := range allNestedTeamNames {
		// TeamTree always shows the whole tree no matter which subteam it starts from
		checkTeamTree(teamOrSubteam, allNestedTeamNames...)
	}
}

func TestTeamGetSubteams(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	bob := tt.addUser("bob")
	t.Logf("Signed up bob (%s)", bob.username)

	allNestedTeamNames := setupNestedSubteams(t, bob)

	checkTeamSubteams := func(teamName keybase1.TeamName, expectedSubteams []keybase1.TeamName) {
		set := make(map[string]bool)
		for _, v := range expectedSubteams {
			set[v.String()] = false
		}

		res, err := teams.ListSubteamsUnverified(libkb.NewMetaContext(context.Background(), bob.tc.G), teamName)
		require.NoError(t, err)
		require.Equal(t, len(expectedSubteams), len(res.Entries))

		for _, entry := range res.Entries {
			name := entry.Name.String()
			alreadyFound, exists := set[name]
			require.True(t, exists, "Found unexpected team %s in subteam list of %s", name, teamName)
			require.False(t, alreadyFound, "Duplicate team %s in subteam list of %s", name, teamName)
			set[name] = true
		}
	}

	checkTeamSubteams(allNestedTeamNames[0], allNestedTeamNames[1:])
	checkTeamSubteams(allNestedTeamNames[1], allNestedTeamNames[3:5])
	checkTeamSubteams(allNestedTeamNames[2], allNestedTeamNames[5:])
}

func TestTeamProfileAddList(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	t.Logf("Signed up ann (%s)", ann.username)

	_, teamName := ann.createTeam2()
	t.Logf("Team created (%s)", teamName)

	res, err := ann.teamsClient.TeamProfileAddList(context.TODO(), keybase1.TeamProfileAddListArg{Username: "t_alice"})
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, keybase1.TeamProfileAddEntry{
		TeamName:       teamName,
		Open:           false,
		DisabledReason: "",
	}, res[0])
}
