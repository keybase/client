package chat

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"encoding/hex"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/ephemeral"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

type chatListener struct {
	sync.Mutex
	libkb.NoopNotifyListener

	// ChatActivity channels
	ephemeralPurge chan chat1.EphemeralPurgeNotifInfo

	obids          []chat1.OutboxID
	incoming       chan int
	failing        chan []chat1.OutboxRecord
	identifyUpdate chan keybase1.CanonicalTLFNameAndIDWithBreaks
	inboxStale     chan struct{}
	threadsStale   chan []chat1.ConversationStaleUpdate
	bgConvLoads    chan chat1.ConversationID
	typingUpdate   chan []chat1.ConvTypingUpdate
	inboxSynced    chan chat1.ChatSyncResult
}

var _ libkb.NotifyListener = (*chatListener)(nil)

func (n *chatListener) ChatIdentifyUpdate(update keybase1.CanonicalTLFNameAndIDWithBreaks) {
	n.identifyUpdate <- update
}
func (n *chatListener) ChatInboxStale(uid keybase1.UID) {
	select {
	case n.inboxStale <- struct{}{}:
	case <-time.After(5 * time.Second):
		panic("timeout on the inbox stale channel")
	}
}
func (n *chatListener) ChatThreadsStale(uid keybase1.UID, updates []chat1.ConversationStaleUpdate) {
	select {
	case n.threadsStale <- updates:
	case <-time.After(5 * time.Second):
		panic("timeout on the threads stale channel")
	}
}
func (n *chatListener) ChatInboxSynced(uid keybase1.UID, topicType chat1.TopicType,
	syncRes chat1.ChatSyncResult) {
	switch topicType {
	case chat1.TopicType_CHAT, chat1.TopicType_NONE:
		select {
		case n.inboxSynced <- syncRes:
		case <-time.After(5 * time.Second):
			panic("timeout on the threads stale channel")
		}
	}
}
func (n *chatListener) ChatTypingUpdate(updates []chat1.ConvTypingUpdate) {
	select {
	case n.typingUpdate <- updates:
	case <-time.After(5 * time.Second):
		panic("timeout on typing update")
	}
}

func (n *chatListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity) {
	n.Lock()
	defer n.Unlock()
	typ, err := activity.ActivityType()
	if err == nil {
		switch typ {
		case chat1.ChatActivityType_INCOMING_MESSAGE:
			if activity.IncomingMessage().Message.IsValid() {
				strOutboxID := activity.IncomingMessage().Message.Valid().OutboxID
				if strOutboxID != nil {
					outboxID, _ := hex.DecodeString(*strOutboxID)
					n.obids = append(n.obids, chat1.OutboxID(outboxID))
					select {
					case n.incoming <- len(n.obids):
					case <-time.After(5 * time.Second):
						panic("timeout on the incoming channel")
					}
				}
			}
		case chat1.ChatActivityType_FAILED_MESSAGE:
			var rmsg []chat1.OutboxRecord
			for _, obr := range activity.FailedMessage().OutboxRecords {
				rmsg = append(rmsg, obr)
			}
			select {
			case n.failing <- rmsg:
			case <-time.After(5 * time.Second):
				panic("timeout on the failing channel")
			}
		case chat1.ChatActivityType_EPHEMERAL_PURGE:
			n.ephemeralPurge <- activity.EphemeralPurge()
		}
	}
}

func (n *chatListener) consumeEphemeralPurge(t *testing.T) chat1.EphemeralPurgeNotifInfo {
	select {
	case x := <-n.ephemeralPurge:
		return x
	case <-time.After(20 * time.Second):
		require.Fail(t, "failed to get ephemeralPurge notification")
		return chat1.EphemeralPurgeNotifInfo{}
	}
}

func newConvTriple(ctx context.Context, t *testing.T, tc *kbtest.ChatTestContext, username string) chat1.ConversationIDTriple {
	return newConvTripleWithMembersType(ctx, t, tc, username, chat1.ConversationMembersType_KBFS)
}

func newConvTripleWithMembersType(ctx context.Context, t *testing.T, tc *kbtest.ChatTestContext,
	username string, membersType chat1.ConversationMembersType) chat1.ConversationIDTriple {
	nameInfo, err := CtxKeyFinder(ctx, tc.Context()).Find(ctx, username, membersType, false)
	require.NoError(t, err)
	topicID, err := utils.NewChatTopicID()
	require.NoError(t, err)
	trip := chat1.ConversationIDTriple{
		Tlfid:     nameInfo.ID,
		TopicType: chat1.TopicType_CHAT,
		TopicID:   chat1.TopicID(topicID),
	}
	return trip
}

func userTc(t *testing.T, world *kbtest.ChatMockWorld, user *kbtest.FakeUser) *kbtest.ChatTestContext {
	for _, u := range world.Users {
		if u.Username == user.Username {
			return world.Tcs[u.Username]
		}
	}
	require.Fail(t, "not user found")
	return &kbtest.ChatTestContext{}
}

func NewChatMockWorld(t *testing.T, name string, numUsers int) (world *kbtest.ChatMockWorld) {
	res := kbtest.NewChatMockWorld(t, name, numUsers)
	for _, w := range res.Tcs {
		teams.ServiceInit(w.G)
		ephemeral.ServiceInit(w.G)
	}
	return res
}

