package chat

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/giphy"
	"github.com/keybase/client/go/kbhttp/manager"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	disklru "github.com/keybase/client/go/lru"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

const keyPrefixLen = 2

var blankProgress = func(bytesComplete, bytesTotal int64) {}

type AttachmentHTTPSrv struct {
	sync.Mutex
	globals.Contextified
	utils.DebugLabeler

	endpoint           string
	attachmentPrefix   string
	pendingPrefix      string
	unfurlPrefix       string
	giphyPrefix        string
	giphyGalleryPrefix string
	giphySelectPrefix  string
	urlMap             *lru.Cache
	fetcher            types.AttachmentFetcher
	ri                 func() chat1.RemoteInterface
	httpSrv            *manager.Srv
}

var _ types.AttachmentURLSrv = (*AttachmentHTTPSrv)(nil)

func NewAttachmentHTTPSrv(g *globals.Context, httpSrv *manager.Srv, fetcher types.AttachmentFetcher,
	ri func() chat1.RemoteInterface) *AttachmentHTTPSrv {
	l, err := lru.New(2000)
	if err != nil {
		panic(err)
	}
	r := &AttachmentHTTPSrv{
		Contextified:       globals.NewContextified(g),
		DebugLabeler:       utils.NewDebugLabeler(g.GetLog(), "AttachmentHTTPSrv", false),
		endpoint:           "at",
		attachmentPrefix:   "at",
		pendingPrefix:      "pe",
		unfurlPrefix:       "uf",
		giphyPrefix:        "gf",
		giphyGalleryPrefix: "gg",
		giphySelectPrefix:  "gs",
		ri:                 ri,
		urlMap:             l,
		fetcher:            fetcher,
		httpSrv:            httpSrv,
	}
	r.httpSrv.HandleFunc(r.endpoint, manager.SrvTokenModeUnchecked, r.serve)
	r.fetcher.OnStart(libkb.NewMetaContextTODO(g.ExternalG()))
	return r
}

func (r *AttachmentHTTPSrv) OnDbNuke(mctx libkb.MetaContext) error {
	r.fetcher.OnDbNuke(mctx)
	return nil
}

func (r *AttachmentHTTPSrv) GetAttachmentFetcher() types.AttachmentFetcher {
	return r.fetcher
}

func (r *AttachmentHTTPSrv) randURLKey(prefix string) (string, error) {
	return libkb.RandHexString(prefix, 32)
}

func (r *AttachmentHTTPSrv) getURL(ctx context.Context, prefix string, payload interface{}) string {
	if !r.httpSrv.Active() {
		r.Debug(ctx, "getURL: http server failed to start earlier")
		return ""
	}
	addr, err := r.httpSrv.Addr()
	if err != nil {
		r.Debug(ctx, "getURL: failed to get HTTP server address: %s", err)
		return ""
	}
	key, err := r.randURLKey(prefix)
	if err != nil {
		r.Debug(ctx, "getURL: failed to generate URL key: %s", err)
		return ""
	}
	r.urlMap.Add(key, payload)
	return fmt.Sprintf("http://%s/%s?key=%s", addr, r.endpoint, key)
}

func (r *AttachmentHTTPSrv) GetURL(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID,
	preview bool) string {
	r.Lock()
	defer r.Unlock()
	defer r.Trace(ctx, func() error { return nil }, "GetURL(%s,%d)", convID, msgID)()
	url := r.getURL(ctx, r.attachmentPrefix, chat1.ConversationIDMessageIDPair{
		ConvID: convID,
		MsgID:  msgID,
	})
	url += fmt.Sprintf("&prev=%v", preview)
	r.Debug(ctx, "GetURL: handler URL: convID: %s msgID: %d %s", convID, msgID, url)
	return url
}

func (r *AttachmentHTTPSrv) GetPendingPreviewURL(ctx context.Context, outboxID chat1.OutboxID) string {
	defer r.Trace(ctx, func() error { return nil }, "GetPendingPreviewURL(%s)", outboxID)()
	url := r.getURL(ctx, r.pendingPrefix, outboxID)
	r.Debug(ctx, "GetPendingPreviewURL: handler URL: outboxID: %s %s", outboxID, url)
	return url
}

