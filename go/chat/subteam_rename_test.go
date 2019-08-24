package chat

import (
	"context"
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestChatSubteamRename(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_TEAM:
		default:
			return
		}
		ctc := makeChatTestContext(t, "TestChatSubteamRename", 2)
		defer ctc.cleanup()
		users := ctc.users()

		listener1 := newServerChatListener()
		listener2 := newServerChatListener()
		ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener1)
		ctc.as(t, users[1]).h.G().NotifyRouter.AddListener(listener2)
		ctc.world.Tcs[users[0].Username].ChatG.Syncer.(*Syncer).isConnected = true
		ctc.world.Tcs[users[1].Username].ChatG.Syncer.(*Syncer).isConnected = true

		// Root team conv
		teamConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, chat1.ConversationMembersType_TEAM, ctc.as(t, users[1]).user())
		// setup a sub team with user0, and user1, and a subsub team with only
		// user1. both subteams have two channels.
		parentTeamName, err := keybase1.TeamNameFromString(teamConv.TlfName)
		require.NoError(t, err)
		tc := ctc.world.Tcs[users[0].Username]

		subteamBasename := "level1"
		_, err = teams.CreateSubteam(context.TODO(), tc.G, subteamBasename, parentTeamName, keybase1.TeamRole_WRITER /* addSelfAs */)
		require.NoError(t, err)
		subteamName, err := parentTeamName.Append(subteamBasename)
		require.NoError(t, err)
		err = teams.SetRoleWriter(context.TODO(), tc.G, subteamName.String(), users[1].Username)
		require.NoError(t, err)
		ctc.teamCache[subteamName.String()] = subteamName.String()

		subSubteamBasename := "level2"
		_, err = teams.CreateSubteam(context.TODO(), tc.G, subSubteamBasename, subteamName, keybase1.TeamRole_WRITER /* addSelfAs */)
		require.NoError(t, err)
		subSubteamName, err := subteamName.Append(subSubteamBasename)
		require.NoError(t, err)
		ctc.teamCache[subSubteamName.String()] = subSubteamName.String()

		versMap := make(map[string]chat1.ConversationVers)
		var convs []chat1.ConversationInfoLocal
		for _, name := range []string{subteamName.String(), subSubteamName.String()} {
			for i := 0; i < 2; i++ {
				t.Logf("creating conv %v, subteam: %vv", i, name)
				var topicName *string
				if i > 0 {
					s := fmt.Sprintf("chan-%v", i)
					topicName = &s
				}
				ctx := ctc.as(t, users[0])
				ncres, err := ctx.chatLocalHandler().NewConversationLocal(ctx.startCtx,
					chat1.NewConversationLocalArg{
						TlfName:          name,
						TopicType:        chat1.TopicType_CHAT,
						TopicName:        topicName,
						TlfVisibility:    keybase1.TLFVisibility_PRIVATE,
						MembersType:      chat1.ConversationMembersType_TEAM,
						IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
					})
				require.NoError(t, err)
				convs = append(convs, ncres.Conv.Info)
				versMap[ncres.Conv.GetConvID().String()] = ncres.Conv.Info.Version

				// Write a message so we have something that uses the old team name in the chat history.
				_, err = ctc.as(t, users[0]).chatLocalHandler().PostLocal(context.TODO(), chat1.PostLocalArg{
					ConversationID: ncres.Conv.Info.Id,
					Msg: chat1.MessagePlaintext{
						ClientHeader: chat1.MessageClientHeader{
							Conv:        ncres.Conv.Info.Triple,
							MessageType: chat1.MessageType_TEXT,
							TlfName:     ncres.Conv.Info.TlfName,
						},
						MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
							Body: "Hello",
						}),
					},
				})
				require.NoError(t, err)
			}
		}

		// subteam convs
		subConv1 := convs[0] // u1, u2
		subConv2 := convs[1] // u1
		// subSubteam convs
		subSubConv1 := convs[2] // u1
		subSubConv2 := convs[3] // u1

		// Rename the subteam
		newSubteamName, err := parentTeamName.Append("bb2")
		require.NoError(t, err)
		err = teams.RenameSubteam(context.TODO(), tc.G, subteamName, newSubteamName)
		require.NoError(t, err)
		newSubSubteamName, err := newSubteamName.Append(subSubteamBasename)
		require.NoError(t, err)

		u1ExpectedUpdates := []chat1.ConversationID{
			subConv1.Id,
			subConv2.Id,
			subSubConv1.Id,
			subSubConv2.Id,
		}
		sort.Sort(utils.ByConvID(u1ExpectedUpdates))

		u1Updates := consumeSubteamRename(t, listener1)
		sort.Sort(utils.ByConvID(u1Updates))
		require.Equal(t, u1ExpectedUpdates, u1Updates)

		select {
		case <-listener1.subteamRename:
			require.Fail(t, "unexpected update")
		case <-time.After(2 * time.Second):
		}

		u2ExpectedUpdates := []chat1.ConversationID{
			subConv1.Id,
		}

		u2Updates := consumeSubteamRename(t, listener2)
		require.Equal(t, u2ExpectedUpdates, u2Updates)

		select {
		case <-listener2.subteamRename:
			require.Fail(t, "unexpected update")
		case <-time.After(2 * time.Second):
		}
		ib, _, err := tc.ChatG.InboxSource.Read(context.TODO(), users[0].User.GetUID().ToBytes(),
			types.ConversationLocalizerBlocking, types.InboxSourceDataSourceAll, nil,
			&chat1.GetInboxLocalQuery{
				ConvIDs: u1ExpectedUpdates,
			}, nil)
		require.NoError(t, err)
		require.True(t, len(ib.Convs) >= len(u1ExpectedUpdates))

		numFound := 0
		for _, conv := range ib.Convs {
			convID := conv.GetConvID()
			if convID.Eq(subConv1.Id) || convID.Eq(subConv2.Id) {
				require.Equal(t, newSubteamName.String(), conv.Info.TlfName)
				numFound++
			} else if convID.Eq(subSubConv1.Id) || convID.Eq(subSubConv2.Id) {
				require.Equal(t, newSubSubteamName.String(), conv.Info.TlfName)
				numFound++
			}
			require.NotEqual(t, versMap[conv.GetConvID().String()], conv.Info.Version)

			// Make sure we can send to each conversation
			_, err = ctc.as(t, users[0]).chatLocalHandler().PostLocal(context.TODO(), chat1.PostLocalArg{
				ConversationID: convID,
				Msg: chat1.MessagePlaintext{
					ClientHeader: chat1.MessageClientHeader{
						Conv:        conv.Info.Triple,
						MessageType: chat1.MessageType_TEXT,
						TlfName:     conv.Info.TlfName,
					},
					MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
						Body: "Hello",
					}),
				},
			})
			require.NoError(t, err)
			// Make sure user1 (user0 did all the sends) can decrypt everything
			// in conversation.
			tv, err := tc.Context().ConvSource.Pull(context.TODO(), convID, users[1].GetUID().ToBytes(), chat1.GetThreadReason_GENERAL, nil,
				nil)
			require.NoError(t, err)
			for _, msg := range tv.Messages {
				require.True(t, msg.IsValid())
			}
		}
		require.Equal(t, len(u1ExpectedUpdates), numFound)
	})
}
