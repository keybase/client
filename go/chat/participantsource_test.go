package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
)

func TestParticipantsSource(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestParticipantsSource", 3)
	defer ctc.cleanup()

	timeout := time.Second * 20
	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := gregor1.UID(users[0].GetUID().ToBytes())
	listener0 := newServerChatListener()
	ctc.as(t, users[0]).h.G().NotifyRouter.AddListener(listener0)

	info := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, users[1])
	conv, err := utils.GetUnverifiedConv(ctx, tc.Context(), uid, info.Id, types.InboxSourceDataSourceAll)
	require.NoError(t, err)

	// empty should get one
	ch := tc.Context().ParticipantsSource.GetNonblock(ctx, uid, conv.GetConvID(),
		types.InboxSourceDataSourceAll)
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Equal(t, 2, len(pres.Uids))
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}
	time.Sleep(time.Millisecond * 200)
	_, ok := <-ch
	require.False(t, ok)

	// cached should get one
	ch = tc.Context().ParticipantsSource.GetNonblock(ctx, uid, conv.GetConvID(),
		types.InboxSourceDataSourceAll)
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Equal(t, 2, len(pres.Uids))
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}
	time.Sleep(time.Millisecond * 200)
	_, ok = <-ch
	require.False(t, ok)

	// hash wrong, should get two
	err = teams.SetRoleWriter(context.TODO(), tc.G, info.TlfName, users[2].Username)
	require.NoError(t, err)
	consumeMembersUpdate(t, listener0)
	ch = tc.Context().ParticipantsSource.GetNonblock(ctx, uid, conv.GetConvID(),
		types.InboxSourceDataSourceAll)
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Equal(t, 2, len(pres.Uids))
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Equal(t, 3, len(pres.Uids))
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}

	// cached should get one
	ch = tc.Context().ParticipantsSource.GetNonblock(ctx, uid, conv.GetConvID(),
		types.InboxSourceDataSourceAll)
	select {
	case pres := <-ch:
		require.NoError(t, pres.Err)
		require.Equal(t, 3, len(pres.Uids))
	case <-time.After(timeout):
		require.Fail(t, "no uids")
	}
	time.Sleep(time.Millisecond * 200)
	_, ok = <-ch
	require.False(t, ok)
}
