package chat

import (
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
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

		conv, _ := newConv(ctx, t, tc, uid, ri2, sender, tlfName)

		// Each participant needs to say something
		for j := i; j >= 0; j-- {
			u := world.GetUsers()[j]
			_, err := ri2.PostRemote(ctx, chat1.PostRemoteArg{
				ConversationID: conv.GetConvID(),
				MessageBoxed: chat1.MessageBoxed{
					ClientHeader: chat1.MessageClientHeader{
						Conv:      conv.Info.Triple,
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

	require.NoError(t, storage.NewInbox(tc.Context()).Clear(ctx, uid))
	_, _, err := tc.Context().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, nil, nil)
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
		inbox, _, err := tc.Context().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
			types.InboxSourceDataSourceAll, nil, nil, nil)
		require.NoError(t, err)
		require.Equal(t, 1, len(inbox.Convs))
		require.NoError(t, helper.SendTextByName(ctx, name, nil,
			mt, keybase1.TLFIdentifyBehavior_CHAT_CLI, "HI"))
		inbox, _, err = tc.Context().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
			types.InboxSourceDataSourceAll, nil, nil, nil)
		require.NoError(t, err)
		require.Equal(t, 1, len(inbox.Convs))
		tv, err := tc.Context().ConvSource.Pull(ctx, inbox.Convs[0].GetConvID(), uid,
			chat1.GetThreadReason_GENERAL,
			&chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			}, nil)
		require.NoError(t, err)
		require.Equal(t, 2, len(tv.Messages))

		t.Logf("sending into new topic name")
		topicName := "MIKE"
		err = helper.SendTextByName(ctx, name, &topicName,
			mt, keybase1.TLFIdentifyBehavior_CHAT_CLI, "HI")
		require.NoError(t, err)
		inbox, _, err = tc.Context().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
			types.InboxSourceDataSourceAll, nil, nil, nil)
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
func TestTopicNameRace(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			return
		}
		ctc := makeChatTestContext(t, "TestTopicNameRace", 1)
		defer ctc.cleanup()
		users := ctc.users()

		ctx := ctc.as(t, users[0]).startCtx
		ri := ctc.as(t, users[0]).ri
		tc := ctc.world.Tcs[users[0].Username]
		uid := users[0].User.GetUID().ToBytes()
		t.Logf("uid: %s", uid)
		first := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_DEV, mt)

		// spam create conversation with same name
		type ncRes struct {
			convID chat1.ConversationID
			err    error
		}
		topicName := "LOSERS"
		attempts := 2
		retCh := make(chan ncRes, attempts)
		for i := 0; i < attempts; i++ {
			go func() {
				ctx = globals.CtxAddLogTags(ctx, tc.Context())
				conv, err := NewConversation(ctx, tc.Context(), uid, first.TlfName, &topicName,
					chat1.TopicType_DEV, mt, keybase1.TLFVisibility_PRIVATE,
					func() chat1.RemoteInterface { return ri }, NewConvFindExistingNormal)
				retCh <- ncRes{convID: conv.GetConvID(), err: err}
			}()
		}
		var convID chat1.ConversationID
		for i := 0; i < attempts; i++ {
			res := <-retCh
			require.NoError(t, res.err)
			if convID.IsNil() {
				convID = res.convID
			} else {
				require.Equal(t, convID, res.convID)
			}
		}
	})
}
