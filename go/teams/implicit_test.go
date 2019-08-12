package teams

import (
	"encoding/hex"
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

func newImplicitTLFID(public bool) keybase1.TLFID {
	suffix := byte(0x29)
	if public {
		suffix = 0x2a
	}

	idBytes, err := libkb.RandBytesWithSuffix(16, suffix)
	if err != nil {
		panic("RandBytes failed: " + err.Error())
	}
	return keybase1.TLFID(hex.EncodeToString(idBytes))
}

func TestImplicitRaceCreateTLFs(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()
	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)
	displayName := u.Username
	_, _, _, err = LookupImplicitTeam(context.TODO(), tc.G, displayName, false, ImplicitTeamOptions{})
	require.Error(t, err)
	require.IsType(t, TeamDoesNotExistError{}, err)
	createdTeam, _, impTeamName, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName, false)
	require.NoError(t, err)
	tlfid0 := createdTeam.LatestKBFSTLFID()
	require.False(t, impTeamName.IsPublic)
	require.True(t, tlfid0.IsNil())
	tlfid1 := newImplicitTLFID(true)
	n := 4
	doneCh := make(chan struct{}, n+1)
	for i := 0; i < n; i++ {
		go func() {
			err = CreateTLF(context.TODO(), tc.G, keybase1.CreateTLFArg{TeamID: createdTeam.ID, TlfID: tlfid1})
			require.NoError(t, err)
			doneCh <- struct{}{}
		}()
	}
	for i := 0; i < n; i++ {
		select {
		case <-doneCh:
		case <-time.After(time.Minute):
			t.Fatal("failed to get racing racers back")
		}
		tc.G.Log.Debug("Got finisher %d", i)
	}
	// second time, LookupOrCreate should Lookup the team just created.
	createdTeam2, _, impTeamName2, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName, false)
	require.NoError(t, err)
	tlfid2 := createdTeam2.LatestKBFSTLFID()
	require.Equal(t, createdTeam.ID, createdTeam2.ID)
	require.Equal(t, impTeamName, impTeamName2, "public: %v", false)
	require.Equal(t, tlfid1, tlfid2, "the right TLFID came back")
}

func TestLookupImplicitTeams(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	numKBUsers := 3
	var usernames []string
	for i := 0; i < numKBUsers; i++ {
		u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
		require.NoError(t, err)
		usernames = append(usernames, u.Username)
	}

	lookupAndCreate := func(displayName string, public bool) {
		t.Logf("displayName:%v public:%v", displayName, public)
		_, _, _, err := LookupImplicitTeam(context.TODO(), tc.G, displayName, public, ImplicitTeamOptions{})
		require.Error(t, err)
		require.IsType(t, TeamDoesNotExistError{}, err)

		createdTeam, _, impTeamName, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName,
			public)
		require.NoError(t, err)
		tlfid0 := createdTeam.LatestKBFSTLFID()
		require.Equal(t, public, impTeamName.IsPublic)
		require.True(t, tlfid0.IsNil())

		tlfid1 := newImplicitTLFID(public)
		err = CreateTLF(context.TODO(), tc.G, keybase1.CreateTLFArg{TeamID: createdTeam.ID, TlfID: tlfid1})
		require.NoError(t, err)

		// We can double this, and it still should work (and noop the second Time)
		err = CreateTLF(context.TODO(), tc.G, keybase1.CreateTLFArg{TeamID: createdTeam.ID, TlfID: tlfid1})
		require.NoError(t, err)

		// second time, LookupOrCreate should Lookup the team just created.
		createdTeam2, _, impTeamName2, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName,
			public)
		require.NoError(t, err)
		tlfid2 := createdTeam2.LatestKBFSTLFID()
		require.Equal(t, createdTeam.ID, createdTeam2.ID)
		require.Equal(t, impTeamName, impTeamName2, "public: %v", public)
		require.Equal(t, tlfid1, tlfid2, "the right TLFID came back")

		lookupTeam, _, impTeamName, err := LookupImplicitTeam(context.TODO(), tc.G, displayName, public, ImplicitTeamOptions{})
		require.NoError(t, err)
		require.Equal(t, createdTeam.ID, lookupTeam.ID)

		team := createdTeam
		teamDisplay, err := team.ImplicitTeamDisplayNameString(context.TODO())
		require.NoError(t, err)
		formatName, err := FormatImplicitTeamDisplayName(context.TODO(), tc.G, impTeamName)
		require.NoError(t, err)
		require.Equal(t, teamDisplay, formatName)
		require.Equal(t, team.IsPublic(), public)

		expr := fmt.Sprintf("tid:%s", createdTeam.ID)
		rres := tc.G.Resolver.ResolveFullExpressionNeedUsername(libkb.NewMetaContextForTest(tc), expr)
		require.NoError(t, rres.GetError())
		require.True(t, rres.GetTeamID().Exists())
	}

	displayName := strings.Join(usernames, ",")
	lookupAndCreate(displayName, false)
	lookupAndCreate(displayName, true)
	displayName = fmt.Sprintf("mike@twitter,%s,james@github", displayName)
	lookupAndCreate(displayName, false)
	lookupAndCreate(displayName, true)

	_, _, _, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, "dksjdskjs/sxs?", false)
	require.Error(t, err)
	_, _, _, err = LookupOrCreateImplicitTeam(context.TODO(), tc.G, "dksjdskjs/sxs?", true)
	require.Error(t, err)

	// Create the same team right on top of each other
	displayName = strings.Join(usernames, ",") + ",josecanseco@twitter"
	ch := make(chan error, 2)
	go func() {
		_, _, _, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName, false)
		ch <- err
	}()
	go func() {
		_, _, _, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, displayName, false)
		ch <- err
	}()
	require.NoError(t, <-ch)
	require.NoError(t, <-ch)
}

