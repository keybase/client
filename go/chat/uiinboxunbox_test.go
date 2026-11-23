package chat

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

var (
	unboxConvA = chat1.ConversationID("aaaa")
	unboxConvB = chat1.ConversationID("bbbb")
)

type unboxPassCall struct {
	convIDs []chat1.ConversationID
	final   bool
}

// passRecorder is the pass handed to an inboxUnboxer: it records each call and answers with what
// the test scripted for it, after the test releases it when gated.
type passRecorder struct {
	sync.Mutex
	calls   []unboxPassCall
	retries [][]chat1.ConversationID
	gate    chan struct{}
	called  chan struct{}
}

func newPassRecorder(retries ...[]chat1.ConversationID) *passRecorder {
	return &passRecorder{retries: retries, called: make(chan struct{}, 100)}
}

func (p *passRecorder) pass(ctx context.Context, convIDs []chat1.ConversationID, final bool) []chat1.ConversationID {
	p.Lock()
	n := len(p.calls)
	p.calls = append(p.calls, unboxPassCall{convIDs: convIDs, final: final})
	gate := p.gate
	p.Unlock()
	p.called <- struct{}{}
	if gate != nil {
		<-gate
	}
	if final || n >= len(p.retries) {
		return nil
	}
	return p.retries[n]
}

func (p *passRecorder) getCalls() []unboxPassCall {
	p.Lock()
	defer p.Unlock()
	return append([]unboxPassCall(nil), p.calls...)
}

func (p *passRecorder) waitCalled(t *testing.T) {
	select {
	case <-p.called:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "no pass")
	}
}

// waits for run to sleep before a retry
func waitBackoff(t *testing.T, clock clockwork.FakeClock) {
	ch := make(chan struct{})
	go func() {
		clock.BlockUntil(1)
		close(ch)
	}()
	select {
	case <-ch:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "no retry scheduled")
	}
}

func waitDone(t *testing.T, done chan struct{}) {
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "run did not return")
	}
}

func online(context.Context) bool  { return true }
func offline(context.Context) bool { return false }

func TestInboxUnboxerJoinsRunningPass(t *testing.T) {
	u := newInboxUnboxer(clockwork.NewFakeClock(), newPassRecorder().pass, online)
	require.Equal(t, []chat1.ConversationID{unboxConvA, unboxConvB},
		u.request([]chat1.ConversationID{unboxConvA, unboxConvB, unboxConvA}, false))
	// another screen asking for a conv already being unboxed is answered by that pass
	require.Empty(t, u.request([]chat1.ConversationID{unboxConvA}, false))
	require.Empty(t, u.finish([]chat1.ConversationID{unboxConvA, unboxConvB}))
	require.Equal(t, []chat1.ConversationID{unboxConvA}, u.request([]chat1.ConversationID{unboxConvA}, false))
}

func TestInboxUnboxerForcedRequestGetsOneMorePass(t *testing.T) {
	u := newInboxUnboxer(clockwork.NewFakeClock(), newPassRecorder().pass, online)
	u.request([]chat1.ConversationID{unboxConvA, unboxConvB}, false)
	require.Empty(t, u.request([]chat1.ConversationID{unboxConvA}, true))
	require.Empty(t, u.request([]chat1.ConversationID{unboxConvA}, true))
	require.Equal(t, []chat1.ConversationID{unboxConvA}, u.finish([]chat1.ConversationID{unboxConvA, unboxConvB}))
	// still running for the rerun
	require.Empty(t, u.request([]chat1.ConversationID{unboxConvA}, false))
	require.Empty(t, u.finish([]chat1.ConversationID{unboxConvA}))
}

func TestInboxUnboxerForcedDuplicateInOneRequestIsOnePass(t *testing.T) {
	u := newInboxUnboxer(clockwork.NewFakeClock(), newPassRecorder().pass, online)
	require.Equal(t, []chat1.ConversationID{unboxConvA},
		u.request([]chat1.ConversationID{unboxConvA, unboxConvA}, true))
	require.Empty(t, u.finish([]chat1.ConversationID{unboxConvA}))
}

