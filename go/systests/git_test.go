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
	res, err := aliceTeamer.LookupOrCreate(context.Background(), keybase1.FolderHandle{
		Name:       "notateamxxx",
		FolderType: keybase1.FolderType_TEAM,
	})
	require.Error(t, err)
	require.IsType(t, teams.TeamDoesNotExistError{}, err, "%v", err)

	t.Logf("team that exists")
	teamID, teamName := tt.users[0].createTeam2()
	res, err = aliceTeamer.LookupOrCreate(context.Background(), keybase1.FolderHandle{
		Name:       teamName.String(),
		FolderType: keybase1.FolderType_TEAM,
	})
	require.NoError(t, err)
	require.Equal(t, res.TeamID, teamID)
	require.Equal(t, res.Visibility, keybase1.TLFVisibility_PRIVATE)

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
		res, err = aliceTeamer.LookupOrCreate(context.Background(), keybase1.FolderHandle{
			Name:       frag,
			FolderType: folderType,
		})
		require.NoError(t, err)
		expectedTeam, _, _, err := teams.LookupImplicitTeam(context.Background(), alice.tc.G, frag, public, teams.ImplicitTeamOptions{})
		require.NoError(t, err)
		require.Equal(t, public, expectedTeam.ID.IsPublic())
		require.Equal(t, expectedTeam.ID, res.TeamID,
			"teamer should have created a team that was then looked up")
		require.Equal(t, visibility, res.Visibility)

		t.Logf("iteam that already exists")
		bob = tt.addUser("bob")
		gil = tt.addUser("gil")
		frag = fmt.Sprintf("%v,%v#%v", alice.username, bob.username, gil.username)
		team, _, _, err := teams.LookupOrCreateImplicitTeam(context.Background(), alice.tc.G, frag, public)
		require.NoError(t, err)
		require.Equal(t, public, team.ID.IsPublic())
		res, err = aliceTeamer.LookupOrCreate(context.Background(), keybase1.FolderHandle{
			Name:       frag,
			FolderType: folderType,
		})
		require.NoError(t, err)
		require.Equal(t, res.TeamID, team.ID, "teamer should return the same team that was created earlier")
		require.Equal(t, visibility, res.Visibility)

		t.Logf("iteam conflict")
		alice.drainGregor()
		bob = tt.addUser("bob")
		iTeamNameCreate1 := strings.Join([]string{alice.username, bob.username}, ",")
		iTeamNameCreate2 := strings.Join([]string{alice.username, bob.username + "@rooter"}, ",")
		_, _, _, err = teams.LookupOrCreateImplicitTeam(context.Background(), alice.tc.G, iTeamNameCreate1, public)
		require.NoError(t, err)
		iTeam2, _, _, err := teams.LookupOrCreateImplicitTeam(context.Background(), alice.tc.G, iTeamNameCreate2, public)
		require.NoError(t, err)
		require.Equal(t, public, iTeam2.ID.IsPublic())

		t.Logf("prove to create the conflict")
		bob.proveRooter()

		t.Logf("wait for someone to add bob")
		pollForConditionWithTimeout(t, 20*time.Second, "bob to be added to the team after rooter proof", func(ctx context.Context) bool {
			team, err := teams.Load(ctx, alice.tc.G, keybase1.LoadTeamArg{
				ID:          iTeam2.ID,
				Public:      public,
				ForceRepoll: true,
			})
			require.NoError(t, err)
			role, err := team.MemberRole(ctx, bob.userVersion())
			require.NoError(t, err)
			return role != keybase1.TeamRole_NONE
		})

		t.Logf("find out the conflict suffix")
		_, _, _, conflicts, err := teams.LookupImplicitTeamAndConflicts(context.Background(), alice.tc.G, iTeamNameCreate1, public, teams.ImplicitTeamOptions{})
		require.NoError(t, err)
		require.Len(t, conflicts, 1)
		t.Logf("check")
		res, err = aliceTeamer.LookupOrCreate(context.Background(), keybase1.FolderHandle{
			Name:       iTeamNameCreate1 + " " + libkb.FormatImplicitTeamDisplayNameSuffix(conflicts[0]),
			FolderType: folderType,
		})
		require.NoError(t, err)
		require.Equal(t, res.TeamID, iTeam2.ID, "teamer should return the old conflicted team")
		require.Equal(t, visibility, res.Visibility)
	}
}
