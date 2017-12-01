// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/git"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestGitTeamer(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	alice := tt.addUser("abc")

	aliceTeamer := git.NewTeamer(alice.tc.G)

	t.Logf("team that doesn't exist")
	res, err := aliceTeamer.LookupOrCreate(context.Background(), keybase1.Folder{
		Name:       "notateamxxx",
		Private:    true,
		FolderType: keybase1.FolderType_TEAM,
	})
	require.Error(t, err)
	require.IsType(t, teams.TeamDoesNotExistError{}, err, "%v", err)

	t.Logf("team that exists")
	teamID, teamName := tt.users[0].createTeam2()
	res, err = aliceTeamer.LookupOrCreate(context.Background(), keybase1.Folder{
		Name:       teamName.String(),
		Private:    true,
		FolderType: keybase1.FolderType_TEAM,
	})
	require.NoError(t, err)
	require.Equal(t, res.TeamID, teamID)
	require.Equal(t, res.Visibility, keybase1.TLFVisibility_PRIVATE)

	t.Logf("public team")
	_, teamName = tt.users[0].createTeam2()
	res, err = aliceTeamer.LookupOrCreate(context.Background(), keybase1.Folder{
		Name:       teamName.String(),
		Private:    false,
		FolderType: keybase1.FolderType_TEAM,
	})
	require.Error(t, err)
	require.Regexp(t, `not supported`, err.Error())

	for _, public := range []bool{false, true} {
		t.Logf("public:%v", public)

		visibility := keybase1.TLFVisibility_PRIVATE
		if public {
			visibility = keybase1.TLFVisibility_PUBLIC
		}

		folderType := keybase1.FolderType_PRIVATE
		if public {
			folderType = keybase1.FolderType_PUBLIC
		}

		t.Logf("iteam that doesn't exist (gets created)")
		bob := tt.addUser("bob")
		gil := tt.addUser("gil")
		frag := fmt.Sprintf("%v,%v#%v", alice.username, bob.username, gil.username)
		res, err = aliceTeamer.LookupOrCreate(context.Background(), keybase1.Folder{
			Name:       frag,
			Private:    !public,
			FolderType: folderType,
		})
		require.NoError(t, err)
		expectedTeamID, _, _, _, err := teams.LookupImplicitTeam(context.Background(), alice.tc.G, frag, public)
		require.NoError(t, err)
		require.Equal(t, public, expectedTeamID.IsPublic())
		require.Equal(t, expectedTeamID, res.TeamID, "teamer should have created a team that was then looked up")
		require.Equal(t, visibility, res.Visibility)

		t.Logf("iteam that already exists")
		bob = tt.addUser("bob")
		gil = tt.addUser("gil")
		frag = fmt.Sprintf("%v,%v#%v", alice.username, bob.username, gil.username)
		teamID, _, _, _, err = teams.LookupOrCreateImplicitTeam(context.Background(), alice.tc.G, frag, public)
		require.NoError(t, err)
		require.Equal(t, public, teamID.IsPublic())
		res, err = aliceTeamer.LookupOrCreate(context.Background(), keybase1.Folder{
			Name:       frag,
			Private:    !public,
			FolderType: folderType,
		})
		require.NoError(t, err)
		require.Equal(t, res.TeamID, teamID, "teamer should return the same team that was created earlier")
		require.Equal(t, visibility, res.Visibility)

		t.Logf("iteam conflict")
		alice.drainGregor()
		bob = tt.addUser("bob")
		iTeamNameCreate1 := strings.Join([]string{alice.username, bob.username}, ",")
		iTeamNameCreate2 := strings.Join([]string{alice.username, bob.username + "@rooter"}, ",")
		_, _, _, _, err = teams.LookupOrCreateImplicitTeam(context.Background(), alice.tc.G, iTeamNameCreate1, public)
		require.NoError(t, err)
		iTeamID2, _, _, _, err := teams.LookupOrCreateImplicitTeam(context.Background(), alice.tc.G, iTeamNameCreate2, public)
		require.NoError(t, err)
		require.Equal(t, public, iTeamID2.IsPublic())

		t.Logf("prove to create the conflict")
		bob.proveRooter()

		t.Logf("wait for someone to add bob")
		pollForConditionWithTimeout(t, 20*time.Second, "bob to be added to the team after rooter proof", func(ctx context.Context) bool {
			team, err := teams.Load(ctx, alice.tc.G, keybase1.LoadTeamArg{
				ID:          iTeamID2,
				Public:      public,
				ForceRepoll: true,
			})
			require.NoError(t, err)
			role, err := team.MemberRole(ctx, bob.userVersion())
			require.NoError(t, err)
			return role != keybase1.TeamRole_NONE
		})

		t.Logf("find out the conflict suffix")
		_, _, _, _, conflicts, err := teams.LookupImplicitTeamAndConflicts(context.Background(), alice.tc.G, iTeamNameCreate1, public)
		require.NoError(t, err)
		require.Len(t, conflicts, 1)
		t.Logf("check")
		res, err = aliceTeamer.LookupOrCreate(context.Background(), keybase1.Folder{
			Name:       iTeamNameCreate1 + " " + libkb.FormatImplicitTeamDisplayNameSuffix(conflicts[0]),
			Private:    !public,
			FolderType: folderType,
		})
		require.NoError(t, err)
		require.Equal(t, res.TeamID, iTeamID2, "teamer should return the old conflicted team")
		require.Equal(t, visibility, res.Visibility)
	}
}