type unfurlAsset struct {
	asset  chat1.Asset
	convID chat1.ConversationID
}

func (r *AttachmentHTTPSrv) GetUnfurlAssetURL(ctx context.Context, convID chat1.ConversationID,
	asset chat1.Asset) string {
	defer r.Trace(ctx, func() error { return nil }, "GetUnfurlAssetURL")()
	url := r.getURL(ctx, r.unfurlPrefix, unfurlAsset{
		asset:  asset,
		convID: convID,
	})
	r.Debug(ctx, "GetUnfurlAssetURL: handler URL: %s", url)
	return url
}

func (r *AttachmentHTTPSrv) GetGiphyURL(ctx context.Context, giphyURL string) string {
	defer r.Trace(ctx, func() error { return nil }, "GetGiphyURL")()
	url := r.getURL(ctx, r.giphyPrefix, giphyURL)
	r.Debug(ctx, "GetGiphyURL: handler URL: %s", url)
	return url
}

func (r *AttachmentHTTPSrv) GetGiphyGalleryURL(ctx context.Context, convID chat1.ConversationID,
	tlfName string, results []chat1.GiphySearchResult) string {
	defer r.Trace(ctx, func() error { return nil }, "GetGiphyGalleryURL")()
	url := r.getURL(ctx, r.giphyGalleryPrefix, giphyGalleryInfo{
		results: results,
		convID:  convID,
		tlfName: tlfName,
	})
	r.Debug(ctx, "GetGiphyGalleryURL: handler URL: %s", url)
	return url
}

func (r *AttachmentHTTPSrv) servePendingPreview(ctx context.Context, w http.ResponseWriter, req *http.Request) {
	defer r.Trace(ctx, func() error { return nil }, "servePendingPreview")()
	key := req.URL.Query().Get("key")
	intOutboxID, ok := r.urlMap.Get(key)
	if !ok {
		r.makeError(ctx, w, http.StatusNotFound, "missing key: %s", key)
		return
	}
	outboxID, ok := intOutboxID.(chat1.OutboxID)
	if !ok {
		r.makeError(ctx, w, http.StatusBadRequest, "invalid outboxID")
		return
	}
	pre, err := attachments.NewPendingPreviews(r.G()).Get(ctx, outboxID)
	if err != nil {
		r.makeError(ctx, w, http.StatusInternalServerError, "error reading preview: %s", err)
		return
	}
	if _, err := io.Copy(w, bytes.NewReader(pre.Preview)); err != nil {
		r.makeError(ctx, w, http.StatusInternalServerError, "failed to write resposne: %s", err)
		return
	}
}

func (r *AttachmentHTTPSrv) serveUnfurlAsset(ctx context.Context, w http.ResponseWriter, req *http.Request) {
	defer r.Trace(ctx, func() error { return nil }, "serveUnfurlAsset")()
	key := req.URL.Query().Get("key")
	val, ok := r.urlMap.Get(key)
	if !ok {
		r.makeError(ctx, w, http.StatusNotFound, "invalid key: %s", key)
		return
	}
	ua := val.(unfurlAsset)
	if r.shouldServeContent(ctx, ua.asset, req) {
		if r.serveUnfurlVideoHostPage(ctx, w, req) {
			// if we served the host page, just bail out
			return
		}
		r.Debug(ctx, "serveUnfurlAsset: streaming: req: method: %s range: %s", req.Method,
			req.Header.Get("Range"))
		rs, err := r.fetcher.StreamAttachment(ctx, ua.convID, ua.asset, r.ri, r)
		if err != nil {
			r.makeError(ctx, w, http.StatusInternalServerError, "failed to get streamer: %s", err)
			return
		}
		http.ServeContent(w, req, ua.asset.Filename, time.Time{}, rs)
	} else {
		if err := r.fetcher.FetchAttachment(ctx, w, ua.convID, ua.asset, r.ri, r, blankProgress); err != nil {
			r.makeError(ctx, w, http.StatusInternalServerError, "failed to fetch attachment: %s", err)
			return
		}
	}
}

type giphyGalleryInfo struct {
	results []chat1.GiphySearchResult
	convID  chat1.ConversationID
	tlfName string
}

