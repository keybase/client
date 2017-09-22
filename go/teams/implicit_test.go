package teams

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
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

	lookupAndCreate := func(displayName string, public bool) {
		t.Logf("displayName:%v public:%v", displayName, public)
		_, _, err := LookupImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.Error(t, err)
		require.IsType(t, TeamDoesNotExistError{}, err)

		createdTeamID, impTeamName, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName, public)
		require.NoError(t, err)
		require.Equal(t, public, impTeamName.IsPublic)

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
		teamDisplay, err := team.ImplicitTeamDisplayNameString(context.TODO())
		require.NoError(t, err)
		formatName, err := FormatImplicitTeamDisplayName(context.TODO(), tc.G, impTeamName)
		require.NoError(t, err)
		require.Equal(t, teamDisplay, formatName)
		require.Equal(t, team.IsPublic(), public)
	}

	displayName := strings.Join(usernames, ",")
	lookupAndCreate(displayName, false)
	lookupAndCreate(displayName, true)
	displayName = fmt.Sprintf("mike@twitter,%s,james@github", displayName)
	lookupAndCreate(displayName, false)
	lookupAndCreate(displayName, true)

	_, _, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, "dksjdskjs/sxs?", false)
	require.Error(t, err)
	_, _, err = LookupOrCreateImplicitTeam(context.TODO(), tc.G, "dksjdskjs/sxs?", true)
	require.Error(t, err)
}

// Test an implicit team where one user does not yet have a PUK.
func TestImplicitPukless(t *testing.T) {
	fus, tcs, cleanup := setupNTestsWithPukless(t, 2, 1)
	defer cleanup()

	displayName := "" + fus[0].Username + "," + fus[1].Username
	t.Logf("U0 creates an implicit team: %v", displayName)
	teamID, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*isPublic*/)
	require.NoError(t, err)

	teamID2, _, err := LookupImplicitTeam(context.Background(), tcs[0].G, displayName, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, teamID, teamID2)

	teamID2, _, err = LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, teamID, teamID2)

	t.Logf("U0 loads the team")
	team, err := Load(context.Background(), tcs[0].G, keybase1.LoadTeamArg{ID: teamID})
	require.NoError(t, err)
	require.False(t, team.IsPublic())
	u0Role, err := team.chain().GetUserRole(fus[0].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_OWNER, u0Role)
	u1Role, err := team.chain().GetUserRole(fus[1].GetUserVersion())
	require.True(t, err != nil || u1Role == keybase1.TeamRole_NONE, "u1 should not yet be a member")
	t.Logf("invites: %v", spew.Sdump(team.chain().inner.ActiveInvites))
	itype, err := keybase1.TeamInviteTypeFromString("keybase", true)
	require.NoError(t, err, "should be able to make invite type for 'keybase'")
	invite, err := team.chain().FindActiveInvite(fus[1].GetUserVersion().TeamInviteName(), itype)
	require.NoError(t, err, "team should have invite for the puk-less user")
	require.Equal(t, keybase1.TeamRole_OWNER, invite.Role)
	require.Len(t, team.chain().inner.ActiveInvites, 1, "number of invites")
}

// Test loading an implicit team as a #reader.
func TestImplicitTeamReader(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	displayName := "" + fus[0].Username + ",bob@twitter#" + fus[1].Username
	t.Logf("U0 creates an implicit team: %v", displayName)
	teamID, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*public*/)
	require.NoError(t, err)

	t.Logf("U1 looks up the team")
	teamID2, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*public*/)
	require.NoError(t, err)
	require.Equal(t, teamID, teamID2, "users should lookup the same team ID")

	t.Logf("U1 loads the team")
	team, err := Load(context.Background(), tcs[1].G, keybase1.LoadTeamArg{ID: teamID2})
	require.NoError(t, err)
	_, err = team.ApplicationKey(context.Background(), keybase1.TeamApplication_KBFS)
	require.NoError(t, err, "getting kbfs application key")
	require.False(t, team.IsPublic())
	u0Role, err := team.chain().GetUserRole(fus[0].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_OWNER, u0Role)
	u1Role, err := team.chain().GetUserRole(fus[1].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_READER, u1Role)
}

