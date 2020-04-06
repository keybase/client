package chat

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestUIInboxLoaderLayout(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestUIInboxLoaderLayout", 3)
	defer ctc.cleanup()
	timeout := 2 * time.Second

	users := ctc.users()
	chatUI := kbtest.NewChatUI()
	ctx := ctc.as(t, users[0]).startCtx
	tc := ctc.world.Tcs[users[0].Username]
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	tc.G.UIRouter = kbtest.NewMockUIRouter(chatUI)
	tc.ChatG.UIInboxLoader = NewUIInboxLoader(tc.Context())
	tc.ChatG.UIInboxLoader.Start(ctx, uid)
	defer func() { <-tc.ChatG.UIInboxLoader.Stop(ctx) }()
	tc.ChatG.UIInboxLoader.(*UIInboxLoader).testingLayoutForceMode = true
	tc.ChatG.UIInboxLoader.(*UIInboxLoader).batchDelay = time.Hour
	recvLayout := func() chat1.UIInboxLayout {
		select {
		case layout := <-chatUI.InboxLayoutCb:
			return layout
		case <-time.After(timeout):
			require.Fail(t, "no layout received")
		}
		return chat1.UIInboxLayout{}
	}
	consumeAllLayout := func() chat1.UIInboxLayout {
		var layout chat1.UIInboxLayout
		for {
			select {
			case layout = <-chatUI.InboxLayoutCb:
			case <-time.After(timeout):
				return layout
			}
		}
	}

	var layout chat1.UIInboxLayout
	t.Logf("basic")
	conv1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[1])
	for i := 0; i < 2; i++ {
		layout = recvLayout()
		require.Equal(t, 1, len(layout.SmallTeams))
		require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	}
	conv2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[2])
	for i := 0; i < 2; i++ {
		layout = recvLayout()
		require.Equal(t, 2, len(layout.SmallTeams))
		require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
		require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	}
	select {
	case <-chatUI.InboxLayoutCb:
		require.Fail(t, "unexpected layout")
	default:
	}

	// no layout is expected here, since the conv is in the layout (since we created it)
	t.Logf("resmsgID: %d",
		mustPostLocalForTest(t, ctc, users[0], conv2, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HI",
		})))
	select {
	case <-chatUI.InboxLayoutCb:
		require.Fail(t, "unexpected layout")
	default:
	}
	mustPostLocalForTest(t, ctc, users[0], conv1, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HI",
	}))
	// just one here, since the local update gets this into the top slot (we might get a second, so wait
	// for it a bit (there is a race between the layout sending up to UI, and remote notification coming
	// in)
	layout = recvLayout()
	require.Equal(t, 2, len(layout.SmallTeams))
	require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	select {
	case layout = <-chatUI.InboxLayoutCb:
		require.Equal(t, 2, len(layout.SmallTeams))
		require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
		require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	case <-time.After(timeout):
		// just don't care if we don't get anything
	}

	// just one here, since we are now on msg ID 3
	t.Logf("resmsgID: %d",
		mustPostLocalForTest(t, ctc, users[0], conv2, chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HI",
		})))
	layout = recvLayout()
	require.Equal(t, 2, len(layout.SmallTeams))
	require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	select {
	case layout = <-chatUI.InboxLayoutCb:
		require.Equal(t, 2, len(layout.SmallTeams))
		require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
		require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	case <-time.After(timeout):
		// just don't care if we don't get anything
	}
	_, err := ctc.as(t, users[0]).chatLocalHandler().SetConversationStatusLocal(ctx,
		chat1.SetConversationStatusLocalArg{
			ConversationID: conv1.Id,
			Status:         chat1.ConversationStatus_IGNORED,
		})
	require.NoError(t, err)
	// get two here
	for i := 0; i < 2; i++ {
		layout = recvLayout()
		require.Equal(t, 1, len(layout.SmallTeams))
		require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	}
	select {
	case <-chatUI.InboxLayoutCb:
		require.Fail(t, "unexpected layout")
	default:
	}

	t.Logf("big teams")
	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1], users[2])
	layout = recvLayout()
	require.Equal(t, 2, len(layout.SmallTeams))
	require.Equal(t, teamConv.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	require.True(t, layout.SmallTeams[0].IsTeam)
	require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[1].ConvID)
	topicName := "mike"
	channel, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
		chat1.NewConversationLocalArg{
			TlfName:       teamConv.TlfName,
			TopicName:     &topicName,
			TopicType:     chat1.TopicType_CHAT,
			TlfVisibility: keybase1.TLFVisibility_PRIVATE,
			MembersType:   chat1.ConversationMembersType_TEAM,
		})
	require.NoError(t, err)

	layout = consumeAllLayout()
	dat, _ := json.Marshal(layout)
	t.Logf("LAYOUT: %s", string(dat))
	require.Equal(t, 1, len(layout.SmallTeams))
	require.Equal(t, conv2.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	require.Equal(t, 3, len(layout.BigTeams))
	st, err := layout.BigTeams[0].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_LABEL, st)
	require.Equal(t, teamConv.TlfName, layout.BigTeams[0].Label().Name)
	require.Equal(t, teamConv.Triple.Tlfid.TLFIDStr(), layout.BigTeams[0].Label().Id)
	st, err = layout.BigTeams[1].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_CHANNEL, st)
	require.Equal(t, teamConv.Id.ConvIDStr(), layout.BigTeams[1].Channel().ConvID)
	require.Equal(t, teamConv.TlfName, layout.BigTeams[1].Channel().Teamname)
	st, err = layout.BigTeams[2].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_CHANNEL, st)
	require.Equal(t, channel.Conv.GetConvID().ConvIDStr(), layout.BigTeams[2].Channel().ConvID)
	require.Equal(t, teamConv.TlfName, layout.BigTeams[2].Channel().Teamname)
	require.Equal(t, topicName, layout.BigTeams[2].Channel().Channelname)
}

