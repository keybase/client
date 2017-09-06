// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package git

import (
	"context"
	"testing"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

// Copied from the teams tests.
func SetupTest(tb testing.TB, name string, depth int) (tc libkb.TestContext) {
	tc = libkb.SetupTest(tb, name, depth+1)
	tc.G.SetServices(externals.GetServices())
	teams.NewTeamLoaderAndInstall(tc.G)
	return tc
}

func doPut(t *testing.T, g *libkb.GlobalContext, teamName string, repoID string, repoName string) {
	err := PutMetadata(context.TODO(), g, keybase1.PutGitMetadataArg{
		Folder: keybase1.Folder{
			Name:       teamName,
			Private:    true,
			FolderType: keybase1.FolderType_TEAM,
		},
		RepoID: keybase1.RepoID(repoID),
		Metadata: keybase1.GitLocalMetadata{
			RepoName: keybase1.GitRepoName(repoName),
		},
	})
	require.NoError(t, err)
}

func TestPutAndGet(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	// Note that the length limit for a team name, with the additional suffix
	// below, is 16 characters. We have 5 to play with, including the implicit
	// underscore after the prefix.
	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	// Create two teams, so that we can test filtering by TeamID.
	teamName1 := u.Username + "t1"
	err = teams.CreateRootTeam(context.TODO(), tc.G, teamName1)
	require.NoError(t, err)

	teamName2 := u.Username + "t2"
	err = teams.CreateRootTeam(context.TODO(), tc.G, teamName2)
	require.NoError(t, err)

	// Create two git repos, one in each team. Remember that all we're
	// "creating" here is metadata.
	doPut(t, tc.G, teamName1, "abc123", "repoNameFirst")
	doPut(t, tc.G, teamName2, "def456", "repoNameSecond")
	expectedIDNames := map[string]string{
		"abc123": "repoNameFirst",
		"def456": "repoNameSecond",
	}

	// Get all repos, and make sure both come back.
	allRepos, err := GetAllMetadata(context.Background(), tc.G)
	require.NoError(t, err)
	require.Equal(t, 2, len(allRepos), "expected to get both repos back, found: %d", len(allRepos))
	for _, repo := range allRepos {
		require.Equal(t, expectedIDNames[string(repo.RepoID)], string(repo.LocalMetadata.RepoName))
		require.Equal(t, repo.Folder.FolderType, keybase1.FolderType_TEAM)
		require.Equal(t, repo.Folder.Private, true)
		require.Equal(t, repo.ServerMetadata.LastModifyingUsername, u.Username)
	}

	// Now get the repos for just one team. Should be only one of the two we just created.
	oneRepo, err := GetMetadata(context.Background(), tc.G, keybase1.Folder{
		Name:       teamName1,
		Private:    true,
		FolderType: keybase1.FolderType_TEAM,
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(oneRepo), "expected to get only one repo back, found: %d", len(oneRepo))
	require.Equal(t, "repoNameFirst", string(oneRepo[0].LocalMetadata.RepoName))
}

func TestPutAndGetImplicitTeam(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	u1, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)
	u2, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	repoName := "implicit repo foo bar"
	err = PutMetadata(context.TODO(), tc.G, keybase1.PutGitMetadataArg{
		Folder: keybase1.Folder{
			Name:       u1.Username + "," + u2.Username,
			Private:    true,
			FolderType: keybase1.FolderType_PRIVATE,
		},
		RepoID: keybase1.RepoID("abc123"),
		Metadata: keybase1.GitLocalMetadata{
			RepoName: keybase1.GitRepoName(repoName),
		},
	})
	require.NoError(t, err)

	allRepos, err := GetAllMetadata(context.Background(), tc.G)
	require.NoError(t, err)
	require.Equal(t, 1, len(allRepos))
	repo := allRepos[0]
	require.Equal(t, repoName, string(repo.LocalMetadata.RepoName))
	require.Equal(t, keybase1.FolderType_PRIVATE, repo.Folder.FolderType)
	require.Equal(t, true, repo.Folder.Private)
}
