package commands

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

type testGiphySearcher struct {
	waitForCancel bool
	waitingCh     chan struct{}
}

func newTestGiphySearcher() *testGiphySearcher {
	return &testGiphySearcher{}
}

func (d *testGiphySearcher) Search(mctx libkb.MetaContext, apiKeySource types.ExternalAPIKeySource,
	query *string, limit int, urlsrv types.AttachmentURLSrv) ([]chat1.GiphySearchResult, error) {
	if d.waitForCancel {
		if d.waitingCh != nil {
			close(d.waitingCh)
			d.waitingCh = nil
		}
		<-mctx.Ctx().Done()
		return nil, mctx.Ctx().Err()
	}
	if query != nil && *query == "miketown" {
		return []chat1.GiphySearchResult{chat1.GiphySearchResult{
			TargetUrl: "https://www.miketown.com",
		}}, nil
	}
	return []chat1.GiphySearchResult{chat1.GiphySearchResult{
		TargetUrl: "https://www.notmiketown.com",
	}}, nil
}

func TestGiphyPreview(t *testing.T) {
	tc := externalstest.SetupTest(t, "giphy", 0)
	defer tc.Cleanup()

	g := globals.NewContext(tc.G, &globals.ChatContext{})
	giphy := NewGiphy(g)
	searcher := newTestGiphySearcher()
	giphy.searcher = searcher
	ctx := context.TODO()
	uid := gregor1.UID{1, 2, 3, 4}
	convID := chat1.ConversationID{1, 2, 3, 4}
	ui := kbtest.NewChatUI()
	g.UIRouter = kbtest.NewMockUIRouter(ui)
	g.AttachmentURLSrv = types.DummyAttachmentHTTPSrv{}
	timeout := 20 * time.Second

	giphy.Preview(ctx, uid, convID, "", "/giph")
	select {
	case <-ui.GiphyResults:
		require.Fail(t, "no results")
	default:
	}

	giphy.Preview(ctx, uid, convID, "", "/giphy")
	select {
	case show := <-ui.GiphyWindow:
		require.True(t, show)
	case <-time.After(timeout):
		require.Fail(t, "no window")
	}
	select {
	case res := <-ui.GiphyResults:
		require.Equal(t, 1, len(res.Results))
		require.Equal(t, "https://www.notmiketown.com", res.Results[0].TargetUrl)
	case <-time.After(timeout):
		require.Fail(t, "no results")
	}
	giphy.Preview(ctx, uid, convID, "", "/giphy ")
	select {
	case <-ui.GiphyResults:
		require.Fail(t, "no results")
	default:
	}
	giphy.Preview(ctx, uid, convID, "", "")
	select {
	case show := <-ui.GiphyWindow:
		require.False(t, show)
	case <-time.After(timeout):
		require.Fail(t, "no window")
	}

	waitingCh := make(chan struct{})
	searcher.waitingCh = waitingCh
	searcher.waitForCancel = true
	firstDoneCh := make(chan struct{})
	go func() {
		giphy.Preview(ctx, uid, convID, "", "/giphy")
		close(firstDoneCh)
	}()
	select {
	case <-waitingCh:
		searcher.waitForCancel = false
	case <-time.After(timeout):
		require.Fail(t, "no waiting ch")
	}
	giphy.Preview(ctx, uid, convID, "", "/giphy miketown")
	for i := 0; i < 2; i++ {
		select {
		case show := <-ui.GiphyWindow:
			require.True(t, show)
		case <-time.After(timeout):
			require.Fail(t, "no window")
		}
	}
	select {
	case res := <-ui.GiphyResults:
		require.Equal(t, 1, len(res.Results))
		require.Equal(t, "https://www.miketown.com", res.Results[0].TargetUrl)
	case <-time.After(timeout):
		require.Fail(t, "no results")
	}
	select {
	case <-firstDoneCh:
	case <-time.After(timeout):
		require.Fail(t, "no first done")
	}
	giphy.Preview(ctx, uid, convID, "", "")
	select {
	case show := <-ui.GiphyWindow:
		require.False(t, show)
	case <-time.After(timeout):
		require.Fail(t, "no window")
	}
	select {
	case <-ui.GiphyResults:
		require.Fail(t, "no more results")
	default:
	}
}
