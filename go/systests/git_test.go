// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package systests

import (
	"context"
	"fmt"
	"strings"
	"testing"

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
	g := tt.users[0].tc.G

	teamer := git.NewTeamer(g)

	t.Logf("team that doesn't exist")
	res, err := teamer.LookupOrCreate(context.Background(), keybase1.Folder{
		Name:       "notateamxxx",
		Private:    true,
		FolderType: keybase1.FolderType_TEAM,
	})
	require.Error(t, err)
	require.IsType(t, teams.TeamDoesNotExistError{}, err, "%v", err)

	t.Logf("team that exists")
	teamID, teamName := tt.users[0].createTeam2()
	res, err = teamer.LookupOrCreate(context.Background(), keybase1.Folder{
		Name:       teamName.String(),
		Private:    true,
		FolderType: keybase1.FolderType_TEAM,
	})
	require.NoError(t, err)
	require.Equal(t, res.TeamID, teamID)
	require.Equal(t, res.Visibility, keybase1.TLFVisibility_PRIVATE)

	// CORE-6335 re-enable
	// t.Logf("public team")
	// teamID, teamName = tt.users[0].createTeam2()
	// res, err = teamer.LookupOrCreate(context.Background(), keybase1.Folder{
	// 	Name:       teamName.String(),
	// 	Private:    false,
	// 	FolderType: keybase1.FolderType_TEAM,
	// })
	// require.Error(t, err)
	// require.Regexp(t, `not supported`, err.Error())

	t.Logf("iteam that doesn't exist (gets created)")
	bob := tt.addUser("bob")
	gil := tt.addUser("gil")
	frag := fmt.Sprintf("%v,%v#%v", alice.username, bob.username, gil.username)
	res, err = teamer.LookupOrCreate(context.Background(), keybase1.Folder{
		Name:       frag,
		Private:    true,
		FolderType: keybase1.FolderType_PRIVATE,
	})
	require.NoError(t, err)
	expectedTeamID, _, _, err := teams.LookupImplicitTeam(context.Background(), g, frag, false /*isPublic*/)
	require.NoError(t, err)
	require.Equal(t, expectedTeamID, res.TeamID, "teamer should have created a team that was then looked up")
	require.Equal(t, res.Visibility, keybase1.TLFVisibility_PRIVATE)

	t.Logf("iteam that already exists")
	bob = tt.addUser("bob")
	gil = tt.addUser("gil")
	frag = fmt.Sprintf("%v,%v#%v", alice.username, bob.username, gil.username)
	teamID, _, _, err = teams.LookupOrCreateImplicitTeam(context.Background(), g, frag, false /*isPublic*/)
	res, err = teamer.LookupOrCreate(context.Background(), keybase1.Folder{
		Name:       frag,
		Private:    true,
		FolderType: keybase1.FolderType_PRIVATE,
	})
	require.NoError(t, err)
	require.Equal(t, res.TeamID, teamID, "teamer should return the same team that was created earlier")
	require.Equal(t, res.Visibility, keybase1.TLFVisibility_PRIVATE)

	// CORE-6335 re-enable
	// t.Logf("public iteam")
	// bob = tt.addUser("bob")
	// gil = tt.addUser("gil")
	// frag = fmt.Sprintf("%v,%v#%v", alice.username, bob.username, gil.username)
	// teamID, _, _, err = teams.LookupOrCreateImplicitTeam(context.Background(), g, frag, true /*isPublic*/)
	// res, err = teamer.LookupOrCreate(context.Background(), keybase1.Folder{
	// 	Name:       frag,
	// 	Private:    false,
	// 	FolderType: keybase1.FolderType_PUBLIC,
	// })
	// require.NoError(t, err)
	// require.Equal(t, res.TeamID, teamID, "teamer should return the same team that was created earlier")
	// require.Equal(t, res.Visibility, keybase1.TLFVisibility_PUBLIC)

	t.Logf("iteam conflict")
	alice.drainGregor()
	bob = tt.addUser("bob")
	iTeamNameCreate1 := strings.Join([]string{alice.username, bob.username}, ",")
	iTeamNameCreate2 := strings.Join([]string{alice.username, bob.username + "@rooter"}, ",")
	_, _, _, err = teams.LookupOrCreateImplicitTeam(context.TODO(), g, iTeamNameCreate1, false /*isPublic*/)
	require.NoError(t, err)
	iTeamID2, _, _, err := teams.LookupOrCreateImplicitTeam(context.TODO(), g, iTeamNameCreate2, false /*isPublic*/)
	require.NoError(t, err)
	t.Logf("prove to create the conflict")
	bob.proveRooter()
	alice.waitForTeamIDChangedGregor(iTeamID2, alice.getTeamSeqno(iTeamID2)+1)
	t.Logf("find out the conflict suffix")
	_, _, _, conflicts, err := teams.LookupImplicitTeamAndConflicts(context.TODO(), g, iTeamNameCreate1, false /*isPublic*/)
	require.NoError(t, err)
	require.Len(t, conflicts, 1)
	t.Logf("check")
	res, err = teamer.LookupOrCreate(context.Background(), keybase1.Folder{
		Name:       iTeamNameCreate1 + " " + libkb.FormatImplicitTeamDisplayNameSuffix(conflicts[0]),
		Private:    true,
		FolderType: keybase1.FolderType_PRIVATE,
	})
	require.NoError(t, err)
	require.Equal(t, res.TeamID, iTeamID2, "teamer should return the old conflicted team")
	require.Equal(t, res.Visibility, keybase1.TLFVisibility_PRIVATE)
}