// Test an implicit team where one user does not yet have a PUK.
func TestImplicitPukless(t *testing.T) {
	fus, tcs, cleanup := setupNTestsWithPukless(t, 2, 1)
	defer cleanup()

	displayName := "" + fus[0].Username + "," + fus[1].Username
	t.Logf("U0 creates an implicit team: %v", displayName)
	team, _, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*isPublic*/)
	require.NoError(t, err)

	team2, _, _, err := LookupImplicitTeam(context.Background(), tcs[0].G, displayName, false /*isPublic*/, ImplicitTeamOptions{})
	require.NoError(t, err)
	require.Equal(t, team.ID, team2.ID)

	team2, _, _, err = LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, team.ID, team2.ID)

	t.Logf("U0 loads the team")
	team, err = Load(context.Background(), tcs[0].G, keybase1.LoadTeamArg{ID: team.ID})
	require.NoError(t, err)
	require.False(t, team.IsPublic())
	u0Role, err := team.chain().GetUserRole(fus[0].GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_OWNER, u0Role)
	u1Role, err := team.chain().GetUserRole(fus[1].GetUserVersion())
	require.True(t, err != nil || u1Role == keybase1.TeamRole_NONE, "u1 should not yet be a member")
	t.Logf("invites: %v", spew.Sdump(team.chain().inner.ActiveInvites))
	itype, err := TeamInviteTypeFromString(tcs[0].MetaContext(), "keybase")
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
	team, _, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*public*/)
	require.NoError(t, err)

	t.Logf("U1 looks up the team")
	team2, _, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, displayName, false /*public*/)
	require.NoError(t, err)
	require.Equal(t, team.ID, team2.ID, "users should lookup the same team ID")

	t.Logf("U1 loads the team")
	team, err = Load(context.Background(), tcs[1].G, keybase1.LoadTeamArg{ID: team2.ID})
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
		return libkb.MakeAssertionContext(libkb.NewMetaContext(context.Background(), tc.G), externals.NewProofServices(tc.G))
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

	team1, _, impTeamName1, err := LookupOrCreateImplicitTeam(context.TODO(), tcs[0].G, displayName1, false /*isPublic*/)
	require.NoError(t, err)
	team2, _, _, err := LookupOrCreateImplicitTeam(context.TODO(), tcs[0].G, displayName2, false /*isPublic*/)
	require.NoError(t, err)

	require.Equal(t, team1.ID, team2.ID, "implicit team ID should be the same for %v and %v", displayName1, displayName2)

	team, err := Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID: team1.ID,
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

