package chat

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
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
	tc.G.UIRouter = kbtest.NewMockUIRouter(chatUI)
	tc.ChatG.UIInboxLoader.(*UIInboxLoader).testingLayoutForceMode = true
	recvLayout := func() chat1.UIInboxLayout {
		select {
		case layout := <-chatUI.InboxLayoutCb:
			return layout
		case <-time.After(timeout):
			require.Fail(t, "no layout received")
		}
		return chat1.UIInboxLayout{}
	}

	t.Logf("basic")
	conv1 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[1])
	layout := recvLayout()
	require.Equal(t, 1, len(layout.SmallTeams))
	require.Equal(t, conv1.Id.String(), layout.SmallTeams[0].ConvID)
	conv2 := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[2])
	layout = recvLayout()
	require.Equal(t, 2, len(layout.SmallTeams))
	require.Equal(t, conv2.Id.String(), layout.SmallTeams[0].ConvID)
	require.Equal(t, conv1.Id.String(), layout.SmallTeams[1].ConvID)

	mustPostLocalForTest(t, ctc, users[0], conv2, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HI",
	}))
	select {
	case <-chatUI.InboxLayoutCb:
		require.Fail(t, "unexpected layout")
	default:
	}
	mustPostLocalForTest(t, ctc, users[0], conv1, chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "HI",
	}))
	layout = recvLayout()
	require.Equal(t, 2, len(layout.SmallTeams))
	require.Equal(t, conv1.Id.String(), layout.SmallTeams[0].ConvID)
	require.Equal(t, conv2.Id.String(), layout.SmallTeams[1].ConvID)
	_, err := ctc.as(t, users[0]).chatLocalHandler().SetConversationStatusLocal(ctx,
		chat1.SetConversationStatusLocalArg{
			ConversationID: conv1.Id,
			Status:         chat1.ConversationStatus_IGNORED,
		})
	require.NoError(t, err)
	layout = recvLayout()
	require.Equal(t, 1, len(layout.SmallTeams))
	require.Equal(t, conv2.Id.String(), layout.SmallTeams[0].ConvID)

	t.Logf("big teams")
	teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1], users[2])
	layout = recvLayout()
	require.Equal(t, 2, len(layout.SmallTeams))
	require.Equal(t, teamConv.Id.String(), layout.SmallTeams[0].ConvID)
	require.True(t, layout.SmallTeams[0].IsTeam)
	require.Equal(t, conv2.Id.String(), layout.SmallTeams[1].ConvID)
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

	for i := 0; i < 3; i++ {
		// layout 1: team type changed
		// layout 2: new conv
		// layout 3: big team unbox
		layout = recvLayout()
	}
	// there is a race where sometimes we need a fourth of these
	select {
	case layout = <-chatUI.InboxLayoutCb:
	case <-time.After(timeout):
		// charge forward
	}
	dat, _ := json.Marshal(layout)
	t.Logf("LAYOUT: %s", string(dat))
	require.Equal(t, 1, len(layout.SmallTeams))
	require.Equal(t, conv2.Id.String(), layout.SmallTeams[0].ConvID)
	require.Equal(t, 3, len(layout.BigTeams))
	st, err := layout.BigTeams[0].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_LABEL, st)
	require.Equal(t, teamConv.TlfName, layout.BigTeams[0].Label())
	st, err = layout.BigTeams[1].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_CHANNEL, st)
	require.Equal(t, teamConv.Id.String(), layout.BigTeams[1].Channel().ConvID)
	require.Equal(t, teamConv.TlfName, layout.BigTeams[1].Channel().Teamname)
	st, err = layout.BigTeams[2].State()
	require.NoError(t, err)
	require.Equal(t, chat1.UIInboxBigTeamRowTyp_CHANNEL, st)
	require.Equal(t, channel.Conv.GetConvID().String(), layout.BigTeams[2].Channel().ConvID)
	require.Equal(t, teamConv.TlfName, layout.BigTeams[2].Channel().Teamname)
	require.Equal(t, topicName, layout.BigTeams[2].Channel().Channelname)
}
