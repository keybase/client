package chat

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func setupLoaderTest(t *testing.T) (context.Context, *kbtest.ChatTestContext, *kbtest.ChatMockWorld,
	func() chat1.RemoteInterface, types.Sender, *chatListener, chat1.NewConversationRemoteRes) {
	ctx, world, ri, _, baseSender, listener := setupTest(t, 1)

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	trip := newConvTriple(ctx, t, tc, u.Username)
	firstMessagePlaintext := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TLFNAME,
		},
		MessageBody: chat1.MessageBody{},
	}
	firstMessageBoxed, _, _, _, _, err := baseSender.Prepare(ctx, firstMessagePlaintext,
		chat1.ConversationMembersType_KBFS, nil)
	require.NoError(t, err)
	res, err := ri.NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
		IdTriple:   trip,
		TLFMessage: *firstMessageBoxed,
	})
	require.NoError(t, err)
	return ctx, tc, world, func() chat1.RemoteInterface { return ri }, baseSender, listener, res
}

func TestConvLoader(t *testing.T) {
	_, tc, world, _, _, listener, res := setupLoaderTest(t)
	defer world.Cleanup()

	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, nil, types.ConvLoaderPriorityHigh, nil)))
	select {
	case convID := <-listener.bgConvLoads:
		if !convID.Eq(res.ConvID) {
			t.Errorf("loaded conv id: %s, expected %s", convID, res.ConvID)
		}
	case <-time.After(20 * time.Second):
		t.Fatal("timeout waiting for conversation load")
	}
}

type slowestRemote struct {
	chat1.RemoteInterface
	callCh chan struct{}
}

func makeSlowestRemote() slowestRemote {
	return slowestRemote{
		callCh: make(chan struct{}, 5),
	}
}

func (s slowestRemote) delay(ctx context.Context) {
	s.callCh <- struct{}{}
	select {
	case <-ctx.Done():
	case <-time.After(24 * time.Hour):
	}
}

func (s slowestRemote) GetThreadRemote(ctx context.Context, arg chat1.GetThreadRemoteArg) (res chat1.GetThreadRemoteRes, err error) {
	s.delay(ctx)
	return res, context.Canceled
}

func (s slowestRemote) GetMessagesRemote(ctx context.Context, arg chat1.GetMessagesRemoteArg) (res chat1.GetMessagesRemoteRes, err error) {
	s.delay(ctx)
	return res, context.Canceled
}

func TestConvLoaderSuspend(t *testing.T) {
	_, tc, world, _, _, listener, res := setupLoaderTest(t)
	defer world.Cleanup()

	ri := tc.ChatG.ConvSource.(*HybridConversationSource).ri
	slowRi := makeSlowestRemote()
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = func() chat1.RemoteInterface {
		return slowRi
	}
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, nil, types.ConvLoaderPriorityHigh, nil)))
	select {
	case <-slowRi.callCh:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no remote call")
	}
	require.True(t, tc.Context().ConvLoader.Suspend(context.TODO()))
	select {
	case <-listener.bgConvLoads:
		require.Fail(t, "no load yet")
	default:
	}
	require.True(t, tc.Context().ConvLoader.Suspend(context.TODO()))

	tc.ChatG.ConvSource.(*HybridConversationSource).ri = ri
	require.False(t, tc.Context().ConvLoader.Resume(context.TODO()))
	select {
	case <-listener.bgConvLoads:
		require.Fail(t, "no load yet")
	default:
	}
	require.True(t, tc.Context().ConvLoader.Resume(context.TODO()))
	select {
	case convID := <-listener.bgConvLoads:
		require.Equal(t, res.ConvID, convID)
	case <-time.After(20 * time.Second):
		require.Fail(t, "no event")
	}
}

