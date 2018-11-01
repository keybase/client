package unfurl

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"net/http"
	"testing"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

type ptsigner struct{}

func (p *ptsigner) Sign(payload []byte) ([]byte, error) {
	s := sha256.Sum256(payload)
	return s[:], nil
}

type paramsRemote struct {
	chat1.RemoteInterface
}

func (p paramsRemote) GetS3Params(ctx context.Context, convID chat1.ConversationID) (chat1.S3Params, error) {
	return chat1.S3Params{
		Bucket:    "packager-test",
		ObjectKey: libkb.RandStringB64(3),
	}, nil
}

func TestPackager(t *testing.T) {
	log := logger.NewTestLogger(t)
	store := attachments.NewStoreTesting(log, nil)
	s3Signer := &ptsigner{}
	ri := func() chat1.RemoteInterface { return paramsRemote{} }
	packager := NewPackager(log, store, s3Signer, ri)
	srv := newDummyHTTPSrv(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		if r.URL.Query().Get("typ") == "favicon" {
			w.Write([]byte("FAVICON"))
			return
		}
		w.Write([]byte("IMAGE"))
	})
	addr := srv.Start()
	defer srv.Stop()

	uid := gregor1.UID([]byte{0})
	convID := chat1.ConversationID([]byte{0})
	imageURL := fmt.Sprintf("http://%s/?typ=image", addr)
	faviconURL := fmt.Sprintf("http://%s/?typ=favicon", addr)
	raw := chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		ImageUrl:   &imageURL,
		FaviconUrl: &faviconURL,
	})
	res, err := packager.Package(context.TODO(), uid, convID, raw)
	require.NoError(t, err)
	typ, err := res.UnfurlType()
	require.NoError(t, err)
	require.Equal(t, chat1.UnfurlType_GENERIC, typ)
	image := res.Generic().Image
	require.NotNil(t, image)
	favicon := res.Generic().Favicon
	require.NotNil(t, favicon)

	var buf bytes.Buffer
	s3params, err := ri().GetS3Params(context.TODO(), convID)
	require.NoError(t, err)
	require.NoError(t, store.DownloadAsset(context.TODO(), s3params, *image, &buf, s3Signer, nil))
	require.Equal(t, "IMAGE", buf.String())
	buf.Reset()
	require.NoError(t, store.DownloadAsset(context.TODO(), s3params, *favicon, &buf, s3Signer, nil))
	require.Equal(t, "FAVICON", buf.String())
}
