package chat

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"encoding/hex"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type chatListener struct {
	sync.Mutex
	obids          []chat1.OutboxID
	incoming       chan int
	failing        chan []chat1.OutboxID
	identifyUpdate chan keybase1.CanonicalTLFNameAndIDWithBreaks
}

var _ libkb.NotifyListener = (*chatListener)(nil)

func (n *chatListener) Logout()                                                      {}
func (n *chatListener) Login(username string)                                        {}
func (n *chatListener) ClientOutOfDate(to, uri, msg string)                          {}
func (n *chatListener) UserChanged(uid keybase1.UID)                                 {}
func (n *chatListener) TrackingChanged(uid keybase1.UID, username string)            {}
func (n *chatListener) FSActivity(activity keybase1.FSNotification)                  {}
func (n *chatListener) FSEditListResponse(arg keybase1.FSEditListArg)                {}
func (n *chatListener) FSEditListRequest(arg keybase1.FSEditListRequest)             {}
func (n *chatListener) FSSyncStatusResponse(arg keybase1.FSSyncStatusArg)            {}
func (n *chatListener) FSSyncEvent(arg keybase1.FSPathSyncStatus)                    {}
func (n *chatListener) PaperKeyCached(uid keybase1.UID, encKID, sigKID keybase1.KID) {}
func (n *chatListener) FavoritesChanged(uid keybase1.UID)                            {}
func (n *chatListener) KeyfamilyChanged(uid keybase1.UID)                            {}
func (n *chatListener) PGPKeyInSecretStoreFile()                                     {}
func (n *chatListener) BadgeState(badgeState keybase1.BadgeState)                    {}
func (n *chatListener) ReachabilityChanged(r keybase1.Reachability)                  {}
func (n *chatListener) ChatIdentifyUpdate(update keybase1.CanonicalTLFNameAndIDWithBreaks) {
	n.identifyUpdate <- update
}
func (n *chatListener) ChatTLFFinalize(uid keybase1.UID, convID chat1.ConversationID, info chat1.ConversationFinalizeInfo) {
}
func (n *chatListener) ChatTLFResolve(uid keybase1.UID, convID chat1.ConversationID, info chat1.ConversationResolveInfo) {
}
func (n *chatListener) ChatInboxStale(uid keybase1.UID)                                {}
func (n *chatListener) ChatThreadsStale(uid keybase1.UID, cids []chat1.ConversationID) {}
func (n *chatListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity) {
	n.Lock()
	defer n.Unlock()
	typ, err := activity.ActivityType()
	if err == nil {
		if typ == chat1.ChatActivityType_INCOMING_MESSAGE {
			header := activity.IncomingMessage().Message.Valid().ClientHeader
			if header.OutboxID != nil {
				n.obids = append(n.obids, *activity.IncomingMessage().Message.Valid().ClientHeader.OutboxID)
				n.incoming <- len(n.obids)
			}
		} else if typ == chat1.ChatActivityType_FAILED_MESSAGE {
			var rmsg []chat1.OutboxID
			for _, obr := range activity.FailedMessage().OutboxRecords {
				rmsg = append(rmsg, obr.OutboxID)
			}
			n.failing <- rmsg
		}
	}
}

