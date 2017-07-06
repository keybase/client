package chat

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"encoding/hex"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/stretchr/testify/require"
	context "golang.org/x/net/context"
)

type chatListener struct {
	sync.Mutex
	obids          []chat1.OutboxID
	incoming       chan int
	failing        chan []chat1.OutboxRecord
	identifyUpdate chan keybase1.CanonicalTLFNameAndIDWithBreaks
	inboxStale     chan struct{}
	threadsStale   chan []chat1.ConversationID
	bgConvLoads    chan chat1.ConversationID
	typingUpdate   chan []chat1.ConvTypingUpdate
}

var _ libkb.NotifyListener = (*chatListener)(nil)

func (n *chatListener) Logout()                                                             {}
func (n *chatListener) Login(username string)                                               {}
func (n *chatListener) ClientOutOfDate(to, uri, msg string)                                 {}
func (n *chatListener) UserChanged(uid keybase1.UID)                                        {}
func (n *chatListener) TrackingChanged(uid keybase1.UID, username libkb.NormalizedUsername) {}
func (n *chatListener) FSActivity(activity keybase1.FSNotification)                         {}
func (n *chatListener) FSEditListResponse(arg keybase1.FSEditListArg)                       {}
func (n *chatListener) FSEditListRequest(arg keybase1.FSEditListRequest)                    {}
func (n *chatListener) FSSyncStatusResponse(arg keybase1.FSSyncStatusArg)                   {}
func (n *chatListener) FSSyncEvent(arg keybase1.FSPathSyncStatus)                           {}
func (n *chatListener) PaperKeyCached(uid keybase1.UID, encKID, sigKID keybase1.KID)        {}
func (n *chatListener) FavoritesChanged(uid keybase1.UID)                                   {}
func (n *chatListener) KeyfamilyChanged(uid keybase1.UID)                                   {}
func (n *chatListener) PGPKeyInSecretStoreFile()                                            {}
func (n *chatListener) BadgeState(badgeState keybase1.BadgeState)                           {}
func (n *chatListener) ReachabilityChanged(r keybase1.Reachability)                         {}
func (n *chatListener) TeamKeyRotated(teamID keybase1.TeamID, teamName string)              {}
func (n *chatListener) ChatIdentifyUpdate(update keybase1.CanonicalTLFNameAndIDWithBreaks) {
	n.identifyUpdate <- update
}
func (n *chatListener) ChatTLFFinalize(uid keybase1.UID, convID chat1.ConversationID, info chat1.ConversationFinalizeInfo) {
}
func (n *chatListener) ChatTLFResolve(uid keybase1.UID, convID chat1.ConversationID, info chat1.ConversationResolveInfo) {
}
func (n *chatListener) ChatInboxStale(uid keybase1.UID) {
	select {
	case n.inboxStale <- struct{}{}:
	case <-time.After(5 * time.Second):
		panic("timeout on the inbox stale channel")
	}
}

func (n *chatListener) ChatThreadsStale(uid keybase1.UID, cids []chat1.ConversationID) {
	select {
	case n.threadsStale <- cids:
	case <-time.After(5 * time.Second):
		panic("timeout on the threads stale channel")
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
		if typ == chat1.ChatActivityType_INCOMING_MESSAGE && activity.IncomingMessage().Message.IsValid() {
			header := activity.IncomingMessage().Message.Valid().ClientHeader
			if header.OutboxID != nil {
				n.obids = append(n.obids, *activity.IncomingMessage().Message.Valid().ClientHeader.OutboxID)
				select {
				case n.incoming <- len(n.obids):
				case <-time.After(5 * time.Second):
					panic("timeout on the incoming channel")
				}
			}
		} else if typ == chat1.ChatActivityType_FAILED_MESSAGE {
			var rmsg []chat1.OutboxRecord
			for _, obr := range activity.FailedMessage().OutboxRecords {
				rmsg = append(rmsg, obr)
			}
			select {
			case n.failing <- rmsg:
			case <-time.After(5 * time.Second):
				panic("timeout on the failing channel")
			}
		}
	}
}

func (n *chatListener) ChatJoinedConversation(uid keybase1.UID, conv chat1.ConversationLocal) {

}

func (n *chatListener) ChatLeftConversation(uid keybase1.UID, convID chat1.ConversationID) {

}

