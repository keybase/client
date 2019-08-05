package libkb

import (
	"fmt"
	"net/http"

	"github.com/keybase/client/go/kbhttp"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type HTTPSrvTokenMode int

const (
	HTTPSrvTokenModeDefault   = iota
	HTTPSrvTokenModeUnchecked // use with caution!
)

type srvEndpoint struct {
	tokenMode HTTPSrvTokenMode
	serve     func(w http.ResponseWriter, req *http.Request)
}

type HTTPSrv struct {
	Contextified

	httpSrv   *kbhttp.Srv
	endpoints map[string]srvEndpoint
	token     string
}

func NewHTTPSrv(g *GlobalContext) *HTTPSrv {
	h := &HTTPSrv{
		Contextified: NewContextified(g),
		endpoints:    make(map[string]srvEndpoint),
	}
	h.initHTTPSrv()
	h.startHTTPSrv()
	g.PushShutdownHook(func() error {
		h.httpSrv.Stop()
		return nil
	})
	go h.monitorAppState()
	return h
}

func (r *HTTPSrv) debug(ctx context.Context, msg string, args ...interface{}) {
	r.G().Log.CDebugf(ctx, "HTTPSrv: %s", fmt.Sprintf(msg, args...))
}

func (r *HTTPSrv) initHTTPSrv() {
	startPort := r.G().GetEnv().GetAttachmentHTTPStartPort()
	r.httpSrv = kbhttp.NewSrv(r.G().GetLog(), kbhttp.NewPortRangeListenerSource(startPort, 18000))
	r.token, _ = RandHexString("", 32)
}

func (r *HTTPSrv) startHTTPSrv() {
	ctx := context.Background()
	maxTries := 2
	success := false
	for i := 0; i < maxTries; i++ {
		if err := r.httpSrv.Start(); err != nil {
			if err == kbhttp.ErrPinnedPortInUse {
				// If we hit this, just try again and get a different port.
				// The advantage is that backing in and out of the thread will restore attachments,
				// whereas if we do nothing you need to bkg/foreground.
				r.debug(ctx, "startHTTPSrv: pinned port taken error, re-initializing and trying again")
				r.initHTTPSrv()
				continue
			}
			r.debug(ctx, "startHTTPSrv: failed to start HTTP server: %s", err)
			break
		}
		success = true
		break
	}
	if !success {
		r.debug(ctx, "startHTTPSrv: exhausted attempts to start HTTP server, giving up")
		return
	}
	for endpoint, serveDesc := range r.endpoints {
		r.HandleFunc("/"+endpoint, serveDesc.tokenMode, serveDesc.serve)
	}
	addr, err := r.httpSrv.Addr()
	if err != nil {
		r.debug(ctx, "startHTTPSrv: failed to get address after start?: %s", err)
	}
	r.G().NotifyRouter.HandleHttpSrvInfoUpdate(ctx, keybase1.HttpSrvInfo{
		Address: addr,
		Token:   r.token,
	})
}

func (r *HTTPSrv) monitorAppState() {
	ctx := context.Background()
	r.debug(ctx, "monitorAppState: starting up")
	state := keybase1.MobileAppState_FOREGROUND
	for {
		state = <-r.G().MobileAppState.NextUpdate(&state)
		switch state {
		case keybase1.MobileAppState_FOREGROUND:
			r.startHTTPSrv()
		case keybase1.MobileAppState_BACKGROUND, keybase1.MobileAppState_INACTIVE:
			r.httpSrv.Stop()
		}
	}
}

func (r *HTTPSrv) HandleFunc(endpoint string, tokenMode HTTPSrvTokenMode,
	serve func(w http.ResponseWriter, req *http.Request)) {
	r.httpSrv.HandleFunc("/"+endpoint, func(w http.ResponseWriter, req *http.Request) {
		switch tokenMode {
		case HTTPSrvTokenModeDefault:
			if req.URL.Query().Get("token") != r.token {
				w.WriteHeader(http.StatusForbidden)
				return
			}
		case HTTPSrvTokenModeUnchecked:
			// serve needs to authenticate on its own
		}
		serve(w, req)
	})
	r.endpoints[endpoint] = srvEndpoint{
		tokenMode: tokenMode,
		serve:     serve,
	}
}

func (r *HTTPSrv) Active() bool {
	return r.httpSrv.Active()
}

func (r *HTTPSrv) Addr() (string, error) {
	return r.httpSrv.Addr()
}

func (r *HTTPSrv) Token() string {
	return r.token
}
