package search

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type appStateCtxFactory struct{}

func (appStateCtxFactory) NewKeyFinder() types.KeyFinder   { return nil }
func (appStateCtxFactory) NewUPAKFinder() types.UPAKFinder { return nil }

// erroringInboxSource fails the inbox read allConvs makes, so a completed
// SelectiveSync always signals on syncLoopCh with an error. Only
// ReadUnverified is reachable from the sync path this test exercises.
type erroringInboxSource struct {
	types.InboxSource
}

func (erroringInboxSource) ReadUnverified(ctx context.Context, uid gregor1.UID,
	dataSource types.InboxSourceDataSourceTyp, query *chat1.GetInboxQuery,
) (types.Inbox, error) {
	return types.Inbox{}, errors.New("stub inbox source error")
}

// A poke that lands while the app is BACKGROUND must not run a sync: SyncLoop
// only gates a *running* sync on FOREGROUND (it cancels one on the app-state
// transition), it never checks the current state before starting a new one
// on a poke, tick, or the initial start delay.
func TestSyncIndexerPokeWhileBackgroundedDoesNotSync(t *testing.T) {
	tc := externalstest.SetupTest(t, "indexer-appstate-bg", 0)
	t.Cleanup(tc.Cleanup)
	g := globals.NewContext(tc.G, &globals.ChatContext{
		CtxFactory:  appStateCtxFactory{},
		InboxSource: erroringInboxSource{},
	})
	idx := NewIndexer(g)
	idx.SetStartSyncDelay(time.Hour)
	idx.syncInterval = time.Hour
	syncLoopCh := make(chan struct{}, 1)
	idx.SetSyncLoopCh(syncLoopCh)

	uid := gregor1.UID([]byte{1, 2, 3, 4})
	idx.Start(context.TODO(), uid)
	defer func() {
		select {
		case <-idx.Stop(context.TODO()):
		case <-time.After(10 * time.Second):
			require.FailNow(t, "Stop did not finish")
		}
	}()

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	// Give the loop's select time to observe the BACKGROUND transition before
	// the poke arrives.
	time.Sleep(100 * time.Millisecond)
	idx.PokeSync(context.TODO())

	require.Never(t, func() bool {
		select {
		case <-syncLoopCh:
			return true
		default:
			return false
		}
	}, 500*time.Millisecond, 10*time.Millisecond, "SelectiveSync ran from a poke while the app was BACKGROUND")
}