func setupTest(t *testing.T, numUsers int) (context.Context, *kbtest.ChatMockWorld, chat1.RemoteInterface, types.Sender, types.Sender, *chatListener) {
	var ri chat1.RemoteInterface
	world := NewChatMockWorld(t, "chatsender", numUsers)
	ri = kbtest.NewChatRemoteMock(world)
	tlf := kbtest.NewTlfMock(world)
	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	tc.G.SetService()
	g := globals.NewContext(tc.G, tc.ChatG)
	uid := u.User.GetUID().ToBytes()

	var ctx context.Context
	if useRemoteMock {
		ctx = newTestContextWithTlfMock(tc, tlf)
	} else {
		ctx = newTestContext(tc)
		nist, err := tc.G.ActiveDevice.NIST(context.TODO())
		if err != nil {
			t.Fatalf(err.Error())
		}
		sessionToken := nist.Token().String()
		gh := newGregorTestConnection(tc.Context(), uid, sessionToken)
		require.NoError(t, gh.Connect(ctx))
		ri = gh.GetClient()
	}
	boxer := NewBoxer(g)
	boxer.SetClock(world.Fc)
	getRI := func() chat1.RemoteInterface { return ri }
	baseSender := NewBlockingSender(g, boxer, nil, getRI)
	// Force a small page size here to test prev pointer calculations for
	// exploding and non exploding messages
	baseSender.setPrevPagination(&chat1.Pagination{Num: 2})
	sender := NewNonblockingSender(g, baseSender)
	listener := chatListener{
		incoming:       make(chan int, 100),
		failing:        make(chan []chat1.OutboxRecord, 100),
		identifyUpdate: make(chan keybase1.CanonicalTLFNameAndIDWithBreaks, 10),
		inboxStale:     make(chan struct{}, 1),
		threadsStale:   make(chan []chat1.ConversationStaleUpdate, 1),
		bgConvLoads:    make(chan chat1.ConversationID, 10),
		typingUpdate:   make(chan []chat1.ConvTypingUpdate, 10),
		inboxSynced:    make(chan chat1.ChatSyncResult, 10),
		ephemeralPurge: make(chan chat1.EphemeralPurgeNotifInfo, 10),
	}
	chatStorage := storage.New(g, nil)
	chatStorage.SetClock(world.Fc)
	g.ConvSource = NewHybridConversationSource(g, boxer, chatStorage, getRI)
	chatStorage.SetAssetDeleter(g.ConvSource)
	g.InboxSource = NewHybridInboxSource(g, getRI)
	g.ServerCacheVersions = storage.NewServerVersions(g)
	g.NotifyRouter.SetListener(&listener)

	deliverer := NewDeliverer(g, baseSender)
	deliverer.SetClock(world.Fc)
	deliverer.setTestingNameInfoSource(tlf)

	g.MessageDeliverer = deliverer
	g.MessageDeliverer.Start(context.TODO(), uid)
	g.MessageDeliverer.Connected(context.TODO())

	g.FetchRetrier = NewFetchRetrier(g)
	g.FetchRetrier.(*FetchRetrier).SetClock(world.Fc)
	g.FetchRetrier.Connected(context.TODO())
	g.FetchRetrier.Start(context.TODO(), uid)

	convLoader := NewBackgroundConvLoader(g)
	convLoader.loads = listener.bgConvLoads
	convLoader.setTestingNameInfoSource(tlf)
	g.ConvLoader = convLoader
	g.ConvLoader.Start(context.TODO(), uid)

	purger := NewBackgroundEphemeralPurger(g, chatStorage)
	purger.SetClock(world.Fc)
	g.EphemeralPurger = purger
	g.EphemeralPurger.Start(context.TODO(), uid)

	chatSyncer := NewSyncer(g)
	chatSyncer.isConnected = true
	g.Syncer = chatSyncer

	g.ConnectivityMonitor = &libkb.NullConnectivityMonitor{}
	pushHandler := NewPushHandler(g)
	pushHandler.SetClock(world.Fc)
	g.PushHandler = pushHandler
	g.ChatHelper = NewHelper(g, getRI)
	g.TeamChannelSource = NewCachingTeamChannelSource(g, getRI)
	g.ActivityNotifier = NewNotifyRouterActivityRouter(g)

	searcher := NewSearcher(g)
	// Force small pages during tests to ensure we fetch context from new pages
	searcher.pageSize = 2
	g.Searcher = searcher
	g.AttachmentURLSrv = DummyAttachmentHTTPSrv{}

	return ctx, world, ri, sender, baseSender, &listener
}

func TestNonblockChannel(t *testing.T) {
	ctx, world, ri, sender, blockingSender, listener := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := userTc(t, world, u)
	conv := newBlankConv(ctx, t, tc, uid, ri, blockingSender, u.Username)

	// Send nonblock
	obid, _, err := sender.Send(context.TODO(), conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "hi",
		}),
	}, 0, nil)
	require.NoError(t, err)

	select {
	case <-listener.incoming:
	case <-time.After(20 * time.Second):
		require.Fail(t, "event not received")
	}

	require.Equal(t, 1, len(listener.obids), "wrong length")
	require.Equal(t, obid, listener.obids[0], "wrong obid")
}

type sentRecord struct {
	msgID    *chat1.MessageID
	outboxID *chat1.OutboxID
}

func checkThread(t *testing.T, thread chat1.ThreadView, ref []sentRecord) {
	require.Equal(t, len(ref), len(thread.Messages), "size not equal")
	for index, msg := range thread.Messages {
		rindex := len(ref) - index - 1
		t.Logf("checking index: %d rindex: %d", index, rindex)
		if ref[rindex].msgID != nil {
			t.Logf("msgID: ref: %d actual: %d", *ref[rindex].msgID, thread.Messages[index].GetMessageID())
			require.NotZero(t, msg.GetMessageID(), "missing message ID")
			require.Equal(t, *ref[rindex].msgID, msg.GetMessageID(), "invalid message ID")
		} else if ref[index].outboxID != nil {
			t.Logf("obID: ref: %s actual: %s",
				hex.EncodeToString(*ref[rindex].outboxID),
				hex.EncodeToString(msg.Outbox().OutboxID))
			require.Equal(t, *ref[rindex].outboxID, msg.Outbox().OutboxID, "invalid outbox ID")
		} else {
			require.Fail(t, "unknown ref type")
		}
		t.Logf("index %d succeeded", index)
	}
}