func newConvTriple(t *testing.T, tlf keybase1.TlfInterface, username string) chat1.ConversationIDTriple {
	cres, err := tlf.CryptKeys(context.TODO(), keybase1.TLFQuery{
		TlfName: username,
	})
	require.NoError(t, err)

	trip := chat1.ConversationIDTriple{
		Tlfid:     cres.NameIDBreaks.TlfID.ToBytes(),
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

func setupTest(t *testing.T, numUsers int) (*kbtest.ChatMockWorld, chat1.RemoteInterface, Sender, Sender, *chatListener, func() libkb.SecretUI, kbtest.TlfMock) {
	world := kbtest.NewChatMockWorld(t, "chatsender", numUsers)
	ri := kbtest.NewChatRemoteMock(world)
	tlf := kbtest.NewTlfMock(world)
	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	tc.G.SetService()
	boxer := NewBoxer(tc.G, tlf)
	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{Passphrase: u.Passphrase}
	}
	baseSender := NewBlockingSender(tc.G, boxer, func() chat1.RemoteInterface { return ri }, f)
	sender := NewNonblockingSender(tc.G, baseSender)
	listener := chatListener{
		incoming:       make(chan int),
		failing:        make(chan []chat1.OutboxID),
		identifyUpdate: make(chan keybase1.CanonicalTLFNameAndIDWithBreaks),
	}
	tc.G.ConvSource = NewHybridConversationSource(tc.G, boxer, storage.New(tc.G, f),
		func() chat1.RemoteInterface { return ri },
		func() libkb.SecretUI { return &libkb.TestSecretUI{} })
	tc.G.InboxSource = NewHybridInboxSource(tc.G,
		func() keybase1.TlfInterface { return tlf },
		func() chat1.RemoteInterface { return ri }, f)
	tc.G.NotifyRouter.SetListener(&listener)
	tc.G.MessageDeliverer = NewDeliverer(tc.G, baseSender)
	tc.G.MessageDeliverer.(*Deliverer).SetClock(world.Fc)
	tc.G.MessageDeliverer.Start(context.TODO(), u.User.GetUID().ToBytes())
	tc.G.MessageDeliverer.Connected(context.TODO())

	return world, ri, sender, baseSender, &listener, f, tlf
}

func TestNonblockChannel(t *testing.T) {
	world, ri, sender, _, listener, _, tlf := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	trip := newConvTriple(t, tlf, u.Username)
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

	// Send nonblock
	obid, _, _, err := sender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:      trip,
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
	world, ri, _, baseSender, listener, f, tlf := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	clock := world.Fc
	trip := newConvTriple(t, tlf, u.Username)
	res, err := ri.NewConversationRemote2(context.TODO(), chat1.NewConversationRemote2Arg{
		IdTriple: trip,
		TLFMessage: chat1.MessageBoxed{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        trip,
				TlfName:     u.Username,
				TlfPublic:   false,
				MessageType: chat1.MessageType_TLFNAME,
			},
			KeyGeneration: 1,
		},
	})
	require.NoError(t, err)

	// Send a bunch of nonblocking messages
	var sentRef []sentRecord
	for i := 0; i < 5; i++ {
		_, msgID, _, err := baseSender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
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
		t.Logf("generated msgID: %d", msgID)
		require.NoError(t, err)
		sentRef = append(sentRef, sentRecord{msgID: &msgID})
	}

	tc := userTc(t, world, u)
	outbox := storage.NewOutbox(tc.G, u.User.GetUID().ToBytes(), f)
	var obids []chat1.OutboxID
	msgID := *sentRef[len(sentRef)-1].msgID
	for i := 0; i < 5; i++ {
		obr, err := outbox.PushMessage(context.TODO(), res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
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
		_, msgID, _, err := baseSender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
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
		t.Logf("generated msgID: %d", msgID)
		sentRef = append(sentRef, sentRecord{msgID: &msgID})
		require.NoError(t, err)
	}

	// Check get thread, make sure it makes sense
	typs := []chat1.MessageType{chat1.MessageType_TEXT}
	tres, _, err := tc.G.ConvSource.Pull(context.TODO(), res.ConvID, u.User.GetUID().ToBytes(),
		&chat1.GetThreadQuery{MessageTypes: typs}, nil)
	tres.Messages = utils.FilterByType(tres.Messages, &chat1.GetThreadQuery{MessageTypes: typs})
	t.Logf("source size: %d", len(tres.Messages))
	require.NoError(t, err)
	require.NoError(t, outbox.SprinkleIntoThread(context.TODO(), res.ConvID, &tres))
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

func (f FailingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID) (chat1.OutboxID, chat1.MessageID, *chat1.RateLimit, error) {
	return chat1.OutboxID{}, 0, nil, fmt.Errorf("I always fail!!!!")
}

func (f FailingSender) Prepare(ctx context.Context, msg chat1.MessagePlaintext, convID *chat1.ConversationID) (*chat1.MessageBoxed, error) {
	return nil, nil
}

func TestFailingSender(t *testing.T) {

	world, ri, sender, _, listener, _, tlf := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	trip := newConvTriple(t, tlf, u.Username)
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

	tc := userTc(t, world, u)
	tc.G.MessageDeliverer.(*Deliverer).SetSender(FailingSender{})

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
		tc.G.MessageDeliverer.ForceDeliverLoop(context.TODO())
	}

	var recvd []chat1.OutboxID
	for i := 0; i < 5; i++ {
		select {
		case fid := <-listener.failing:
			recvd = append(recvd, fid...)
		case <-time.After(20 * time.Second):
			require.Fail(t, "event not received")
		}
	}

	require.Equal(t, len(obids), len(recvd), "invalid length")
	require.Equal(t, obids, recvd, "list mismatch")
}

func TestDisconnectedFailure(t *testing.T) {

	world, ri, sender, baseSender, listener, _, tlf := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	cl := world.Fc
	trip := newConvTriple(t, tlf, u.Username)
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

	tc := userTc(t, world, u)
	tc.G.MessageDeliverer.Disconnected(context.TODO())
	tc.G.MessageDeliverer.(*Deliverer).SetSender(FailingSender{})

	// Send nonblock
	obids := []chat1.OutboxID{}
	for i := 0; i < 3; i++ {
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
		cl.Advance(time.Millisecond)
	}

	var allrecvd []chat1.OutboxID
	var recvd []chat1.OutboxID
	appendUnique := func(a []chat1.OutboxID, r []chat1.OutboxID) (res []chat1.OutboxID) {
		m := make(map[string]bool)
		for _, i := range a {
			m[hex.EncodeToString(i)] = true
			res = append(res, i)
		}
		for _, i := range r {
			if !m[hex.EncodeToString(i)] {
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
	require.Equal(t, obids, allrecvd, "list mismatch")

	t.Logf("reconnecting and checking for successes")
	<-tc.G.MessageDeliverer.Stop(context.TODO())
	<-tc.G.MessageDeliverer.Stop(context.TODO())
	tc.G.MessageDeliverer.(*Deliverer).SetSender(baseSender)
	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{Passphrase: u.Passphrase}
	}
	outbox := storage.NewOutbox(tc.G, u.User.GetUID().ToBytes(), f)
	for _, obid := range obids {
		require.NoError(t, outbox.RetryMessage(context.TODO(), obid))
	}
	tc.G.MessageDeliverer.Connected(context.TODO())
	tc.G.MessageDeliverer.Start(context.TODO(), u.User.GetUID().ToBytes())

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
	world, ri, _, blockingSender, _, _, tlf := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	trip := newConvTriple(t, tlf, u.Username)
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

	// Send a message and two edits.
	_, firstMessageID, _, err := blockingSender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
	}, 0)
	require.NoError(t, err)
	_, editID, _, err := blockingSender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_EDIT,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: firstMessageID, Body: "bar"}),
	}, 0)
	require.NoError(t, err)
	_, editID2, _, err := blockingSender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			MessageType: chat1.MessageType_EDIT,
			Supersedes:  firstMessageID,
		},
		MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{MessageID: firstMessageID, Body: "baz"}),
	}, 0)
	require.NoError(t, err)

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
	preparedDeletion, err := blockingSender.Prepare(context.TODO(), deletion, &res.ConvID)
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
	world, ri, _, blockingSender, _, secretUI, tlf := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := u.User.GetUID().ToBytes()
	tc := userTc(t, world, u)
	trip := newConvTriple(t, tlf, u.Username)
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

	// Send a bunch of messages on this convo
	for i := 0; i < 10; i++ {
		_, _, _, err := blockingSender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Conv:        trip,
				Sender:      uid,
				TlfName:     u.Username,
				MessageType: chat1.MessageType_TEXT,
			},
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
		}, 0)
		require.NoError(t, err)
	}

	// Nuke the body cache
	require.NoError(t, storage.New(tc.G, secretUI).MaybeNuke(true, nil, res.ConvID, uid))

	// Fetch a subset into the cache
	_, _, err = tc.G.ConvSource.Pull(context.TODO(), res.ConvID, uid, nil, &chat1.Pagination{
		Num: 2,
	})
	require.NoError(t, err)

	// Prepare a message and make sure it gets prev pointers
	boxed, err := blockingSender.Prepare(context.TODO(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      uid,
			TlfName:     u.Username,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
	}, &res.ConvID)
	require.NoError(t, err)
	require.NotEmpty(t, boxed.ClientHeader.Prev, "empty prev pointers")

}
