package chat

import (
	"testing"

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
	_, err := tc.Context().InboxSource.Read(ctx, uid, nil, true, nil, nil)
	require.NoError(t, err)

	res, err := RecentConversationParticipants(ctx, tc.Context(), uid)
	require.NoError(t, err)
	require.Equal(t, maxUsers-1, len(res))
	require.Equal(t, refList, res)
}

func TestSendTextByName(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctx, world, ri2, _, _, _ := setupTest(t, 1)
		defer world.Cleanup()

		u := world.GetUsers()[0]
		tc := world.Tcs[u.Username]
		uid := u.User.GetUID().ToBytes()
		var name string
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			name = createTeam(tc.TestContext)
		default:
			name = u.Username
		}

		getRi := func() chat1.RemoteInterface { return ri2 }
		helper := NewHelper(tc.Context(), getRi)
		require.NoError(t, helper.SendTextByName(ctx, name, nil,
			mt, keybase1.TLFIdentifyBehavior_CHAT_CLI, "HI"))
		inbox, err := tc.Context().InboxSource.Read(ctx, uid, nil, true, nil, nil)
		require.NoError(t, err)
		require.Equal(t, 1, len(inbox.Convs))
		require.NoError(t, helper.SendTextByName(ctx, name, nil,
			mt, keybase1.TLFIdentifyBehavior_CHAT_CLI, "HI"))
		inbox, err = tc.Context().InboxSource.Read(ctx, uid, nil, true, nil, nil)
		require.NoError(t, err)
		require.Equal(t, 1, len(inbox.Convs))
		tv, err := tc.Context().ConvSource.Pull(ctx, inbox.Convs[0].GetConvID(), uid, &chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 2, len(tv.Messages))

		t.Logf("sending into new topic name")
		topicName := "MIKE"
		err = helper.SendTextByName(ctx, name, &topicName,
			mt, keybase1.TLFIdentifyBehavior_CHAT_CLI, "HI")
		require.NoError(t, err)
		inbox, err = tc.Context().InboxSource.Read(ctx, uid, nil, true, nil, nil)
		require.NoError(t, err)
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			require.Equal(t, 2, len(inbox.Convs))
		default:
			// No second topic name on KBFS chats
			require.Equal(t, 1, len(inbox.Convs))
		}
	})
}
