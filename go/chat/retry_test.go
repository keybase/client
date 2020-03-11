package chat

import (
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type errorClient struct{}

func (e errorClient) Call(ctx context.Context, method string, arg interface{},
	res interface{}, timeout time.Duration) error {
	return fmt.Errorf("errorClient: Call %s", method)
}

func (e errorClient) CallCompressed(ctx context.Context, method string, arg interface{},
	res interface{}, ctype rpc.CompressionType, timeout time.Duration) error {
	return fmt.Errorf("errorClient: Call %s", method)
}

func (e errorClient) Notify(ctx context.Context, method string, arg interface{}, timeout time.Duration) error {
	return fmt.Errorf("errorClient: Notify %s", method)
}

func TestFetchRetry(t *testing.T) {
	ctx, world, ri2, _, sender, list := setupTest(t, 3)
	defer world.Cleanup()

	ri := ri2.(*kbtest.ChatRemoteMock)
	rifunc := func() chat1.RemoteInterface { return ri }
	u := world.GetUsers()[0]
	u1 := world.GetUsers()[1]
	u2 := world.GetUsers()[2]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	store := storage.New(globals.NewContext(tc.G, tc.ChatG), tc.ChatG.ConvSource)

	var convIDs []chat1.ConversationID
	var convs []chat1.Conversation
	_, conv := newConv(ctx, t, tc, uid, ri, sender, u.Username+","+u1.Username)
	convs = append(convs, conv)
	_, conv = newConv(ctx, t, tc, uid, ri, sender, u.Username+","+u2.Username)
	convs = append(convs, conv)
	_, conv = newConv(ctx, t, tc, uid, ri, sender, u.Username+","+u2.Username+","+u1.Username)
	convs = append(convs, conv)
	sort.Slice(convs, func(i, j int) bool {
		return convs[i].GetConvID().Less(convs[j].GetConvID())
	})
	for _, conv := range convs {
		convIDs = append(convIDs, conv.GetConvID())
	}

	// Nuke body cache
	t.Logf("clearing: %s", convs[0].GetConvID())
	require.NoError(t, store.ClearAll(context.TODO(), convs[0].GetConvID(), uid))

	errorRI := func() chat1.RemoteInterface { return chat1.RemoteClient{Cli: errorClient{}} }
	tc.ChatG.ConvSource.SetRemoteInterface(errorRI)

	inbox, _, err := tc.ChatG.InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil,
		&chat1.GetInboxLocalQuery{
			ConvIDs: convIDs,
		})
	require.NoError(t, err)
	sort.Slice(inbox.Convs, func(i, j int) bool {
		return inbox.Convs[i].GetConvID().Less(inbox.Convs[j].GetConvID())
	})
	require.NotNil(t, inbox.Convs[0].Error)
	require.Nil(t, inbox.Convs[1].Error)
	require.Nil(t, inbox.Convs[2].Error)
	tc.ChatG.FetchRetrier.Failure(ctx, uid,
		NewConversationRetry(tc.Context(), inbox.Convs[0].GetConvID(), nil, ThreadLoad))

	// Advance clock and check for errors on all conversations
	t.Logf("advancing clock and checking for stale")
	tc.ChatG.ConvSource.SetRemoteInterface(rifunc)
	world.Fc.Advance(time.Hour)
	select {
	case updates := <-list.threadsStale:
		require.Equal(t, 1, len(updates))
		require.Equal(t, chat1.StaleUpdateType_NEWACTIVITY, updates[0].UpdateType)
	case <-time.After(20 * time.Second):
		require.Fail(t, "timeout on inbox stale")
	}
	world.Fc.Advance(time.Hour)
	select {
	case <-list.threadsStale:
		require.Fail(t, "invalid stale message")
	default:
	}

	t.Logf("trying to use Force")
	tc.ChatG.FetchRetrier.Failure(ctx, uid,
		NewConversationRetry(tc.Context(), inbox.Convs[0].GetConvID(), nil, ThreadLoad))
	tc.ChatG.FetchRetrier.Force(ctx)
	select {
	case cids := <-list.threadsStale:
		require.Equal(t, 1, len(cids))
	case <-time.After(20 * time.Second):
		require.Fail(t, "timeout on inbox stale")
	}

	t.Logf("testing full inbox retry")
	ttype := chat1.TopicType_CHAT
	tc.Context().FetchRetrier.Failure(ctx, uid,
		NewFullInboxRetry(tc.Context(), &chat1.GetInboxLocalQuery{
			TopicType: &ttype,
		}))
	tc.Context().FetchRetrier.Force(ctx)
	select {
	case <-list.inboxStale:
	case <-time.After(20 * time.Second):
		require.Fail(t, "no inbox full stale received")
	}

}