func TestInboxUnboxerRunRerunsForcedConvs(t *testing.T) {
	rec := newPassRecorder()
	rec.gate = make(chan struct{})
	u := newInboxUnboxer(clockwork.NewFakeClock(), rec.pass, online)
	start := u.request([]chat1.ConversationID{unboxConvA, unboxConvB}, false)
	done := make(chan struct{})
	go func() {
		u.run(context.Background(), start)
		close(done)
	}()
	rec.waitCalled(t)
	u.request([]chat1.ConversationID{unboxConvA}, true)
	u.request([]chat1.ConversationID{unboxConvB}, false)
	rec.gate <- struct{}{}
	rec.waitCalled(t)
	rec.gate <- struct{}{}
	waitDone(t, done)
	calls := rec.getCalls()
	require.Len(t, calls, 2)
	require.Equal(t, []chat1.ConversationID{unboxConvA}, calls[1].convIDs)
	require.Equal(t, []chat1.ConversationID{unboxConvA}, u.request([]chat1.ConversationID{unboxConvA}, false))
}

func TestInboxUnboxerRetriesTransientFailures(t *testing.T) {
	clock := clockwork.NewFakeClock()
	rec := newPassRecorder([]chat1.ConversationID{unboxConvA}, []chat1.ConversationID{unboxConvA})
	u := newInboxUnboxer(clock, rec.pass, online)
	start := u.request([]chat1.ConversationID{unboxConvA, unboxConvB}, false)
	done := make(chan struct{})
	go func() {
		u.run(context.Background(), start)
		close(done)
	}()
	rec.waitCalled(t)
	waitBackoff(t, clock)
	clock.Advance(inboxUnboxRetryBackoff)
	rec.waitCalled(t)
	waitBackoff(t, clock)
	clock.Advance(2 * inboxUnboxRetryBackoff)
	waitDone(t, done)
	require.Equal(t, []unboxPassCall{
		{convIDs: []chat1.ConversationID{unboxConvA, unboxConvB}, final: false},
		{convIDs: []chat1.ConversationID{unboxConvA}, final: false},
		{convIDs: []chat1.ConversationID{unboxConvA}, final: true},
	}, rec.getCalls())
}

func TestInboxUnboxerOfflineAnswersOnFirstPass(t *testing.T) {
	rec := newPassRecorder([]chat1.ConversationID{unboxConvA})
	u := newInboxUnboxer(clockwork.NewFakeClock(), rec.pass, offline)
	done := make(chan struct{})
	go func() {
		u.run(context.Background(), u.request([]chat1.ConversationID{unboxConvA}, false))
		close(done)
	}()
	waitDone(t, done)
	require.Equal(t, []unboxPassCall{{convIDs: []chat1.ConversationID{unboxConvA}, final: true}}, rec.getCalls())
}

func TestInboxUnboxerStopsWhenSessionEnds(t *testing.T) {
	clock := clockwork.NewFakeClock()
	rec := newPassRecorder([]chat1.ConversationID{unboxConvA})
	u := newInboxUnboxer(clock, rec.pass, online)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		u.run(ctx, u.request([]chat1.ConversationID{unboxConvA}, false))
		close(done)
	}()
	rec.waitCalled(t)
	// would get a pass of its own if the session were still on
	u.request([]chat1.ConversationID{unboxConvA}, true)
	waitBackoff(t, clock)
	cancel()
	waitDone(t, done)
	require.Len(t, rec.getCalls(), 1)
}

// The tests below run against kbweb.

type flakyInboxRemote struct {
	chat1.RemoteInterface
	failures atomic.Int32
}

func (f *flakyInboxRemote) GetInboxRemote(ctx context.Context, arg chat1.GetInboxRemoteArg) (chat1.GetInboxRemoteRes, error) {
	if f.failures.Add(-1) >= 0 {
		return chat1.GetInboxRemoteRes{}, errors.New("flaky inbox remote")
	}
	return f.RemoteInterface.GetInboxRemote(ctx, arg)
}

func startUnboxLoader(t *testing.T, ctc *chatTestContext, user *kbtest.FakeUser) (context.Context, *kbtest.ChatUI,
	*UIInboxLoader,
) {
	chatUI := kbtest.NewChatUI()
	ctx := ctc.as(t, user).startCtx
	tc := ctc.world.Tcs[user.Username]
	tc.G.UIRouter = kbtest.NewMockUIRouter(chatUI)
	loader := NewUIInboxLoader(tc.Context())
	tc.ChatG.UIInboxLoader = loader
	loader.Start(ctx, gregor1.UID(user.GetUID().ToBytes()))
	t.Cleanup(func() { <-loader.Stop(ctx) })
	return ctx, chatUI, loader
}