func TestConvLoaderAppState(t *testing.T) {
	_, tc, world, _, _, listener, res := setupLoaderTest(t)
	defer world.Cleanup()

	clock := clockwork.NewFakeClock()
	appStateCh := make(chan struct{})
	tc.ChatG.ConvLoader.(*BackgroundConvLoader).clock = clock
	tc.ChatG.ConvLoader.(*BackgroundConvLoader).appStateCh = appStateCh
	ri := tc.ChatG.ConvSource.(*HybridConversationSource).ri
	_ = ri
	slowRi := makeSlowestRemote()
	failDuration := 2 * time.Second
	uid := gregor1.UID(tc.G.Env.GetUID().ToBytes())
	// Test that a foreground with no background doesnt do anything
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = func() chat1.RemoteInterface {
		return slowRi
	}
	tc.ChatG.ConvSource.(*HybridConversationSource).Clear(context.TODO(), res.ConvID, uid)
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, nil, types.ConvLoaderPriorityHigh, nil)))
	clock.BlockUntil(1)
	clock.Advance(200 * time.Millisecond) // Get by small sleep
	select {
	case <-slowRi.callCh:
	case <-time.After(failDuration):
		require.Fail(t, "no remote call")
	}
	require.True(t, tc.Context().ConvLoader.Suspend(context.TODO()))
	tc.G.AppState.Update(keybase1.AppState_FOREGROUND)
	select {
	case <-appStateCh:
		require.Fail(t, "no app state")
	default:
	}
	select {
	case <-listener.bgConvLoads:
		require.Fail(t, "no load yet")
	default:
	}
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = ri
	require.True(t, tc.Context().ConvLoader.Resume(context.TODO()))
	clock.BlockUntil(1)
	clock.Advance(2 * time.Second) // Get by resume wait
	clock.BlockUntil(1)
	clock.Advance(time.Hour) // Get by small sleep
	select {
	case convID := <-listener.bgConvLoads:
		require.Equal(t, res.ConvID, convID)
	case <-time.After(failDuration):
		require.Fail(t, "no event")
	}
	t.Logf("testing foreground/background")
	// Test that background/foreground works
	tc.ChatG.ConvSource.(*HybridConversationSource).Clear(context.TODO(), res.ConvID, uid)
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = func() chat1.RemoteInterface {
		return slowRi
	}

	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, nil, types.ConvLoaderPriorityHigh, nil)))

	clock.BlockUntil(1)
	clock.Advance(200 * time.Millisecond) // Get by small sleep
	select {
	case <-slowRi.callCh:
	case <-time.After(failDuration):
		require.Fail(t, "no remote call")
	}
	tc.G.AppState.Update(keybase1.AppState_BACKGROUND)
	select {
	case <-appStateCh:
	case <-time.After(failDuration):
		require.Fail(t, "no app state")
	}
	tc.ChatG.ConvSource.(*HybridConversationSource).ri = ri
	tc.G.AppState.Update(keybase1.AppState_FOREGROUND)
	select {
	case <-appStateCh:
	case <-time.After(failDuration):
		require.Fail(t, "no app state")
	}
	// Need to advance clock
	select {
	case <-listener.bgConvLoads:
		require.Fail(t, "no load yet")
	default:
	}

	clock.BlockUntil(1)
	clock.Advance(10 * time.Second)
	clock.BlockUntil(1)
	clock.Advance(time.Hour) // Get by small sleep
	select {
	case convID := <-listener.bgConvLoads:
		require.Equal(t, res.ConvID, convID)
	case <-time.After(failDuration):
		require.Fail(t, "no event")
	}
}

func TestConvLoaderPageBack(t *testing.T) {
	ctx, tc, world, ri, sender, listener, res := setupLoaderTest(t)
	defer world.Cleanup()

	ib, err := ri().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query: &chat1.GetInboxQuery{
			ConvID: &res.ConvID,
		},
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(ib.Inbox.Full().Conversations))
	conv := ib.Inbox.Full().Conversations[0]

	u := world.GetUsers()[0]
	skp, err := sender.(*BlockingSender).getSigningKeyPair(ctx)
	require.NoError(t, err)
	for i := 0; i < 2; i++ {
		pt := chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Metadata.IdTriple,
				Sender:      u.User.GetUID().ToBytes(),
				TlfName:     u.Username,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
		}
		boxed, err := NewBoxer(tc.Context()).BoxMessage(ctx, pt, conv.GetMembersType(), skp)
		require.NoError(t, err)
		require.NotNil(t, boxed)
		_, err = ri().PostRemote(ctx, chat1.PostRemoteArg{
			ConversationID: conv.GetConvID(),
			MessageBoxed:   *boxed,
		})
		require.NoError(t, err)
	}
	// Send kicks off one of these when reading the conversation
	select {
	case <-listener.bgConvLoads:
		require.Fail(t, "no loads here")
	default:
	}

	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, &chat1.Pagination{Num: 1}, types.ConvLoaderPriorityHigh,
			newConvLoaderPagebackHook(tc.Context(), 0, 1))))
	for i := 0; i < 2; i++ {
		select {
		case <-listener.bgConvLoads:
		case <-time.After(20 * time.Second):
			require.Fail(t, "no load")
		}
	}
}

