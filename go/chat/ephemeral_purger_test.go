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
	sendEphemeral(lifetime * 3)

	thread, err := tc.ChatG.ConvSource.Pull(ctx, res.ConvID, uid,
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	msgs := thread.Messages
	require.Len(t, msgs, 3)
	msgUnboxed3 := msgs[0]
	msgUnboxed2 := msgs[1]
	msgUnboxed1 := msgs[2]

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
		MinUnexplodedID: msgUnboxed3.GetMessageID(),
		NextPurgeTime:   msgUnboxed3.Valid().Etime(),
		IsActive:        true,
	})
	assertEphemeralPurgeNotifInfo(res.ConvID, []chat1.MessageID{msgUnboxed2.GetMessageID()})

	// Stop the Purger, and ensure the final message gets purged when we Pull
	// the conversation and the GUI get's a notification
	<-g.EphemeralPurger.Stop(context.Background())
	t.Logf("assert listener 3")
	world.Fc.Advance(lifetimeDuration)
	thread, err = tc.ChatG.ConvSource.Pull(ctx, res.ConvID, uid,
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Len(t, thread.Messages, 3)
	assertTrackerState(res.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          res.ConvID,
		MinUnexplodedID: msgUnboxed3.GetMessageID(),
		NextPurgeTime:   msgUnboxed3.Valid().Etime(),
		IsActive:        true,
	})
	assertEphemeralPurgeNotifInfo(res.ConvID, []chat1.MessageID{msgUnboxed3.GetMessageID()})
}

func TestQueueState(t *testing.T) {
	ctx, tc, world, _, _, _, _ := setupLoaderTest(t)
	defer world.Cleanup()

	g := globals.NewContext(tc.G, tc.ChatG)
	u := world.GetUsers()[0]
	uid := gregor1.UID(u.GetUID().ToBytes())

	chatStorage := storage.New(g, nil)
	chatStorage.SetClock(world.Fc)
	purger := NewBackgroundEphemeralPurger(g, chatStorage)
	purger.SetClock(world.Fc)
	purger.Start(context.Background(), uid)
	<-purger.Stop(context.Background())

	pq := purger.pq
	require.NotNil(t, pq)
	require.Zero(t, pq.Len())
	require.Nil(t, pq.Peek())

	now := world.Fc.Now()

	purgeInfo := chat1.EphemeralPurgeInfo{
		ConvID:          chat1.ConversationID("conv1"),
		MinUnexplodedID: 0,
		NextPurgeTime:   gregor1.ToTime(now.Add(time.Hour)),
		IsActive:        true,
	}

	purger.Queue(ctx, purgeInfo)
	require.Equal(t, 1, pq.Len())
	queueItem := pq.Peek()
	require.NotNil(t, queueItem)
	require.Zero(t, queueItem.index)
	require.Equal(t, purgeInfo, queueItem.purgeInfo)

	// Insert an item with a shorter time and make sure it's updated appropiated
	purgeInfo2 := chat1.EphemeralPurgeInfo{
		ConvID:          chat1.ConversationID("conv1"),
		MinUnexplodedID: 5,
		NextPurgeTime:   gregor1.ToTime(now.Add(time.Hour).Add(time.Minute)),
		IsActive:        true,
	}
	purger.Queue(ctx, purgeInfo2)
	require.Equal(t, 1, pq.Len())
	queueItem = pq.Peek()
	require.NotNil(t, queueItem)
	require.Zero(t, queueItem.index)
	require.Equal(t, purgeInfo2, queueItem.purgeInfo)

	// Insert a second item make sure it is distinct
	purgeInfo3 := chat1.EphemeralPurgeInfo{
		ConvID:          chat1.ConversationID("conv2"),
		MinUnexplodedID: 0,
		NextPurgeTime:   gregor1.ToTime(now.Add(30 * time.Minute)),
		IsActive:        true,
	}
	purger.Queue(ctx, purgeInfo3)
	require.Equal(t, 2, pq.Len())
	queueItem = pq.Peek()
	require.NotNil(t, queueItem)
	require.Zero(t, queueItem.index)
	require.Equal(t, purgeInfo3, queueItem.purgeInfo)

}
