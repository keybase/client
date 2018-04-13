package chat

import (
	"context"
	"testing"
	"time"

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
	tc.ChatG.ConvSource.(*HybridConversationSource).Clear(res.ConvID, uid)
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
	cb := make(chan struct{})
	go func() {
		clock.BlockUntil(1)
		close(cb)
	}()
	select {
	case <-cb:
	case <-time.After(2 * time.Second):
		require.Fail(t, "die")
	}
	/*
		clock.Advance(time.Hour) // Get by small sleep
		select {
		case convID := <-listener.bgConvLoads:
			require.Equal(t, res.ConvID, convID)
		case <-time.After(failDuration):
			require.Fail(t, "no event")
		}
			t.Logf("testing foreground/background")
			// Test that background/foreground works
			tc.ChatG.ConvSource.(*HybridConversationSource).Clear(res.ConvID, uid)
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
	*/
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
	for i := 0; i < 2; i++ {
		_, _, _, err = sender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Metadata.IdTriple,
				Sender:      u.User.GetUID().ToBytes(),
				TlfName:     u.Username,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
		}, 0, nil)
		require.NoError(t, err)
	}

	require.NoError(t, tc.Context().ConvLoader.Queue(context.TODO(),
		types.NewConvLoaderJob(res.ConvID, &chat1.Pagination{Num: 1}, types.ConvLoaderPriorityHigh, nil)))

	for i := 0; i < 2; i++ {
		select {
		case <-listener.bgConvLoads:
		case <-time.After(20 * time.Second):
			require.Fail(t, "no load")
		}
	}
}

func TestConvLoaderJobQueue(t *testing.T) {
	j := newJobQueue(5)
	newTask := func(p types.ConvLoaderPriority) clTask {
		job := types.NewConvLoaderJob(chat1.ConversationID{}, nil, p, nil)
		return clTask{job: job}
	}

	select {
	case <-j.Pop():
		require.Fail(t, "queue empty")
	default:
	}

	cb := make(chan bool, 1)
	go func() {
		ret := true
		select {
		case <-j.Pop():
		case <-time.After(20 * time.Second):
			ret = false
		}
		cb <- ret
	}()
	time.Sleep(100 * time.Millisecond)
	j.Push(newTask(types.ConvLoaderPriorityLow))
	require.True(t, <-cb)

	require.NoError(t, j.Push(newTask(types.ConvLoaderPriorityLow)))
	require.NoError(t, j.Push(newTask(types.ConvLoaderPriorityLow)))
	require.NoError(t, j.Push(newTask(types.ConvLoaderPriorityMedium)))
	require.NoError(t, j.Push(newTask(types.ConvLoaderPriorityHigh)))
	require.Error(t, j.Push(newTask(types.ConvLoaderPriorityHigh)))
	order := []types.ConvLoaderPriority{types.ConvLoaderPriorityHigh, types.ConvLoaderPriorityMedium,
		types.ConvLoaderPriorityLow, types.ConvLoaderPriorityLow}
	for i := 0; i < len(order); i++ {
		select {
		case task := <-j.Pop():
			require.Equal(t, order[i], task.job.Priority)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no task")
		}
	}

}