func TestNonblockTimer(t *testing.T) {
	ctx, world, ri, _, baseSender, listener := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	clock := world.Fc
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

	// Send a bunch of blocking messages
	var sentRef []sentRecord
	for i := 0; i < 5; i++ {
		_, msgBoxed, err := baseSender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        trip,
				Sender:      u.User.GetUID().ToBytes(),
				TlfName:     u.Username,
				TlfPublic:   false,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "hi",
			}),
		}, 0, nil)
		require.NoError(t, err)
		msgID := msgBoxed.GetMessageID()
		t.Logf("generated msgID: %d", msgID)
		sentRef = append(sentRef, sentRecord{msgID: &msgID})
	}

	outbox := storage.NewOutbox(tc.Context(), u.User.GetUID().ToBytes())
	outbox.SetClock(clock)
	var obids []chat1.OutboxID
	msgID := *sentRef[len(sentRef)-1].msgID
	for i := 0; i < 5; i++ {
		obr, err := outbox.PushMessage(ctx, res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        trip,
				Sender:      u.User.GetUID().ToBytes(),
				TlfName:     u.Username,
				TlfPublic:   false,
				MessageType: chat1.MessageType_TEXT,
				OutboxInfo: &chat1.OutboxInfo{
					Prev: msgID,
				},
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "hi",
			}),
		}, nil, keybase1.TLFIdentifyBehavior_CHAT_CLI)
		obid := obr.OutboxID
		t.Logf("generated obid: %s prev: %d", hex.EncodeToString(obid), msgID)
		require.NoError(t, err)
		sentRef = append(sentRef, sentRecord{outboxID: &obid})
		obids = append(obids, obid)
	}

	// Make we get nothing until timer is up
	select {
	case <-listener.incoming:
		require.Fail(t, "action event received too soon")
	default:
	}
	select {
	case <-listener.failing:
		require.Fail(t, "failed message")
	default:
	}

	// Send a bunch of blocking messages
	for i := 0; i < 5; i++ {
		_, msgBoxed, err := baseSender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        trip,
				Sender:      u.User.GetUID().ToBytes(),
				TlfName:     u.Username,
				TlfPublic:   false,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "hi",
			}),
		}, 0, nil)
		require.NoError(t, err)
		msgID := msgBoxed.GetMessageID()
		t.Logf("generated msgID: %d", msgID)
		sentRef = append(sentRef, sentRecord{msgID: &msgID})
	}

	// Check get thread, make sure it makes sense
	typs := []chat1.MessageType{chat1.MessageType_TEXT}
	tres, err := tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{MessageTypes: typs}, nil)
	tres.Messages = utils.FilterByType(tres.Messages, &chat1.GetThreadQuery{MessageTypes: typs}, true)
	t.Logf("source size: %d", len(tres.Messages))
	require.NoError(t, err)
	checkThread(t, tres, sentRef)
	clock.Advance(5 * time.Minute)

	// Should get a blast of all 5

	var olen int
	for i := 0; i < 10; i++ {
		select {
		case olen = <-listener.incoming:
		case <-time.After(20 * time.Second):
			require.Fail(t, "event not received")
		}

		t.Logf("OUTBOXID: %s", obids[i/2])
		require.Equal(t, i+1, olen, "wrong length")
		require.Equal(t, listener.obids[i], obids[i/2], "wrong obid")
	}

	// Make sure it is really empty
	clock.Advance(5 * time.Minute)
	select {
	case <-listener.incoming:
		require.Fail(t, "action event received too soon")
	default:
	}
}

type FailingSender struct {
}

var _ types.Sender = (*FailingSender)(nil)

func (f FailingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID, outboxID *chat1.OutboxID) (chat1.OutboxID, *chat1.MessageBoxed, error) {
	return chat1.OutboxID{}, nil, fmt.Errorf("I always fail!!!!")
}

func (f FailingSender) Prepare(ctx context.Context, msg chat1.MessagePlaintext,
	membersType chat1.ConversationMembersType, convID *chat1.Conversation) (*chat1.MessageBoxed, []chat1.Asset, []gregor1.UID, chat1.ChannelMention, *chat1.TopicNameState, error) {
	return nil, nil, nil, chat1.ChannelMention_NONE, nil, nil
}

func recordCompare(t *testing.T, obids []chat1.OutboxID, obrs []chat1.OutboxRecord) {
	require.Equal(t, len(obids), len(obrs), "wrong length")
	for i := 0; i < len(obids); i++ {
		require.Equal(t, obids[i], obrs[i].OutboxID)
	}
}

func TestFailingSender(t *testing.T) {

	ctx, world, ri, sender, _, listener := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	tc := userTc(t, world, u)
	trip := newConvTriple(ctx, t, tc, u.Username)
	res, err := ri.NewConversationRemote2(context.TODO(), chat1.NewConversationRemote2Arg{
		IdTriple: trip,
		TLFMessage: chat1.MessageBoxed{
			ClientHeader: chat1.MessageClientHeader{
				Conv:      trip,
				TlfName:   u.Username,
				TlfPublic: false,
			},
			KeyGeneration: 1,
		},
	})
	require.NoError(t, err)

	tc.ChatG.MessageDeliverer.(*Deliverer).SetSender(FailingSender{})

	// Send nonblock
	var obids []chat1.OutboxID
	for i := 0; i < 5; i++ {
		obid, _, err := sender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:      trip,
				Sender:    u.User.GetUID().ToBytes(),
				TlfName:   u.Username,
				TlfPublic: false,
			},
		}, 0, nil)
		require.NoError(t, err)
		obids = append(obids, obid)
	}
	for i := 0; i < deliverMaxAttempts; i++ {
		tc.ChatG.MessageDeliverer.ForceDeliverLoop(context.TODO())
	}

	var recvd []chat1.OutboxRecord
	for {
		select {
		case fid := <-listener.failing:
			recvd = append(recvd, fid...)
		case <-time.After(20 * time.Second):
			require.Fail(t, "event not received", "len(recvd): %d", len(recvd))
		}
		if len(recvd) >= len(obids) {
			break
		}
	}

	require.Equal(t, len(obids), len(recvd), "invalid length")
	recordCompare(t, obids, recvd)
	state, err := recvd[0].State.State()
	require.NoError(t, err)
	require.Equal(t, chat1.OutboxStateType_ERROR, state, "wrong state type")
}

