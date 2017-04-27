package chat

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type errorClient struct{}

func (e errorClient) Call(ctx context.Context, method string, arg interface{}, res interface{}) error {
	return fmt.Errorf("errorClient: Call %s", method)
}

func (e errorClient) Notify(ctx context.Context, method string, arg interface{}) error {
	return fmt.Errorf("errorClient: Notify %s", method)
}

func TestFetchRetry(t *testing.T) {
	world, ri2, _, sender, list, tlf := setupTest(t, 3)
	defer world.Cleanup()

	ri := ri2.(*kbtest.ChatRemoteMock)
	rifunc := func() chat1.RemoteInterface { return ri }
	u := world.GetUsers()[0]
	u1 := world.GetUsers()[1]
	u2 := world.GetUsers()[2]
	uid := u.User.GetUID().ToBytes()
	tc := world.Tcs[u.Username]
	store := storage.New(globals.NewContext(tc.G, tc.ChatG))

	var convIDs []chat1.ConversationID
	var convs []chat1.Conversation
	convs = append(convs, newConv(t, uid, ri, sender, tlf, u.Username+","+u1.Username))
	convs = append(convs, newConv(t, uid, ri, sender, tlf, u.Username+","+u2.Username))
	convs = append(convs, newConv(t, uid, ri, sender, tlf, u.Username+","+u2.Username+","+u1.Username))
	for _, conv := range convs {
		convIDs = append(convIDs, conv.GetConvID())
	}

	// Nuke body cache
	require.NoError(t, store.MaybeNuke(true, nil, convs[0].GetConvID(), uid))

	errorRI := func() chat1.RemoteInterface { return chat1.RemoteClient{Cli: errorClient{}} }
	tc.ChatG.ConvSource.SetRemoteInterface(errorRI)

	inbox, _, err := tc.ChatG.InboxSource.Read(context.TODO(), uid, nil, true, &chat1.GetInboxLocalQuery{
		ConvIDs: convIDs,
	}, nil)
	require.NoError(t, err)
	require.NotNil(t, inbox.Convs[2].Error)
	require.Nil(t, inbox.Convs[0].Error)
	tc.ChatG.FetchRetrier.Failure(context.TODO(), inbox.Convs[2].GetConvID(), uid, types.ThreadLoad)

	// Advance clock and check for errors on all conversations
	t.Logf("advancing clock and checking for stale")
	tc.ChatG.ConvSource.SetRemoteInterface(rifunc)
	world.Fc.Advance(time.Hour)
	select {
	case cids := <-list.threadsStale:
		require.Equal(t, 1, len(cids))
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
	tc.ChatG.FetchRetrier.Failure(context.TODO(), inbox.Convs[2].GetConvID(), uid, types.ThreadLoad)
	tc.ChatG.FetchRetrier.Force(context.TODO())
	select {
	case cids := <-list.threadsStale:
		require.Equal(t, 1, len(cids))
	case <-time.After(20 * time.Second):
		require.Fail(t, "timeout on inbox stale")
	}

}
