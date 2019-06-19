package unfurl

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/keybase/client/go/chat/globals"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
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
	tc := libkb.SetupTest(t, "packager", 1)
	defer tc.Cleanup()

	log := logger.NewTestLogger(t)
	store := attachments.NewStoreTesting(log, nil, tc.G)
	s3Signer := &ptsigner{}
	ri := func() chat1.RemoteInterface { return paramsRemote{} }
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	packager := NewPackager(g, store, s3Signer, ri)
	clock := clockwork.NewFakeClock()
	packager.cache.setClock(clock)
	srvFile := func(w io.Writer, name string) {
		file, err := os.Open(name)
		require.NoError(t, err)
		defer file.Close()
		_, err = io.Copy(w, file)
		require.NoError(t, err)
	}
	srv := newDummyHTTPSrv(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		if r.URL.Query().Get("typ") == "favicon" {
			srvFile(w, filepath.Join("testcases", "nytimes.ico"))
			return
		}
		srvFile(w, filepath.Join("testcases", "nytogimage.jpg"))
	})
	addr := srv.Start()
	defer srv.Stop()

	uid := gregor1.UID([]byte{0})
	convID := chat1.ConversationID([]byte{0})
	imageURL := fmt.Sprintf("http://%s/?typ=image", addr)
	faviconURL := fmt.Sprintf("http://%s/?typ=favicon", addr)
	raw := chat1.NewUnfurlRawWithGeneric(chat1.UnfurlGenericRaw{
		Url:        "https://example.com",
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
	require.NotZero(t, image.Metadata.Image().Height)
	require.NotZero(t, image.Metadata.Image().Width)
	require.NotZero(t, favicon.Metadata.Image().Height)
	require.NotZero(t, favicon.Metadata.Image().Width)

	// test caching
	cacheKey := packager.cacheKey(uid, convID, raw)
	cachedRes, valid := packager.cache.get(cacheKey)
	require.True(t, valid)
	require.Equal(t, res, cachedRes.data.(chat1.Unfurl))

	clock.Advance(defaultCacheLifetime * 2)
	cachedRes, valid = packager.cache.get(cacheKey)
	require.False(t, valid)

	compareSol := func(name string, resDat []byte) {
		dat, err := ioutil.ReadFile(filepath.Join("testcases", name))
		require.NoError(t, err)
		require.True(t, bytes.Equal(dat, resDat))
	}
	var buf bytes.Buffer
	s3params, err := ri().GetS3Params(context.TODO(), convID)
	require.NoError(t, err)
	require.NoError(t, store.DownloadAsset(context.TODO(), s3params, *image, &buf, s3Signer, nil))
	compareSol("nytogimage_sol.jpg", buf.Bytes())
	buf.Reset()
	require.NoError(t, store.DownloadAsset(context.TODO(), s3params, *favicon, &buf, s3Signer, nil))
	compareSol("nytimes_sol.ico", buf.Bytes())
}