func TestOutboxItemExpiration(t *testing.T) {
	ctx, world, ri, sender, baseSender, listener := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	cl := world.Fc
	tc := userTc(t, world, u)
	conv := newBlankConv(ctx, t, tc, uid, ri, baseSender, u.Username)

	tc.ChatG.MessageDeliverer.Disconnected(ctx)
	tc.ChatG.MessageDeliverer.(*Deliverer).SetSender(baseSender)
	obid, _, err := sender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "hi",
		}),
	}, 0, nil)
	require.NoError(t, err)
	cl.Advance(20 * time.Minute)
	tc.ChatG.MessageDeliverer.Connected(ctx)
	select {
	case f := <-listener.failing:
		require.Len(t, f, 1)
		require.Equal(t, obid, f[0].OutboxID)
		st, err := f[0].State.State()
		require.NoError(t, err)
		require.Equal(t, chat1.OutboxStateType_ERROR, st)
		require.Equal(t, chat1.OutboxErrorType_EXPIRED, f[0].State.Error().Typ)
	case <-time.After(20 * time.Second):
		require.Fail(t, "no failing message")
	}
	select {
	case <-listener.incoming:
		require.Fail(t, "no incoming message")
	default:
	}

	outbox := storage.NewOutbox(tc.Context(), uid)
	outbox.SetClock(cl)
	require.NoError(t, outbox.RetryMessage(ctx, obid, nil))
	tc.ChatG.MessageDeliverer.ForceDeliverLoop(ctx)
	select {
	case i := <-listener.incoming:
		require.Equal(t, 1, i)
	case <-time.After(20 * time.Second):
		require.Fail(t, "no success")
	}
	select {
	case <-listener.failing:
		require.Fail(t, "no failing message")
	default:
	}
}

func TestDisconnectedFailure(t *testing.T) {
	ctx, world, ri, sender, baseSender, listener := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	cl := world.Fc
	tc := userTc(t, world, u)
	conv := newBlankConv(ctx, t, tc, uid, ri, baseSender, u.Username)

	tc.ChatG.MessageDeliverer.Disconnected(ctx)
	tc.ChatG.MessageDeliverer.(*Deliverer).SetSender(baseSender)

	mkMsg := func() chat1.MessagePlaintext {
		return chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Metadata.IdTriple,
				Sender:      uid,
				TlfName:     u.Username,
				TlfPublic:   false,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body: "hi",
			}),
		}
	}

	// If not offline for long enough, we should be able to get a send by just reconnecting
	obid, _, err := sender.Send(ctx, conv.GetConvID(), mkMsg(), 0, nil)
	require.NoError(t, err)
	cl.Advance(time.Millisecond)
	select {
	case <-listener.failing:
		require.Fail(t, "no failed message")
	default:
	}
	tc.ChatG.MessageDeliverer.Connected(ctx)
	for i := 0; i < 2; i++ {
		select {
		case inc := <-listener.incoming:
			require.Equal(t, i+1, inc)
			require.Equal(t, obid, listener.obids[0])
		case <-time.After(20 * time.Second):
			require.Fail(t, "no incoming message")
		}
	}
	listener.obids = nil

	tc.ChatG.MessageDeliverer.Disconnected(ctx)
	tc.ChatG.MessageDeliverer.(*Deliverer).SetSender(FailingSender{})
	cl.Advance(time.Hour)

	// Send nonblock
	obids := []chat1.OutboxID{}
	for i := 0; i < 3; i++ {
		obid, _, err = sender.Send(ctx, conv.GetConvID(), mkMsg(), 0, nil)
		require.NoError(t, err)
		obids = append(obids, obid)
		cl.Advance(time.Millisecond)
	}

	var allrecvd []chat1.OutboxRecord
	var recvd []chat1.OutboxRecord
	appendUnique := func(a []chat1.OutboxRecord, r []chat1.OutboxRecord) (res []chat1.OutboxRecord) {
		m := make(map[string]bool)
		for _, i := range a {
			m[hex.EncodeToString(i.OutboxID)] = true
			res = append(res, i)
		}
		for _, i := range r {
			if !m[hex.EncodeToString(i.OutboxID)] {
				res = append(res, i)
			}
		}
		return res
	}
	for {
		select {
		case recvd = <-listener.failing:
			allrecvd = appendUnique(allrecvd, recvd)
			if len(allrecvd) >= len(obids) {
				break
			}
			continue
		case <-time.After(20 * time.Second):
			require.Fail(t, "timeout in failing loop")
		}
		break
	}

	require.Equal(t, len(obids), len(allrecvd), "invalid length")
	recordCompare(t, obids, allrecvd)

	t.Logf("reconnecting and checking for successes")
	<-tc.ChatG.MessageDeliverer.Stop(ctx)
	<-tc.ChatG.MessageDeliverer.Stop(ctx)
	tc.ChatG.MessageDeliverer.(*Deliverer).SetSender(baseSender)
	outbox := storage.NewOutbox(tc.Context(), u.User.GetUID().ToBytes())
	outbox.SetClock(cl)
	for _, obid := range obids {
		require.NoError(t, outbox.RetryMessage(ctx, obid, nil))
	}
	tc.ChatG.MessageDeliverer.Start(ctx, u.User.GetUID().ToBytes())
	tc.ChatG.MessageDeliverer.Connected(ctx)

	for {
		select {
		case inc := <-listener.incoming:
			if inc >= 2*len(obids) {
				break
			}
			continue
		case <-time.After(20 * time.Second):
			require.Fail(t, "timeout in incoming loop")
		}
		break
	}
	require.Equal(t, 2*len(obids), len(listener.obids), "wrong amount of successes")
	for index, obid := range listener.obids {
		require.Equal(t, obid, obids[index/2])
	}
}

