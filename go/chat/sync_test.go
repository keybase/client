package chat

import (
	"testing"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func newConv(t *testing.T, uid gregor1.UID, ri chat1.RemoteInterface, sender Sender, tlf kbtest.TlfMock,
	tlfName string) chat1.Conversation {
	trip := newConvTriple(t, tlf, tlfName)
	firstMessagePlaintext := chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			TlfName:     tlfName,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TLFNAME,
		},
		MessageBody: chat1.MessageBody{},
	}
	firstMessageBoxed, _, err := sender.Prepare(context.TODO(), firstMessagePlaintext, nil)
	require.NoError(t, err)
	res, err := ri.NewConversationRemote2(context.TODO(), chat1.NewConversationRemote2Arg{
		IdTriple:   trip,
		TLFMessage: *firstMessageBoxed,
	})
	require.NoError(t, err)

	_, _, _, err = sender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      uid,
			TlfName:     tlfName,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{Body: "foo"}),
	}, 0)
	require.NoError(t, err)

	ires, err := ri.GetInboxRemote(context.TODO(), chat1.GetInboxRemoteArg{
		Query: &chat1.GetInboxQuery{
			ConvID: &res.ConvID,
		},
	})
	require.NoError(t, err)
	return ires.Inbox.Full().Conversations[0]
}

func doSync(t *testing.T, syncer types.Syncer, ri chat1.RemoteInterface, uid gregor1.UID) {
	res, err := ri.SyncAll(context.TODO(), chat1.SyncAllArg{
		Uid: uid,
	})
	require.NoError(t, err)
	require.NoError(t, syncer.Sync(context.TODO(), ri, uid, &res.Chat))
}

func TestSyncerConnected(t *testing.T) {
	world, ri2, _, sender, list, tlf := setupTest(t, 3)
	defer world.Cleanup()

	ri := ri2.(*kbtest.ChatRemoteMock)
	u := world.GetUsers()[0]
	u1 := world.GetUsers()[1]
	u2 := world.GetUsers()[2]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	syncer := NewSyncer(tc.G)
	ibox := storage.NewInbox(tc.G, uid)
	store := storage.New(tc.G)

	var convs []chat1.Conversation
	convs = append(convs, newConv(t, uid, ri, sender, tlf, u.Username+","+u1.Username))
	convs = append(convs, newConv(t, uid, ri, sender, tlf, u.Username+","+u2.Username))
	convs = append(convs, newConv(t, uid, ri, sender, tlf, u.Username+","+u2.Username+","+u1.Username))

	t.Logf("test current")
	ri.SyncInboxFunc = func(m *kbtest.ChatRemoteMock, ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
		return chat1.NewSyncInboxResWithCurrent(), nil
	}
	doSync(t, syncer, ri, uid)

	t.Logf("test clear")
	ri.SyncInboxFunc = func(m *kbtest.ChatRemoteMock, ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
		return chat1.NewSyncInboxResWithClear(), nil
	}
	doSync(t, syncer, ri, uid)
	select {
	case <-list.inboxStale:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no inbox stale received")
	}
	select {
	case cids := <-list.threadsStale:
		require.Zero(t, len(cids))
	case <-time.After(20 * time.Second):
		require.Fail(t, "no threads stale received")
	}
	_, _, err := ibox.ReadAll(context.TODO())
	require.Error(t, err)
	require.IsType(t, storage.MissError{}, err)

	t.Logf("test incremental")
	mconv := convs[1]
	_, _, cerr := tc.G.ConvSource.Pull(context.TODO(), mconv.GetConvID(), uid, nil, nil)
	require.NoError(t, cerr)
	_, _, serr := tc.G.InboxSource.Read(context.TODO(), uid, nil, true, nil, nil)
	require.NoError(t, serr)
	_, iconvs, err := ibox.ReadAll(context.TODO())
	require.NoError(t, err)
	require.Equal(t, len(convs), len(iconvs))
	ri.SyncInboxFunc = func(m *kbtest.ChatRemoteMock, ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
		mconv.Metadata.Status = chat1.ConversationStatus_MUTED
		return chat1.NewSyncInboxResWithIncremental(chat1.SyncIncrementalRes{
			Vers:  100,
			Convs: []chat1.Conversation{mconv},
		}), nil
	}
	doSync(t, syncer, ri, uid)
	select {
	case <-list.inboxStale:
		require.Fail(t, "should not receive inbox stale")
	default:
	}
	select {
	case cids := <-list.threadsStale:
		require.Equal(t, 1, len(cids))
		require.Equal(t, convs[1].GetConvID(), cids[0])
	case <-time.After(20 * time.Second):
		require.Fail(t, "no threads stale received")
	}
	vers, iconvs, err := ibox.ReadAll(context.TODO())
	require.NoError(t, err)
	require.Equal(t, len(convs), len(iconvs))
	for _, ic := range iconvs {
		if ic.GetConvID().Eq(mconv.GetConvID()) {
			require.Equal(t, chat1.ConversationStatus_MUTED, ic.Metadata.Status)
		}
	}
	require.Equal(t, chat1.ConversationStatus_UNFILED, convs[1].Metadata.Status)
	require.Equal(t, chat1.InboxVers(100), vers)
	thread, cerr := store.Fetch(context.TODO(), mconv, uid, nil, nil)
	require.NoError(t, cerr)
	require.Equal(t, 2, len(thread.Messages))

	t.Logf("test server version")
	srvVers, err := ibox.ServerVersion(context.TODO())
	require.NoError(t, err)
	require.Zero(t, srvVers)
	ri.SyncInboxFunc = func(m *kbtest.ChatRemoteMock, ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
		return chat1.NewSyncInboxResWithCurrent(), nil
	}
	ri.CacheInboxVersion = 5
	ri.CacheBodiesVersion = 5
	doSync(t, syncer, ri, uid)
	select {
	case <-list.inboxStale:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no inbox stale received")
	}
	select {
	case cids := <-list.threadsStale:
		require.Zero(t, len(cids))
	case <-time.After(20 * time.Second):
		require.Fail(t, "no threads stale received")
	}
	_, _, err = ibox.ReadAll(context.TODO())
	require.Error(t, err)
	require.IsType(t, storage.MissError{}, err)
	_, cerr = store.Fetch(context.TODO(), mconv, uid, nil, nil)
	require.Error(t, cerr)
	require.IsType(t, storage.MissError{}, cerr)
	_, _, serr = tc.G.InboxSource.Read(context.TODO(), uid, nil, true, nil, nil)
	require.NoError(t, serr)
	_, iconvs, err = ibox.ReadAll(context.TODO())
	require.NoError(t, err)
	require.Equal(t, len(convs), len(iconvs))
	srvVers, err = ibox.ServerVersion(context.TODO())
	require.NoError(t, err)
	require.Equal(t, 5, srvVers)
}
