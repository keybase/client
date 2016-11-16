package chat

import (
	"sync"
	"testing"
	"time"

	"encoding/hex"

	"github.com/jonboulle/clockwork"
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
	obids  []chat1.OutboxID
	action chan int
}

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
func (n *chatListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity) {
	n.Lock()
	defer n.Unlock()
	typ, err := activity.ActivityType()
	if err == nil && typ == chat1.ChatActivityType_INCOMING_MESSAGE {
		header := activity.IncomingMessage().Message.Valid().ClientHeader
		if header.OutboxID != nil {
			n.obids = append(n.obids, *activity.IncomingMessage().Message.Valid().ClientHeader.OutboxID)
			n.action <- len(n.obids)
		}
	}
}

func getUser(world *kbtest.ChatMockWorld) (libkb.TestContext, *kbtest.FakeUser) {
	for _, u := range world.Users {
		return *world.Tcs[u.Username], u
	}
	return libkb.TestContext{}, nil
}

func setupTest(t *testing.T) (libkb.TestContext, chat1.RemoteInterface, *kbtest.FakeUser, Sender, Sender, *chatListener, func() libkb.SecretUI, clockwork.FakeClock) {
	world := kbtest.NewChatMockWorld(t, "chatsender", 1)
	ri := kbtest.NewChatRemoteMock(world)
	tlf := kbtest.NewTlfMock(world)
	tc, u := getUser(world)
	tc.G.SetService()
	udc := utils.NewUserDeviceCache(tc.G)
	boxer := NewBoxer(tc.G, tlf, udc)
	f := func() libkb.SecretUI {
		return &libkb.TestSecretUI{Passphrase: u.Passphrase}
	}
	baseSender := NewBlockingSender(tc.G, boxer, func() chat1.RemoteInterface { return ri }, f)
	sender := NewNonblockingSender(tc.G, baseSender)
	listener := chatListener{
		action: make(chan int),
	}
	tc.G.ConvSource = NewRemoteConversationSource(tc.G, boxer, ri)
	tc.G.NotifyRouter.SetListener(&listener)
	tc.G.MessageDeliverer = NewDeliverer(tc.G, baseSender)
	tc.G.MessageDeliverer.Start(u.User.GetUID().ToBytes())

	return tc, ri, u, sender, baseSender, &listener, f, world.Fc
}

func TestNonblockChannel(t *testing.T) {
	tc, ri, u, sender, _, listener, _, _ := setupTest(t)
	defer tc.Cleanup()

	res, err := ri.NewConversationRemote2(context.TODO(), chat1.NewConversationRemote2Arg{
		IdTriple: chat1.ConversationIDTriple{
			Tlfid:     []byte{4, 5, 6},
			TopicType: 0,
			TopicID:   []byte{0},
		},
		TLFMessage: chat1.MessageBoxed{
			ClientHeader: chat1.MessageClientHeader{
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
			Sender:    u.User.GetUID().ToBytes(),
			TlfName:   u.Username,
			TlfPublic: false,
		},
	}, 0)
	require.NoError(t, err)

	select {
	case <-listener.action:
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
	tc, ri, u, _, baseSender, listener, f, clock := setupTest(t)
	defer tc.Cleanup()

	res, err := ri.NewConversationRemote2(context.TODO(), chat1.NewConversationRemote2Arg{
		IdTriple: chat1.ConversationIDTriple{
			Tlfid:     []byte{4, 5, 6},
			TopicType: 0,
			TopicID:   []byte{0},
		},
		TLFMessage: chat1.MessageBoxed{
			ClientHeader: chat1.MessageClientHeader{
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

	outbox := storage.NewOutbox(tc.G, u.User.GetUID().ToBytes(), f)
	var obids []chat1.OutboxID
	msgID := *sentRef[len(sentRef)-1].msgID
	for i := 0; i < 5; i++ {
		obid, err := outbox.PushMessage(res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
				Sender:    u.User.GetUID().ToBytes(),
				TlfName:   u.Username,
				TlfPublic: false,
				OutboxInfo: &chat1.OutboxInfo{
					Prev: msgID,
				},
			},
		})
		t.Logf("generated obid: %s prev: %d", hex.EncodeToString(obid), msgID)
		require.NoError(t, err)
		sentRef = append(sentRef, sentRecord{outboxID: &obid})
		obids = append(obids, obid)
	}

	// Make we get nothing until timer is up
	select {
	case <-listener.action:
		require.Fail(t, "action event received too soon")
	default:
	}

	// Send a bunch of nonblocking messages
	for i := 0; i < 5; i++ {
		_, msgID, _, err := baseSender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
			ClientHeader: chat1.MessageClientHeader{
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
	require.NoError(t, outbox.SprinkleIntoThread(res.ConvID, &tres))
	checkThread(t, tres, sentRef)
	clock.Advance(5 * time.Minute)

	// Should get a blast of all 5
	var olen int
	for i := 0; i < 5; i++ {
		select {
		case olen = <-listener.action:
		case <-time.After(20 * time.Second):
			require.Fail(t, "event not received")
		}

		require.Equal(t, i+1, olen, "wrong length")
		require.Equal(t, obids[i], listener.obids[i], "wrong obid")
	}

	// Make sure it is really empty
	clock.Advance(5 * time.Minute)
	select {
	case <-listener.action:
		require.Fail(t, "action event received too soon")
	default:
	}
}