// Test that you can rotate the key on an implicit team.
func TestImplicitTeamRotate(t *testing.T) {
	for _, public := range []bool{false, true} {
		t.Logf("public:%v", public)
		fus, tcs, cleanup := setupNTests(t, 3)
		defer cleanup()

		displayName := strings.Join([]string{fus[0].Username, fus[1].Username}, ",")

		team, _, _, err := LookupOrCreateImplicitTeam(context.TODO(), tcs[0].G, displayName, public)
		require.NoError(t, err)
		teamID := team.ID
		t.Logf("teamID: %v", teamID)
		require.Equal(t, keybase1.PerTeamKeyGeneration(1), team.Generation())

		t.Logf("rotate the key")
		err = team.Rotate(context.TODO(), keybase1.RotationType_VISIBLE)
		require.NoError(t, err)

		t.Logf("load as other member")
		team, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
			ID:     teamID,
			Public: public,
		})
		require.NoError(t, err)
		require.Equal(t, keybase1.PerTeamKeyGeneration(2), team.Generation())

		if public {
			t.Logf("load as third user who is not a member of the team")
			team, err = Load(context.TODO(), tcs[1].G, keybase1.LoadTeamArg{
				ID:     teamID,
				Public: public,
			})
			require.NoError(t, err)
			require.Equal(t, keybase1.PerTeamKeyGeneration(2), team.Generation())
		}
	}
}

func TestLoggedOutPublicTeamLoad(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()
	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)
	createdTeam, _, impTeamName, err := LookupOrCreateImplicitTeam(context.TODO(), tc.G, u.Username, true)
	require.NoError(t, err)
	require.Equal(t, true, impTeamName.IsPublic)
	err = tc.G.Logout(context.TODO())
	require.NoError(t, err)

	for i := 0; i < 2; i++ {
		_, err = Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
			ID:     createdTeam.ID,
			Public: true,
		})
		require.NoError(t, err)
	}
}

func TestImplicitInvalidLinks(t *testing.T) {
	fus, tcs, cleanup := setupNTestsWithPukless(t, 5, 2)
	defer cleanup()

	ann := fus[0] // pukful user
	bob := fus[1] // pukful user
	cat := fus[3] // pukless user

	pam := fus[2] // pukful user
	joe := fus[4] // pukless user

	impteamName := strings.Join([]string{ann.Username, bob.Username, cat.Username}, ",")
	t.Logf("ann creates an implicit team: %v", impteamName)
	teamObj, _, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, impteamName, false /*isPublic*/)
	require.NoError(t, err)

	RequirePrecheckError := func(err error) {
		require.Error(t, err)
		require.IsType(t, PrecheckAppendError{}, err)
	}

	{
		// Adding entirely new member should be illegal
		req := keybase1.TeamChangeReq{
			Owners: []keybase1.UserVersion{pam.GetUserVersion()},
		}
		err := teamObj.ChangeMembership(context.Background(), req)
		RequirePrecheckError(err)
	}

	{
		// Adding entirely new pukless member should be illegal
		invite := SCTeamInvite{
			Type: "keybase",
			Name: joe.GetUserVersion().TeamInviteName(),
			ID:   NewInviteID(),
		}
		err := teamObj.postInvite(context.Background(), invite, keybase1.TeamRole_OWNER)
		RequirePrecheckError(err)
	}

	{
		// Adding new social invite never works
		_, err := teamObj.inviteSBSMember(context.Background(), ann.Username+"@rooter", keybase1.TeamRole_OWNER)
		RequirePrecheckError(err)
	}

	{
		// Removing existing member should be illegal
		req := keybase1.TeamChangeReq{
			None: []keybase1.UserVersion{bob.GetUserVersion()},
		}
		err := teamObj.ChangeMembership(context.Background(), req)
		RequirePrecheckError(err)
	}

	{
		// Removing existing pukless member should be illegal
		invite, _, found := teamObj.FindActiveKeybaseInvite(cat.GetUID())
		require.True(t, found)
		err := removeInviteID(context.Background(), teamObj, invite.Id)
		RequirePrecheckError(err)
	}
}