func (r *AttachmentHTTPSrv) getGiphyGallerySelectURL(ctx context.Context, convID chat1.ConversationID,
	tlfName, targetURL string) string {
	addr, err := r.httpSrv.Addr()
	if err != nil {
		r.Debug(ctx, "getGiphySelectURL: failed to get HTTP server address: %s", err)
		return ""
	}
	key, err := r.randURLKey(r.giphySelectPrefix)
	if err != nil {
		r.Debug(ctx, "getGiphySelectURL: failed to generate URL key: %s", err)
		return ""
	}
	r.urlMap.Add(key, targetURL)
	return fmt.Sprintf("http://%s/%s?url=%s&convID=%s&tlfName=%s&key=%s", addr, r.endpoint,
		url.QueryEscape(targetURL), convID, tlfName, key)
}

func (r *AttachmentHTTPSrv) serveGiphyGallerySelect(ctx context.Context, w http.ResponseWriter,
	req *http.Request) {
	defer r.Trace(ctx, func() error { return nil }, "serveGiphyGallerySelect")()
	url := req.URL.Query().Get("url")
	strConvID := req.URL.Query().Get("convID")
	tlfName := req.URL.Query().Get("tlfName")
	key := req.URL.Query().Get("key")
	if mapURL, ok := r.urlMap.Get(key); !ok || mapURL != url {
		r.makeError(ctx, w, http.StatusNotFound, "invalid key: %s", key)
		return
	}
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		r.makeError(context.TODO(), w, http.StatusInternalServerError, "failed to decode convID: %s",
			err)
		return
	}
	if err := r.G().ChatHelper.SendTextByID(ctx, convID, tlfName, url, keybase1.TLFVisibility_PRIVATE); err != nil {
		r.makeError(context.TODO(), w, http.StatusInternalServerError, "failed to send giphy url: %s",
			err)
	}
	ui, err := r.G().UIRouter.GetChatUI()
	if err == nil && ui != nil {
		ui.ChatGiphyToggleResultWindow(ctx, convID, false, true)
	} else {
		r.Debug(ctx, "serveGiphyGallerySelect: failed to get chat UI: %s", err)
	}
}

func (r *AttachmentHTTPSrv) serveGiphyGallery(ctx context.Context, w http.ResponseWriter, req *http.Request) {
	defer r.Trace(ctx, func() error { return nil }, "serveGiphyGallery")()
	key := req.URL.Query().Get("key")
	infoInt, ok := r.urlMap.Get(key)
	if !ok {
		r.makeError(ctx, w, http.StatusNotFound, "invalid key: %s", key)
		return
	}
	galleryInfo := infoInt.(giphyGalleryInfo)
	var videoStr string
	for _, res := range galleryInfo.results {
		videoStr += fmt.Sprintf(`
			<img style="height: 100%%" src="%s" onclick="sendMessage('%s')" />
		`, res.PreviewUrl, r.getGiphyGallerySelectURL(ctx, galleryInfo.convID, galleryInfo.tlfName,
			res.TargetUrl))
	}
	res := fmt.Sprintf(`
	<html>
		<head>
			<title>Keybase Giphy Gallery</title>
			<script>
				window.sendMessage = function(url) {
					var req = new XMLHttpRequest();
					req.open("GET", url);
					req.send();
				}
			</script>
		</head>
		<body style="margin: 0px;">
			<div style="display: flex; flex-direction: row; height: 100%%; overflow-x: auto; overflow-y: hidden; flex-wrap: nowrap;  -webkit-overflow-scrolling: touch; border-top: 1px solid rgba(0, 0, 0, 0.20); align-items: flex-end;">
				%s
			</div>
		</body>
	</html>`, videoStr)
	if _, err := io.WriteString(w, res); err != nil {
		r.makeError(context.TODO(), w, http.StatusInternalServerError, "failed to write giphy gallery: %s",
			err)
	}
}

