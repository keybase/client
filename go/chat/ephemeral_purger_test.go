package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

type mockHTTPSrv struct {
	types.DummyAttachmentHTTPSrv
	fetcher types.AttachmentFetcher
}

func newMockHTTPSrv(fetcher types.AttachmentFetcher) *mockHTTPSrv {
	return &mockHTTPSrv{
		fetcher: fetcher,
	}
}

func (d mockHTTPSrv) GetAttachmentFetcher() types.AttachmentFetcher {
	return d.fetcher
}

type mockAssetDeleter struct {
	types.DummyAttachmentFetcher
	delCh chan struct{}
}

func newMockAssetDeleter() *mockAssetDeleter {
	return &mockAssetDeleter{
		delCh: make(chan struct{}, 100),
	}
}

func (d mockAssetDeleter) DeleteAssets(ctx context.Context, convID chat1.ConversationID, assets []chat1.Asset,
	ri func() chat1.RemoteInterface, signer s3.Signer) error {
	if len(assets) > 0 {
		d.delCh <- struct{}{}
	}
	return nil
}

func TestBackgroundPurge(t *testing.T) {
	ctx, tc, world, ri, baseSender, listener, conv1 := setupLoaderTest(t)
	defer world.Cleanup()

	g := globals.NewContext(tc.G, tc.ChatG)
	u := world.GetUsers()[0]
	uid := gregor1.UID(u.GetUID().ToBytes())
	trip1 := newConvTriple(ctx, t, tc, u.Username)
	clock := world.Fc
	g.EphemeralTracker = NewEphemeralTracker(g)
	fetcher := newMockAssetDeleter()
	httpSrv := newMockHTTPSrv(fetcher)
	g.AttachmentURLSrv = httpSrv
	chatStorage := storage.New(g, tc.ChatG.ConvSource)
	chatStorage.SetClock(clock)

	<-g.EphemeralPurger.Stop(ctx)
	purger := NewBackgroundEphemeralPurger(g)
	purger.SetClock(world.Fc)
	g.EphemeralPurger = purger
	g.ConvSource.(*HybridConversationSource).storage = chatStorage
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
			require.Equal(t, queueSize, purger.Len())
		case <-time.After(10 * time.Second):
			require.Fail(t, "timeout waiting for conversation load")
		}
	}

	sendEphemeral := func(convID chat1.ConversationID, trip chat1.ConversationIDTriple,
		lifetime gregor1.DurationSec, body chat1.MessageBody) chat1.MessageUnboxed {
		typ, err := body.MessageType()
		require.NoError(t, err)
		_, _, err = baseSender.Send(ctx, convID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:              trip,
				Sender:            uid,
				TlfName:           u.Username,
				TlfPublic:         false,
				MessageType:       typ,
				EphemeralMetadata: &chat1.MsgEphemeralMetadata{Lifetime: lifetime},
			},
			MessageBody: body,
		}, 0, nil, nil, nil)
		require.NoError(t, err)
		thread, err := tc.ChatG.ConvSource.Pull(ctx, convID, uid,
			chat1.GetThreadReason_GENERAL, nil,
			&chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT, chat1.MessageType_ATTACHMENT},
			}, nil)
		require.NoError(t, err)
		require.True(t, len(thread.Messages) > 0)
		return thread.Messages[0]
	}

	assertTrackerState := func(convID chat1.ConversationID, expectedPurgeInfo chat1.EphemeralPurgeInfo) {
		purgeInfo, err := g.EphemeralTracker.GetPurgeInfo(ctx, uid, convID)
		if expectedPurgeInfo.IsNil() {
			require.Error(t, err)
			require.IsType(t, storage.MissError{}, err)
		} else {
			require.NoError(t, err)
			require.Equal(t, expectedPurgeInfo, purgeInfo)
		}
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
		updateID := listener.consumeConvUpdate(t)
		require.Equal(t, updateID, convID)

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
		types.NewConvLoaderJob(conv1.ConvID, &chat1.Pagination{Num: 3}, types.ConvLoaderPriorityHigh,
			types.ConvLoaderUnique, nil)))
	assertListener(conv1.ConvID, 0)
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(conv2.ConvID, &chat1.Pagination{Num: 3}, types.ConvLoaderPriorityHigh,
			types.ConvLoaderUnique, nil)))
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
	body := chat1.NewMessageBodyWithText(chat1.MessageText{
		Body: "hi",
	})
	for i := 1; i <= 5; i++ {
		convID := conv1.ConvID
		trip := trip1
		if i%2 == 0 {
			convID = conv2.ConvID
			trip = trip2
		}
		if i == 1 {
			body = chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
				Object: chat1.Asset{
					Path: "miketown",
				},
			})
		} else {
			chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "hi",
			})
		}
		msg := sendEphemeral(convID, trip, lifetime*gregor1.DurationSec(i), body)
		if i == 1 {
			t.Logf("DEBUG: attachment msgid: %d", msg.GetMessageID())
		}
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
		MinUnexplodedID: msgs[1].GetMessageID(),
		NextPurgeTime:   msgs[1].Valid().Etime(),
		IsActive:        true,
	})
	assertListener(conv1.ConvID, 2)
	// make sure the single asset got deleted
	select {
	case <-fetcher.delCh:
	case <-time.After(2 * time.Second):
		require.Fail(t, "no asset deleted")
	}

	// Ensure things run smoothly even with extraneous start/stop calls to
	// purger
	g.EphemeralPurger.Start(context.Background(), uid)
	<-g.EphemeralPurger.Stop(context.Background())
	<-g.EphemeralPurger.Stop(context.Background())
	g.EphemeralPurger.Start(context.Background(), uid)
	g.EphemeralPurger.Start(context.Background(), uid)

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
	// asset deletion job
	assertListener(conv2.ConvID, 2)

	// Stop the Purger, and ensure the next message gets purged when we Pull
	// the conversation and the GUI get's a notification
	<-g.EphemeralPurger.Stop(context.Background())
	t.Logf("assert listener 3")
	world.Fc.Advance(lifetimeDuration)
	thread, err := tc.ChatG.ConvSource.Pull(ctx, conv1.ConvID, uid,
		chat1.GetThreadReason_GENERAL, nil,
		&chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT, chat1.MessageType_ATTACHMENT},
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
	// asset deletion job
	assertListener(conv1.ConvID, 2)

	for _, item := range purger.pq.queue {
		t.Logf("queue item: %+v", item)
	}
	require.Equal(t, 2, purger.Len(), "expected conv %v and %v", conv1.ConvID, conv2.ConvID)

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
	assertListener(conv1.ConvID, 0)
	assertListener(conv2.ConvID, 0)
	localVers1++
	assertEphemeralPurgeNotifInfo(conv1.ConvID, []chat1.MessageID{msgs[4].GetMessageID()}, localVers1)
	localVers2++
	assertEphemeralPurgeNotifInfo(conv2.ConvID, []chat1.MessageID{msgs[3].GetMessageID()}, localVers2)
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
	// asset deletion job
	assertListener(conv1.ConvID, 0)
	assertListener(conv2.ConvID, 0)

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
	require.Equal(t, 0, purger.Len())
}

func TestQueueState(t *testing.T) {
	ctx, tc, world, _, _, _, _ := setupLoaderTest(t)
	defer world.Cleanup()

	g := globals.NewContext(tc.G, tc.ChatG)
	u := world.GetUsers()[0]
	uid := gregor1.UID(u.GetUID().ToBytes())

	g.EphemeralTracker = NewEphemeralTracker(g)
	purger := NewBackgroundEphemeralPurger(g)
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

	err := purger.Queue(ctx, purgeInfo)
	require.NoError(t, err)
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
	err = purger.Queue(ctx, purgeInfo2)
	require.NoError(t, err)
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
	err = purger.Queue(ctx, purgeInfo3)
	require.NoError(t, err)
	require.Equal(t, 2, pq.Len())
	queueItem = pq.Peek()
	require.NotNil(t, queueItem)
	require.Zero(t, queueItem.index)
	require.Equal(t, purgeInfo3, queueItem.purgeInfo)

}
