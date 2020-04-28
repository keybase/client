package chat

import (
	"errors"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type dummyUIRouter struct {
	libkb.UIRouter
}

func (d dummyUIRouter) GetChatUI() (libkb.ChatUI, error) {
	return nil, nil
}

func (d dummyUIRouter) Shutdown() {}

func TestBotCommandManager(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestBotCommandManager", 3)
	defer ctc.cleanup()

	timeout := 20 * time.Second
	users := ctc.users()
	listener := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener)
	tc := ctc.world.Tcs[users[0].Username]
	tc.G.UIRouter = dummyUIRouter{}
	tc1 := ctc.world.Tcs[users[1].Username]
	tc1.G.UIRouter = dummyUIRouter{}
	tc2 := ctc.world.Tcs[users[2].Username]
	tc2.G.UIRouter = dummyUIRouter{}
	ctx := ctc.as(t, users[0]).startCtx
	ctx1 := ctc.as(t, users[1]).startCtx
	ctx2 := ctc.as(t, users[2]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	botua := users[2]
	t.Logf("uid: %s", uid)
	listener0 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)

	impConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	impConv1 := mustCreateConversationForTest(t, ctc, users[1], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[0])
	t.Logf("impconv: %s", impConv.Id)
	t.Logf("impconv1: %s", impConv1.Id)
	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM)
	t.Logf("teamconv: %x", teamConv.Id.DbShortForm())

	// test public
	alias := "MIKE BOT"
	commands := []chat1.AdvertiseCommandsParam{
		{
			Typ: chat1.BotCommandsAdvertisementTyp_PUBLIC,
			Commands: []chat1.UserBotCommandInput{
				{
					Name:        "status",
					Description: "get status",
					Usage:       "just type it",
				},
			},
		},
	}
	require.NoError(t, tc.Context().BotCommandManager.Advertise(ctx, &alias, commands))
	cmds, _, err := tc.Context().BotCommandManager.ListCommands(ctx, impConv.Id)
	require.NoError(t, err)
	require.Zero(t, len(cmds))

	errCh, err := tc.Context().BotCommandManager.UpdateCommands(ctx, impConv.Id, nil)
	require.NoError(t, err)

	errCh1, err := tc1.Context().BotCommandManager.UpdateCommands(ctx1, impConv1.Id, nil)
	require.NoError(t, err)

	readErrCh := func(errCh chan error) error {
		select {
		case err := <-errCh:
			return err
		case <-time.After(timeout):
			return errors.New("timeout")
		}
	}
	select {
	case convID := <-listener0.convUpdate:
		require.Equal(t, impConv.Id, convID)
	case <-time.After(timeout):
		require.Fail(t, "no stale")
	}
	impConvLocal, err := utils.GetVerifiedConv(ctx, tc.Context(), uid, impConv.Id,
		types.InboxSourceDataSourceAll)
	require.NoError(t, err)
	typ, err := impConvLocal.BotCommands.Typ()
	require.NoError(t, err)
	require.Equal(t, chat1.ConversationCommandGroupsTyp_CUSTOM, typ)
	require.Equal(t, 1, len(impConvLocal.BotCommands.Custom().Commands))
	require.Equal(t, "status", impConvLocal.BotCommands.Custom().Commands[0].Name)
	require.NoError(t, readErrCh(errCh))
	cmds, _, err = tc.Context().BotCommandManager.ListCommands(ctx, impConv.Id)
	require.NoError(t, err)
	require.Equal(t, 1, len(cmds))
	require.Equal(t, "status", cmds[0].Name)

	//make sure the cmds are cached
	for i := 0; i < 5; i++ {
		errCh, err = tc.Context().BotCommandManager.UpdateCommands(ctx, impConv.Id, nil)
		require.NoError(t, err)
		require.NoError(t, readErrCh(errCh))
	}
	select {
	case <-listener0.convUpdate:
		require.Fail(t, "commands not cached")
	default:
	}

	require.NoError(t, readErrCh(errCh1))
	cmds, _, err = tc1.Context().BotCommandManager.ListCommands(ctx1, impConv1.Id)
	require.NoError(t, err)
	require.Equal(t, 1, len(cmds))
	require.Equal(t, "status", cmds[0].Name)

	// test team
	teamID, err := keybase1.TeamIDFromString(teamConv.Triple.Tlfid.String())
	require.NoError(t, err)
	pollForSeqno := func(expectedSeqno keybase1.Seqno) {
		found := false
		for !found {
			select {
			case teamChange := <-listener.teamChangedByID:
				found = teamChange.TeamID == teamID &&
					teamChange.LatestSeqno == expectedSeqno
			case <-time.After(20 * time.Second):
				require.Fail(t, "no event received")
			}
		}
	}

	commands = append(commands, chat1.AdvertiseCommandsParam{
		Typ: chat1.BotCommandsAdvertisementTyp_TLFID_CONVS,
		Commands: []chat1.UserBotCommandInput{{
			Name: "teamconvonly",
		}},
		TeamName: &teamConv.TlfName,
	}, chat1.AdvertiseCommandsParam{
		Typ: chat1.BotCommandsAdvertisementTyp_TLFID_MEMBERS,
		Commands: []chat1.UserBotCommandInput{{
			Name: "teammembsonly",
		}},
		TeamName: &teamConv.TlfName,
	}, chat1.AdvertiseCommandsParam{
		Typ: chat1.BotCommandsAdvertisementTyp_CONV,
		Commands: []chat1.UserBotCommandInput{{
			Name: "conv",
		}},
		ConvID: &teamConv.Id,
	})
	require.NoError(t, tc.Context().BotCommandManager.Advertise(ctx, &alias, commands))

	errCh, err = tc.Context().BotCommandManager.UpdateCommands(ctx, impConv.Id, nil)
	require.NoError(t, err)
	require.NoError(t, readErrCh(errCh))

	errChT, err := tc.Context().BotCommandManager.UpdateCommands(ctx, teamConv.Id, nil)
	require.NoError(t, err)
	require.NoError(t, readErrCh(errChT))

	errCh1, err = tc1.Context().BotCommandManager.UpdateCommands(ctx, impConv1.Id, nil)
	require.NoError(t, err)
	require.NoError(t, readErrCh(errCh1))

	cmds, _, err = tc.Context().BotCommandManager.ListCommands(ctx, impConv.Id)
	require.NoError(t, err)
	require.Equal(t, 2, len(cmds))
	cmds, _, err = tc.Context().BotCommandManager.ListCommands(ctx, teamConv.Id)
	require.NoError(t, err)
	require.Equal(t, 4, len(cmds))
	cmds, _, err = tc1.Context().BotCommandManager.ListCommands(ctx1, impConv1.Id)
	require.NoError(t, err)
	require.Equal(t, 1, len(cmds))

	err = ctc.as(t, users[0]).chatLocalHandler().AddBotMember(ctx, chat1.AddBotMemberArg{
		ConvID:      teamConv.Id,
		Username:    botua.Username,
		Role:        keybase1.TeamRole_RESTRICTEDBOT,
		BotSettings: &keybase1.TeamBotSettings{Cmds: true},
	})
	require.NoError(t, err)
	require.NoError(t, tc2.Context().BotCommandManager.Advertise(ctx2, &alias, commands))
	pollForSeqno(3)

	errChT, err = tc.Context().BotCommandManager.UpdateCommands(ctx, teamConv.Id, nil)
	require.NoError(t, err)
	require.NoError(t, readErrCh(errChT))

	cmds, _, err = tc.Context().BotCommandManager.ListCommands(ctx, teamConv.Id)
	require.NoError(t, err)
	require.Equal(t, 8, len(cmds))

	// impteams can't advertise on team types
	commands = append(commands, chat1.AdvertiseCommandsParam{
		Typ: chat1.BotCommandsAdvertisementTyp_TLFID_CONVS,
		Commands: []chat1.UserBotCommandInput{{
			Name: "teamconvonly_implicit",
		}},
		TeamName: &impConv.TlfName,
	})
	require.Error(t, tc.Context().BotCommandManager.Advertise(ctx, &alias, commands))
}