func TestUIInboxLoaderReselect(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestUIInboxLoaderReselect", 2)
	defer ctc.cleanup()
	timeout := 2 * time.Second

	users := ctc.users()
	chatUI := kbtest.NewChatUI()
	ctx := ctc.as(t, users[0]).startCtx
	tc := ctc.world.Tcs[users[0].Username]
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	tc.G.UIRouter = kbtest.NewMockUIRouter(chatUI)
	tc.ChatG.UIInboxLoader = NewUIInboxLoader(tc.Context())
	tc.ChatG.UIInboxLoader.Start(ctx, uid)
	defer func() { <-tc.ChatG.UIInboxLoader.Stop(ctx) }()
	tc.ChatG.UIInboxLoader.(*UIInboxLoader).testingLayoutForceMode = true
	tc.ChatG.UIInboxLoader.(*UIInboxLoader).batchDelay = time.Hour

	recvLayout := func() chat1.UIInboxLayout {
		select {
		case layout := <-chatUI.InboxLayoutCb:
			return layout
		case <-time.After(timeout):
			require.Fail(t, "no layout received")
		}
		return chat1.UIInboxLayout{}
	}
	consumeAllLayout := func() chat1.UIInboxLayout {
		var layout chat1.UIInboxLayout
		for {
			select {
			case layout = <-chatUI.InboxLayoutCb:
			case <-time.After(timeout):
				return layout
			}
		}
	}

	var layout chat1.UIInboxLayout
	conv1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	for i := 0; i < 2; i++ {
		layout = recvLayout()
		require.Equal(t, 1, len(layout.SmallTeams))
		require.Equal(t, conv1.Id.ConvIDStr(), layout.SmallTeams[0].ConvID)
	}
	tc.Context().Syncer.SelectConversation(ctx, conv1.Id)

	topicName := "mike"
	channel, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
		chat1.NewConversationLocalArg{
			TlfName:     conv1.TlfName,
			TopicType:   chat1.TopicType_CHAT,
			TopicName:   &topicName,
			MembersType: chat1.ConversationMembersType_TEAM,
		})
	require.NoError(t, err)

	// there is a race where sometimes we need a third or fourth of these
	layout = consumeAllLayout()
	require.Nil(t, layout.ReselectInfo)
	require.Equal(t, 3, len(layout.BigTeams))
	st, err := layout.BigTeams[0].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_LABEL, st)
	require.Equal(t, conv1.TlfName, layout.BigTeams[0].Label().Name)
	require.Equal(t, conv1.Triple.Tlfid.TLFIDStr(), layout.BigTeams[0].Label().Id)
	st, err = layout.BigTeams[1].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_CHANNEL, st)
	require.Equal(t, conv1.Id.ConvIDStr(), layout.BigTeams[1].Channel().ConvID)
	require.Equal(t, conv1.TlfName, layout.BigTeams[1].Channel().Teamname)
	st, err = layout.BigTeams[2].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_CHANNEL, st)
	require.Equal(t, channel.Conv.GetConvID().ConvIDStr(), layout.BigTeams[2].Channel().ConvID)
	require.Equal(t, conv1.TlfName, layout.BigTeams[2].Channel().Teamname)
	require.Equal(t, topicName, layout.BigTeams[2].Channel().Channelname)

	select {
	case <-chatUI.InboxLayoutCb:
		require.Fail(t, "unexpected layout")
	default:
	}
	tc.Context().Syncer.SelectConversation(ctx, channel.Conv.GetConvID())
	_, err = ctc.as(t, users[0]).chatLocalHandler().DeleteConversationLocal(ctx,
		chat1.DeleteConversationLocalArg{
			ConvID:      channel.Conv.GetConvID(),
			ChannelName: channel.Conv.GetTopicName(),
			Confirmed:   true,
		})
	require.NoError(t, err)

	layout = consumeAllLayout()
	require.Equal(t, 1, len(layout.SmallTeams))
	require.Zero(t, len(layout.BigTeams))
	require.NotNil(t, layout.ReselectInfo)
	require.NotNil(t, layout.ReselectInfo.NewConvID)
	require.Equal(t, conv1.Id.ConvIDStr(), *layout.ReselectInfo.NewConvID)
}