// The sender is responsible for making sure that a deletion of a single
// message is expanded to include all of its edits.
func TestDeletionHeaders(t *testing.T) {
	ctx, world, ri, _, blockingSender, _ := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := userTc(t, world, u)
	conv := newBlankConv(ctx, t, tc, uid, ri, blockingSender, u.Username)

	// Send a message and two edits.
	_, firstMessageBoxed, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
	}, 0, nil)
	require.NoError(t, err)
	firstMessageID := firstMessageBoxed.GetMessageID()
	_, editBoxed, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_EDIT,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: firstMessageID, Body: "bar"}),
	}, 0, nil)
	require.NoError(t, err)
	editID := editBoxed.GetMessageID()
	_, editBoxed2, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_EDIT,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: firstMessageID, Body: "baz"}),
	}, 0, nil)
	require.NoError(t, err)
	editID2 := editBoxed2.GetMessageID()

	// Now prepare a deletion.
	deletion := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_DELETE,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageIDs: []chat1.MessageID{firstMessageID}}),
	}
	preparedDeletion, _, _, _, _, err := blockingSender.Prepare(ctx, deletion,
		chat1.ConversationMembersType_KBFS, &conv)
	require.NoError(t, err)

	// Assert that the deletion gets the edit too.
	deletedIDs := map[chat1.MessageID]bool{}
	for _, id := range preparedDeletion.ClientHeader.Deletes {
		deletedIDs[id] = true
	}
	if len(deletedIDs) != 3 {
		t.Fatalf("expected 3 deleted IDs, found %d", len(deletedIDs))
	}
	if !deletedIDs[firstMessageID] {
		t.Fatalf("expected message #%d to be deleted", firstMessageID)
	}
	if !deletedIDs[editID] {
		t.Fatalf("expected message #%d to be deleted", editID)
	}
	if !deletedIDs[editID2] {
		t.Fatalf("expected message #%d to be deleted", editID2)
	}
}

func TestAtMentionsText(t *testing.T) {
	ctx, world, ri, _, blockingSender, _ := setupTest(t, 3)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	u1 := world.GetUsers()[1]
	u2 := world.GetUsers()[2]
	uid := u.User.GetUID().ToBytes()
	uid1 := u1.User.GetUID().ToBytes()
	uid2 := u2.User.GetUID().ToBytes()
	tc := userTc(t, world, u)
	conv := newBlankConv(ctx, t, tc, uid, ri, blockingSender, u.Username)

	text := fmt.Sprintf("@%s hello! From @%s. @ksjdskj", u1.Username, u2.Username)
	t.Logf("text: %s", text)
	_, _, atMentions, chanMention, _, err := blockingSender.Prepare(ctx, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      uid,
			TlfName:     u.Username,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: text,
		}),
	}, chat1.ConversationMembersType_KBFS, &conv)
	require.NoError(t, err)
	require.Equal(t, []gregor1.UID{uid1, uid2}, atMentions)
	require.Equal(t, chat1.ChannelMention_NONE, chanMention)

	text = "Hello @channel!"
	_, _, atMentions, chanMention, _, err = blockingSender.Prepare(ctx, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      uid,
			TlfName:     u.Username,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: text,
		}),
	}, chat1.ConversationMembersType_KBFS, &conv)
	require.NoError(t, err)
	require.Zero(t, len(atMentions))
	require.Equal(t, chat1.ChannelMention_ALL, chanMention)
}

func TestAtMentionsEdit(t *testing.T) {
	ctx, world, ri, _, blockingSender, _ := setupTest(t, 3)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	u1 := world.GetUsers()[1]
	u2 := world.GetUsers()[2]
	uid := u.User.GetUID().ToBytes()
	uid1 := u1.User.GetUID().ToBytes()
	uid2 := u2.User.GetUID().ToBytes()
	tc := userTc(t, world, u)
	conv := newBlankConv(ctx, t, tc, uid, ri, blockingSender, u.Username)

	text := fmt.Sprintf("%s hello! From %s. @ksjdskj", u1.Username, u2.Username)
	t.Logf("text: %s", text)
	_, firstMessageBoxed, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      uid,
			TlfName:     u.Username,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: text,
		}),
	}, 0, nil)
	require.NoError(t, err)

	// edit that message and add atMentions
	text = fmt.Sprintf("@%s hello! From @%s. @ksjdskj", u1.Username, u2.Username)
	firstMessageID := firstMessageBoxed.GetMessageID()
	_, _, atMentions, chanMention, _, err := blockingSender.Prepare(ctx, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_EDIT,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
			MessageID: firstMessageID,
			Body:      text,
		}),
	}, chat1.ConversationMembersType_KBFS, &conv)
	require.NoError(t, err)
	require.Equal(t, []gregor1.UID{uid1, uid2}, atMentions)
	require.Equal(t, chat1.ChannelMention_NONE, chanMention)

	// edit the message and add channel mention
	text = "Hello @channel!"
	_, _, atMentions, chanMention, _, err = blockingSender.Prepare(ctx, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      uid,
			TlfName:     u.Username,
			MessageType: chat1.MessageType_EDIT,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
			MessageID: firstMessageID,
			Body:      text,
		}),
	}, chat1.ConversationMembersType_KBFS, &conv)
	require.NoError(t, err)
	require.Zero(t, len(atMentions))
	require.Equal(t, chat1.ChannelMention_ALL, chanMention)
}

