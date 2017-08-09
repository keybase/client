package chat

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestRecentConversationParticipants(t *testing.T) {
	maxUsers := 5
	ctx, world, ri2, _, sender, _ := setupTest(t, maxUsers)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	uid := u.User.GetUID().ToBytes()

	var refList []gregor1.UID
	for i := 0; i < maxUsers; i++ {
		tlfName := ""
		for j := i; j >= 0; j-- {
			tlfName += world.GetUsers()[j].Username
			if j > 0 {
				tlfName += ","
			}
		}

		conv := newConv(ctx, t, tc, uid, ri2, sender, tlfName)

		// Each participant needs to say something
		for j := i; j >= 0; j-- {
			u := world.GetUsers()[j]
			_, err := ri2.PostRemote(ctx, chat1.PostRemoteArg{
				ConversationID: conv.GetConvID(),
				MessageBoxed: chat1.MessageBoxed{
					ClientHeader: chat1.MessageClientHeader{
						Conv:      conv.Metadata.IdTriple,
						Sender:    u.User.GetUID().ToBytes(),
						TlfName:   tlfName,
						TlfPublic: false,
					},
				},
			})
			require.NoError(t, err)
		}

		iuid := gregor1.UID(world.GetUsers()[i].User.GetUID().ToBytes())
		if !iuid.Eq(uid) {
			refList = append(refList, iuid)
		}
	}

	require.NoError(t, storage.NewInbox(tc.Context(), uid).Clear(ctx))
	_, _, err := tc.Context().InboxSource.Read(ctx, uid, nil, true, nil, nil)
	require.NoError(t, err)

	res, err := RecentConversationParticipants(ctx, tc.Context(), uid)
	require.NoError(t, err)
	require.Equal(t, maxUsers-1, len(res))
	require.Equal(t, refList, res)
}

type MockSC struct {
	ri chat1.RemoteInterface
}

func (s MockSC) Reconnect(ctx context.Context) (bool, error) {
	return true, nil
}

func (s MockSC) GetClient() chat1.RemoteInterface {
	return s.ri
}

func TestSendHelper(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctc := makeChatTestContext(t, "SendHelper", 2)
		defer ctc.cleanup()
		users := ctc.users()

		tc := ctc.world.Tcs[users[0].Username]
		ctx := ctc.as(t, users[0]).startCtx
		uid := users[0].User.GetUID().ToBytes()

		ri := ctc.as(t, users[0]).ri
		sc := MockSC{
			ri: ri,
		}

		g := globals.NewContext(tc.G, tc.ChatG)
		server := NewServer(g, nil, sc, TestUISource{})

		created := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt, users[1])
		tlfName := created.TlfName

		var topicName *string
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			topicName = nil
		case chat1.ConversationMembersType_TEAM:
			topicName = &DefaultTeamTopic
		}

		sendHelper, err := NewSendHelper(ctx, server, chat1.NewConversationLocalArg{
			TlfName:          tlfName,
			TopicType:        chat1.TopicType_CHAT,
			TlfVisibility:    chat1.TLFVisibility_PRIVATE,
			TopicName:        topicName,
			MembersType:      mt,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		require.NoError(t, err)
		_, err = sendHelper.Send(ctx, sendHelper.NewPlaintextMessage("alpha"))
		require.NoError(t, err)
		inbox, _, err := tc.Context().InboxSource.Read(ctx, uid, nil, true, nil, nil)
		require.NoError(t, err)
		require.Equal(t, 1, len(inbox.Convs))
		_, err = sendHelper.Send(ctx, sendHelper.NewPlaintextMessage("beta"))
		inbox, _, err = tc.Context().InboxSource.Read(ctx, uid, nil, true, nil, nil)
		require.NoError(t, err)
		require.Equal(t, 1, len(inbox.Convs))
		tv, _, err := tc.Context().ConvSource.Pull(ctx, inbox.Convs[0].GetConvID(), uid, &chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 2, len(tv.Messages))

		altTopicName := "aleph"
		altSendHelper, err := NewSendHelper(ctx, server, chat1.NewConversationLocalArg{
			TlfName:          tlfName,
			TopicType:        chat1.TopicType_CHAT,
			TlfVisibility:    chat1.TLFVisibility_PRIVATE,
			TopicName:        &altTopicName,
			MembersType:      mt,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		require.NoError(t, err)
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			_, err = altSendHelper.Send(ctx, sendHelper.NewPlaintextMessage("gamma"))
			require.NoError(t, err)
			inbox, _, err = tc.Context().InboxSource.Read(ctx, uid, nil, true, nil, nil)
			require.NoError(t, err)
			require.Equal(t, 2, len(inbox.Convs))
		default:
			// No second topic name on KBFS chats
			_, err = altSendHelper.Send(ctx, sendHelper.NewPlaintextMessage("gamma"))
			require.NoError(t, err)
			inbox, _, err = tc.Context().InboxSource.Read(ctx, uid, nil, true, nil, nil)
			require.Equal(t, 1, len(inbox.Convs))
		}
	})
}
