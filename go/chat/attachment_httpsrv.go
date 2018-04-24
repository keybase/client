package chat

import (
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"sync"

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

type DummyAttachmentFetcher struct{}

func (d DummyAttachmentFetcher) FetchAttachment(ctx context.Context, w io.Writer,
	convID chat1.ConversationID, asset chat1.Asset, r func() chat1.RemoteInterface, signer s3.Signer,
	progress types.ProgressReporter) error {
	return nil
}

func (d DummyAttachmentFetcher) DeleteAssets(ctx context.Context,
	convID chat1.ConversationID, assets []chat1.Asset, ri func() chat1.RemoteInterface, signer s3.Signer) (err error) {
	return nil
}

type DummyAttachmentHTTPSrv struct{}

func (d DummyAttachmentHTTPSrv) GetURL(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID,
	preview bool) string {
	return ""
}

func (d DummyAttachmentHTTPSrv) GetAttachmentFetcher() types.AttachmentFetcher {
	return DummyAttachmentFetcher{}
}

var blankProgress = func(bytesComplete, bytesTotal int64) {}

type AttachmentHTTPSrv struct {
	sync.Mutex
	globals.Contextified
	utils.DebugLabeler

	endpoint string
	httpSrv  *libkb.HTTPSrv
	urlMap   *lru.Cache
	fetcher  types.AttachmentFetcher
	ri       func() chat1.RemoteInterface
}

var _ types.AttachmentURLSrv = (*AttachmentHTTPSrv)(nil)

func NewAttachmentHTTPSrv(g *globals.Context, fetcher types.AttachmentFetcher, ri func() chat1.RemoteInterface) *AttachmentHTTPSrv {
	l, err := lru.New(10000)
	if err != nil {
		panic(err)
	}
	r := &AttachmentHTTPSrv{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "AttachmentHTTPSrv", false),
		httpSrv:      libkb.NewHTTPSrv(g.ExternalG(), libkb.NewPortRangeListenerSource(16423, 18000)),
		endpoint:     "at",
		ri:           ri,
		urlMap:       l,
		fetcher:      fetcher,
	}
	r.startHTTPSrv()
	g.PushShutdownHook(func() error {
		r.httpSrv.Stop()
		return nil
	})
	go r.monitorAppState()

	return r
}

func (r *AttachmentHTTPSrv) monitorAppState() {
	ctx := context.Background()
	r.Debug(ctx, "monitorAppState: starting up")
	state := keybase1.AppState_FOREGROUND
	for {
		state = <-r.G().AppState.NextUpdate(&state)
		switch state {
		case keybase1.AppState_FOREGROUND:
			r.startHTTPSrv()
		case keybase1.AppState_BACKGROUND:
			r.httpSrv.Stop()
		}
	}
}

func (r *AttachmentHTTPSrv) startHTTPSrv() {
	if err := r.httpSrv.Start(); err != nil {
		r.Debug(context.TODO(), "startHTTPSrv: failed to start HTTP server: %", err)
		return
	}
	r.httpSrv.HandleFunc("/"+r.endpoint, r.serve)
}

func (r *AttachmentHTTPSrv) GetAttachmentFetcher() types.AttachmentFetcher {
	return r.fetcher
}

func (r *AttachmentHTTPSrv) GetURL(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID,
	preview bool) string {
	r.Lock()
	defer r.Unlock()
	defer r.Trace(ctx, func() error { return nil }, "GetURL(%s,%d)", convID, msgID)()
	if !r.httpSrv.Active() {
		r.Debug(ctx, "GetURL: http server failed to start earlier")
		return ""
	}
	addr, err := r.httpSrv.Addr()
	if err != nil {
		r.Debug(ctx, "GetURL: failed to get HTTP server address: %s", err)
		return ""
	}
	key, err := libkb.RandHexString("at", 8)
	if err != nil {
		r.Debug(ctx, "GetURL: failed to generate URL key: %s", err)
		return ""
	}
	r.urlMap.Add(key, chat1.ConversationIDMessageIDPair{
		ConvID: convID,
		MsgID:  msgID,
	})
	url := fmt.Sprintf("http://%s/%s?key=%s&prev=%v", addr, r.endpoint, key, preview)
	r.Debug(ctx, "GetURL: handler URL: convID: %s msgID: %d %s", convID, msgID, url)
	return url
}