func TestKBFSFileEditSize(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		switch mt {
		case chat1.ConversationMembersType_IMPTEAMNATIVE, chat1.ConversationMembersType_TEAM:
		default:
			return
		}
		ctx, world, ri, _, blockingSender, _ := setupTest(t, 1)
		defer world.Cleanup()

		u := world.GetUsers()[0]
		uid := u.User.GetUID().ToBytes()
		tlfName := u.Username
		tc := userTc(t, world, u)
		conv, err := NewConversation(ctx, tc.Context(), uid, tlfName, nil, chat1.TopicType_KBFSFILEEDIT,
			chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFVisibility_PRIVATE,
			func() chat1.RemoteInterface { return ri })
		require.NoError(t, err)

		body := strings.Repeat("M", 100000)
		_, _, err = blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Sender:      uid,
				TlfName:     tlfName,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: body}),
		}, 0, nil)
		require.NoError(t, err)
	})
}

func TestKBFSCryptKeysBit(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		ctx, world, ri, _, blockingSender, _ := setupTest(t, 1)
		defer world.Cleanup()

		u := world.GetUsers()[0]
		uid := u.User.GetUID().ToBytes()
		tc := userTc(t, world, u)
		var name string
		switch mt {
		case chat1.ConversationMembersType_TEAM:
			name = createTeam(tc.TestContext)
		default:
			name = u.Username
		}

		conv := newBlankConvWithMembersType(ctx, t, tc, uid, ri, blockingSender, name, mt)
		_, _, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Metadata.IdTriple,
				Sender:      uid,
				TlfName:     name,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
		}, 0, nil)
		require.NoError(t, err)
		tv, err := tc.ChatG.ConvSource.Pull(ctx, conv.GetConvID(), uid,
			chat1.GetThreadReason_GENERAL,
			&chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
			}, nil)
		require.NoError(t, err)
		require.Len(t, tv.Messages, 1)
		msg := tv.Messages[0]

		require.NotNil(t, msg.Valid().ClientHeader.KbfsCryptKeysUsed)
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			require.True(t, *msg.Valid().ClientHeader.KbfsCryptKeysUsed)
		default:
			require.False(t, *msg.Valid().ClientHeader.KbfsCryptKeysUsed)
		}
	})
}

func TestPrevPointerAddition(t *testing.T) {
	mt := chat1.ConversationMembersType_TEAM
	runWithEphemeral(t, mt, func(ephemeralLifetime *gregor1.DurationSec) {
		ctx, world, ri2, _, blockingSender, _ := setupTest(t, 1)
		defer world.Cleanup()

		ri := ri2.(*kbtest.ChatRemoteMock)
		var ephemeralMetadata *chat1.MsgEphemeralMetadata
		if ephemeralLifetime != nil {
			ephemeralMetadata = &chat1.MsgEphemeralMetadata{
				Lifetime: *ephemeralLifetime,
			}
		}
		u := world.GetUsers()[0]
		uid := u.User.GetUID().ToBytes()
		tc := userTc(t, world, u)
		conv := newBlankConv(ctx, t, tc, uid, ri, blockingSender, u.Username)

		// Send a bunch of messages on this convo
		for i := 0; i < 10; i++ {
			_, _, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:              conv.Metadata.IdTriple,
					Sender:            uid,
					TlfName:           u.Username,
					MessageType:       chat1.MessageType_TEXT,
					EphemeralMetadata: ephemeralMetadata,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
			}, 0, nil)
			require.NoError(t, err)
		}

		// Hide all ephemeral messages by advancing the clock enough to hide
		// the "ash" lines.  We also mock out the server call so we can
		// simulate a chat with only long exploded ephemeral messages.
		if ephemeralLifetime != nil {
			t.Logf("expiry all ephemeral messages")
			world.Fc.Advance(time.Second*time.Duration(*ephemeralLifetime) + chat1.ShowExplosionLifetime)
			// Mock out server call for new messages
			ri.GetThreadRemoteFunc = func(m *kbtest.ChatRemoteMock, ctx context.Context, arg chat1.GetThreadRemoteArg) (chat1.GetThreadRemoteRes, error) {
				return chat1.GetThreadRemoteRes{
					Thread: chat1.ThreadViewBoxed{
						Pagination: &chat1.Pagination{},
					},
				}, nil
			}
			// Prepare a regular message and make sure it gets prev pointers
			boxed, pendingAssetDeletes, _, _, _, err := blockingSender.Prepare(ctx, chat1.MessagePlaintext{
				ClientHeader: chat1.MessageClientHeader{
					Conv:              conv.Metadata.IdTriple,
					Sender:            uid,
					TlfName:           u.Username,
					MessageType:       chat1.MessageType_TEXT,
					EphemeralMetadata: ephemeralMetadata,
				},
				MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
			}, mt, &conv)
			require.NoError(t, err)
			require.Empty(t, pendingAssetDeletes)
			// With all of the messages filtered because they exploded and the
			// server not returning results, we give up and don't attach any
			// prevs.
			require.Empty(t, boxed.ClientHeader.Prev, "empty prev pointers")
			ri.GetThreadRemoteFunc = nil
		}

		// Nuke the body cache
		require.NoError(t, storage.New(tc.Context(), tc.ChatG.ConvSource).MaybeNuke(context.TODO(), true, nil, conv.GetConvID(), uid))

		// Fetch a subset into the cache
		_, err := tc.ChatG.ConvSource.Pull(ctx, conv.GetConvID(), uid, chat1.GetThreadReason_GENERAL, nil,
			&chat1.Pagination{
				Num: 2,
			})
		require.NoError(t, err)

		// Prepare a regular message and make sure it gets prev pointers
		boxed, pendingAssetDeletes, _, _, _, err := blockingSender.Prepare(ctx, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Metadata.IdTriple,
				Sender:      uid,
				TlfName:     u.Username,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
		}, mt, &conv)
		require.NoError(t, err)
		require.Empty(t, pendingAssetDeletes)
		if ephemeralLifetime == nil {
			require.NotEmpty(t, boxed.ClientHeader.Prev, "empty prev pointers")
		} else {
			// Since we only sent ephemeral messages previously, we won't have
			// any prev pointers to regular messages here.
			require.Empty(t, boxed.ClientHeader.Prev, "empty prev pointers")
		}
	})
}

