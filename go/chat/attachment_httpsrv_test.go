package chat

import (
	"bytes"
	"context"
	"errors"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/externalstest"
	"github.com/keybase/client/go/kbhttp/manager"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"

	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
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

func (m mockAttachmentRemoteStore) DeleteAssets(ctx context.Context, params chat1.S3Params, signer s3.Signer,
	assets []chat1.Asset) error {
	return nil
}

func (m mockAttachmentRemoteStore) DeleteAsset(ctx context.Context, params chat1.S3Params, signer s3.Signer,
	asset chat1.Asset) error {
	return nil
}

func (m mockAttachmentRemoteStore) DownloadAsset(ctx context.Context, params chat1.S3Params,
	asset chat1.Asset, w io.Writer, signer s3.Signer, progress types.ProgressReporter) error {
	return errors.New("not implemented")
}

func (m mockAttachmentRemoteStore) UploadAsset(ctx context.Context, task *attachments.UploadTask,
	encryptedOut io.Writer) (chat1.Asset, error) {
	return chat1.Asset{}, errors.New("not implemented")
}

func (m mockAttachmentRemoteStore) StreamAsset(ctx context.Context, params chat1.S3Params, asset chat1.Asset,
	signer s3.Signer) (io.ReadSeeker, error) {
	return nil, errors.New("not implemented")
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
		manager.NewSrv(tc.Context().ExternalG()), fetcher,
		func() chat1.RemoteInterface { return mockSigningRemote{} })

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

	tv, err := tc.Context().ConvSource.Pull(context.TODO(), conv.Id, uid,
		chat1.GetThreadReason_GENERAL,
		&chat1.GetThreadQuery{
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

	found, localPath, err := fetcher.localAssetPath(context.TODO(), assets[0])
	require.NoError(t, err)
	require.True(t, found)
	_, err = os.Stat(localPath)
	require.False(t, os.IsNotExist(err))

	err = fetcher.DeleteAssets(context.TODO(), conv.Id, assets,
		func() chat1.RemoteInterface { return mockSigningRemote{} }, mockSigningRemote{})
	require.NoError(t, err)

	// make sure we have purged the attachment from disk as well
	_, err = os.Stat(localPath)
	require.True(t, os.IsNotExist(err))
}

func TestChatSrvAttachmentUploadPreviewCached(t *testing.T) {
	etc := externalstest.SetupTest(t, "chat", 1)
	defer etc.Cleanup()

	ctc := makeChatTestContext(t, "TestChatSrvAttachmentUploadPreviewCached", 1)
	defer ctc.cleanup()
	users := ctc.users()

	defer func() {
		useRemoteMock = true
	}()
	useRemoteMock = false
	tc := ctc.world.Tcs[users[0].Username]
	store := attachments.NewStoreTesting(logger.NewTestLogger(t), nil, etc.G)
	fetcher := NewCachingAttachmentFetcher(tc.Context(), store, 5)
	ri := ctc.as(t, users[0]).ri
	d, err := libkb.RandHexString("", 8)
	require.NoError(t, err)
	fetcher.tempDir = filepath.Join(os.TempDir(), d)

	conv := mustCreateConversationForTest(t, ctc, users[0], chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE)
	tc.ChatG.AttachmentURLSrv = NewAttachmentHTTPSrv(tc.Context(),
		manager.NewSrv(tc.Context().ExternalG()),
		fetcher, func() chat1.RemoteInterface { return mockSigningRemote{} })
	uploader := attachments.NewUploader(tc.Context(), store, mockSigningRemote{},
		func() chat1.RemoteInterface { return ri }, 1)
	uploader.SetPreviewTempDir(fetcher.tempDir)
	tc.ChatG.AttachmentUploader = uploader

	res, err := ctc.as(t, users[0]).chatLocalHandler().PostFileAttachmentLocal(context.TODO(),
		chat1.PostFileAttachmentLocalArg{
			Arg: chat1.PostFileAttachmentArg{
				ConversationID: conv.Id,
				TlfName:        conv.TlfName,
				Visibility:     keybase1.TLFVisibility_PRIVATE,
				Filename:       "testdata/ship.jpg",
				Title:          "SHIP",
			},
		})
	require.NoError(t, err)

	msgRes, err := ctc.as(t, users[0]).chatLocalHandler().GetMessagesLocal(context.TODO(),
		chat1.GetMessagesLocalArg{
			ConversationID: conv.Id,
			MessageIDs:     []chat1.MessageID{res.MessageID},
		})
	require.NoError(t, err)
	require.Equal(t, 1, len(msgRes.Messages))
	require.True(t, msgRes.Messages[0].IsValid())
	body := msgRes.Messages[0].Valid().MessageBody
	require.NotNil(t, body.Attachment().Preview)

	t.Logf("remote preview path: %s", body.Attachment().Preview.Path)
	t.Logf("remote object path: %s", body.Attachment().Object.Path)
	found, path, err := fetcher.localAssetPath(context.TODO(), *body.Attachment().Preview)
	require.NoError(t, err)
	require.True(t, found)
	t.Logf("found path: %s", path)

	found, path, err = fetcher.localAssetPath(context.TODO(), body.Attachment().Object)
	require.NoError(t, err)
	require.True(t, found)
	t.Logf("found path: %s", path)

	// Try with an attachment with no preview
	res, err = ctc.as(t, users[0]).chatLocalHandler().PostFileAttachmentLocal(context.TODO(),
		chat1.PostFileAttachmentLocalArg{
			Arg: chat1.PostFileAttachmentArg{
				ConversationID: conv.Id,
				TlfName:        conv.TlfName,
				Visibility:     keybase1.TLFVisibility_PRIVATE,
				Filename:       "testdata/weather.pdf",
				Title:          "WEATHER",
			},
		})
	require.NoError(t, err)
	msgRes, err = ctc.as(t, users[0]).chatLocalHandler().GetMessagesLocal(context.TODO(),
		chat1.GetMessagesLocalArg{
			ConversationID: conv.Id,
			MessageIDs:     []chat1.MessageID{res.MessageID},
		})
	require.NoError(t, err)
	require.Equal(t, 1, len(msgRes.Messages))
	require.True(t, msgRes.Messages[0].IsValid())
	body = msgRes.Messages[0].Valid().MessageBody
	require.Nil(t, body.Attachment().Preview)
	found, path, err = fetcher.localAssetPath(context.TODO(), body.Attachment().Object)
	require.NoError(t, err)
	require.False(t, found)
}
