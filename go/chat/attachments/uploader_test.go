package attachments

import (
	"errors"
	"io"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type mockStore struct {
	Store
	uploadFn func(context.Context, *UploadTask) (chat1.Asset, error)
}

func (m *mockStore) UploadAsset(ctx context.Context, task *UploadTask, encryptedOut io.Writer) (chat1.Asset, error) {
	return m.uploadFn(ctx, task)
}

type mockRemote struct {
	chat1.RemoteInterface
}

func (r mockRemote) GetS3Params(context.Context, chat1.ConversationID) (chat1.S3Params, error) {
	return chat1.S3Params{}, nil
}

func (r mockRemote) S3Sign(context.Context, chat1.S3SignArg) ([]byte, error) {
	return nil, nil
}

type mockActivityNotifier struct {
	types.ActivityNotifier
	startCh chan chat1.OutboxID
}

func newMockActivityNotifier() *mockActivityNotifier {
	return &mockActivityNotifier{
		startCh: make(chan chat1.OutboxID, 1000),
	}
}

func (a *mockActivityNotifier) AttachmentUploadStart(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, outboxID chat1.OutboxID) {
	a.startCh <- outboxID
}

func (a *mockActivityNotifier) AttachmentUploadProgress(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, outboxID chat1.OutboxID, bytesComplete, bytesTotal int64) {

}

type mockDeliverer struct {
	types.MessageDeliverer
	forceCh chan struct{}
}

func newMockDeliverer() *mockDeliverer {
	return &mockDeliverer{
		forceCh: make(chan struct{}, 1000),
	}
}

func (m *mockDeliverer) ForceDeliverLoop(context.Context) {
	m.forceCh <- struct{}{}
}

func (m *mockDeliverer) Stop(context.Context) chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}