func TestImpTeamAddInviteWithoutCanceling(t *testing.T) {
	fus, tcs, cleanup := setupNTestsWithPukless(t, 2, 1)
	defer cleanup()

	impteamName := strings.Join([]string{fus[0].Username, fus[1].Username}, ",")
	t.Logf("created implicit team: %s", impteamName)

	teamObj, _, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, impteamName, false /*isPublic*/)
	require.NoError(t, err)

	t.Logf("created team id: %s", teamObj.ID)

	kbtest.ResetAccount(*tcs[1], fus[1])
	fus[1].EldestSeqno = 0

	// Adding new version of user without canceling old invite should
	// fail on the server side.
	invite := SCTeamInvite{
		Type: "keybase",
		Name: fus[1].GetUserVersion().TeamInviteName(),
		ID:   NewInviteID(),
	}
	err = teamObj.postInvite(context.Background(), invite, keybase1.TeamRole_OWNER)
	require.IsType(t, libkb.AppStatusError{}, err)
}

func TestTeamListImplicit(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	impteamName := strings.Join([]string{fus[0].Username, fus[1].Username}, ",")
	t.Logf("created implicit team: %s", impteamName)
	_, _, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, impteamName, false /*isPublic*/)
	require.NoError(t, err)

	teamName := createTeam(*tcs[1])
	t.Logf("created normal team: %s", teamName)

	require.NoError(t, SetRoleWriter(context.Background(), tcs[1].G, teamName, fus[0].Username))

	list, err := ListTeamsVerified(context.Background(), tcs[0].G, keybase1.TeamListVerifiedArg{IncludeImplicitTeams: false})
	require.NoError(t, err)
	require.Len(t, list.Teams, 1)

	list, err = ListTeamsVerified(context.Background(), tcs[0].G, keybase1.TeamListVerifiedArg{IncludeImplicitTeams: true})
	require.NoError(t, err)
	require.Len(t, list.Teams, 2)

	list, err = ListTeamsUnverified(context.Background(), tcs[0].G, keybase1.TeamListUnverifiedArg{IncludeImplicitTeams: false})
	require.NoError(t, err)
	require.Len(t, list.Teams, 1)
	// verify that we cache this call
	var cachedList []keybase1.MemberInfo
	cacheKey := listTeamsUnverifiedCacheKey(fus[0].User.GetUID(), "" /* userAssertion */, false /* includeImplicitTeams */)
	found, err := tcs[0].G.GetKVStore().GetInto(&cachedList, cacheKey)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, len(list.Teams), len(cachedList))

	list, err = ListTeamsUnverified(context.Background(), tcs[0].G, keybase1.TeamListUnverifiedArg{IncludeImplicitTeams: true})
	require.NoError(t, err)
	require.Len(t, list.Teams, 2)
	cacheKey = listTeamsUnverifiedCacheKey(fus[0].User.GetUID(), "" /* userAssertion */, true /* includeImplicitTeams */)
	found, err = tcs[0].G.GetKVStore().GetInto(&cachedList, cacheKey)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, len(list.Teams), len(cachedList))

	list, err = ListAll(context.Background(), tcs[0].G, keybase1.TeamListTeammatesArg{
		IncludeImplicitTeams: false,
	})
	require.NoError(t, err)
	require.Len(t, list.Teams, 2)
	require.Equal(t, teamName, list.Teams[0].FqName)
	require.Equal(t, teamName, list.Teams[1].FqName)

	list, err = ListAll(context.Background(), tcs[0].G, keybase1.TeamListTeammatesArg{
		IncludeImplicitTeams: true,
	})
	require.NoError(t, err)
	require.Len(t, list.Teams, 4)
}

