package manager

import (
	"crypto/hmac"
	"fmt"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/keybase/client/go/kbhttp"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type SrvTokenMode int

const (
	SrvTokenModeDefault   = iota
	SrvTokenModeUnchecked // use with caution!
)

type srvEndpoint struct {
	tokenMode SrvTokenMode
	serve     func(w http.ResponseWriter, req *http.Request)
}

type Srv struct {
	libkb.Contextified

	httpSrv       *kbhttp.Srv
	endpoints     map[string]srvEndpoint
	token         string
	previousToken string
	tokenExpiry   time.Time
	startMu       sync.Mutex
}

func NewSrv(g *libkb.GlobalContext) *Srv {
	h := &Srv{
		Contextified: libkb.NewContextified(g),
		endpoints:    make(map[string]srvEndpoint),
	}
	h.initHTTPSrv()
	h.startHTTPSrv()
	g.PushShutdownHook(func(mctx libkb.MetaContext) error {
		h.httpSrv.Stop()
		return nil
	})
	go h.monitorAppState()
	return h
}

func (r *Srv) debug(ctx context.Context, msg string, args ...interface{}) {
	r.G().Log.CDebugf(ctx, "Srv: %s", fmt.Sprintf(msg, args...))
}

func (r *Srv) initHTTPSrv() {
	startPort := r.G().GetEnv().GetAttachmentHTTPStartPort()
	r.httpSrv = kbhttp.NewSrv(r.G().GetLog(), kbhttp.NewRandomPortRangeListenerSource(startPort, 18000))
}

func (r *Srv) startHTTPSrv() {
	r.startMu.Lock()
	defer r.startMu.Unlock()
	ctx := context.Background()
	newToken, _ := libkb.RandHexString("", 32)
	
	if r.token != "" {
		r.previousToken = r.token
		r.tokenExpiry = time.Now().Add(10 * time.Second)
		r.debug(ctx, "startHTTPSrv: rotating token, old token valid for 10s grace period")
	}
	
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
		r.HandleFunc(endpoint, serveDesc.tokenMode, serveDesc.serve)
	}
	addr, err := r.httpSrv.Addr()
	if err != nil {
		r.debug(ctx, "startHTTPSrv: failed to get address after start?: %s", err)
	} else {
		r.debug(ctx, "startHTTPSrv: start success: addr: %s", addr)
	}
	r.token = newToken
	r.debug(ctx, "startHTTPSrv: addr: %s new token: %s... (previous token valid until: %v)", addr, r.token[:8], r.tokenExpiry)
	r.debug(ctx, "startHTTPSrv: sending HTTPSrvInfoUpdate notification to clients")
	r.G().NotifyRouter.HandleHTTPSrvInfoUpdate(ctx, keybase1.HttpSrvInfo{
		Address: addr,
		Token:   r.token,
	})
	r.debug(ctx, "startHTTPSrv: HTTPSrvInfoUpdate notification sent")
}

func (r *Srv) monitorAppState() {
	ctx := context.Background()
	r.debug(ctx, "monitorAppState: starting up")
	state := keybase1.MobileAppState_FOREGROUND
	// We don't need this on Android
	if runtime.GOOS == "android" {
		return
	}
	for {
		state = <-r.G().MobileAppState.NextUpdate(&state)
		r.debug(ctx, "monitorAppState: received state update: %v", state)
		switch state {
		case keybase1.MobileAppState_FOREGROUND, keybase1.MobileAppState_BACKGROUNDACTIVE:
			r.debug(ctx, "monitorAppState: transitioning to active state, starting HTTP server")
			r.startHTTPSrv()
			r.debug(ctx, "monitorAppState: HTTP server start completed, active=%v", r.httpSrv.Active())
		case keybase1.MobileAppState_BACKGROUND, keybase1.MobileAppState_INACTIVE:
			r.debug(ctx, "monitorAppState: transitioning to inactive state, stopping HTTP server")
			r.httpSrv.Stop()
		}
	}
}

func (r *Srv) HandleFunc(endpoint string, tokenMode SrvTokenMode,
	serve func(w http.ResponseWriter, req *http.Request)) {
	r.httpSrv.HandleFunc("/"+endpoint, func(w http.ResponseWriter, req *http.Request) {
		switch tokenMode {
		case SrvTokenModeDefault:
			requestToken := req.URL.Query().Get("token")
			r.startMu.Lock()
			currentToken := r.token
			previousToken := r.previousToken
			expiry := r.tokenExpiry
			r.startMu.Unlock()
			
			validToken := hmac.Equal([]byte(requestToken), []byte(currentToken))
			
			if !validToken && previousToken != "" && time.Now().Before(expiry) {
				validToken = hmac.Equal([]byte(requestToken), []byte(previousToken))
				if validToken {
					r.debug(context.Background(), "HandleFunc: request using previous token (grace period), endpoint: %s", endpoint)
				}
			}
			
			if !validToken {
				r.debug(context.Background(), "HandleFunc: token failed for endpoint %s: %s...", endpoint, requestToken[:min(len(requestToken), 8)])
				w.WriteHeader(http.StatusForbidden)
				return
			}
		case SrvTokenModeUnchecked:
			// serve needs to authenticate on its own
		}
		serve(w, req)
	})
	r.endpoints[endpoint] = srvEndpoint{
		tokenMode: tokenMode,
		serve:     serve,
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (r *Srv) Active() bool {
	return r.httpSrv.Active()
}

func (r *Srv) Addr() (string, error) {
	r.startMu.Lock()
	defer r.startMu.Unlock()
	addr, err := r.httpSrv.Addr()
	if err != nil {
		r.debug(context.Background(), "Addr: failed to get address: %v, active=%v", err, r.httpSrv.Active())
	}
	return addr, err
}

func (r *Srv) Token() string {
	r.startMu.Lock()
	defer r.startMu.Unlock()
	return r.token
}