func TestAttachmentUploader(t *testing.T) {
	world := kbtest.NewChatMockWorld(t, "uploader", 1)
	defer world.Cleanup()

	u := world.GetUsers()[0]
	uid := gregor1.UID(u.User.GetUID().ToBytes())
	tc := world.Tcs[u.Username]
	g := globals.NewContext(tc.G, tc.ChatG)
	notifier := newMockActivityNotifier()
	store := &mockStore{}
	ri := mockRemote{}
	deliverer := newMockDeliverer()
	g.AttachmentURLSrv = types.DummyAttachmentHTTPSrv{}
	g.ActivityNotifier = notifier
	g.MessageDeliverer = deliverer
	getRi := func() chat1.RemoteInterface { return ri }
	cacheSize := 1
	uploader := NewUploader(g, store, NewS3Signer(getRi), getRi, cacheSize)
	convID := chat1.ConversationID([]byte{0, 1, 0})
	outboxID, err := storage.NewOutboxID()
	require.NoError(t, err)
	filename := "../testdata/ship.jpg"

	// Basic test to see if it works
	store.uploadFn = func(context.Context, *UploadTask) (chat1.Asset, error) {
		return chat1.Asset{}, nil
	}
	md, err := libkb.RandBytes(10)
	require.NoError(t, err)
	resChan, err := uploader.Register(context.TODO(), uid, convID, outboxID, "ship", filename, md, nil)
	require.NoError(t, err)
	uploadStartCheck := func(shouldHappen bool, outboxID chat1.OutboxID) {
		if shouldHappen {
			select {
			case obid := <-notifier.startCh:
				require.Equal(t, outboxID, obid)
			case <-time.After(20 * time.Second):
				require.Fail(t, "no start")
			}
		} else {
			select {
			case <-notifier.startCh:
				require.Fail(t, "start not supposed to happen")
			default:
			}
		}
	}
	deliverCheck := func(shouldHappen bool) {
		if shouldHappen {
			select {
			case <-deliverer.forceCh:
			case <-time.After(20 * time.Second):
				require.Fail(t, "no start")
			}
		} else {
			select {
			case <-deliverer.forceCh:
				require.Fail(t, "start not supposed to happen")
			default:
			}
		}
	}
	successCheck := func(cb types.AttachmentUploaderResultCb) {
		ch := cb.Wait()
		select {
		case res := <-ch:
			require.Nil(t, res.Error)
			require.Equal(t, md, res.Metadata)
			require.NotNil(t, res.Preview)
			require.Equal(t, "image/jpeg", res.Preview.MimeType)
			require.Equal(t, "image/jpeg", res.Object.MimeType)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no upload")
		}
	}
	deliverCheck(true)
	uploadStartCheck(true, outboxID)
	successCheck(resChan)

	// Broken store
	outboxID, err = storage.NewOutboxID()
	require.NoError(t, err)
	store.uploadFn = func(context.Context, *UploadTask) (chat1.Asset, error) {
		return chat1.Asset{}, errors.New("i dont work")
	}
	resChan, err = uploader.Register(context.TODO(), uid, convID, outboxID, "ship", filename, md, nil)
	require.NoError(t, err)
	uploadStartCheck(true, outboxID)
	select {
	case res := <-resChan.Wait():
		require.NotNil(t, res.Error)
	case <-time.After(20 * time.Second):
		require.Fail(t, "no upload")
	}
	deliverCheck(true)

	// Retry after fixing store
	store.uploadFn = func(context.Context, *UploadTask) (chat1.Asset, error) {
		return chat1.Asset{}, nil
	}
	resChan, err = uploader.Retry(context.TODO(), outboxID)
	require.NoError(t, err)
	uploadStartCheck(true, outboxID)
	successCheck(resChan)
	deliverCheck(true)

	// Slow store to test concurrent retry
	outboxID, err = storage.NewOutboxID()
	require.NoError(t, err)
	slowCh := make(chan struct{})
	store.uploadFn = func(context.Context, *UploadTask) (chat1.Asset, error) {
		<-slowCh
		return chat1.Asset{}, nil
	}
	resChan, err = uploader.Register(context.TODO(), uid, convID, outboxID, "ship", filename, md, nil)
	require.NoError(t, err)
	uploadStartCheck(true, outboxID)
	deliverCheck(false)
	select {
	case <-resChan.Wait():
		require.Fail(t, "no res")
	default:
	}
	retryChan, err := uploader.Retry(context.TODO(), outboxID)
	require.NoError(t, err)
	uploadStartCheck(false, outboxID)
	close(slowCh)
	deliverCheck(true)
	// Should get results on both of these
	successCheck(retryChan)
	successCheck(resChan)

	uploader.Complete(context.TODO(), outboxID)
	_, _, err = uploader.Status(context.TODO(), outboxID)
	require.Error(t, err)

	// Test cancel
	outboxID, err = storage.NewOutboxID()
	require.NoError(t, err)
	slowCh = make(chan struct{})
	store.uploadFn = func(ctx context.Context, task *UploadTask) (chat1.Asset, error) {
		select {
		case <-slowCh:
		case <-ctx.Done():
			return chat1.Asset{}, ctx.Err()
		}
		return chat1.Asset{}, nil
	}
	resChan, err = uploader.Register(context.TODO(), uid, convID, outboxID, "ship", filename, md, nil)
	require.NoError(t, err)
	uploadStartCheck(true, outboxID)
	deliverCheck(false)
	select {
	case <-resChan.Wait():
		require.Fail(t, "no res")
	default:
	}
	require.NoError(t, uploader.Cancel(context.TODO(), outboxID))
	_, _, err = uploader.Status(context.TODO(), outboxID)
	require.Error(t, err)
	select {
	case res := <-resChan.Wait():
		require.NotNil(t, res.Error)
	}

	// verify uploadedPreviewsDir respects the cache size
	baseDir := uploader.getBaseDir()
	uploadedPreviews, err := filepath.Glob(filepath.Join(baseDir, uploadedPreviewsDir, "*"))
	require.NoError(t, err)
	require.Len(t, uploadedPreviews, 1)

	// verify uploadedFullsDir is respects the cache size
	uploadedFulls, err := filepath.Glob(filepath.Join(baseDir, uploadedFullsDir, "*"))
	require.NoError(t, err)
	require.Len(t, uploadedFulls, 1)
	mctx := kbtest.NewMetaContextForTest(*tc)

	// verify db nuke
	g.LocalDb.Nuke()
	err = uploader.OnDbNuke(mctx)
	require.NoError(t, err)

	uploadedPreviews, err = filepath.Glob(filepath.Join(baseDir, uploadedPreviewsDir, "*"))
	require.NoError(t, err)
	require.Zero(t, len(uploadedPreviews))

	uploadedFulls, err = filepath.Glob(filepath.Join(baseDir, uploadedFullsDir, "*"))
	require.NoError(t, err)
	require.Zero(t, len(uploadedFulls))
}
