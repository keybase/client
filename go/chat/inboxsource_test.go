package chat

import (
	"context"
	"testing"

	"sync"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestInboxSourceUpdateRace(t *testing.T) {
	world, ri, _, sender, _, _, tlf := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	trip := newConvTriple(t, tlf, u.Username)
	res, err := ri.NewConversationRemote2(context.TODO(), chat1.NewConversationRemote2Arg{
		IdTriple: trip,
		TLFMessage: chat1.MessageBoxed{
			ClientHeader: chat1.MessageClientHeader{
				TlfName:   u.Username,
				TlfPublic: false,
			},
			KeyGeneration: 1,
		},
	})
	require.NoError(t, err)

	_, _, _, err = sender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HIHI",
		}),
	}, 0)
	require.NoError(t, err)

	ib, _, err := tc.G.InboxSource.Read(context.TODO(), u.User.GetUID().ToBytes(), nil, true, nil, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.InboxVers(0), ib.Version, "wrong version")

	// Spawn two goroutines to try and update the inbox at the same time with a self-update, and a
	// Gregor style update
	t.Logf("spawning update goroutines")
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		_, err = tc.G.InboxSource.SetStatus(context.TODO(), u.User.GetUID().ToBytes(), 0, res.ConvID,
			chat1.ConversationStatus_UNFILED)
		require.NoError(t, err)
		wg.Done()
	}()
	wg.Add(1)
	go func() {
		_, err = tc.G.InboxSource.SetStatus(context.TODO(), u.User.GetUID().ToBytes(), 1, res.ConvID,
			chat1.ConversationStatus_UNFILED)
		require.NoError(t, err)
		wg.Done()
	}()
	wg.Wait()

	ib, _, err = tc.G.InboxSource.Read(context.TODO(), u.User.GetUID().ToBytes(), nil, true, nil, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.InboxVers(1), ib.Version, "wrong version")
}