func TestReAddMemberWithSameUV(t *testing.T) {
	fus, tcs, cleanup := setupNTestsWithPukless(t, 4, 2)
	defer cleanup()

	ann := fus[0] // crypto user
	bob := fus[1] // crypto user
	jun := fus[2] // pukless user
	hal := fus[3] // pukless user (eldest=0)

	kbtest.ResetAccount(*tcs[3], fus[3])

	impteamName := strings.Join([]string{ann.Username, bob.Username, jun.Username, hal.Username}, ",")
	t.Logf("ann creates an implicit team: %v", impteamName)
	teamObj, _, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, impteamName, false /*isPublic*/)
	require.NoError(t, err)

	t.Logf("created team id: %s", teamObj.ID)

	err = reAddMemberAfterResetInner(context.Background(), tcs[0].G, teamObj.ID, bob.Username)
	require.IsType(t, UserHasNotResetError{}, err)

	err = ReAddMemberAfterReset(context.Background(), tcs[0].G, teamObj.ID, jun.Username)
	require.NoError(t, err)

	err = reAddMemberAfterResetInner(context.Background(), tcs[0].G, teamObj.ID, hal.Username)
	require.IsType(t, UserHasNotResetError{}, err)

	// Now, the fun part (bug CORE-8099):

	// Bob resets, ann re-adds bob by posting an "invite" link, so
	// from chain point of view there are two active memberships for
	// bob: cryptomember from before reset and invite from after reset
	// (it's an implicit team weirdness - "invite" link has no way of
	// removing old membership).

	kbtest.ResetAccount(*tcs[1], fus[1])
	err = ReAddMemberAfterReset(context.Background(), tcs[0].G, teamObj.ID, bob.Username)
	require.NoError(t, err)

	// Subsequent calls should start UserHasNotResetErrorin again
	err = reAddMemberAfterResetInner(context.Background(), tcs[0].G, teamObj.ID, bob.Username)
	require.IsType(t, UserHasNotResetError{}, err)
}

func TestBotMember(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 4)
	defer cleanup()

	ann := fus[0]             // crypto user
	bob := fus[1]             // crypto user
	botua := fus[2]           // bot user
	restrictedBotua := fus[3] // restricted bot user

	impteamName := strings.Join([]string{ann.Username, bob.Username}, ",")
	t.Logf("ann creates an implicit team: %v", impteamName)
	teamObj, _, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, impteamName, false /*isPublic*/)
	require.NoError(t, err)

	t.Logf("created team id: %s", teamObj.ID)
	_, err = AddMemberByID(context.TODO(), tcs[0].G, teamObj.ID, botua.Username, keybase1.TeamRole_BOT, nil)
	require.NoError(t, err)
	_, err = AddMemberByID(context.TODO(), tcs[0].G, teamObj.ID, restrictedBotua.Username, keybase1.TeamRole_RESTRICTEDBOT, &keybase1.TeamBotSettings{})
	require.NoError(t, err)
	team, err := Load(context.Background(), tcs[2].G, keybase1.LoadTeamArg{ID: teamObj.ID})
	require.NoError(t, err)

	members, err := team.Members()
	require.NoError(t, err)
	require.Len(t, members.Bots, 1)
	require.Equal(t, botua.User.GetUID(), members.Bots[0].Uid)
	require.Len(t, members.RestrictedBots, 1)
	require.Equal(t, restrictedBotua.User.GetUID(), members.RestrictedBots[0].Uid)

	team, err = Load(context.Background(), tcs[3].G, keybase1.LoadTeamArg{ID: teamObj.ID})
	require.NoError(t, err)

	members, err = team.Members()
	require.NoError(t, err)
	require.Len(t, members.Bots, 1)
	require.Equal(t, botua.User.GetUID(), members.Bots[0].Uid)
	require.Len(t, members.RestrictedBots, 1)
	require.Equal(t, restrictedBotua.User.GetUID(), members.RestrictedBots[0].Uid)

	kbtest.ResetAccount(*tcs[2], botua)
	// BOT invites not supported, add support in HOTPOT-460
	err = ReAddMemberAfterReset(context.Background(), tcs[0].G, teamObj.ID, botua.Username)
	require.Error(t, err)

	err = botua.Login(tcs[2].G)
	require.NoError(t, err)
	err = kbtest.AssertProvisioned(*tcs[2])
	require.NoError(t, err)

	err = ReAddMemberAfterReset(context.Background(), tcs[0].G, teamObj.ID, botua.Username)
	require.NoError(t, err)
	// Subsequent calls should have UserHasNotResetError
	err = reAddMemberAfterResetInner(context.Background(), tcs[0].G, teamObj.ID, botua.Username)
	require.IsType(t, UserHasNotResetError{}, err)

	team, err = Load(context.Background(), tcs[3].G, keybase1.LoadTeamArg{ID: teamObj.ID})
	require.NoError(t, err)

	members, err = team.Members()
	require.NoError(t, err)

	kbtest.ResetAccount(*tcs[3], restrictedBotua)
	team, err = Load(context.Background(), tcs[2].G, keybase1.LoadTeamArg{ID: teamObj.ID})
	require.NoError(t, err)

	members, err = team.Members()
	require.NoError(t, err)
	// RESTRICTEDBOT invites not supported
	err = ReAddMemberAfterReset(context.Background(), tcs[0].G, teamObj.ID, restrictedBotua.Username)
	require.Error(t, err)

	err = restrictedBotua.Login(tcs[3].G)
	require.NoError(t, err)
	err = kbtest.AssertProvisioned(*tcs[3])
	require.NoError(t, err)

	err = ReAddMemberAfterReset(context.Background(), tcs[0].G, teamObj.ID, restrictedBotua.Username)
	require.NoError(t, err)

	// Subsequent calls should have UserHasNotResetError
	err = reAddMemberAfterResetInner(context.Background(), tcs[0].G, teamObj.ID, restrictedBotua.Username)
	require.IsType(t, UserHasNotResetError{}, err)

	team, err = Load(context.Background(), tcs[0].G, keybase1.LoadTeamArg{ID: teamObj.ID})
	require.NoError(t, err)
	members, err = team.Members()
	require.NoError(t, err)
	require.Len(t, members.Bots, 1)
	require.Equal(t, botua.User.GetUID(), members.Bots[0].Uid)
	require.Len(t, members.RestrictedBots, 1)
	require.Equal(t, restrictedBotua.User.GetUID(), members.RestrictedBots[0].Uid)

	err = RemoveMemberByID(context.TODO(), tcs[0].G, teamObj.ID, botua.Username)
	require.NoError(t, err)
	err = RemoveMemberByID(context.TODO(), tcs[0].G, teamObj.ID, restrictedBotua.Username)
	require.NoError(t, err)

	team, err = Load(context.Background(), tcs[0].G, keybase1.LoadTeamArg{ID: teamObj.ID})
	require.NoError(t, err)
	members, err = team.Members()
	require.NoError(t, err)
	require.Len(t, members.Bots, 0)
	require.Len(t, members.RestrictedBots, 0)
}