// one inbox result per conv, keyed by conv; fails on anything past n
func recvUnboxResults(t *testing.T, chatUI *kbtest.ChatUI, n int, wait time.Duration) map[chat1.ConvIDStr]kbtest.NonblockInboxResult {
	res := make(map[chat1.ConvIDStr]kbtest.NonblockInboxResult)
	deadline := time.After(wait)
	for {
		select {
		case r := <-chatUI.InboxCb:
			require.NotContains(t, res, r.ConvID.ConvIDStr())
			res[r.ConvID.ConvIDStr()] = r
			require.LessOrEqual(t, len(res), n)
		case <-deadline:
			return res
		}
	}
}

func TestUIInboxLoaderUnboxAnswersEveryConv(t *testing.T) {
	ctc := makeChatTestContext(t, "TestUIInboxLoaderUnboxAnswersEveryConv", 2)
	defer ctc.cleanup()
	users := ctc.users()
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[1])
	ctx, chatUI, loader := startUnboxLoader(t, ctc, users[0])
	unknown := chat1.ConversationID("not-a-conv")

	require.NoError(t, loader.UnboxConvs(ctx, []chat1.ConversationID{conv.Id, unknown}, false))
	res := recvUnboxResults(t, chatUI, 2, 5*time.Second)
	require.Len(t, res, 2)
	require.NotNil(t, res[conv.Id.ConvIDStr()].ConvRes)
	require.Error(t, res[unknown.ConvIDStr()].Err)
}

func TestUIInboxLoaderUnboxJoinsConcurrentRequests(t *testing.T) {
	ctc := makeChatTestContext(t, "TestUIInboxLoaderUnboxJoinsConcurrentRequests", 2)
	defer ctc.cleanup()
	users := ctc.users()
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[1])
	ctx, chatUI, loader := startUnboxLoader(t, ctc, users[0])
	tc := ctc.world.Tcs[users[0].Username]

	// hold the pass in the localizer so the later requests find it running
	tc.Context().InboxSource.Suspend(ctx)
	for range 3 {
		require.NoError(t, loader.UnboxConvs(ctx, []chat1.ConversationID{conv.Id}, false))
	}
	tc.Context().InboxSource.Resume(ctx)
	res := recvUnboxResults(t, chatUI, 1, 5*time.Second)
	require.Len(t, res, 1)
	require.NotNil(t, res[conv.Id.ConvIDStr()].ConvRes)
}

func TestUIInboxLoaderUnboxRetriesTransientReadFailure(t *testing.T) {
	ctc := makeChatTestContext(t, "TestUIInboxLoaderUnboxRetriesTransientReadFailure", 2)
	defer ctc.cleanup()
	users := ctc.users()
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, users[1])
	ctx, chatUI, loader := startUnboxLoader(t, ctc, users[0])
	tc := ctc.world.Tcs[users[0].Username]
	uid := gregor1.UID(users[0].GetUID().ToBytes())

	run := func(failures int32) kbtest.NonblockInboxResult {
		require.NoError(t, tc.Context().InboxSource.Clear(ctx, uid, &types.ClearOpts{SendLocalAdminNotification: false}))
		flaky := &flakyInboxRemote{RemoteInterface: ctc.as(t, users[0]).ri}
		flaky.failures.Store(failures)
		tc.Context().InboxSource.SetRemoteInterface(func() chat1.RemoteInterface { return flaky })
		require.NoError(t, loader.UnboxConvs(ctx, []chat1.ConversationID{conv.Id}, false))
		res := recvUnboxResults(t, chatUI, 1, 10*time.Second)
		require.Len(t, res, 1)
		return res[conv.Id.ConvIDStr()]
	}
	// one failed read: the next attempt answers with the conversation
	require.NotNil(t, run(1).ConvRes)
	// every attempt fails: the conv is answered with a failure
	require.Error(t, run(inboxUnboxAttempts).Err)
}