func TestConvLoaderJobQueue(t *testing.T) {
	j := newJobQueue(10)
	newTask := func(p types.ConvLoaderPriority) clTask {
		job := types.NewConvLoaderJob(chat1.ConversationID{}, nil, p, nil)
		return clTask{job: job}
	}

	t.Logf("test wait")
	select {
	case <-j.Wait():
		require.Fail(t, "queue empty")
	default:
	}
	cb := make(chan bool, 1)
	go func() {
		ret := true
		select {
		case <-j.Wait():
		case <-time.After(20 * time.Second):
			ret = false
		}
		cb <- ret
	}()
	time.Sleep(100 * time.Millisecond)
	require.NoError(t, j.Push(newTask(types.ConvLoaderPriorityLow)))
	require.True(t, <-cb)
	task, ok := j.PopFront()
	require.True(t, ok)
	require.Equal(t, types.ConvLoaderPriorityLow, task.job.Priority)
	require.Zero(t, j.queue.Len())

	t.Logf("test priority")
	order := []types.ConvLoaderPriority{types.ConvLoaderPriorityHigh, types.ConvLoaderPriorityMedium,
		types.ConvLoaderPriorityLow, types.ConvLoaderPriorityLow}
	for i := len(order) - 1; i >= 0; i-- {
		require.NoError(t, j.Push(newTask(order[i])))
	}
	for i := 0; i < len(order); i++ {
		task, ok := j.PopFront()
		require.True(t, ok)
		require.Equal(t, order[i], task.job.Priority)

	}
	require.Zero(t, j.queue.Len())

	t.Logf("test maxsize")
	j = newJobQueue(2)
	require.NoError(t, j.Push(newTask(types.ConvLoaderPriorityLow)))
	require.NoError(t, j.Push(newTask(types.ConvLoaderPriorityLow)))
	require.Error(t, j.Push(newTask(types.ConvLoaderPriorityLow)))
}

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

	// setup a ticker since we don't run the service's fastChatChecks ticker here.
	tickerLifetime := 500 * time.Millisecond
	ticker := time.NewTicker(tickerLifetime)
	defer ticker.Stop()

	go func() {
		for {
			<-ticker.C
			world.Fc.Advance(tickerLifetime)
			chatStorage.QueueEphemeralBackgroundPurges(context.Background(), uid)
		}
	}()

	assertListener := func(convID chat1.ConversationID) {
		select {
		case convID := <-listener.bgConvLoads:
			require.Equal(t, res.ConvID, convID)
		case <-time.After(2 * time.Second):
			t.Fatal("timeout waiting for conversation load")
		}
	}

	sendEphemeral := func(lifetime gregor1.DurationSec) {
		_, _, _, err := baseSender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
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
		require.Len(t, allPurgeInfo, 1)
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
		}
	}

	// Load our conv with the initial tlf msg
	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, &chat1.Pagination{Num: 3}, types.ConvLoaderPriorityHigh, nil)))
	t.Logf("assert listener 0")
	assertListener(res.ConvID)

	// Nothing is up for purging yet
	expectedPurgeInfo := chat1.EphemeralPurgeInfo{
		MinUnexplodedID: 1,
		NextPurgeTime:   0,
		IsActive:        false,
	}
	assertTrackerState(res.ConvID, expectedPurgeInfo)

	// Send two ephemeral messages, and ensure both get purged
	lifetime := gregor1.DurationSec(1)
	sendEphemeral(lifetime * 2)
	sendEphemeral(lifetime * 3)

	thread, _, err := tc.ChatG.ConvSource.Pull(ctx, res.ConvID, uid, &chat1.GetThreadQuery{
		MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
	}, nil)
	require.NoError(t, err)
	msgs := thread.Messages
	require.Len(t, msgs, 2)
	msgUnboxed2 := msgs[0]
	msgUnboxed1 := msgs[1]

	t.Logf("assert listener 1")
	assertListener(res.ConvID)
	assertTrackerState(res.ConvID, chat1.EphemeralPurgeInfo{
		MinUnexplodedID: msgUnboxed1.GetMessageID(),
		NextPurgeTime:   msgUnboxed1.Valid().Etime(),
		IsActive:        true,
	})

	t.Logf("assert listener 2")
	assertListener(res.ConvID)
	assertTrackerState(res.ConvID, chat1.EphemeralPurgeInfo{
		MinUnexplodedID: msgUnboxed2.GetMessageID(),
		NextPurgeTime:   msgUnboxed2.Valid().Etime(),
		IsActive:        true,
	})
	assertEphemeralPurgeNotifInfo(res.ConvID, []chat1.MessageID{msgUnboxed1.GetMessageID()})

	t.Logf("assert listener 3")
	assertListener(res.ConvID)
	assertTrackerState(res.ConvID, chat1.EphemeralPurgeInfo{
		MinUnexplodedID: msgUnboxed2.GetMessageID(),
		NextPurgeTime:   0,
		IsActive:        false,
	})
	assertEphemeralPurgeNotifInfo(res.ConvID, []chat1.MessageID{msgUnboxed2.GetMessageID()})
}