func TestGetTeamIDRPC(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	for i := 1; i <= 2; i++ {
		// Test with two impteams: "fus[0]" and "fus[0],fus[1]"
		var membersStr []string
		for j := 0; j < i; j++ {
			membersStr = append(membersStr, fus[j].Username)
		}
		impteamName := strings.Join(membersStr, ",")
		t.Logf("creating an implicit team: %v", impteamName)
		teamObj, _, _, err := LookupOrCreateImplicitTeam(context.Background(), tcs[0].G, impteamName, false /*isPublic*/)
		require.NoError(t, err)

		mctx := libkb.NewMetaContextForTest(*tcs[0])
		res, err := GetTeamIDByNameRPC(mctx, teamObj.Name().String())
		require.NoError(t, err)
		require.Equal(t, teamObj.ID, res)
	}
}

func TestInvalidPhoneNumberAssertion(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	// Make sure we are stopped from creating an implicit team with bad number.
	// This will also stop a conversation from being created if someone tries
	// to chat with invalid phone number assertion.
	badNumbers := []string{"111", "12345678", "48111"}
	for _, bad := range badNumbers {
		displayName := keybase1.ImplicitTeamDisplayName{
			IsPublic: false,
			Writers: keybase1.ImplicitTeamUserSet{
				KeybaseUsers: []string{fus[0].Username},
				UnresolvedUsers: []keybase1.SocialAssertion{
					keybase1.SocialAssertion{
						User:    bad,
						Service: keybase1.SocialAssertionService("phone"),
					},
				},
			},
		}
		t.Logf("Trying name: %q", displayName.String())
		_, _, err := CreateImplicitTeam(context.Background(), tcs[0].G, displayName)
		require.Error(t, err)
		require.Contains(t, err.Error(), "bad phone number given")
	}

	// Some numbers are stopped at assertion parsing level.
	superBadNumbers := []string{"012345678"}
	for _, bad := range superBadNumbers {
		displayName := fmt.Sprintf("%s@phone,%s", bad, fus[0].Username)
		_, err := ResolveImplicitTeamDisplayName(context.Background(), tcs[0].G, displayName, false)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Invalid phone number")
	}
}