// Test a DELETE attempts to delete all associated assets.
// func TestDeletionHeaders(t *testing.T) { // <- TODO delete this line
func TestDeletionAssets(t *testing.T) {
	ctx, world, ri, _, blockingSender, _ := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := userTc(t, world, u)
	conv := newBlankConv(ctx, t, tc, uid, ri, blockingSender, u.Username)
	trip := conv.Metadata.IdTriple

	var doomedAssets []chat1.Asset
	mkAsset := func() chat1.Asset {
		asset := chat1.Asset{
			Path: fmt.Sprintf("test-asset-%v", len(doomedAssets)),
			Size: 8,
		}
		doomedAssets = append(doomedAssets, asset)
		return asset
	}

	// Send an attachment message and 3 MessageAttachUploaded's.
	tmp1 := mkAsset()
	_, firstMessageBoxed, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      uid,
			TlfName:     u.Username,
			MessageType: chat1.MessageType_ATTACHMENT,
		},
		MessageBody: chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
			Object: mkAsset(),
			// Use v1 and v2 assets for fuller coverage. These would never both exist in a real message.
			Preview:  &tmp1,
			Previews: []chat1.Asset{mkAsset(), mkAsset()},
		}),
	}, 0, nil)
	require.NoError(t, err)
	firstMessageID := firstMessageBoxed.GetMessageID()

	editHeader := chat1.MessageClientHeader{
		Conv:        trip,
		Sender:      uid,
		TlfName:     u.Username,
		MessageType: chat1.MessageType_ATTACHMENTUPLOADED,
		Supersedes:  firstMessageID,
	}
	_, edit1Boxed, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: editHeader,
		MessageBody: chat1.NewMessageBodyWithAttachmentuploaded(chat1.MessageAttachmentUploaded{
			MessageID: firstMessageID,
			Object:    mkAsset(),
			Previews:  []chat1.Asset{mkAsset(), mkAsset()},
		}),
	}, 0, nil)
	require.NoError(t, err)
	edit1ID := edit1Boxed.GetMessageID()
	_, edit2Boxed, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: editHeader,
		MessageBody: chat1.NewMessageBodyWithAttachmentuploaded(chat1.MessageAttachmentUploaded{
			MessageID: firstMessageID,
			Object:    mkAsset(),
			Previews:  []chat1.Asset{mkAsset(), mkAsset()},
		}),
	}, 0, nil)
	require.NoError(t, err)
	edit2ID := edit2Boxed.GetMessageID()
	_, edit3Boxed, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: editHeader,
		MessageBody: chat1.NewMessageBodyWithAttachmentuploaded(chat1.MessageAttachmentUploaded{
			MessageID: firstMessageID,
			Object:    chat1.Asset{},
			Previews:  nil,
		}),
	}, 0, nil)
	require.NoError(t, err)
	edit3ID := edit3Boxed.GetMessageID()

	require.Equal(t, len(doomedAssets), 10, "wrong number of assets created")

	// Now prepare a deletion.
	deletion := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      uid,
			TlfName:     u.Username,
			MessageType: chat1.MessageType_DELETE,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageIDs: []chat1.MessageID{firstMessageID}}),
	}
	preparedDeletion, pendingAssetDeletes, _, _, _, err := blockingSender.Prepare(ctx, deletion,
		chat1.ConversationMembersType_KBFS, &conv)
	require.NoError(t, err)

	assertAssetSetsEqual(t, pendingAssetDeletes, doomedAssets)
	require.Equal(t, len(doomedAssets), len(pendingAssetDeletes), "wrong number of assets pending deletion")

	// Assert that the deletion gets the MessageAttachmentUploaded's too.
	deletedIDs := map[chat1.MessageID]bool{}
	for _, id := range preparedDeletion.ClientHeader.Deletes {
		deletedIDs[id] = true
	}
	if len(deletedIDs) != 4 {
		t.Fatalf("expected 4 deleted IDs, found %d", len(deletedIDs))
	}
	if !deletedIDs[firstMessageID] {
		t.Fatalf("expected message #%d to be deleted", firstMessageID)
	}
	if !deletedIDs[edit1ID] {
		t.Fatalf("expected message #%d to be deleted", edit1ID)
	}
	if !deletedIDs[edit2ID] {
		t.Fatalf("expected message #%d to be deleted", edit2ID)
	}
	if !deletedIDs[edit3ID] {
		t.Fatalf("expected message #%d to be deleted", edit3ID)
	}
}

func assertAssetSetsEqual(t *testing.T, got []chat1.Asset, expected []chat1.Asset) {
	if !compareAssetLists(t, got, expected, false) {
		compareAssetLists(t, got, expected, true)
		t.Fatalf("asset lists not equal")
	}
}

