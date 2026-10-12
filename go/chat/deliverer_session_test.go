package chat

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// captureSender records the context BlockingSender.Send would see.
type captureSender struct {
	ch chan context.Context
}

func (s *captureSender) Send(ctx context.Context, _ chat1.ConversationID, _ chat1.MessagePlaintext,
	_ chat1.MessageID, _ *chat1.OutboxID, _ *chat1.SenderSendOptions, _ *chat1.SenderPrepareOptions,
) (chat1.OutboxID, *chat1.MessageBoxed, error) {
	s.ch <- ctx
	return nil, nil, nil
}

func (s *captureSender) Prepare(context.Context, chat1.MessagePlaintext, chat1.ConversationMembersType,
	*chat1.ConversationLocal, *chat1.SenderPrepareOptions,
) (types.SenderPrepareResult, error) {
	return types.SenderPrepareResult{}, errors.New("not used")
}

func kbfsEditRecord(convID chat1.ConversationID) chat1.OutboxRecord {
	return chat1.OutboxRecord{
		ConvID: convID,
		Msg: chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv: chat1.ConversationIDTriple{TopicType: chat1.TopicType_KBFSFILEEDIT},
			},
		},
	}
}

// The KBFS deliver loop starts inside startChatModules, before MarkChatReady
// bumps the session epoch. A context stamped in that window stays stale for
// the life of the loop, and TestEditHistory then never sees the second writer.
func TestKBFSDeliverLoopStampsSessionPerSend(t *testing.T) {
	world := kbtest.NewChatMockWorld(t, "kbfs-deliver-session", 1)
	defer world.Cleanup()
	user := world.GetUsers()[0]
	tc := world.Tcs[user.Username]
	g := tc.Context()
	g.CtxFactory = NewCtxFactory(g)
	uid := user.User.GetUID().ToBytes()

	sender := &captureSender{ch: make(chan context.Context, 1)}
	d := &Deliverer{
		Contextified:     globals.NewContextified(g),
		DebugLabeler:     utils.NewDebugLabeler(g.ExternalG(), "Deliverer", false),
		sender:           sender,
		kbfsDeliverQueue: make(chan chat1.OutboxRecord, 2),
	}
	d.outbox = storage.NewOutbox(g, uid)

	// Same order as startChatModules: the loop is alive while the session is
	// still blocked, then MarkChatReady runs.
	g.BeginChatLogout()
	shutdownCh := make(chan struct{})
	loopDone := make(chan struct{})
	go func() {
		_ = d.kbfsDeliverLoop(shutdownCh)
		close(loopDone)
	}()
	t.Cleanup(func() {
		close(shutdownCh)
		select {
		case <-loopDone:
		case <-time.After(5 * time.Second):
			t.Error("kbfs deliver loop did not stop")
		}
	})

	convID := chat1.ConversationID("0123456789abcdef")
	d.kbfsDeliverQueue <- kbfsEditRecord(convID)
	var beforeReady context.Context
	select {
	case beforeReady = <-sender.ch:
	case <-time.After(5 * time.Second):
		require.Fail(t, "send before MarkChatReady did not run")
	}
	require.True(t, globals.ChatSessionStale(beforeReady, g), "session is not ready yet")

	g.MarkChatReady()
	require.True(t, globals.ChatSessionStale(beforeReady, g), "pre-ready stamp must stay stale")

	d.kbfsDeliverQueue <- kbfsEditRecord(convID)
	var afterReady context.Context
	select {
	case afterReady = <-sender.ch:
	case <-time.After(5 * time.Second):
		require.Fail(t, "send after MarkChatReady did not run")
	}
	require.False(t, globals.ChatSessionStale(afterReady, g))
}

// A stale session used to return AbortedError without closing the localizer
// result channel. BlockingSender.Send waits on that channel, and MarkChatReady
// does not cancel the deliverer context, so the KBFS loop never flushed again.
func TestStaleSessionLocalizeDoesNotHang(t *testing.T) {
	world := kbtest.NewChatMockWorld(t, "stale-localize", 1)
	defer world.Cleanup()
	user := world.GetUsers()[0]
	tc := world.Tcs[user.Username]
	g := tc.Context()
	g.CtxFactory = NewCtxFactory(g)
	uid := user.User.GetUID().ToBytes()

	g.BeginChatLogout()
	staleCtx := globals.ChatCtx(context.Background(), g, keybase1.TLFIdentifyBehavior_CHAT_CLI, nil, nil)
	g.MarkChatReady()
	require.True(t, globals.ChatSessionStale(staleCtx, g))

	pipeline := newLocalizerPipeline(g)
	pipeline.start(context.Background())
	t.Cleanup(func() { <-pipeline.stop(context.Background()) })

	convID := chat1.ConversationID("fedcba9876543210")
	cb := make(chan types.AsyncInboxResult, 1)
	localizer := newBlockingLocalizer(g, pipeline, cb)
	done := make(chan error, 1)
	go func() {
		_, err := localizer.Localize(staleCtx, uid, types.Inbox{
			ConvsUnverified: []types.RemoteConversation{
				types.NewEmptyRemoteConversation(convID),
			},
		}, nil)
		done <- err
	}()
	select {
	case err := <-done:
		require.Error(t, err)
		var aborted storage.AbortedError
		require.ErrorAs(t, err, &aborted)
	case <-time.After(5 * time.Second):
		require.Fail(t, "blocking localize hung on a stale chat session")
	}
}
