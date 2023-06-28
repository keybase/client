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

	queryRes := store.GiphyQueries(ctx, uid)
	require.Equal(t, len(queryRes), 0)

	giphy1 := chat1.GiphySearchResult{
		Query:     "query1",
		TargetUrl: "url1",
	}
	store.Put(ctx, uid, giphy1)

	giphyRes = store.GiphyResults(ctx, uid)
	require.Equal(t, len(giphyRes), 1)
	require.Equal(t, giphyRes[0], giphy1)

	queryRes = store.GiphyQueries(ctx, uid)
	require.Equal(t, len(queryRes), 1)
	require.Equal(t, queryRes[0], giphy1.Query)

	giphy2 := chat1.GiphySearchResult{
		Query:     "query2",
		TargetUrl: "url2",
	}
	store.Put(ctx, uid, giphy2)

	giphyRes = store.GiphyResults(ctx, uid)
	require.Equal(t, len(giphyRes), 2)
	require.Equal(t, giphyRes[0], giphy1)
	require.Equal(t, giphyRes[1], giphy2)

	queryRes = store.GiphyQueries(ctx, uid)
	require.Equal(t, len(queryRes), 2)
	require.Equal(t, queryRes[0], giphy1.Query)
	require.Equal(t, queryRes[1], giphy2.Query)

	store.Put(ctx, uid, giphy2)

	giphyRes = store.GiphyResults(ctx, uid)
	require.Equal(t, len(giphyRes), 2)
	require.Equal(t, giphyRes[0], giphy2)
	require.Equal(t, giphyRes[1], giphy1)

	queryRes = store.GiphyQueries(ctx, uid)
	require.Equal(t, len(queryRes), 2)
	require.Equal(t, queryRes[0], giphy2.Query)
	require.Equal(t, queryRes[1], giphy1.Query)

	giphy3 := chat1.GiphySearchResult{
		// Same query as giphy1
		Query:     "query1",
		TargetUrl: "url3",
	}
	store.Put(ctx, uid, giphy3)

	giphyRes = store.GiphyResults(ctx, uid)
	require.Equal(t, len(giphyRes), 3)
	require.Equal(t, giphyRes[0], giphy2)
	require.Equal(t, giphyRes[1], giphy1)
	require.Equal(t, giphyRes[2], giphy3)

	queryRes = store.GiphyQueries(ctx, uid)
	require.Equal(t, len(queryRes), 2)
	require.Equal(t, queryRes[0], giphy1.Query)
	require.Equal(t, queryRes[1], giphy2.Query)
}
