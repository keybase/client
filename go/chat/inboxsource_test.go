package chat

import (
	"fmt"
	"testing"

	"sync"

	context "golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestInboxSourceUpdateRace(t *testing.T) {
	world, ri, _, sender, _, tlf := setupTest(t, 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]
	trip := newConvTriple(t, tlf, u.Username)
	res := startConv(t, u, trip, sender, ri, tc)

	_, _, _, err := sender.Send(context.TODO(), res.ConvID, chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HIHI",
		}),
	}, 0)
	require.NoError(t, err)

	ib, _, err := tc.ChatG.InboxSource.Read(context.TODO(), u.User.GetUID().ToBytes(), nil, true, nil, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.InboxVers(0), ib.Version, "wrong version")

	// Spawn two goroutines to try and update the inbox at the same time with a self-update, and a
	// Gregor style update
	t.Logf("spawning update goroutines")
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		_, err = tc.ChatG.InboxSource.SetStatus(context.TODO(), u.User.GetUID().ToBytes(), 0, res.ConvID,
			chat1.ConversationStatus_UNFILED)
		require.NoError(t, err)
		wg.Done()
	}()
	wg.Add(1)
	go func() {
		_, err = tc.ChatG.InboxSource.SetStatus(context.TODO(), u.User.GetUID().ToBytes(), 1, res.ConvID,
			chat1.ConversationStatus_UNFILED)
		require.NoError(t, err)
		wg.Done()
	}()
	wg.Wait()

	ib, _, err = tc.ChatG.InboxSource.Read(context.TODO(), u.User.GetUID().ToBytes(), nil, true, nil, nil)
	require.NoError(t, err)
	require.Equal(t, chat1.InboxVers(1), ib.Version, "wrong version")
}

// Test that when an update is received that is more than 1 ahead of the current inbox version,
// a complete sync of the inbox occurs.
func TestInboxSourceSkipAhead(t *testing.T) {
	t.Logf("setup")
	world, ri2, _, sender, _, tlf := setupTest(t, 1)
	ri := ri2.(*kbtest.ChatRemoteMock)
	defer world.Cleanup()
	t.Logf("test's remoteInterface: %p[%T] -> %v", &ri, ri, ri)

	u := world.GetUsers()[0]
	tc := world.Tcs[u.Username]

	assertInboxVersion := func(v int) {
		ib, _, err := tc.ChatG.InboxSource.Read(context.TODO(), u.User.GetUID().ToBytes(), nil, true, nil, nil)
		require.Equal(t, chat1.InboxVers(v), ib.Version, "wrong version")
		require.NoError(t, err)
	}

	fatal := func(msg string, args ...interface{}) error {
		t.Fatalf(msg, args...)
		return fmt.Errorf(msg, args...)
	}

	t.Logf("install fake sync")
	ri.SyncInboxFunc = func(m *kbtest.ChatRemoteMock, ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
		return chat1.SyncInboxRes{}, fatal("sync not expected yet")
	}

	assertInboxVersion(0)

	t.Logf("new conv")
	trip := newConvTriple(t, tlf, u.Username)
	res := startConv(t, u, trip, sender, ri, tc)

	assertInboxVersion(0)

	t.Logf("add message but drop oobm")

	boxed, _, err := sender.Prepare(context.TODO(), chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			Conv:        trip,
			Sender:      u.User.GetUID().ToBytes(),
			TlfName:     u.Username,
			TlfPublic:   false,
			MessageType: chat1.MessageType_TEXT,
		},
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: "HIHI",
		}),
	}, &res.ConvID)
	require.NoError(t, err)

	postRes, err := ri.PostRemote(context.TODO(), chat1.PostRemoteArg{
		ConversationID: res.ConvID,
		MessageBoxed:   *boxed,
	})
	require.NoError(t, err)
	boxed.ServerHeader = &postRes.MsgHeader

	assertInboxVersion(0)

	t.Logf("install fake sync")
	syncCalled := 0
	ri.SyncInboxFunc = func(m *kbtest.ChatRemoteMock, ctx context.Context, vers chat1.InboxVers) (chat1.SyncInboxRes, error) {
		syncCalled += 1
		require.Equal(t, chat1.InboxVers(0), vers)

		res, err := m.GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
			Vers:       vers,
			Query:      nil,
			Pagination: nil,
		})
		require.NoError(t, err)

		return chat1.NewSyncInboxResWithIncremental(chat1.SyncIncrementalRes{
			Vers:  100,
			Convs: res.Inbox.Full().Conversations,
		}), nil
	}

	t.Logf("receive oobm with version light years ahead of its current one")
	_, err = tc.ChatG.InboxSource.NewMessage(context.TODO(), u.User.GetUID().ToBytes(), chat1.InboxVers(100),
		res.ConvID, *boxed)
	require.NoError(t, err)
	assertInboxVersion(100)

	t.Logf("sync was triggered")
	require.Equal(t, 1, syncCalled)
}
