package chat

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestJourneycardStorage(t *testing.T) {
	ctx, world, ri, _, sender, _ := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	conv := newBlankConv(ctx, t, tc, uid, ri, sender, u.Username)
	mkctx := func() context.Context { return libkb.WithLogTag(context.Background(), "TST") }

	t.Logf("setup complete")
	tc.ChatG.JourneyCardManager.SentMessage(mkctx(), uid, conv.GetConvID())
	t.Logf("sent message")
	js, err := tc.ChatG.JourneyCardManager.(*JourneyCardManager).get(mkctx(), uid)
	require.NoError(t, err)
	jcd, err := js.getConvData(mkctx(), conv.GetConvID())
	require.NoError(t, err)
	require.True(t, jcd.SentMessage)

	t.Logf("switch users")
	uid2kb, err := keybase1.UIDFromString("295a7eea607af32040647123732bc819")
	require.NoError(t, err)
	uid2 := gregor1.UID(uid2kb.ToBytes())
	js, err = tc.ChatG.JourneyCardManager.(*JourneyCardManager).get(mkctx(), uid2)
	require.NoError(t, err)
	jcd, err = js.getConvData(mkctx(), conv.GetConvID())
	require.NoError(t, err)
	require.False(t, jcd.SentMessage)

	t.Logf("switch back")
	js, err = tc.ChatG.JourneyCardManager.(*JourneyCardManager).get(mkctx(), uid)
	require.NoError(t, err)
	jcd, err = js.getConvData(mkctx(), conv.GetConvID())
	require.NoError(t, err)
	require.True(t, jcd.SentMessage)
}

func TestJourneycardDismiss(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestBotCommandManager", 2)
	defer ctc.cleanup()

	users := ctc.users()
	tc0 := ctc.world.Tcs[users[0].Username]
	ctx0 := ctc.as(t, users[0]).startCtx
	uid0 := gregor1.UID(users[0].GetUID().ToBytes())
	t.Logf("uid0: %s", uid0)
	tc1 := ctc.world.Tcs[users[1].Username]
	ctx1 := ctc.as(t, users[1]).startCtx
	uid1 := gregor1.UID(users[1].GetUID().ToBytes())
	_ = tc1
	_ = ctx1
	t.Logf("uid1: %s", uid1)

	// teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
	// 	chat1.ConversationMembersType_TEAM)
	// t.Logf("teamconv: %x", teamConv.Id.DbShortForm())
	// teamID, err := keybase1.TeamIDFromString(teamConv.Triple.Tlfid.String())
	// require.NoError(t, err)

	teamName := users[0].Username + "t"
	teamIDx, err := teams.CreateRootTeam(ctx0, tc0.G, teamName, keybase1.TeamSettings{})
	require.NoError(t, err)
	teamID := *teamIDx

	_, err = teams.AddMemberByID(ctx0, tc0.G, teamID, users[1].Username, keybase1.TeamRole_OWNER, nil)
	require.NoError(t, err)

	tlfID := chat1.TLFID(teamID.ToBytes())
	inbox, err := tc0.ChatG.InboxSource.ReadUnverified(ctx0, uid0, types.InboxSourceDataSourceAll, &chat1.GetInboxQuery{TlfID: &tlfID})
	require.NoError(t, err)
	require.Len(t, inbox.ConvsUnverified, 1)
	convID := inbox.ConvsUnverified[0].GetConvID()

	thread, err := tc1.ChatG.ConvSource.Pull(ctx1, convID, uid1,
		chat1.GetThreadReason_GENERAL, nil, nil)
	require.NoError(t, err)
	t.Logf("messages: %v", chat1.MessageUnboxedDebugList(thread.Messages))
}
