package search

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

type deadlockTestDiskStorage struct {
	clearEntered chan struct{}
	clearRelease chan struct{}
}

func (d *deadlockTestDiskStorage) GetTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string,
) (res *tokenEntry, err error) {
	return nil, nil
}

func (d *deadlockTestDiskStorage) PutTokenEntry(ctx context.Context, convID chat1.ConversationID,
	token string, te *tokenEntry,
) error {
	return nil
}

func (d *deadlockTestDiskStorage) RemoveTokenEntry(ctx context.Context, convID chat1.ConversationID, token string) {
}

func (d *deadlockTestDiskStorage) GetAliasEntry(ctx context.Context, alias string) (res *aliasEntry, err error) {
	return nil, nil
}

func (d *deadlockTestDiskStorage) PutAliasEntry(ctx context.Context, alias string, ae *aliasEntry) error {
	return nil
}

func (d *deadlockTestDiskStorage) RemoveAliasEntry(ctx context.Context, alias string) {}

func (d *deadlockTestDiskStorage) GetMetadata(ctx context.Context, convID chat1.ConversationID) (res *indexMetadata, err error) {
	return nil, nil
}

func (d *deadlockTestDiskStorage) PutMetadata(ctx context.Context, convID chat1.ConversationID, md *indexMetadata) error {
	return nil
}

func (d *deadlockTestDiskStorage) Clear(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) error {
	if d.clearEntered != nil {
		select {
		case d.clearEntered <- struct{}{}:
		default:
		}
	}
	if d.clearRelease != nil {
		select {
		case <-d.clearRelease:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

type blockingGetMsgsChatHelper struct {
	*kbtest.MockChatHelper
	calledCh  chan struct{}
	releaseCh chan struct{}
}

func (h *blockingGetMsgsChatHelper) GetMessages(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgIDs []chat1.MessageID,
	resolveSupersedes bool, reason *chat1.GetThreadReason,
) ([]chat1.MessageUnboxed, error) {
	select {
	case h.calledCh <- struct{}{}:
	default:
	}
	select {
	case <-h.releaseCh:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return nil, nil
}

func setupDeadlockTestStore(t *testing.T) (*globals.Context, *store) {
	tc := externalstest.SetupTest(t, "search-deadlock", 2)
	t.Cleanup(tc.Cleanup)
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	uid := gregor1.UID([]byte{1, 2, 3, 4})
	s := newStore(g, uid)
	s.diskStorage = &deadlockTestDiskStorage{}
	return g, s
}

func TestSearchDeadlockRegression(t *testing.T) {
	t.Run("store add releases lock before superseded fetch", func(t *testing.T) {
		ctx := context.TODO()
		g, s := setupDeadlockTestStore(t)
		calledCh := make(chan struct{}, 1)
		releaseCh := make(chan struct{})
		var releaseOnce sync.Once
		releaseFetch := func() {
			releaseOnce.Do(func() {
				close(releaseCh)
			})
		}
		t.Cleanup(releaseFetch)
		g.ExternalG().ChatHelper = &blockingGetMsgsChatHelper{
			MockChatHelper: kbtest.NewMockChatHelper(),
			calledCh:       calledCh,
			releaseCh:      releaseCh,
		}

		convID := chat1.ConversationID([]byte{
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
		})
		editMsg := chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
			ClientHeader: chat1.MessageClientHeaderVerified{
				MessageType: chat1.MessageType_EDIT,
				Conv: chat1.ConversationIDTriple{
					TopicType: chat1.TopicType_CHAT,
				},
			},
			MessageBody: chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
				MessageID: 1,
				Body:      "hello world",
			}),
			ServerHeader: chat1.MessageServerHeader{
				MessageID: 2,
			},
		})

		addDone := make(chan error, 1)
		go func() {
			addDone <- s.Add(ctx, convID, []chat1.MessageUnboxed{editMsg})
		}()

		select {
		case <-calledCh:
		case <-time.After(10 * time.Second):
			require.Fail(t, "store.Add never reached GetMessages")
		}

		clearDone := make(chan struct{})
		go func() {
			s.ClearMemory()
			close(clearDone)
		}()

		select {
		case <-clearDone:
		case <-time.After(5 * time.Second):
			releaseFetch()
			require.Fail(t, "store.Add held s.Lock while blocked in GetMessages")
		}

		releaseFetch()
		select {
		case err := <-addDone:
			require.NoError(t, err)
		case <-time.After(10 * time.Second):
			require.Fail(t, "store.Add never completed after GetMessages was released")
		}
	})

	t.Run("indexer clear releases lock while storage clear is blocked", func(t *testing.T) {
		ctx := context.TODO()
		tc := externalstest.SetupTest(t, "indexer-clear-lock", 2)
		t.Cleanup(tc.Cleanup)
		g := globals.NewContext(tc.G, &globals.ChatContext{})
		uid := gregor1.UID([]byte{9, 8, 7, 6})
		convID := chat1.ConversationID([]byte{
			16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
		})

		idx := NewIndexer(g)
		idx.SetUID(uid)
		ds := &deadlockTestDiskStorage{
			clearEntered: make(chan struct{}, 1),
			clearRelease: make(chan struct{}),
		}
		var releaseOnce sync.Once
		releaseClear := func() {
			releaseOnce.Do(func() {
				close(ds.clearRelease)
			})
		}
		t.Cleanup(releaseClear)
		idx.store.diskStorage = ds
		idx.started = true

		clearDone := make(chan error, 1)
		go func() {
			clearDone <- idx.Clear(ctx, uid, convID)
		}()

		select {
		case <-ds.clearEntered:
		case <-time.After(10 * time.Second):
			require.Fail(t, "Indexer.Clear never reached diskStorage.Clear")
		}

		suspendDone := make(chan struct{})
		go func() {
			idx.Suspend(ctx)
			close(suspendDone)
		}()

		select {
		case <-suspendDone:
		case <-time.After(5 * time.Second):
			releaseClear()
			require.Fail(t, "Indexer.Clear held idx.Lock while blocked in diskStorage.Clear")
		}
		idx.Resume(ctx)

		releaseClear()
		select {
		case err := <-clearDone:
			require.NoError(t, err)
		case <-time.After(10 * time.Second):
			require.Fail(t, "Indexer.Clear never completed after diskStorage.Clear was released")
		}
	})
}
