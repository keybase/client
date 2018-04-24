package chat

import (
	"bytes"
	"context"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

type nopCloser struct {
	io.Reader
}

func (nopCloser) Close() error { return nil }

type mockAttachmentRemoteStore struct {
	decryptCh     chan struct{}
	assetReaderCh chan struct{}
}

func (m mockAttachmentRemoteStore) DecryptAsset(ctx context.Context, w io.Writer, body io.Reader,
	asset chat1.Asset, progress types.ProgressReporter) error {
	if m.decryptCh != nil {
		m.decryptCh <- struct{}{}
	}
	io.Copy(w, body)
	return nil
}

func (m mockAttachmentRemoteStore) DeleteAssets(ctx context.Context, params chat1.S3Params, signer s3.Signer, assets []chat1.Asset) error {
	return nil
}

func (m mockAttachmentRemoteStore) GetAssetReader(ctx context.Context, params chat1.S3Params, asset chat1.Asset,
	signer s3.Signer) (io.ReadCloser, error) {
	if m.assetReaderCh != nil {
		m.assetReaderCh <- struct{}{}
	}
	return nopCloser{Reader: bytes.NewBufferString("HI")}, nil
}

type mockSigningRemote struct {
	chat1.RemoteInterface
}

func (m mockSigningRemote) Sign(payload []byte) ([]byte, error) {
	return nil, nil
}

func (m mockSigningRemote) GetS3Params(ctx context.Context, convID chat1.ConversationID) (res chat1.S3Params, err error) {
	return res, nil
}

func TestChatSrvAttachmentHTTPSrv(t *testing.T) {
	ctc := makeChatTestContext(t, "TestChatSrvAttachmentHTTPSrv", 1)
	defer ctc.cleanup()
	users := ctc.users()

	defer func() {
		useRemoteMock = true
	}()
	useRemoteMock = false
	tc := ctc.world.Tcs[users[0].Username]
	decryptCh := make(chan struct{}, 10)
	assetReaderCh := make(chan struct{}, 10)
	store := mockAttachmentRemoteStore{
		decryptCh:     decryptCh,
		assetReaderCh: assetReaderCh,
	}
	fetcher := NewCachingAttachmentFetcher(tc.Context(), store, 1)
	d, err := libkb.RandHexString("", 8)
	require.NoError(t, err)
	fetcher.tempDir = filepath.Join(os.TempDir(), d)

	uid := gregor1.UID(users[0].GetUID().ToBytes())
	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	tc.ChatG.AttachmentURLSrv = NewAttachmentHTTPSrv(tc.Context(),
		fetcher, func() chat1.RemoteInterface { return mockSigningRemote{} })

	postLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
		Object: chat1.Asset{
			Path: "m0",
		},
	}))
	postLocalForTest(t, ctc, users[0], conv, chat1.NewMessageBodyWithAttachment(chat1.MessageAttachment{
		Object: chat1.Asset{
			Path: "m1",
		},
	}))

	tv, _, err := tc.Context().ConvSource.Pull(context.TODO(), conv.Id, uid, &chat1.GetThreadQuery{
		MessageTypes: []chat1.MessageType{chat1.MessageType_ATTACHMENT},
	}, nil)
	require.NoError(t, err)
	require.Equal(t, 2, len(tv.Messages))

	uiMsg := utils.PresentMessageUnboxed(context.TODO(), tc.Context(), tv.Messages[0], uid, conv.Id)
	require.NotNil(t, uiMsg.Valid().AssetUrlInfo)
	uiMsg2 := utils.PresentMessageUnboxed(context.TODO(), tc.Context(), tv.Messages[1], uid, conv.Id)
	require.NotNil(t, uiMsg.Valid().AssetUrlInfo)

	waitTime := 20 * time.Second
	readAsset := func(msg chat1.UIMessage, cacheHit bool) {
		httpRes, err := http.Get(msg.Valid().AssetUrlInfo.FullUrl)
		require.NoError(t, err)
		body, err := ioutil.ReadAll(httpRes.Body)
		require.NoError(t, err)
		require.Equal(t, "HI", string(body))
		if cacheHit {
			select {
			case <-assetReaderCh:
				require.Fail(t, "should have hit cache")
			default:
			}
		} else {
			select {
			case <-assetReaderCh:
			case <-time.After(waitTime):
				require.Fail(t, "should have read")
			}
		}
		select {
		case <-decryptCh:
		case <-time.After(waitTime):
			require.Fail(t, "should have decrypted")
		}
	}
	readAsset(uiMsg, false)
	readAsset(uiMsg, true)
	readAsset(uiMsg2, false)
	readAsset(uiMsg2, true)
	readAsset(uiMsg, false) // make sure it got evicted
	readAsset(uiMsg, true)

	require.NoError(t, os.RemoveAll(fetcher.tempDir))
	readAsset(uiMsg, false)
	readAsset(uiMsg, true)

	assets := utils.AssetsForMessage(tc.Context(), tv.Messages[0].Valid().MessageBody)
	require.Len(t, assets, 1)
	err = fetcher.DeleteAssets(context.TODO(), conv.Id, assets,
		func() chat1.RemoteInterface { return mockSigningRemote{} }, mockSigningRemote{})
	require.NoError(t, err)
}
