package chat

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTeamChannelSource(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// Only run this test for teams
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}

		ctc := makeChatTestContext(t, "TestTeamChannelSource", 2)
		defer ctc.cleanup()
		users := ctc.users()

		ctx1 := ctc.as(t, users[0]).startCtx
		//ctx2 := ctc.as(t, users[1]).startCtx
		listener1 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener1)
		listener2 := newServerChatListener()
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener2)
		ui := kbtest.NewChatUI()
		ctc.as(t, users[0]).h.mockChatUI = ui
		ctc.as(t, users[1]).h.mockChatUI = ui
		ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true
		ctc.world.Tcs[users[1].Username].ChatG.Syncer.(*Syncer).isConnected = true
		uid1 := users[0].User.GetUID().ToBytes()
		g1 := ctc.world.Tcs[users[0].Username].Context()
		uid2 := users[1].User.GetUID().ToBytes()
		g2 := ctc.world.Tcs[users[1].Username].Context()
		t.Logf("uid1: %v, uid2: %v", users[0].User.GetUID(), users[1].User.GetUID())

		var tlfID chat1.TLFID
		ctx := context.TODO()

		type expectedResult struct {
			ConvID       chat1.ConversationID
			Existence    chat1.ConversationExistence
			MemberStatus chat1.ConversationMemberStatus
			TopicName    string
		}

		// Verify all public functions of the team channel source return the expected results.
		assertTeamChannelSource := func(g *globals.Context, uid gregor1.UID, expectedResults map[string]expectedResult) {
			convs, err := g.TeamChannelSource.GetChannelsFull(ctx, uid, tlfID, chat1.TopicType_CHAT)
			require.NoError(t, err)
			require.Equal(t, len(expectedResults), len(convs))
			for _, conv := range convs {
				expected, ok := expectedResults[conv.GetConvID().String()]
				require.True(t, ok)
				require.Equal(t, expected.ConvID, conv.GetConvID())
				require.Equal(t, expected.Existence, conv.Info.Existence)
				require.Equal(t, expected.MemberStatus, conv.Info.MemberStatus)
			}

			mentions, err := g.TeamChannelSource.GetChannelsTopicName(ctx, uid, tlfID, chat1.TopicType_CHAT)
			require.NoError(t, err)
			require.Equal(t, len(expectedResults), len(mentions))
			for _, mention := range mentions {
				expected, ok := expectedResults[mention.ConvID.String()]
				require.True(t, ok)
				require.Equal(t, expected.ConvID, mention.ConvID)
				require.Equal(t, expected.TopicName, mention.TopicName)
			}

			for _, expected := range expectedResults {
				topicName, err := g.TeamChannelSource.GetChannelTopicName(ctx, uid, tlfID,
					chat1.TopicType_CHAT, expected.ConvID)
				require.NoError(t, err)
				require.Equal(t, expected.TopicName, topicName)
			}
		}
		assertTeamChannelSource(g1, uid1, nil)
		assertTeamChannelSource(g2, uid2, nil)

		conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt,
			ctc.as(t, users[1]).user())
		consumeNewConversation(t, listener1, conv.Id)
		consumeNewConversation(t, listener2, conv.Id)
		tlfID = conv.Triple.Tlfid
		generalChannel := expectedResult{
			ConvID:       conv.Id,
			Existence:    chat1.ConversationExistence_ACTIVE,
			MemberStatus: chat1.ConversationMemberStatus_ACTIVE,
			TopicName:    "general",
		}
		// Both members can see the #general channel and are ACTIVE
		expectedResults1 := map[string]expectedResult{conv.Id.String(): generalChannel}
		expectedResults2 := map[string]expectedResult{conv.Id.String(): generalChannel}
		assertTeamChannelSource(g1, uid1, expectedResults1)
		assertTeamChannelSource(g2, uid2, expectedResults2)

		topicName := "channel1"
		channel1, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:       conv.TlfName,
				TopicName:     &topicName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   chat1.ConversationMembersType_TEAM,
			})
		require.NoError(t, err)
		channelConvID := channel1.Conv.GetConvID()
		consumeNewConversation(t, listener1, channelConvID)
		assertNoNewConversation(t, listener2)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
		consumeTeamType(t, listener1)
		consumeTeamType(t, listener2)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_SYSTEM)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_SYSTEM)
		t.Logf("created %v", topicName)

		// Both members can see the #general channel and are ACTIVE
		channel1User1 := expectedResult{
			ConvID:       channelConvID,
			Existence:    chat1.ConversationExistence_ACTIVE,
			MemberStatus: chat1.ConversationMemberStatus_ACTIVE,
			TopicName:    topicName,
		}
		expectedResults1[channelConvID.String()] = channel1User1

		channel1User2 := expectedResult{
			ConvID:       channelConvID,
			Existence:    chat1.ConversationExistence_ACTIVE,
			MemberStatus: chat1.ConversationMemberStatus_NEVER_JOINED,
			TopicName:    topicName,
		}
		expectedResults2[channelConvID.String()] = channel1User2
		assertTeamChannelSource(g1, uid1, expectedResults1)
		assertTeamChannelSource(g2, uid2, expectedResults2)

		// test rename
		topicName = "channel1-renamed"
		marg := chat1.PostMetadataNonblockArg{
			ConversationID: channelConvID,
			TlfName:        conv.TlfName,
			TlfPublic:      false,
			ChannelName:    topicName,
		}
		_, err = ctc.as(t, users[0]).chatLocalHandler().PostMetadataNonblock(ctx1, marg)
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_METADATA)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_METADATA)
		t.Logf("renamed %v", topicName)

		channel1User1.TopicName = topicName
		channel1User2.TopicName = topicName
		expectedResults1[channelConvID.String()] = channel1User1
		expectedResults2[channelConvID.String()] = channel1User2
		assertTeamChannelSource(g1, uid1, expectedResults1)
		assertTeamChannelSource(g2, uid2, expectedResults2)

		channel1User2.MemberStatus = chat1.ConversationMemberStatus_ACTIVE
		expectedResults2[channelConvID.String()] = channel1User2
		_, err = ctc.as(t, users[1]).chatLocalHandler().JoinConversationLocal(ctx1, chat1.JoinConversationLocalArg{
			TlfName:    conv.TlfName,
			TopicType:  chat1.TopicType_CHAT,
			Visibility: keybase1.TLFVisibility_PRIVATE,
			TopicName:  topicName,
		})
		require.NoError(t, err)
		consumeNewMsgRemote(t, listener1, chat1.MessageType_JOIN)
		consumeNewMsgRemote(t, listener2, chat1.MessageType_JOIN)
		assertTeamChannelSource(g1, uid1, expectedResults1)
		assertTeamChannelSource(g2, uid2, expectedResults2)

		_, err = ctc.as(t, users[0]).chatLocalHandler().DeleteConversationLocal(ctx1,
			chat1.DeleteConversationLocalArg{
				ConvID: channelConvID,
			})
		require.NoError(t, err)
		consumeLeaveConv(t, listener1)
		consumeTeamType(t, listener1)
		delete(expectedResults1, channelConvID.String())
		delete(expectedResults2, channelConvID.String())
		assertTeamChannelSource(g1, uid1, expectedResults1)
		assertTeamChannelSource(g2, uid2, expectedResults2)

		updates := consumeNewThreadsStale(t, listener1)
		require.Equal(t, 1, len(updates))
		require.Equal(t, channelConvID, updates[0].ConvID, "wrong cid")
		require.Equal(t, chat1.StaleUpdateType_CLEAR, updates[0].UpdateType)

		updates = consumeNewThreadsStale(t, listener2)
		require.Equal(t, 1, len(updates))
		require.Equal(t, channelConvID, updates[0].ConvID, "wrong cid")
		require.Equal(t, chat1.StaleUpdateType_CLEAR, updates[0].UpdateType)
	})
}
