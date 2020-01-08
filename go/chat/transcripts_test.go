package chat

import (
	"fmt"
	"strings"
	"testing"

	"github.com/keybase/client/go/kbun"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestTranscript(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// Only run this test for imp teams
		switch mt {
		case chat1.ConversationMembersType_IMPTEAMNATIVE,
			chat1.ConversationMembersType_IMPTEAMUPGRADE:
		default:
			return
		}

		ctc := makeChatTestContext(t, "TestTranscripts", 3)
		defer ctc.cleanup()
		users := ctc.users()

		tc1 := ctc.world.Tcs[users[0].Username]
		ctx := ctc.as(t, users[0]).startCtx

		displayName := strings.Join([]string{
			users[0].Username,
			users[1].Username,
			users[2].Username,
		}, ",")

		ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:          displayName,
				TopicType:        chat1.TopicType_CHAT,
				TlfVisibility:    keybase1.TLFVisibility_PRIVATE,
				MembersType:      mt,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			})
		require.NoError(t, err)

		for i := range users {
			mustPostLocalForTest(t, ctc, users[i], ncres.Conv.Info,
				chat1.NewMessageBodyWithText(chat1.MessageText{
					Body: fmt.Sprintf("hello from user %d", i),
				}))
		}

		res, err := PullTranscript(tc1.MetaContext(), tc1.Context().ConvSource,
			ncres.Conv.GetConvID().String(), nil)
		require.NoError(t, err)
		require.Len(t, res.Messages, 3)
		for i := range res.Messages {
			require.Equal(t, res.Messages[i].SenderUsername, users[2-i].Username)
		}

		usernames := []kbun.NormalizedUsername{
			kbun.NewNormalizedUsername(users[0].Username),
			kbun.NewNormalizedUsername(users[1].Username),
		}
		res, err = PullTranscript(tc1.MetaContext(), tc1.Context().ConvSource,
			ncres.Conv.GetConvID().String(), usernames)
		require.NoError(t, err)
		require.Len(t, res.Messages, 2)
		// Messages from users[2] should be skipped.
		require.Equal(t, res.Messages[0].SenderUsername, users[1].Username)
		require.Equal(t, res.Messages[1].SenderUsername, users[0].Username)
	})
}