// compareAssetLists compares two unordered sets of assets based on Path only.
func compareAssetLists(t *testing.T, got []chat1.Asset, expected []chat1.Asset, verbose bool) bool {
	match := true
	gMap := make(map[string]chat1.Asset)
	eMap := make(map[string]chat1.Asset)
	for _, a := range got {
		gMap[a.Path] = a
	}
	for _, a := range expected {
		eMap[a.Path] = a
		if gMap[a.Path].Path != a.Path {
			match = false
			if verbose {
				t.Logf("expected: %v", a.Path)
			}
		}
	}
	for _, a := range got {
		if eMap[a.Path].Path != a.Path {
			match = false
			if verbose {
				t.Logf("got unexpected: %v", a.Path)
			}
		}
	}
	if match && len(got) != len(expected) {
		if verbose {
			t.Logf("list contains duplicates or compareAssetLists has a bug")
			for i, a := range got {
				t.Logf("[%v] %v", i, a.Path)
			}
		}
		return false
	}

	return match
}

func TestPairwiseMACChecker(t *testing.T) {
	runWithMemberTypes(t, func(mt chat1.ConversationMembersType) {
		// Don't run this test for kbfs
		switch mt {
		case chat1.ConversationMembersType_KBFS:
			return
		default:
		}

		ctc := makeChatTestContext(t, "TestPairwiseMACChecker", 2)
		defer ctc.cleanup()
		users := ctc.users()

		firstConv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT, mt, users[1])
		ctx := ctc.as(t, users[0]).startCtx
		ncres, err := ctc.as(t, users[0]).chatLocalHandler().NewConversationLocal(ctx,
			chat1.NewConversationLocalArg{
				TlfName:       firstConv.TlfName,
				TopicType:     chat1.TopicType_CHAT,
				TlfVisibility: keybase1.TLFVisibility_PRIVATE,
				MembersType:   mt,
			})
		require.NoError(t, err)
		conv := ncres.Conv.Info

		tc := ctc.world.Tcs[users[0].Username]
		uid1 := users[0].User.GetUID()
		uid2 := users[1].User.GetUID()
		ri := ctc.as(t, users[0]).ri
		boxer := NewBoxer(tc.Context())
		getRI := func() chat1.RemoteInterface { return ri }
		g := globals.NewContext(tc.G, tc.ChatG)
		blockingSender := NewBlockingSender(g, boxer, nil, getRI)

		text := "hi"
		msg := textMsgWithSender(t, text, uid1.ToBytes(), chat1.MessageBoxedVersion_V3)
		// Pairwise MACs rely on the sender's DeviceID in the header.
		deviceID := make([]byte, libkb.DeviceIDLen)
		err = tc.G.ActiveDevice.DeviceID().ToBytes(deviceID)
		require.NoError(t, err)
		msg.ClientHeader.TlfName = firstConv.TlfName
		msg.ClientHeader.SenderDevice = gregor1.DeviceID(deviceID)

		key := cryptKey(t)
		signKP := getSigningKeyPairForTest(t, tc, users[0])
		encryptionKeypair, err := tc.G.ActiveDevice.NaclEncryptionKey()
		require.NoError(t, err)

		// Missing recipients uid2
		pairwiseMACRecipients := []keybase1.KID{encryptionKeypair.GetKID()}

		boxed, err := boxer.box(context.TODO(), msg, key, nil, signKP, chat1.MessageBoxedVersion_V3, pairwiseMACRecipients)
		require.NoError(t, err)

		_, err = ri.PostRemote(ctx, chat1.PostRemoteArg{
			ConversationID: conv.Id, MessageBoxed: *boxed,
		})
		require.Error(t, err)
		require.IsType(t, libkb.EphemeralPairwiseMACsMissingUIDsError{}, err)
		merr := err.(libkb.EphemeralPairwiseMACsMissingUIDsError)
		require.Equal(t, []keybase1.UID{keybase1.UID(uid2)}, merr.UIDs)

		// Bogus recipients, both uids are missing
		pairwiseMACRecipients = []keybase1.KID{"012141487209e42c6b39f7d9bcbda02a8e8045e4bcab10b571a5fa250ae72012bd3f0a"}
		boxed, err = boxer.box(context.TODO(), msg, key, nil, signKP, chat1.MessageBoxedVersion_V3, pairwiseMACRecipients)
		require.NoError(t, err)

		_, err = ri.PostRemote(ctx, chat1.PostRemoteArg{
			ConversationID: conv.Id,
			MessageBoxed:   *boxed,
		})
		require.Error(t, err)
		require.IsType(t, libkb.EphemeralPairwiseMACsMissingUIDsError{}, err)
		merr = err.(libkb.EphemeralPairwiseMACsMissingUIDsError)
		sortUIDs := func(uids []keybase1.UID) { sort.Slice(uids, func(i, j int) bool { return uids[i] < uids[j] }) }
		expectedUIDs := []keybase1.UID{keybase1.UID(uid1), keybase1.UID(uid2)}
		sortUIDs(expectedUIDs)
		sortUIDs(merr.UIDs)
		require.Equal(t, expectedUIDs, merr.UIDs)

		// Including all devices works
		_, _, err = blockingSender.Send(ctx, conv.Id, msg, 0, nil)
		require.NoError(t, err)

		tv, err := tc.Context().ConvSource.Pull(ctx, conv.Id, uid1.ToBytes(), chat1.GetThreadReason_GENERAL, nil, nil)
		require.NoError(t, err)
		require.Len(t, tv.Messages, 2)
		msgUnboxed := tv.Messages[0]
		require.True(t, msgUnboxed.IsValid())
		require.Equal(t, msgUnboxed.Valid().MessageBody.Text().Body, text)
	})
}