func (r *AttachmentHTTPSrv) serveGiphyLink(ctx context.Context, w http.ResponseWriter, req *http.Request) {
	defer r.Trace(ctx, func() error { return nil }, "serveGiphyLink")()
	key := req.URL.Query().Get("key")
	val, ok := r.urlMap.Get(key)
	if !ok {
		r.makeError(ctx, w, http.StatusNotFound, "invalid key: %s", key)
		return
	}
	// Grab range headers
	rangeHeader := req.Header.Get("Range")
	client := giphy.AssetClient(libkb.NewMetaContext(ctx, r.G().GlobalContext))
	url, err := giphy.ProxyURL(val.(string))
	if err != nil {
		r.makeError(ctx, w, http.StatusInternalServerError, "url creation: %s", err)
		return
	}
	giphyReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		r.makeError(ctx, w, http.StatusInternalServerError, "request creation: %s", err)
		return
	}
	if len(rangeHeader) > 0 {
		giphyReq.Header.Add("Range", rangeHeader)
	}
	giphyReq.Host = giphy.MediaHost
	resp, err := client.Do(giphyReq)
	if err != nil {
		r.makeError(ctx, w, resp.StatusCode, "failed to get read giphy link: %s", err)
		return
	}
	defer resp.Body.Close()
	for k := range resp.Header {
		w.Header().Add(k, resp.Header.Get(k))
	}
	if _, err := io.Copy(w, resp.Body); err != nil {
		r.makeError(ctx, w, resp.StatusCode, "failed to write giphy data: %s", err)
		return
	}
}

func (r *AttachmentHTTPSrv) makeError(ctx context.Context, w http.ResponseWriter, code int, msg string,
	args ...interface{}) {
	r.Debug(ctx, "serve: error code: %d msg %s", code, fmt.Sprintf(msg, args...))
	w.WriteHeader(code)
}

func (r *AttachmentHTTPSrv) shouldServeContent(ctx context.Context, asset chat1.Asset, req *http.Request) bool {
	noStream := "true" == req.URL.Query().Get("nostream")
	if noStream {
		// If we just want the bits without streaming
		return false
	}
	return strings.HasPrefix(asset.MimeType, "video")
}

func (r *AttachmentHTTPSrv) serveUnfurlVideoHostPage(ctx context.Context, w http.ResponseWriter, req *http.Request) bool {
	contentForce := "true" == req.URL.Query().Get("contentforce")
	if r.G().GetAppType() == libkb.MobileAppType && !contentForce {
		r.Debug(ctx, "serveUnfurlVideoHostPage: mobile client detected, showing the HTML video viewer")
		w.Header().Set("Content-Type", "text/html")
		autoplay := ""
		if req.URL.Query().Get("autoplay") != "true" {
			autoplay = `onloadeddata="togglePlay('pause')"`
		}
		if _, err := w.Write([]byte(fmt.Sprintf(`
			<html>
				<head>
					<meta name="viewport" content="initial-scale=1, viewport-fit=cover">
					<title>Keybase Video Viewer</title>
					<script>
						window.playVideo = function(data) {
							var vid = document.getElementById("vid");
							vid.play()
						}
						window.togglePlay = function(data) {
							var vid = document.getElementById("vid");
							if (data === "play") {
								vid.play();
							} else {
								vid.pause();
							}
						}
					</script>
				</head>
				<body style="margin: 0px; background-color: rgba(0,0,0,0.05)">
					<video id="vid" %s preload="auto" style="width: 100%%; height: 100%%; border-radius: 4px; object-fit:fill" src="%s" playsinline webkit-playsinline loop autoplay muted />
				</body>
			</html>
		`, autoplay, req.URL.String()+"&contentforce=true"))); err != nil {
			r.Debug(ctx, "serveUnfurlVideoHostPage: failed to write HTML video player: %s", err)
		}
		return true
	}
	return false
}