// Check that ParseImplicitTeamDisplayName and FormatImplicitTeamDisplayName agree.
func TestImplicitDisplayTeamNameParse(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	// TODO test this with keybase assertions (puk-less users).
	// It will probably fail because <uid>@keybase is the wrong format.

	makeAssertionContext := func() libkb.AssertionContext {
		return libkb.MakeAssertionContext(externals.GetServices())
	}

	for _, public := range []bool{true, false} {
		for _, hasConflict := range []bool{true, false} {
			var conflictInfo *keybase1.ImplicitTeamConflictInfo
			if hasConflict {
				conflictTime, err := time.Parse("2006-01-02", "2017-08-30")
				require.NoError(t, err)
				conflictInfo = &keybase1.ImplicitTeamConflictInfo{
					Generation: 3,
					Time:       keybase1.ToTime(conflictTime.UTC()),
				}
			}
			obj1 := keybase1.ImplicitTeamDisplayName{
				IsPublic: public,
				Writers: keybase1.ImplicitTeamUserSet{
					KeybaseUsers: []string{"alice", "bob"},
					UnresolvedUsers: []keybase1.SocialAssertion{
						keybase1.SocialAssertion{User: "twwwww", Service: keybase1.SocialAssertionService("twitter")},
						keybase1.SocialAssertion{User: "reeeee", Service: keybase1.SocialAssertionService("reddit")},
					},
				},
				Readers: keybase1.ImplicitTeamUserSet{
					KeybaseUsers: []string{"trust", "worthy"},
					UnresolvedUsers: []keybase1.SocialAssertion{
						keybase1.SocialAssertion{User: "ghhhh", Service: keybase1.SocialAssertionService("github")},
						keybase1.SocialAssertion{User: "fbbbb", Service: keybase1.SocialAssertionService("facebook")},
					},
				},
				ConflictInfo: conflictInfo,
			}
			str1, err := FormatImplicitTeamDisplayName(context.Background(), tc.G, obj1)
			t.Logf("str1 '%v'", str1)
			require.NoError(t, err)
			obj2, err := libkb.ParseImplicitTeamDisplayName(makeAssertionContext(), str1, obj1.IsPublic)
			require.NoError(t, err)
			require.Equal(t, obj2.IsPublic, public)
			require.Len(t, obj2.Writers.KeybaseUsers, 2)
			require.Len(t, obj2.Writers.UnresolvedUsers, 2)
			require.Len(t, obj2.Readers.KeybaseUsers, 2)
			require.Len(t, obj2.Readers.UnresolvedUsers, 2)
			if hasConflict {
				require.NotNil(t, obj2.ConflictInfo)
				require.Equal(t, obj2.ConflictInfo.Generation, obj1.ConflictInfo.Generation)
				require.Equal(t, obj2.ConflictInfo.Time, obj1.ConflictInfo.Time)
			} else {
				require.Nil(t, obj2.ConflictInfo)
			}
			str2, err := FormatImplicitTeamDisplayName(context.Background(), tc.G, obj2)
			require.NoError(t, err)
			require.Equal(t, str2, str1)
		}
	}
}

// Test the looking up an implicit team involving a resolved assertion gives the resolved iteam.
func TestLookupImplicitTeamResolvedSocialAssertion(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	// assumption: t_tracy@rooter resolves to t_tracy

	displayName1 := "t_tracy@rooter," + fus[0].Username
	displayName2 := "t_tracy," + fus[0].Username

	teamID1, impTeamName1, err := LookupOrCreateImplicitTeam(context.TODO(), tcs[0].G, displayName1, false /*isPublic*/)
	require.NoError(t, err)
	teamID2, _, err := LookupOrCreateImplicitTeam(context.TODO(), tcs[0].G, displayName2, false /*isPublic*/)
	require.NoError(t, err)

	require.Equal(t, teamID1, teamID2, "implicit team ID should be the same for %v and %v", displayName1, displayName2)

	team, err := Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID: teamID1,
	})
	require.NoError(t, err)
	owners, err := team.UsersWithRole(keybase1.TeamRole_OWNER)
	require.NoError(t, err)
	// Note: t_tracy has no PUK so she shows up as an invite.
	require.Len(t, owners, 1)
	require.Len(t, team.chain().inner.ActiveInvites, 1, "number of invites")

	teamDisplay, err := team.ImplicitTeamDisplayNameString(context.TODO())
	require.NoError(t, err)
	require.Equal(t, displayName2, teamDisplay)
	formatName, err := FormatImplicitTeamDisplayName(context.TODO(), tcs[0].G, impTeamName1)
	require.NoError(t, err)
	require.Equal(t, displayName2, formatName)
}
