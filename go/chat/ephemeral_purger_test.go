package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

func TestBackgroundPurge(t *testing.T) {
	ctx, tc, world, ri, baseSender, listener, conv1 := setupLoaderTest(t)
	defer world.Cleanup()

	g := globals.NewContext(tc.G, tc.ChatG)
	u := world.GetUsers()[0]
	uid := gregor1.UID(u.GetUID().ToBytes())
	trip1 := newConvTriple(ctx, t, tc, u.Username)
	clock := world.Fc
	chatStorage := storage.New(g, tc.ChatG.ConvSource)
	chatStorage.SetClock(clock)

	<-g.EphemeralPurger.Stop(ctx)
	purger := NewBackgroundEphemeralPurger(g, chatStorage)
	purger.SetClock(world.Fc)
	g.EphemeralPurger = purger
	purger.Start(ctx, uid)

	trip2 := newConvTriple(ctx, t, tc, u.Username)
	trip2.TopicType = chat1.TopicType_DEV
	firstMessagePlaintext := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip2,
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TLFNAME,
		},
		MessageBody: chat1.MessageBody{},
	}
	prepareRes, err := baseSender.Prepare(ctx, firstMessagePlaintext,
		chat1.ConversationMembersType_IMPTEAMNATIVE, nil, nil)
	firstMessageBoxed := prepareRes.Boxed
	require.NoError(t, err)
	conv2, err := ri().NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
		IdTriple:   trip2,
		TLFMessage: firstMessageBoxed,
	})
	require.NoError(t, err)

	assertListener := func(convID chat1.ConversationID, queueSize int) {
		select {
		case loadID := <-listener.bgConvLoads:
			require.Equal(t, convID, loadID)
			require.Equal(t, queueSize, purger.pq.Len())
		case <-time.After(10 * time.Second):
			require.Fail(t, "timeout waiting for conversation load")
		}
	}

	sendEphemeral := func(convID chat1.ConversationID, trip chat1.ConversationIDTriple, lifetime gregor1.DurationSec) chat1.MessageUnboxed {
		_, _, err := baseSender.Send(ctx, convID, chat1.MessagePlaintext{
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
		}, 0, nil, nil, nil)
		require.NoError(t, err)
		thread, err := tc.ChatG.ConvSource.Pull(ctx, convID, uid,
			chat1.GetThreadReason_GENERAL,
			&chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			}, nil)
		require.NoError(t, err)
		require.True(t, len(thread.Messages) > 0)
		return thread.Messages[0]
	}

	assertTrackerState := func(convID chat1.ConversationID, expectedPurgeInfo chat1.EphemeralPurgeInfo) {
		allPurgeInfo, err := chatStorage.GetAllPurgeInfo(ctx, uid)
		require.NoError(t, err)
		purgeInfo, ok := allPurgeInfo[convID.String()]
		require.True(t, ok)
		require.Equal(t, expectedPurgeInfo, purgeInfo)
	}

	assertEphemeralPurgeNotifInfo := func(convID chat1.ConversationID, msgIDs []chat1.MessageID, localVers chat1.LocalConversationVers) {
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
		}
		updates := listener.consumeThreadsStale(t)
		require.Len(t, updates, 1)
		require.Equal(t, updates[0].ConvID, convID)
		require.Equal(t, updates[0].UpdateType, chat1.StaleUpdateType_CONVUPDATE)

		rc, err := utils.GetUnverifiedConv(ctx, g, uid, convID, types.InboxSourceDataSourceLocalOnly)
		require.NoError(t, err)
		require.Equal(t, localVers, rc.Conv.Metadata.LocalVersion)

		conv, err := utils.GetVerifiedConv(ctx, g, uid, convID, types.InboxSourceDataSourceLocalOnly)
		require.NoError(t, err)
		require.Equal(t, localVers, conv.Info.LocalVersion)
	}

	// Load our conv with the initial tlf msg
	t.Logf("assert listener 0")
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(conv1.ConvID, nil, &chat1.Pagination{Num: 3}, types.ConvLoaderPriorityHigh, nil)))
	assertListener(conv1.ConvID, 0)
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(conv2.ConvID, nil, &chat1.Pagination{Num: 3}, types.ConvLoaderPriorityHigh, nil)))
	assertListener(conv2.ConvID, 0)

	// Nothing is up for purging yet
	assertTrackerState(conv1.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv1.ConvID,
		MinUnexplodedID: 1,
		NextPurgeTime:   0,
		IsActive:        false,
	})
	assertTrackerState(conv2.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv2.ConvID,
		MinUnexplodedID: 1,
		NextPurgeTime:   0,
		IsActive:        false,
	})

	// Send ephemeral messages, and ensure all get purged
	lifetime := gregor1.DurationSec(1)
	lifetimeDuration := time.Second
	msgs := []chat1.MessageUnboxed{}
	for i := 1; i <= 5; i++ {
		convID := conv1.ConvID
		trip := trip1
		if i%2 == 0 {
			convID = conv2.ConvID
			trip = trip2
		}
		msg := sendEphemeral(convID, trip, lifetime*gregor1.DurationSec(i))
		msgs = append(msgs, msg)
	}

	t.Logf("assert listener 1")
	world.Fc.Advance(lifetimeDuration)
	assertListener(conv1.ConvID, 2)
	localVers1 := chat1.LocalConversationVers(1)
	localVers2 := chat1.LocalConversationVers(1)
	assertEphemeralPurgeNotifInfo(conv1.ConvID, []chat1.MessageID{msgs[0].GetMessageID()}, localVers1)
	assertTrackerState(conv1.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv1.ConvID,
		MinUnexplodedID: msgs[2].GetMessageID(),
		NextPurgeTime:   msgs[2].Valid().Etime(),
		IsActive:        true,
	})
	assertTrackerState(conv2.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv2.ConvID,
		MinUnexplodedID: 1,
		NextPurgeTime:   msgs[1].Valid().Etime(),
		IsActive:        true,
	})

	// Ensure things run smoothly even with extraneous start/stop calls to
	// purger
	g.EphemeralPurger.Start(context.Background(), uid)
	<-g.EphemeralPurger.Stop(context.Background())
	<-g.EphemeralPurger.Stop(context.Background())
	g.EphemeralPurger.Start(context.Background(), uid)
	g.EphemeralPurger.Start(context.Background(), uid)
	assertListener(conv1.ConvID, 2)

	t.Logf("assert listener 2")
	world.Fc.Advance(lifetimeDuration)
	assertListener(conv2.ConvID, 2)
	assertEphemeralPurgeNotifInfo(conv2.ConvID, []chat1.MessageID{msgs[1].GetMessageID()}, localVers1)
	assertTrackerState(conv1.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv1.ConvID,
		MinUnexplodedID: msgs[2].GetMessageID(),
		NextPurgeTime:   msgs[2].Valid().Etime(),
		IsActive:        true,
	})
	assertTrackerState(conv2.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv2.ConvID,
		MinUnexplodedID: msgs[3].GetMessageID(),
		NextPurgeTime:   msgs[3].Valid().Etime(),
		IsActive:        true,
	})

	// Stop the Purger, and ensure the next message gets purged when we Pull
	// the conversation and the GUI get's a notification
	<-g.EphemeralPurger.Stop(context.Background())
	t.Logf("assert listener 3")
	world.Fc.Advance(lifetimeDuration)
	thread, err := tc.ChatG.ConvSource.Pull(ctx, conv1.ConvID, uid,
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, nil)
	require.NoError(t, err)
	require.Len(t, thread.Messages, 3)
	localVers1++
	assertEphemeralPurgeNotifInfo(conv1.ConvID, []chat1.MessageID{msgs[2].GetMessageID()}, localVers1)
	assertTrackerState(conv1.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv1.ConvID,
		MinUnexplodedID: msgs[2].GetMessageID(),
		NextPurgeTime:   msgs[2].Valid().Etime(),
		IsActive:        true,
	})
	assertTrackerState(conv2.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv2.ConvID,
		MinUnexplodedID: msgs[3].GetMessageID(),
		NextPurgeTime:   msgs[3].Valid().Etime(),
		IsActive:        true,
	})
	require.Equal(t, 2, purger.pq.Len())

	g.EphemeralPurger.Start(ctx, uid)
	world.Fc.Advance(lifetimeDuration * 3)
	// keep the fakeclock ticking
	go func() {
		for i := 0; i < 10; i++ {
			world.Fc.Advance(lifetimeDuration)
			time.Sleep(lifetimeDuration)
		}
	}()

	t.Logf("assert listener 4 & 5")
	assertListener(conv2.ConvID, 0)
	assertListener(conv1.ConvID, 0)
	for i := 0; i < 3; i++ {
		select {
		case <-listener.bgConvLoads:
		case <-time.After(time.Second):
			require.Fail(t, "did not drain")
		}
	}
	localVers2++
	assertEphemeralPurgeNotifInfo(conv2.ConvID, []chat1.MessageID{msgs[3].GetMessageID()}, localVers2)
	localVers1++
	assertEphemeralPurgeNotifInfo(conv1.ConvID, []chat1.MessageID{msgs[4].GetMessageID()}, localVers1)
	assertTrackerState(conv1.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv1.ConvID,
		MinUnexplodedID: msgs[4].GetMessageID(),
		NextPurgeTime:   0,
		IsActive:        false,
	})
	assertTrackerState(conv2.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv2.ConvID,
		MinUnexplodedID: msgs[3].GetMessageID(),
		NextPurgeTime:   0,
		IsActive:        false,
	})

	world.Fc.Advance(lifetimeDuration * 5)
	select {
	case <-listener.bgConvLoads:
		require.Fail(t, "unexpected load")
	case <-listener.ephemeralPurge:
		require.Fail(t, "unexpected purge")
	case <-time.After(1 * time.Second):
	}
	assertTrackerState(conv1.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv1.ConvID,
		MinUnexplodedID: msgs[4].GetMessageID(),
		NextPurgeTime:   0,
		IsActive:        false,
	})
	assertTrackerState(conv2.ConvID, chat1.EphemeralPurgeInfo{
		ConvID:          conv2.ConvID,
		MinUnexplodedID: msgs[3].GetMessageID(),
		NextPurgeTime:   0,
		IsActive:        false,
	})
	require.Equal(t, 0, purger.pq.Len())
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