func (r *AttachmentHTTPSrv) serveVideoHostPage(ctx context.Context, w http.ResponseWriter, req *http.Request) bool {
	contentForce := "true" == req.URL.Query().Get("contentforce")
	if r.G().GetAppType() == libkb.MobileAppType && !contentForce {
		r.Debug(ctx, "serve: mobile client detected, showing the HTML video viewer")
		w.Header().Set("Content-Type", "text/html")
		if _, err := w.Write([]byte(fmt.Sprintf(`
			<html>
				<head>
					<meta name="viewport" content="initial-scale=1, viewport-fit=cover">
					<title>Keybase Video Viewer</title>
					<script>
						window.togglePlay = function(data) {
							var vid = document.getElementById("vid");
							if (data === "play") {
								vid.play();
								vid.setAttribute('controls', 'controls');
							} else {
								vid.pause();
								vid.removeAttribute('controls');
							}
						  }
					</script>
				</head>
				<body style="margin: 0px;">
					<video id="vid" style="width: 100%%; height: 100%%; object-fit:fill; border-radius: 4px" poster="%s" src="%s" preload="none" playsinline webkit-playsinline />
				</body>
			</html>
		`, req.URL.Query().Get("poster"), req.URL.String()+"&contentforce=true"))); err != nil {
			r.Debug(ctx, "serve: failed to write HTML video player: %s", err)
		}
		return true
	}
	return false
}

func (r *AttachmentHTTPSrv) serveAttachment(ctx context.Context, w http.ResponseWriter, req *http.Request) {
	defer r.Trace(ctx, func() error { return nil }, "serveAttachment")()
	key := req.URL.Query().Get("key")
	preview := false
	if "true" == req.URL.Query().Get("prev") {
		preview = true
	}
	r.Lock()
	pairInt, ok := r.urlMap.Get(key)
	r.Unlock()
	if !ok {
		r.makeError(ctx, w, http.StatusNotFound, "key not found in URL map")
		return
	}

	pair := pairInt.(chat1.ConversationIDMessageIDPair)
	uid := gregor1.UID(r.G().Env.GetUID().ToBytes())
	asset, err := attachments.AssetFromMessage(ctx, r.G(), uid, pair.ConvID, pair.MsgID, preview)
	if err != nil {
		r.makeError(ctx, w, http.StatusInternalServerError, "failed to get asset: %s", err)
		return
	}
	if len(asset.Path) == 0 {
		r.makeError(ctx, w, http.StatusNotFound, "attachment not uploaded yet, no path")
		return
	}
	size := asset.Size
	r.Debug(ctx, "serveAttachment: setting content-type: %s sz: %d", asset.MimeType, size)
	w.Header().Set("Content-Type", asset.MimeType)
	if r.shouldServeContent(ctx, asset, req) {
		if r.serveVideoHostPage(ctx, w, req) {
			// if we served the host page, just bail out
			return
		}
		r.Debug(ctx, "serveAttachment: streaming: req: method: %s range: %s", req.Method,
			req.Header.Get("Range"))
		rs, err := r.fetcher.StreamAttachment(ctx, pair.ConvID, asset, r.ri, r)
		if err != nil {
			r.makeError(ctx, w, http.StatusInternalServerError, "failed to get streamer: %s", err)
			return
		}
		http.ServeContent(w, req, asset.Filename, time.Time{}, rs)
	} else {
		if err := r.fetcher.FetchAttachment(ctx, w, pair.ConvID, asset, r.ri, r, blankProgress); err != nil {
			r.makeError(ctx, w, http.StatusInternalServerError, "failed to fetch attachment: %s", err)
			return
		}
	}
}

func (r *AttachmentHTTPSrv) serve(w http.ResponseWriter, req *http.Request) {
	ctx := globals.ChatCtx(context.Background(), r.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil,
		NewSimpleIdentifyNotifier(r.G()))
	defer r.Trace(ctx, func() error { return nil }, "serve")()
	addr, err := r.httpSrv.Addr()
	if err != nil {
		r.Debug(ctx, "serve: failed to get HTTP server address: %s", err)
		r.makeError(ctx, w, http.StatusInternalServerError, "unable to determine addr")
		return
	}
	if req.Host != addr {
		r.Debug(ctx, "Host %s didn't match addr %s, failing request to protect against DNS rebinding", req.Host, addr)
		r.makeError(ctx, w, http.StatusBadRequest, "invalid host")
		return
	}
	key := req.URL.Query().Get("key")
	if len(key) < keyPrefixLen {
		r.makeError(ctx, w, http.StatusNotFound, "invalid key")
		return
	}
	if _, ok := r.urlMap.Get(key); !ok {
		r.makeError(ctx, w, http.StatusNotFound, "invalid key")
		return
	}
	prefix := key[:keyPrefixLen]
	switch prefix {
	case r.unfurlPrefix:
		r.serveUnfurlAsset(ctx, w, req)
	case r.giphyPrefix:
		r.serveGiphyLink(ctx, w, req)
	case r.giphyGalleryPrefix:
		r.serveGiphyGallery(ctx, w, req)
	case r.giphySelectPrefix:
		r.serveGiphyGallerySelect(ctx, w, req)
	case r.pendingPrefix:
		r.servePendingPreview(ctx, w, req)
	case r.attachmentPrefix:
		r.serveAttachment(ctx, w, req)
	default:
		r.makeError(ctx, w, http.StatusBadRequest, "invalid key prefix")
	}
}

