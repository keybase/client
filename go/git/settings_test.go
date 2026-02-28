package git

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestSettings(t *testing.T) {
	tc := SetupTest(t, "settings", 1)
	defer tc.Cleanup()

	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	teamName := u.Username + "t1"
	_, err = teams.CreateRootTeam(context.Background(), tc.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)

	repoName := "repoName"
	repoID := "abc123"
	doPut(t, tc.G, teamName, repoID, repoName)
	folder := keybase1.FolderHandle{
		Name:       teamName,
		FolderType: keybase1.FolderType_TEAM,
	}

	arg := keybase1.GetTeamRepoSettingsArg{
		Folder: folder,
		RepoID: keybase1.RepoID(repoID),
	}
	settings, err := GetTeamRepoSettings(context.Background(), tc.G, arg)
	require.NoError(t, err)

	require.False(t, settings.ChatDisabled)
	require.NotNil(t, settings.ChannelName)
	require.Equal(t, globals.DefaultTeamTopic, *settings.ChannelName)

	setArg := keybase1.SetTeamRepoSettingsArg{
		Folder:       folder,
		RepoID:       keybase1.RepoID(repoID),
		ChatDisabled: true,
	}
	err = SetTeamRepoSettings(context.Background(), tc.G, setArg)
	require.NoError(t, err)

	settings, err = GetTeamRepoSettings(context.Background(), tc.G, arg)
	require.NoError(t, err)
	require.True(t, settings.ChatDisabled)
	require.Nil(t, settings.ChannelName)

	// create a channel and change the settings to use it
	require.NotNil(t, tc.G.ChatHelper)
	channelName := "git"
	err = tc.G.ChatHelper.SendTextByName(context.Background(), teamName, &channelName, chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, "hello")
	require.NoError(t, err)

	setArg = keybase1.SetTeamRepoSettingsArg{
		Folder:       folder,
		RepoID:       keybase1.RepoID(repoID),
		ChatDisabled: false,
		ChannelName:  &channelName,
	}
	err = SetTeamRepoSettings(context.Background(), tc.G, setArg)
	require.NoError(t, err)

	settings, err = GetTeamRepoSettings(context.Background(), tc.G, arg)
	require.NoError(t, err)
	require.False(t, settings.ChatDisabled)
	require.NotNil(t, settings.ChannelName)
	require.Equal(t, "git", *settings.ChannelName)
}