func newConvTriple(ctx context.Context, t *testing.T, tc *kbtest.ChatTestContext, username string) chat1.ConversationIDTriple {
	nameInfo, err := CtxKeyFinder(ctx, tc.Context()).Find(ctx, username,
		chat1.ConversationMembersType_KBFS, false)
	require.NoError(t, err)
	trip := chat1.ConversationIDTriple{
		Tlfid:     nameInfo.ID,
		TopicType: chat1.TopicType_CHAT,
		TopicID:   []byte{0},
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
		teams.NewTeamLoaderAndInstall(w.G)
	}
	return res
}

func setupTest(t *testing.T, numUsers int) (context.Context, *kbtest.ChatMockWorld, chat1.RemoteInterface, Sender, Sender, *chatListener) {
	world := NewChatMockWorld(t, "chatsender", numUsers)
	ri := kbtest.NewChatRemoteMock(world)
	tlf := kbtest.NewTlfMock(world)
	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	tc.G.SetService()
	g := globals.NewContext(tc.G, tc.ChatG)
	ctx := newTestContextWithTlfMock(tc, tlf)
	boxer := NewBoxer(g)
	getRI := func() chat1.RemoteInterface { return ri }
	baseSender := NewBlockingSender(g, boxer, nil, getRI)
	sender := NewNonblockingSender(g, baseSender)
	listener := chatListener{
		incoming:       make(chan int, 100),
		failing:        make(chan []chat1.OutboxRecord),
		identifyUpdate: make(chan keybase1.CanonicalTLFNameAndIDWithBreaks),
		inboxStale:     make(chan struct{}, 1),
		threadsStale:   make(chan []chat1.ConversationID, 1),
		bgConvLoads:    make(chan chat1.ConversationID, 10),
		typingUpdate:   make(chan []chat1.ConvTypingUpdate, 10),
	}
	g.ConvSource = NewHybridConversationSource(g, boxer, storage.New(g), getRI)
	g.InboxSource = NewHybridInboxSource(g, getRI)
	g.ServerCacheVersions = storage.NewServerVersions(g)
	g.NotifyRouter.SetListener(&listener)
	deliverer := NewDeliverer(g, baseSender)
	deliverer.SetClock(world.Fc)
	deliverer.setTestingNameInfoSource(tlf)
	g.MessageDeliverer = deliverer
	g.MessageDeliverer.Start(context.TODO(), u.User.GetUID().ToBytes())
	g.MessageDeliverer.Connected(context.TODO())
	g.FetchRetrier = NewFetchRetrier(g)
	g.FetchRetrier.(*FetchRetrier).SetClock(world.Fc)
	g.FetchRetrier.Connected(context.TODO())
	g.FetchRetrier.Start(context.TODO(), u.User.GetUID().ToBytes())
	bgLoader := NewBackgroundConvLoader(g)
	bgLoader.loads = listener.bgConvLoads
	bgLoader.setTestingNameInfoSource(tlf)
	g.ConvLoader = bgLoader
	g.ConvLoader.Start(context.TODO(), u.User.GetUID().ToBytes())
	chatSyncer := NewSyncer(g)
	chatSyncer.isConnected = true
	g.Syncer = chatSyncer
	g.ConnectivityMonitor = &libkb.NullConnectivityMonitor{}

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
	obid, _, _, err := sender.Send(context.TODO(), conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:      conv.Metadata.IdTriple,
			Sender:    u.User.GetUID().ToBytes(),
			TlfName:   u.Username,
			TlfPublic: false,
		},
	}, 0)
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
	firstMessageBoxed, _, err := baseSender.Prepare(ctx, firstMessagePlaintext,
		chat1.ConversationMembersType_KBFS, nil)
	require.NoError(t, err)
	res, err := ri.NewConversationRemote2(ctx, chat1.NewConversationRemote2Arg{
		IdTriple:   trip,
		TLFMessage: *firstMessageBoxed,
	})
	require.NoError(t, err)

	// Send a bunch of nonblocking messages
	var sentRef []sentRecord
	for i := 0; i < 5; i++ {
		_, msgBoxed, _, err := baseSender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
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
		}, 0)
		require.NoError(t, err)
		msgID := msgBoxed.GetMessageID()
		t.Logf("generated msgID: %d", msgID)
		sentRef = append(sentRef, sentRecord{msgID: &msgID})
	}

	outbox := storage.NewOutbox(tc.Context(), u.User.GetUID().ToBytes())
	var obids []chat1.OutboxID
	msgID := *sentRef[len(sentRef)-1].msgID
	for i := 0; i < 5; i++ {
		obr, err := outbox.PushMessage(ctx, res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:      trip,
				Sender:    u.User.GetUID().ToBytes(),
				TlfName:   u.Username,
				TlfPublic: false,
				OutboxInfo: &chat1.OutboxInfo{
					Prev: msgID,
				},
			},
		}, keybase1.TLFIdentifyBehavior_CHAT_CLI)
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

	// Send a bunch of nonblocking messages
	for i := 0; i < 5; i++ {
		_, msgBoxed, _, err := baseSender.Send(ctx, res.ConvID, chat1.MessagePlaintext{
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
		}, 0)
		require.NoError(t, err)
		msgID := msgBoxed.GetMessageID()
		t.Logf("generated msgID: %d", msgID)
		sentRef = append(sentRef, sentRecord{msgID: &msgID})
	}

	// Check get thread, make sure it makes sense
	typs := []chat1.MessageType{chat1.MessageType_TEXT}
	tres, _, err := tc.ChatG.ConvSource.Pull(ctx, res.ConvID, u.User.GetUID().ToBytes(),
		&chat1.GetThreadQuery{MessageTypes: typs}, nil)
	tres.Messages = utils.FilterByType(tres.Messages, &chat1.GetThreadQuery{MessageTypes: typs}, true)
	t.Logf("source size: %d", len(tres.Messages))
	require.NoError(t, err)
	require.NoError(t, outbox.SprinkleIntoThread(ctx, res.ConvID, &tres))
	checkThread(t, tres, sentRef)
	clock.Advance(5 * time.Minute)

	// Should get a blast of all 5
	var olen int
	for i := 0; i < 5; i++ {
		select {
		case olen = <-listener.incoming:
		case <-time.After(20 * time.Second):
			require.Fail(t, "event not received")
		}

		require.Equal(t, i+1, olen, "wrong length")
		require.Equal(t, obids[i], listener.obids[i], "wrong obid")
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

var _ Sender = (*FailingSender)(nil)

func (f FailingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID) (chat1.OutboxID, *chat1.MessageBoxed, *chat1.RateLimit, error) {
	return chat1.OutboxID{}, nil, nil, fmt.Errorf("I always fail!!!!")
}

func (f FailingSender) Prepare(ctx context.Context, msg chat1.MessagePlaintext,
	membersType chat1.ConversationMembersType, convID *chat1.Conversation) (*chat1.MessageBoxed, []chat1.Asset, error) {
	return nil, nil, nil
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
		obid, _, _, err := sender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:      trip,
				Sender:    u.User.GetUID().ToBytes(),
				TlfName:   u.Username,
				TlfPublic: false,
			},
		}, 0)
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

	// If not offline for long enough, we should be able to get a send by just reconnecting
	obid, _, _, err := sender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:      conv.Metadata.IdTriple,
			Sender:    u.User.GetUID().ToBytes(),
			TlfName:   u.Username,
			TlfPublic: false,
		},
	}, 0)
	require.NoError(t, err)
	cl.Advance(time.Millisecond)
	select {
	case <-listener.failing:
		require.Fail(t, "no failed message")
	default:
	}
	tc.ChatG.MessageDeliverer.Connected(ctx)
	select {
	case inc := <-listener.incoming:
		require.Equal(t, 1, inc)
		require.Equal(t, obid, listener.obids[0])
	case <-time.After(20 * time.Second):
		require.Fail(t, "no incoming message")
	}
	listener.obids = nil

	tc.ChatG.MessageDeliverer.Disconnected(ctx)
	tc.ChatG.MessageDeliverer.(*Deliverer).SetSender(FailingSender{})
	cl.Advance(time.Hour)

	// Send nonblock
	obids := []chat1.OutboxID{}
	for i := 0; i < 3; i++ {
		obid, _, _, err = sender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:      conv.Metadata.IdTriple,
				Sender:    u.User.GetUID().ToBytes(),
				TlfName:   u.Username,
				TlfPublic: false,
			},
		}, 0)
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
			break
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
	for _, obid := range obids {
		require.NoError(t, outbox.RetryMessage(ctx, obid))
	}
	tc.ChatG.MessageDeliverer.Connected(ctx)
	tc.ChatG.MessageDeliverer.Start(ctx, u.User.GetUID().ToBytes())

	for {
		select {
		case inc := <-listener.incoming:
			if inc >= len(obids) {
				break
			}
			continue
		case <-time.After(20 * time.Second):
			require.Fail(t, "timeout in incoming loop")
			break
		}
		break
	}
	require.Equal(t, len(obids), len(listener.obids), "wrong amount of successes")
	require.Equal(t, obids, listener.obids, "wrong obids for successes")
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
	_, firstMessageBoxed, _, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
	}, 0)
	require.NoError(t, err)
	firstMessageID := firstMessageBoxed.GetMessageID()
	_, editBoxed, _, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_EDIT,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: firstMessageID, Body: "bar"}),
	}, 0)
	require.NoError(t, err)
	editID := editBoxed.GetMessageID()
	_, editBoxed2, _, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_EDIT,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: firstMessageID, Body: "baz"}),
	}, 0)
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
	preparedDeletion, _, err := blockingSender.Prepare(ctx, deletion,
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

func TestPrevPointerAddition(t *testing.T) {
	ctx, world, ri, _, blockingSender, _ := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := userTc(t, world, u)
	conv := newBlankConv(ctx, t, tc, uid, ri, blockingSender, u.Username)

	// Send a bunch of messages on this convo
	for i := 0; i < 10; i++ {
		_, _, _, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        conv.Metadata.IdTriple,
				Sender:      uid,
				TlfName:     u.Username,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
		}, 0)
		require.NoError(t, err)
	}

	// Nuke the body cache
	require.NoError(t, storage.New(tc.Context()).MaybeNuke(true, nil, conv.GetConvID(), uid))

	// Fetch a subset into the cache
	_, _, err := tc.ChatG.ConvSource.Pull(ctx, conv.GetConvID(), uid, nil, &chat1.Pagination{
		Num: 2,
	})
	require.NoError(t, err)

	// Prepare a message and make sure it gets prev pointers
	boxed, pendingAssetDeletes, err := blockingSender.Prepare(ctx, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        conv.Metadata.IdTriple,
			Sender:      uid,
			TlfName:     u.Username,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
	}, chat1.ConversationMembersType_KBFS, &conv)
	require.NoError(t, err)
	require.Empty(t, pendingAssetDeletes)
	require.NotEmpty(t, boxed.ClientHeader.Prev, "empty prev pointers")
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
	_, firstMessageBoxed, _, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_ATTACHMENT,
		},
		MessageBody: chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
			Object: mkAsset(),
			// Use v1 and v2 assets for fuller coverage. These would never both exist in a real message.
			Preview:  &tmp1,
			Previews: []chat1.Asset{mkAsset(), mkAsset()},
		}),
	}, 0)
	require.NoError(t, err)
	firstMessageID := firstMessageBoxed.GetMessageID()

	editHeader := chat1.MessageClientHeader{
		Conv:        trip,
		Sender:      u.User.GetUID().ToBytes(),
		TlfName:     u.Username,
		MessageType: chat1.MessageType_ATTACHMENTUPLOADED,
		Supersedes:  firstMessageID,
	}
	_, edit1Boxed, _, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: editHeader,
		MessageBody: chat1.NewMessageBodyWithAttachmentuploaded(chat1.MessageAttachmentUploaded{
			MessageID: firstMessageID,
			Object:    mkAsset(),
			Previews:  []chat1.Asset{mkAsset(), mkAsset()},
		}),
	}, 0)
	require.NoError(t, err)
	edit1ID := edit1Boxed.GetMessageID()
	_, edit2Boxed, _, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: editHeader,
		MessageBody: chat1.NewMessageBodyWithAttachmentuploaded(chat1.MessageAttachmentUploaded{
			MessageID: firstMessageID,
			Object:    mkAsset(),
			Previews:  []chat1.Asset{mkAsset(), mkAsset()},
		}),
	}, 0)
	edit2ID := edit2Boxed.GetMessageID()
	_, edit3Boxed, _, err := blockingSender.Send(ctx, conv.GetConvID(), chat1.MessagePlaintext{
		ClientHeader: editHeader,
		MessageBody: chat1.NewMessageBodyWithAttachmentuploaded(chat1.MessageAttachmentUploaded{
			MessageID: firstMessageID,
			Object:    chat1.Asset{},
			Previews:  nil,
		}),
	}, 0)
	require.NoError(t, err)
	edit3ID := edit3Boxed.GetMessageID()

	require.Equal(t, len(doomedAssets), 10, "wrong number of assets created")

	// Now prepare a deletion.
	deletion := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_DELETE,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageIDs: []chat1.MessageID{firstMessageID}}),
	}
	preparedDeletion, pendingAssetDeletes, err := blockingSender.Prepare(ctx, deletion,
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