// Sign implements github.com/keybase/go/chat/s3.Signer interface.
func (r *AttachmentHTTPSrv) Sign(payload []byte) ([]byte, error) {
	arg := chat1.S3SignArg{
		Payload: payload,
		Version: 1,
	}
	return r.ri().S3Sign(context.Background(), arg)
}

type RemoteAttachmentFetcher struct {
	globals.Contextified
	utils.DebugLabeler
	store attachments.Store
}

var _ types.AttachmentFetcher = (*RemoteAttachmentFetcher)(nil)

func NewRemoteAttachmentFetcher(g *globals.Context, store attachments.Store) *RemoteAttachmentFetcher {
	return &RemoteAttachmentFetcher{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "RemoteAttachmentFetcher", false),
		store:        store,
	}
}

func (r *RemoteAttachmentFetcher) StreamAttachment(ctx context.Context, convID chat1.ConversationID,
	asset chat1.Asset, ri func() chat1.RemoteInterface, signer s3.Signer) (res io.ReadSeeker, err error) {
	defer r.Trace(ctx, func() error { return err }, "StreamAttachment")()
	// Grab S3 params for the conversation
	s3params, err := ri().GetS3Params(ctx, convID)
	if err != nil {
		return nil, err
	}
	return r.store.StreamAsset(ctx, s3params, asset, signer)
}

func (r *RemoteAttachmentFetcher) FetchAttachment(ctx context.Context, w io.Writer,
	convID chat1.ConversationID, asset chat1.Asset,
	ri func() chat1.RemoteInterface, signer s3.Signer, progress types.ProgressReporter) (err error) {
	defer r.Trace(ctx, func() error { return err }, "FetchAttachment")()
	// Grab S3 params for the conversation
	s3params, err := ri().GetS3Params(ctx, convID)
	if err != nil {
		return err
	}
	return r.store.DownloadAsset(ctx, s3params, asset, w, signer, progress)
}

func (r *RemoteAttachmentFetcher) DeleteAssets(ctx context.Context,
	convID chat1.ConversationID, assets []chat1.Asset, ri func() chat1.RemoteInterface, signer s3.Signer) (err error) {
	defer r.Trace(ctx, func() error { return err }, "DeleteAssets")()

	if len(assets) == 0 {
		return nil
	}

	// get s3 params from server
	s3params, err := ri().GetS3Params(ctx, convID)
	if err != nil {
		r.Debug(ctx, "error getting s3params: %s", err)
		return err
	}

	// Try to delete the assets remotely
	if err := r.store.DeleteAssets(ctx, s3params, signer, assets); err != nil {
		// there's no way to get asset information after this point.
		// any assets not deleted will be stranded on s3.
		r.Debug(ctx, "error deleting assets: %s", err)
	}

	r.Debug(ctx, "deleted %d assets", len(assets))
	return nil
}

func (r *RemoteAttachmentFetcher) PutUploadedAsset(ctx context.Context, filename string, asset chat1.Asset) error {
	return nil
}

func (r *RemoteAttachmentFetcher) IsAssetLocal(ctx context.Context, asset chat1.Asset) (bool, error) {
	return false, nil
}

func (r *RemoteAttachmentFetcher) OnDbNuke(mctx libkb.MetaContext) error { return nil }
func (r *RemoteAttachmentFetcher) OnStart(mctx libkb.MetaContext)        {}

