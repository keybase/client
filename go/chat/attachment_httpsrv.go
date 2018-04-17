package chat

import (
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type AttachmentFetcher interface {
	FetchAttachment(ctx context.Context, w io.Writer, asset chat1.Asset, s3params chat1.S3Params,
		signer s3.Signer) error
}

type AttachmentHTTPSrv struct {
	sync.Mutex
	globals.Contextified
	utils.DebugLabeler

	endpoint string
	httpSrv  *libkb.HTTPSrv
	urlMap   map[string]chat1.ConversationIDMessageIDPair
	fetcher  AttachmentFetcher
	ri       func() chat1.RemoteInterface
}

var _ types.AttachmentURLSrv = (*AttachmentHTTPSrv)(nil)

func NewAttachmentHTTPSrv(g *globals.Context, fetcher AttachmentFetcher, ri func() chat1.RemoteInterface) *AttachmentHTTPSrv {
	r := &AttachmentHTTPSrv{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "RemoteAttachmentHTTPSrv", false),
		httpSrv:      libkb.NewHTTPSrv(g.ExternalG(), libkb.NewPortRangeListenerSource(7000, 8000)),
		endpoint:     "at",
		ri:           ri,
	}
	if err := r.httpSrv.Start(); err != nil {
		r.Debug(context.TODO(), "NewRemoteAttachmentHTTPSrv: failed to start HTTP server: %", err)
		return r
	}
	r.httpSrv.HandleFunc(r.endpoint, r.servePreview)
	g.PushShutdownHook(func() error {
		r.httpSrv.Stop()
		return nil
	})
	return r
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
	r.urlMap[key] = chat1.ConversationIDMessageIDPair{
		ConvID: convID,
		MsgID:  msgID,
	}
	return fmt.Sprintf("http://%s/%s?key=%s&prev=%v", addr, r.endpoint, key, preview)
}

func (r *AttachmentHTTPSrv) servePreview(w http.ResponseWriter, req *http.Request) {
	ctx := Context(context.Background(), r.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil,
		NewSimpleIdentifyNotifier(r.G()))
	defer r.Trace(ctx, func() error { return nil }, "servePreview")()
	key := req.URL.Query().Get("key")
	preview := false
	if len(req.URL.Query().Get("prev")) > 0 {
		preview = true
	}
	r.Lock()
	pair, ok := r.urlMap[key]
	r.Unlock()
	if !ok {
		w.WriteHeader(404)
		return
	}

	uid := gregor1.UID(r.G().Env.GetUID().ToBytes())
	asset, err := attachments.AssetFromMessage(ctx, r.G(), uid, pair.ConvID, pair.MsgID, preview)
	if err != nil {
		w.WriteHeader(500)
		return
	}
	params, err := r.ri().GetS3Params(ctx, pair.ConvID)
	if err != nil {
		w.WriteHeader(500)
		return
	}
	if err := r.fetcher.FetchAttachment(ctx, w, asset, params, r); err != nil {
		w.WriteHeader(500)
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

var _ AttachmentFetcher = (*RemoteAttachmentFetcher)(nil)

func NewRemoteAttachmentFetcher(g *globals.Context, store *attachments.Store) *RemoteAttachmentFetcher {
	return &RemoteAttachmentFetcher{
		Contextified: globals.NewContextified(g),
		store:        store,
	}
}

func (r *RemoteAttachmentFetcher) FetchAttachment(ctx context.Context, w io.Writer, asset chat1.Asset,
	s3params chat1.S3Params, signer s3.Signer) error {
	return r.store.DownloadAsset(ctx, s3params, asset, w, signer,
		func(bytesComplete, bytesTotal int64) {})
}
