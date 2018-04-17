package chat

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/s3"
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

func NewRemoteAttachmentHTTPSrv(g *globals.Context, fetcher AttachmentFetcher, ri func() chat1.RemoteInterface) *AttachmentHTTPSrv {
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

func (r *AttachmentHTTPSrv) GetURLs(ctx context.Context, ats []chat1.ConversationIDMessageIDPair,
	preview bool) (res []string, err error) {
	r.Lock()
	defer r.Unlock()
	if !r.httpSrv.Active() {
		return nil, errors.New("http server failed to start earlier")
	}
	addr, err := r.httpSrv.Addr()
	if err != nil {
		return nil, err
	}
	for _, at := range ats {
		key, err := libkb.RandHexString("at", 8)
		if err != nil {
			return nil, err
		}
		r.urlMap[key] = at
		url := fmt.Sprintf("http://%s/%s?key=%s&prev=%v", addr, r.endpoint, key, preview)
		res = append(res, url)
	}
	return res, nil
}

func (r *AttachmentHTTPSrv) servePreview(w http.ResponseWriter, req *http.Request) {
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
	ctx := Context(context.Background(), r.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil,
		NewSimpleIdentifyNotifier(r.G()))
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
