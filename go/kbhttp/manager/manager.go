package manager

import (
	"crypto/hmac"
	"fmt"
	"net/http"
	"sync"

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

	httpSrv   *kbhttp.Srv
	endpoints map[string]srvEndpoint
	token     string
	startMu   sync.Mutex
}

func NewSrv(g *libkb.GlobalContext) *Srv {
	h := &Srv{
		Contextified: libkb.NewContextified(g),
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
	r.token, _ = libkb.RandHexString("", 32)
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
	r.G().NotifyRouter.HandleHTTPSrvInfoUpdate(ctx, keybase1.HttpSrvInfo{
		Address: addr,
		Token:   r.token,
	})
}

func (r *Srv) monitorAppState() {
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

func (r *Srv) HandleFunc(endpoint string, tokenMode SrvTokenMode,
	serve func(w http.ResponseWriter, req *http.Request)) {
	r.httpSrv.HandleFunc("/"+endpoint, func(w http.ResponseWriter, req *http.Request) {
		switch tokenMode {
		case SrvTokenModeDefault:
			if !hmac.Equal([]byte(req.URL.Query().Get("token")), []byte(r.token)) {
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

func (r *Srv) Active() bool {
	return r.httpSrv.Active()
}

func (r *Srv) Addr() (string, error) {
	r.startMu.Lock()
	defer r.startMu.Unlock()
	return r.httpSrv.Addr()
}

func (r *Srv) Token() string {
	r.startMu.Lock()
	defer r.startMu.Unlock()
	return r.token
}