type CachingAttachmentFetcher struct {
	globals.Contextified
	utils.DebugLabeler

	store   attachments.Store
	diskLRU *disklru.DiskLRU

	// testing
	tempDir string
}

var _ types.AttachmentFetcher = (*CachingAttachmentFetcher)(nil)

func NewCachingAttachmentFetcher(g *globals.Context, store attachments.Store, size int) *CachingAttachmentFetcher {
	return &CachingAttachmentFetcher{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "CachingAttachmentFetcher", false),
		store:        store,
		diskLRU:      disklru.NewDiskLRU("attachments", 1, size),
	}
}

func (c *CachingAttachmentFetcher) getCacheDir() string {
	if len(c.tempDir) > 0 {
		return c.tempDir
	}
	return filepath.Join(c.G().GetCacheDir(), "attachments")
}

func (c *CachingAttachmentFetcher) getFullFilename(name string) string {
	return name + ".attachment"
}

func (c *CachingAttachmentFetcher) closeFile(f io.Closer) {
	if f != nil {
		f.Close()
	}
}

func (c *CachingAttachmentFetcher) cacheKey(asset chat1.Asset) string {
	return asset.Path
}

func (c *CachingAttachmentFetcher) createAttachmentFile(ctx context.Context) (*os.File, error) {
	os.MkdirAll(c.getCacheDir(), os.ModePerm)
	file, err := ioutil.TempFile(c.getCacheDir(), "att")
	file.Close()
	if err != nil {
		return nil, err
	}
	path := c.getFullFilename(file.Name())
	if err := os.Rename(file.Name(), path); err != nil {
		return nil, err
	}
	return os.OpenFile(path, os.O_RDWR, os.ModeAppend)
}

// normalizeFilenameFromCache substitutes the existing cache dir value into the
// file path since it's possible for the path to the cache dir to change,
// especially on mobile.
func (c *CachingAttachmentFetcher) normalizeFilenameFromCache(file string) string {
	file = filepath.Base(file)
	return filepath.Join(c.getCacheDir(), file)
}

func (c *CachingAttachmentFetcher) localAssetPath(ctx context.Context, asset chat1.Asset) (found bool, path string, err error) {
	found, entry, err := c.diskLRU.Get(ctx, c.G(), c.cacheKey(asset))
	if err != nil {
		return found, path, err
	}
	if found {
		path = c.normalizeFilenameFromCache(entry.Value.(string))
	}
	return found, path, nil
}

func (c *CachingAttachmentFetcher) StreamAttachment(ctx context.Context, convID chat1.ConversationID,
	asset chat1.Asset, ri func() chat1.RemoteInterface, signer s3.Signer) (res io.ReadSeeker, err error) {
	defer c.Trace(ctx, func() error { return err }, "StreamAttachment")()
	return NewRemoteAttachmentFetcher(c.G(), c.store).StreamAttachment(ctx, convID, asset, ri, signer)
}

func (c *CachingAttachmentFetcher) FetchAttachment(ctx context.Context, w io.Writer,
	convID chat1.ConversationID, asset chat1.Asset, ri func() chat1.RemoteInterface, signer s3.Signer,
	progress types.ProgressReporter) (err error) {

	defer c.Trace(ctx, func() error { return err }, "FetchAttachment")()

	// Check for a disk cache hit, and decrypt that onto the response stream
	found, path, err := c.localAssetPath(ctx, asset)
	if err != nil {
		return err
	}
	if found {
		c.Debug(ctx, "FetchAttachment: cache hit for: %s filepath: %s", asset.Path, path)
		fileReader, err := os.Open(path)
		defer c.closeFile(fileReader)
		if err != nil {
			c.Debug(ctx, "FetchAttachment: failed to read cached file, removing: %s", err)
			os.Remove(path)
			c.diskLRU.Remove(ctx, c.G(), c.cacheKey(asset))
			found = false
		}
		if found {
			return c.store.DecryptAsset(ctx, w, fileReader, asset, progress)
		}
	}

	// Grab S3 params for the conversation
	s3params, err := ri().GetS3Params(ctx, convID)
	if err != nil {
		return err
	}

	// Create a reader to the remote ciphertext
	remoteReader, err := c.store.GetAssetReader(ctx, s3params, asset, signer)
	defer c.closeFile(remoteReader)
	if err != nil {
		return err
	}

	// Create a file we can write the ciphertext into
	fileWriter, err := c.createAttachmentFile(ctx)
	defer c.closeFile(fileWriter)
	if err != nil {
		return err
	}

	// Read out the ciphertext into the decryption copier, and simultaneously write
	// into the cached file (the ciphertext)
	teeReader := io.TeeReader(remoteReader, fileWriter)
	if err := c.store.DecryptAsset(ctx, w, teeReader, asset, progress); err != nil {
		c.Debug(ctx, "FetchAttachment: error reading asset: %s", err)
		c.closeFile(fileWriter)
		os.Remove(fileWriter.Name())
		return err
	}

	// commit to the on disk LRU
	return c.putFileInLRU(ctx, fileWriter.Name(), asset)
}