func (r *AttachmentHTTPSrv) serve(w http.ResponseWriter, req *http.Request) {
	ctx := Context(context.Background(), r.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil,
		NewSimpleIdentifyNotifier(r.G()))
	defer r.Trace(ctx, func() error { return nil }, "serve")()

	var response struct {
		code int
		msg  string
	}
	makeError := func(code int, msg string, args ...interface{}) {
		response.code = code
		response.msg = fmt.Sprintf(msg, args...)
		r.Debug(ctx, "serve: error code: %d msg %s", response.code, response.msg)
		w.WriteHeader(response.code)
	}

	key := req.URL.Query().Get("key")
	preview := false
	if "true" == req.URL.Query().Get("prev") {
		preview = true
	}
	r.Lock()
	pairInt, ok := r.urlMap.Get(key)
	r.Unlock()
	if !ok {
		makeError(404, "key not found in URL map")
		return
	}

	pair := pairInt.(chat1.ConversationIDMessageIDPair)
	uid := gregor1.UID(r.G().Env.GetUID().ToBytes())
	asset, err := attachments.AssetFromMessage(ctx, r.G(), uid, pair.ConvID, pair.MsgID, preview)
	if err != nil {
		makeError(500, "failed to get asset: %s", err)
		return
	}
	if len(asset.Path) == 0 {
		makeError(404, "attachment not uploaded yet, no path")
		return
	}
	if err := r.fetcher.FetchAttachment(ctx, w, pair.ConvID, asset, r.ri, r, blankProgress); err != nil {
		makeError(500, "failed to fetch attachment: %s", err)
		return
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
	store *attachments.Store
}

var _ types.AttachmentFetcher = (*RemoteAttachmentFetcher)(nil)

func NewRemoteAttachmentFetcher(g *globals.Context, store *attachments.Store) *RemoteAttachmentFetcher {
	return &RemoteAttachmentFetcher{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "RemoteAttachmentFetcher", false),
		store:        store,
	}
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

type attachmentRemoteStore interface {
	DecryptAsset(ctx context.Context, w io.Writer, body io.Reader, asset chat1.Asset,
		progress types.ProgressReporter) error
	GetAssetReader(ctx context.Context, params chat1.S3Params, asset chat1.Asset,
		signer s3.Signer) (io.ReadCloser, error)
	DeleteAssets(ctx context.Context, params chat1.S3Params, signer s3.Signer, assets []chat1.Asset) error
}

type CachingAttachmentFetcher struct {
	globals.Contextified
	utils.DebugLabeler

	store   attachmentRemoteStore
	diskLRU *disklru.DiskLRU

	// testing
	tempDir string
}

var _ types.AttachmentFetcher = (*CachingAttachmentFetcher)(nil)

func NewCachingAttachmentFetcher(g *globals.Context, store attachmentRemoteStore, size int) *CachingAttachmentFetcher {
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

func (c *CachingAttachmentFetcher) FetchAttachment(ctx context.Context, w io.Writer,
	convID chat1.ConversationID, asset chat1.Asset, ri func() chat1.RemoteInterface, signer s3.Signer,
	progress types.ProgressReporter) (err error) {

	defer c.Trace(ctx, func() error { return err }, "FetchAttachment")()

	// Check for a disk cache hit, and decrypt that onto the response stream
	found, entry, err := c.diskLRU.Get(ctx, c.G(), c.cacheKey(asset))
	if err != nil {
		return err
	}
	if found {
		path := entry.Value.(string)
		c.Debug(ctx, "FetchAttachment: cache hit for: %s filepath: %s", asset.Path, path)
		fileReader, err := os.OpenFile(path, os.O_RDONLY, os.ModeAppend)
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

	// Add an entry to the disk LRU mapping the asset path to the local path, and remove
	// the remnants of any evicted attachments.
	evicted, err := c.diskLRU.Put(ctx, c.G(), c.cacheKey(asset), fileWriter.Name())
	if err != nil {
		return err
	}
	if evicted != nil {
		path := evicted.Value.(string)
		os.Remove(path)
	}

	return nil
}

func (c *CachingAttachmentFetcher) DeleteAssets(ctx context.Context,
	convID chat1.ConversationID, assets []chat1.Asset, ri func() chat1.RemoteInterface, signer s3.Signer) (err error) {
	defer c.Trace(ctx, func() error { return err }, "DeleteAssets")()

	if len(assets) == 0 {
		return nil
	}

	// get s3 params from server
	s3params, err := ri().GetS3Params(ctx, convID)
	if err != nil {
		c.Debug(ctx, "error getting s3params: %s", err)
		return err
	}

	// Delete the assets locally
	for _, asset := range assets {
		c.diskLRU.Remove(ctx, c.G(), c.cacheKey(asset))
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
