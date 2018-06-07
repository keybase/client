package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestBackgroundPurge(t *testing.T) {
	ctx, tc, world, _, baseSender, listener, res := setupLoaderTest(t)
	defer world.Cleanup()

	g := globals.NewContext(tc.G, tc.ChatG)
	u := world.GetUsers()[0]
	uid := gregor1.UID(u.GetUID().ToBytes())
	trip := newConvTriple(ctx, t, tc, u.Username)
	clock := world.Fc
	chatStorage := storage.New(g, tc.ChatG.ConvSource)
	chatStorage.SetClock(clock)

	assertListener := func(convID chat1.ConversationID) {
		select {
		case convID := <-listener.bgConvLoads:
			require.Equal(t, res.ConvID, convID)
		case <-time.After(10 * time.Second):
			t.Fatal("timeout waiting for conversation load")
		}
	}

	sendEphemeral := func(lifetime gregor1.DurationSec) {
		_, _, err := baseSender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:              trip,
				Sender:            uid,
				TlfName:           u.Username,
				TlfPublic:         false,
				MessageType:       chat1.MessageType_TEXT,
				EphemeralMetadata: &chat1.MsgEphemeralMetadata{Lifetime: lifetime},
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "hi",
			}),
		}, 0, nil)
		require.NoError(t, err)
	}

	assertTrackerState := func(convID chat1.ConversationID, expectedPurgeInfo chat1.EphemeralPurgeInfo) {
		allPurgeInfo, err := chatStorage.GetAllPurgeInfo(ctx, uid)
		require.NoError(t, err)
		purgeInfo, ok := allPurgeInfo[convID.String()]
		require.True(t, ok)
		require.Equal(t, expectedPurgeInfo, purgeInfo)
	}

	assertEphemeralPurgeNotifInfo := func(convID chat1.ConversationID, msgIDs []chat1.MessageID) {
		info := listener.consumeEphemeralPurge(t)
		require.Equal(t, info.ConvID, convID)
		if msgIDs == nil {
			require.Nil(t, info.Msgs)
		} else {
			purgedIDs := []chat1.MessageID{}
			for _, purgedMsg := range info.Msgs {
				purgedIDs = append(purgedIDs, purgedMsg.GetMessageID())
			}
			require.Equal(t, msgIDs, purgedIDs)
			require.Equal(t, convID.String(), info.Conv.ConvID)
		}
	}

	// Load our conv with the initial tlf msg
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, &chat1.Pagination{Num: 3}, types.ConvLoaderPriorityHigh, nil)))
	t.Logf("assert listener 0")
	assertListener(res.ConvID)

	// Nothing is up for purging yet
	expectedPurgeInfo := chat1.EphemeralPurgeInfo{
		ConvID:          res.ConvID,
		MinUnexplodedID: 1,
		NextPurgeTime:   0,
		IsActive:        false,
	}
	assertTrackerState(res.ConvID, expectedPurgeInfo)

	// Send two ephemeral messages, and ensure both get purged
	lifetime := gregor1.DurationSec(1)
	lifetimeDuration := time.Second
	sendEphemeral(lifetime)
	sendEphemeral(lifetime * 2)

	thread, err := tc.ChatG.ConvSource.Pull(ctx, res.ConvID, uid, &chat1.GetThreadQuery{
		MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
	}, nil)
	require.NoError(t, err)
	msgs := thread.Messages
	require.Len(t, msgs, 2)
	msgUnboxed2 := msgs[0]
	msgUnboxed1 := msgs[1]

	t.Logf("assert listener 1")
	world.Fc.Advance(lifetimeDuration)
	assertListener(res.ConvID)
	assertTrackerState(res.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          res.ConvID,
		MinUnexplodedID: msgUnboxed2.GetMessageID(),
		NextPurgeTime:   msgUnboxed2.Valid().Etime(),
		IsActive:        true,
	})
	assertEphemeralPurgeNotifInfo(res.ConvID, []chat1.MessageID{msgUnboxed1.GetMessageID()})

	// Ensure things run smoothly even with extraneous start/stop calls to purger
	g.EphemeralPurger.Start(context.Background(), uid)
	<-g.EphemeralPurger.Stop(context.Background())
	<-g.EphemeralPurger.Stop(context.Background())
	g.EphemeralPurger.Start(context.Background(), uid)
	g.EphemeralPurger.Start(context.Background(), uid)

	t.Logf("assert listener 2")
	world.Fc.Advance(lifetimeDuration)
	assertListener(res.ConvID)
	assertTrackerState(res.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          res.ConvID,
		MinUnexplodedID: msgUnboxed2.GetMessageID(),
		NextPurgeTime:   0,
		IsActive:        false,
	})
	assertEphemeralPurgeNotifInfo(res.ConvID, []chat1.MessageID{msgUnboxed2.GetMessageID()})
}
