package chat

import (
	"testing"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestGiphyStorage(t *testing.T) {
	useRemoteMock = false
	defer func() { useRemoteMock = true }()
	ctc := makeChatTestContext(t, "TestGiphyStorage", 1)
	defer ctc.cleanup()

	users := ctc.users()
	tc := ctc.world.Tcs[users[0].Username]
	ctx := ctc.as(t, users[0]).startCtx
	uid := users[0].User.GetUID().ToBytes()

	store := storage.NewGiphyStore(tc.Context())

	giphyRes := store.GiphyResults(ctx, uid)
	require.Equal(t, len(giphyRes), 0)

	giphy1 := chat1.GiphySearchResult{
		TargetUrl: "url1",
	}
	err := store.Put(ctx, uid, giphy1)
	require.NoError(t, err)

	giphyRes = store.GiphyResults(ctx, uid)
	require.Equal(t, len(giphyRes), 1)
	require.Equal(t, giphyRes[0], giphy1)

	giphy2 := chat1.GiphySearchResult{
		TargetUrl: "url2",
	}
	err = store.Put(ctx, uid, giphy2)
	require.NoError(t, err)

	giphyRes = store.GiphyResults(ctx, uid)
	require.Equal(t, len(giphyRes), 2)
	require.Equal(t, giphyRes[0], giphy1)
	require.Equal(t, giphyRes[1], giphy2)

	err = store.Put(ctx, uid, giphy2)
	require.NoError(t, err)

	giphyRes = store.GiphyResults(ctx, uid)
	require.Equal(t, len(giphyRes), 2)
	require.Equal(t, giphyRes[0], giphy2)
	require.Equal(t, giphyRes[1], giphy1)
}
