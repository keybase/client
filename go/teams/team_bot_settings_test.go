package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamBotSettings(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 4)
	defer cleanup()

	t.Logf("create team")
	teamName, teamID := createTeam2(*tcs[0])
	m := make([]libkb.MetaContext, 4)
	for i, tc := range tcs {
		m[i] = libkb.NewMetaContextForTest(*tc)
	}
	rBotua1, rBotua2 := fus[1], fus[2]
	botua := fus[3]
	rBotua1UV, rBotua2UV, botuaUV := rBotua1.GetUserVersion(), rBotua2.GetUserVersion(), botua.GetUserVersion()

	t.Logf("empty bot state")
	botSettings1 := keybase1.TeamBotSettings{Cmds: true}
	_, err := AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), rBotua1.Username, keybase1.TeamRole_RESTRICTEDBOT, &botSettings1)
	require.NoError(t, err)

	botSettings2 := keybase1.TeamBotSettings{Cmds: true}
	_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), rBotua2.Username, keybase1.TeamRole_RESTRICTEDBOT, &botSettings2)
	require.NoError(t, err)

	_, err = AddMember(m[0].Ctx(), tcs[0].G, teamName.String(), botua.Username, keybase1.TeamRole_BOT, nil)
	require.NoError(t, err)

	team, err := Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	teamBotSettings, err := team.TeamBotSettings()
	require.NoError(t, err)
	// Defaults without a bot settings link
	expectedBots := map[keybase1.UserVersion]keybase1.TeamBotSettings{
		rBotua1UV: botSettings1,
		rBotua2UV: botSettings2,
	}
	require.Len(t, teamBotSettings, 2)

	// happy paths
	botSettings1 = keybase1.TeamBotSettings{
		Cmds:     true,
		Mentions: true,
		Triggers: []string{"shipit"},
		Convs:    []string{chat1.ConversationID([]byte("convo")).String()},
	}
	err = team.PostTeamBotSettings(context.TODO(), map[keybase1.UserVersion]keybase1.TeamBotSettings{
		rBotua1UV: botSettings1,
	})
	require.NoError(t, err)

	team, err = Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	teamBotSettings, err = team.TeamBotSettings()
	require.NoError(t, err)
	expectedBots[rBotua1UV] = botSettings1
	require.Equal(t, expectedBots, teamBotSettings)

	// update settings
	botSettings1 = keybase1.TeamBotSettings{Cmds: true}
	expectedBots[rBotua1UV] = botSettings1
	err = team.PostTeamBotSettings(context.TODO(), expectedBots)
	require.NoError(t, err)

	team, err = Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	teamBotSettings, err = team.TeamBotSettings()
	require.NoError(t, err)
	require.Equal(t, expectedBots, teamBotSettings)

	// add a second bot
	settings2 := keybase1.TeamBotSettings{Cmds: true}
	expectedBots = map[keybase1.UserVersion]keybase1.TeamBotSettings{
		rBotua2UV: settings2,
	}
	err = team.PostTeamBotSettings(context.TODO(), expectedBots)
	require.NoError(t, err)

	team, err = Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	teamBotSettings, err = team.TeamBotSettings()
	require.NoError(t, err)
	expectedBots[rBotua1UV] = botSettings1
	require.Equal(t, expectedBots, teamBotSettings)

	// Role change for rBotua1, they get nuked from the bot settings
	err = SetRoleBot(context.TODO(), tcs[0].G, team.Name().String(), rBotua1.Username)
	require.NoError(t, err)
	team, err = Load(context.TODO(), tcs[0].G, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	teamBotSettings, err = team.TeamBotSettings()
	require.NoError(t, err)
	delete(expectedBots, rBotua1UV)
	require.Equal(t, expectedBots, teamBotSettings)

	// sad paths
	// must specify a restricted-bot member but botua is a BOT
	expectedBots = map[keybase1.UserVersion]keybase1.TeamBotSettings{
		botuaUV: keybase1.TeamBotSettings{},
	}
	err = team.PostTeamBotSettings(context.TODO(), expectedBots)
	require.Error(t, err)
	require.IsType(t, PrecheckAppendError{}, err)

	// bad trigger regex
	expectedBots[rBotua1UV] = keybase1.TeamBotSettings{Triggers: []string{"*"}}
	err = team.PostTeamBotSettings(context.TODO(), expectedBots)
	require.Error(t, err)

	// bad conv ids
	expectedBots[rBotua1UV] = keybase1.TeamBotSettings{Convs: []string{"not hex"}}
	err = team.PostTeamBotSettings(context.TODO(), expectedBots)
	require.Error(t, err)
}
