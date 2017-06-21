package chat

import (
	"testing"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
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
