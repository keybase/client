package systests

import (
	"testing"

	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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

	details, err := teamCli.TeamGet(context.TODO(), keybase1.TeamGetArg{
		Name:        team.name,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	require.Equal(t, 1, len(details.Members.Owners))
	require.Equal(t, 0, len(details.Members.Admins))
	require.Equal(t, 4, len(details.Members.Writers))
	require.Equal(t, 0, len(details.Members.Readers))
	require.Equal(t, 1, len(details.AnnotatedActiveInvites))

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

	for _, invite := range details.AnnotatedActiveInvites {
		// There should be only one invite
		require.EqualValues(t, rootername, invite.Name)
	}

	list, err := teamCli.TeamList(context.TODO(), keybase1.TeamListArg{})
	require.NoError(t, err)

	require.Equal(t, 1, len(list.Teams))
	require.Equal(t, 0, len(list.AnnotatedActiveInvites))

	teamInfo := list.Teams[0]
	require.Equal(t, team.name, teamInfo.FqName)
	require.Equal(t, 5, teamInfo.MemberCount)
}