func (c *CachingAttachmentFetcher) putFileInLRU(ctx context.Context, filename string, asset chat1.Asset) error {
	// Add an entry to the disk LRU mapping the asset path to the local path, and remove
	// the remnants of any evicted attachments.
	evicted, err := c.diskLRU.Put(ctx, c.G(), c.cacheKey(asset), filename)
	if err != nil {
		return err
	}
	if evicted != nil {
		path := c.normalizeFilenameFromCache(evicted.Value.(string))
		os.Remove(path)
	}
	return nil
}

func (c *CachingAttachmentFetcher) IsAssetLocal(ctx context.Context, asset chat1.Asset) (found bool, err error) {
	defer c.Trace(ctx, func() error { return err }, "IsAssetLocal")()
	found, path, err := c.localAssetPath(ctx, asset)
	if err != nil {
		return false, err
	}
	if !found {
		return false, nil
	}
	fileReader, err := os.Open(path)
	defer c.closeFile(fileReader)
	if err != nil {
		return false, nil
	}
	return true, nil
}

func (c *CachingAttachmentFetcher) PutUploadedAsset(ctx context.Context, filename string, asset chat1.Asset) (err error) {
	defer c.Trace(ctx, func() error { return err }, "PutUploadedAsset")()
	return c.putFileInLRU(ctx, filename, asset)
}

func (c *CachingAttachmentFetcher) DeleteAssets(ctx context.Context,
	convID chat1.ConversationID, assets []chat1.Asset, ri func() chat1.RemoteInterface, signer s3.Signer) (err error) {
	defer c.Trace(ctx, func() error { return err }, "DeleteAssets")()

	if len(assets) == 0 {
		return nil
	}

	// Delete the assets locally
	for _, asset := range assets {
		found, path, err := c.localAssetPath(ctx, asset)
		if err != nil {
			c.Debug(ctx, "error getting asset: %s", err)
			continue
		}
		if found {
			os.Remove(path)
			c.diskLRU.Remove(ctx, c.G(), c.cacheKey(asset))
		}
	}

	// get s3 params from server
	s3params, err := ri().GetS3Params(ctx, convID)
	if err != nil {
		c.Debug(ctx, "error getting s3params: %s", err)
		return err
	}

	// Try to delete the assets remotely
	if err := c.store.DeleteAssets(ctx, s3params, signer, assets); err != nil {
		// there's no way to get asset information after this point.
		// any assets not deleted will be stranded on s3.
		c.Debug(ctx, "error deleting assets: %s", err)
	}

	c.Debug(ctx, "deleted %d assets", len(assets))
	return nil
}

func (c *CachingAttachmentFetcher) OnStart(mctx libkb.MetaContext) {
	go disklru.CleanOutOfSyncWithDelay(mctx, c.diskLRU, c.getCacheDir(), 10*time.Second)
}

func (c *CachingAttachmentFetcher) OnDbNuke(mctx libkb.MetaContext) error {
	if c.diskLRU != nil {
		if err := c.diskLRU.CleanOutOfSync(mctx, c.getCacheDir()); err != nil {
			c.Debug(mctx.Ctx(), "unable to run clean: %v", err)
		}
	}
	return nil
}
