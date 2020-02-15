package systests

import (
	"testing"

	"fmt"

	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestSubteamAdminships(t *testing.T) {
	// This is not a real test - we used it to debug and profile
	// multiple level subteam loading where implicit adminships were
	// involved.
	t.Skip()

	tt := newTeamTester(t)
	defer tt.cleanup()

	al := tt.addUser("al")
	bob := tt.addUser("bob")
	eve := tt.addUser("eve")

	_, teamName := al.createTeam2()

	const subteamBasename = "bb1"
	subteamID1, err := teams.CreateSubteam(context.TODO(), al.tc.G, subteamBasename,
		teamName, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	subTeamName1, _ := teamName.Append(subteamBasename)

	t.Logf("Subteam created %s / %s", subteamID1.String(), subTeamName1.String())

	const subSubTeamBasename = "cc2"
	subteamID2, err := teams.CreateSubteam(context.TODO(), al.tc.G, subSubTeamBasename,
		subTeamName1, keybase1.TeamRole_NONE /* addSelfAs */)
	require.NoError(t, err)

	subTeamName2, _ := subTeamName1.Append(subSubTeamBasename)

	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)
	require.NoError(t, err)
	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)
	require.NoError(t, err)
	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)
	require.NoError(t, err)

	t.Logf("Sub-Subteam created %s / %s", subteamID2.String(), subTeamName2.String())

	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)
	require.NoError(t, err)
	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)
	require.NoError(t, err)
	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID1)
	require.NoError(t, err)

	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID2)
	require.NoError(t, err)
	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID2)
	require.NoError(t, err)
	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID2)
	require.NoError(t, err)

	al.addTeamMember(subTeamName2.String(), bob.username, keybase1.TeamRole_WRITER)
	al.addTeamMember(subTeamName2.String(), eve.username, keybase1.TeamRole_READER)

	bob.leave(subTeamName2.String())

	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID2)
	require.NoError(t, err)
	err = teams.RotateKeyVisible(context.TODO(), al.tc.G, *subteamID2)
	require.NoError(t, err)

	t.Logf("Eve loads team ...")
	fmt.Printf(":: Eve loads team %s ...\n", subteamID2.String())

	eve.loadTeam(subTeamName2.String(), false)
}

type subteamTestCtx struct {
	T     *testing.T
	Alice *userPlusDevice
	Bob   *userPlusDevice

	verifyCounter int
}

type subteamTest struct {
	Name     string
	Role     keybase1.TeamRole
	Subteams []*subteamTest

	teamID   keybase1.TeamID
	teamName keybase1.TeamName
}

func (s *subteamTest) Prepare(
	ctx *subteamTestCtx,
	parent *subteamTest,
) {
	if parent != nil {
		teamID, err := teams.CreateSubteam(
			context.TODO(),
			ctx.Alice.tc.G,
			s.Name,
			parent.teamName,
			keybase1.TeamRole_NONE, /* addSelfAs */
		)
		require.NoError(ctx.T, err)
		s.teamID = *teamID
		s.teamName, _ = parent.teamName.Append(s.Name)

		if s.Role != keybase1.TeamRole_NONE {
			ctx.Alice.addTeamMember(s.teamName.String(), ctx.Bob.username, s.Role)
		}
	}

	for _, st := range s.Subteams {
		st.Prepare(ctx, s)
	}
}

func (s *subteamTest) Verify(
	ctx *subteamTestCtx,
	details []keybase1.AnnotatedSubteamMemberDetails,
) {
	if s.Role != keybase1.TeamRole_NONE {
		row := details[ctx.verifyCounter]
		require.Equal(ctx.T, ctx.Bob.username, row.Details.Username, "username should match")
		require.Equal(ctx.T, s.Role, row.Role, "role should match")
		require.Equal(ctx.T, s.teamName, row.TeamName, "team name should match")
		require.Equal(ctx.T, s.teamID, row.TeamID, "team id should match")
		require.NotZero(ctx.T, row.Details.JoinTime, "join time should not be zero")

		ctx.verifyCounter++
	}

	for _, st := range s.Subteams {
		st.Verify(ctx, details)
	}
}

func TestSubteamMembership(t *testing.T) {
	// Tests the "GetUserSubteamMemberships"
	tt := newTeamTester(t)
	defer tt.cleanup()

	ctx := &subteamTestCtx{
		T:     t,
		Alice: tt.addUser("al"),
		Bob:   tt.addUser("bob"),
	}

	teamID, teamName := ctx.Alice.createTeam2()
	ctx.Alice.addTeamMember(teamName.String(), ctx.Bob.username, keybase1.TeamRole_WRITER)

	// We're using createTeam2 to prepare the root team, so fake a subteamTest
	rootTeam := subteamTest{
		Name: teamName.String(),
		Role: keybase1.TeamRole_WRITER,

		teamID:   teamID,
		teamName: teamName,

		Subteams: []*subteamTest{
			{
				Name: "bb1",
				Role: keybase1.TeamRole_WRITER,
				Subteams: []*subteamTest{
					{
						Name: "cc1",
						Role: keybase1.TeamRole_WRITER,
					},
					{
						Name: "cc2",
						Role: keybase1.TeamRole_READER,
					},
				},
			},
			{
				Name: "bb2",
				Role: keybase1.TeamRole_NONE,
				Subteams: []*subteamTest{
					{
						Name: "cc1",
						Role: keybase1.TeamRole_READER,
					},
					{
						Name: "cc2",
						Role: keybase1.TeamRole_WRITER,
					},
				},
			},
		},
	}

	// Prepare the tree of teams
	rootTeam.Prepare(ctx, nil)

	// now that we've bobbed all the teams, observe the bobification
	details, err := teams.GetUserSubteamMemberships(
		ctx.Alice.MetaContext(),
		rootTeam.teamID,
		ctx.Bob.username,
	)
	require.NoError(t, err)

	// run the verification
	rootTeam.Verify(ctx, details)
}
