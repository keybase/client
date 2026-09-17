package manager

import (
	"context"
	"crypto/hmac"
	"errors"
	"fmt"
	"net/http"
	"runtime"
	"sync"

	"github.com/keybase/client/go/kbhttp"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
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

	// token is set once in NewSrv and kept across restarts, so URLs handed
	// out before a restart keep working.
	token          string
	listenerSource func() kbhttp.ListenerSource
	// stopInBackground is false on Android, where the server stays up in
	// every state.
	stopInBackground bool

	// mu guards everything below and serializes starts and stops.
	mu        sync.Mutex
	httpSrv   *kbhttp.Srv
	endpoints map[string]srvEndpoint
	shutdown  bool
	// exitRestartChange is one past stateChanges at the last restart after an
	// unexpected exit, so a listener that keeps dying restarts at most once
	// per app state change.
	exitRestartChange uint64
	// stateChanges counts the app state changes the monitor applied.
	stateChanges uint64
	// exits counts handled unexpected exits, for tests.
	exits int
	// beforeExitRestart, if set, runs in serverExited between reading the
	// app state and acting on it. Tests only.
	beforeExitRestart func()
	// monitorState is the state the monitor last acted on, and monitorWait
	// the change channel it is waiting on for that state; tests use them to
	// wait until the monitor has caught up.
	monitorState keybase1.MobileAppState
	monitorWait  <-chan struct{}

	shutdownCh  chan struct{}
	monitorDone chan struct{}
}

func NewSrv(g *libkb.GlobalContext) *Srv {
	listenerSource := func() kbhttp.ListenerSource {
		return kbhttp.NewRandomPortRangeListenerSource(g.GetEnv().GetAttachmentHTTPStartPort(), 18000)
	}
	return newSrv(g, listenerSource, runtime.GOOS != "android")
}

func newSrv(g *libkb.GlobalContext, listenerSource func() kbhttp.ListenerSource, stopInBackground bool) *Srv {
	token, _ := libkb.RandHexString("", 32)
	h := &Srv{
		Contextified:     libkb.NewContextified(g),
		token:            token,
		listenerSource:   listenerSource,
		stopInBackground: stopInBackground,
		endpoints:        make(map[string]srvEndpoint),
		shutdownCh:       make(chan struct{}),
		monitorDone:      make(chan struct{}),
	}
	h.httpSrv = h.newHTTPSrv()
	g.PushShutdownHook(func(mctx libkb.MetaContext) error {
		h.stop()
		return nil
	})
	state := g.MobileAppState.State()
	h.reconcile(state)
	go h.monitorAppState(state)
	return h
}

func (r *Srv) debug(ctx context.Context, msg string, args ...any) {
	r.G().Log.CDebugf(ctx, "Srv: %s", fmt.Sprintf(msg, args...))
}

// TokenPrefix shortens a token for logging.
func TokenPrefix(token string) string {
	if len(token) > 8 {
		return token[:8] + "..."
	}
	return token
}

func (r *Srv) newHTTPSrv() *kbhttp.Srv {
	srv := kbhttp.NewSrv(r.G().GetLog(), r.listenerSource())
	srv.OnUnexpectedExit(r.serverExited)
	return srv
}

func (r *Srv) wantUp(state keybase1.MobileAppState) bool {
	return !r.stopInBackground || state != keybase1.MobileAppState_BACKGROUND
}

// serverExited restarts a server whose listener died without a Stop, for
// example one the OS reclaimed while the app was suspended without ever
// reaching BACKGROUND.
func (r *Srv) serverExited() {
	ctx := context.Background()
	r.mu.Lock()
	// Read the state and start under mu, so a BACKGROUND the monitor applies
	// concurrently either comes first (seen here) or stops what starts here.
	state := r.G().MobileAppState.State()
	if r.beforeExitRestart != nil {
		r.beforeExitRestart()
	}
	var info keybase1.HttpSrvInfo
	started := false
	if r.wantUp(state) && r.exitRestartChange != r.stateChanges+1 {
		r.exitRestartChange = r.stateChanges + 1
		r.debug(ctx, "serverExited: restarting in %v", state)
		info, started = r.startLocked(ctx)
	} else {
		r.debug(ctx, "serverExited: not restarting in %v", state)
	}
	r.exits++
	r.mu.Unlock()
	if started {
		r.G().NotifyRouter.HandleHTTPSrvInfoUpdate(ctx, info)
	}
}

// startHTTPSrv starts the server if it isn't serving, including after its
// listener died underneath it.
func (r *Srv) startHTTPSrv() {
	ctx := context.Background()
	r.mu.Lock()
	info, started := r.startLocked(ctx)
	r.mu.Unlock()
	if !started {
		return
	}
	r.G().NotifyRouter.HandleHTTPSrvInfoUpdate(ctx, info)
}

func (r *Srv) startLocked(ctx context.Context) (info keybase1.HttpSrvInfo, started bool) {
	if r.shutdown || r.httpSrv.Active() {
		return info, false
	}
	maxTries := 2
	success := false
	for range maxTries {
		if err := r.httpSrv.StartWithHandlers(r.registerEndpointsLocked); err != nil {
			if errors.Is(err, kbhttp.ErrPinnedPortInUse) {
				// If we hit this, just try again and get a different port.
				// The advantage is that backing in and out of the thread will restore attachments,
				// whereas if we do nothing you need to bkg/foreground.
				r.debug(ctx, "startHTTPSrv: pinned port taken error, re-initializing and trying again")
				r.httpSrv = r.newHTTPSrv()
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
		return info, false
	}
	addr, err := r.httpSrv.Addr()
	if err != nil {
		r.debug(ctx, "startHTTPSrv: failed to get address after start?: %s", err)
	}
	r.debug(ctx, "startHTTPSrv: addr: %s token: %s", addr, TokenPrefix(r.token))
	return keybase1.HttpSrvInfo{
		Address: addr,
		Token:   r.token,
	}, true
}

func (r *Srv) stopHTTPSrv() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.httpSrv.Stop()
}

func (r *Srv) stop() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.shutdown {
		return
	}
	r.shutdown = true
	close(r.shutdownCh)
	r.httpSrv.Stop()
}

// reconcile tears the server down only in BACKGROUND, and only where
// stopInBackground. INACTIVE (Control Center, system alerts, the app
// switcher) keeps it up, and every other state restarts it if it isn't
// serving.
func (r *Srv) reconcile(state keybase1.MobileAppState) {
	if !r.wantUp(state) {
		r.stopHTTPSrv()
		return
	}
	r.startHTTPSrv()
}

func (r *Srv) monitorAppState(state keybase1.MobileAppState) {
	defer close(r.monitorDone)
	r.debug(context.Background(), "monitorAppState: starting up in %v", state)
	for {
		next := r.G().MobileAppState.NextUpdate(state)
		r.mu.Lock()
		r.monitorState, r.monitorWait = state, next
		r.mu.Unlock()
		select {
		case <-next:
		case <-r.shutdownCh:
			return
		}
		state = r.G().MobileAppState.State()
		r.mu.Lock()
		r.stateChanges++
		r.mu.Unlock()
		r.reconcile(state)
	}
}

func (r *Srv) HandleFunc(endpoint string, tokenMode SrvTokenMode,
	serve func(w http.ResponseWriter, req *http.Request),
) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.endpoints[endpoint] = srvEndpoint{
		tokenMode: tokenMode,
		serve:     serve,
	}
	// A stopped server has no mux; startHTTPSrv registers every endpoint.
	if r.httpSrv.Active() {
		r.httpSrv.HandleFunc("/"+endpoint, r.checkToken(tokenMode, serve))
	}
}

func (r *Srv) registerEndpointsLocked(mux *http.ServeMux) {
	for endpoint, desc := range r.endpoints {
		mux.HandleFunc("/"+endpoint, r.checkToken(desc.tokenMode, desc.serve))
	}
}

func (r *Srv) checkToken(tokenMode SrvTokenMode,
	serve func(w http.ResponseWriter, req *http.Request),
) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		switch tokenMode {
		case SrvTokenModeDefault:
			if !hmac.Equal([]byte(req.URL.Query().Get("token")), []byte(r.token)) {
				r.debug(context.Background(), "HandleFunc: token failed: %s != %s",
					TokenPrefix(req.URL.Query().Get("token")), TokenPrefix(r.token))
				w.WriteHeader(http.StatusForbidden)
				return
			}
		case SrvTokenModeUnchecked:
			// serve needs to authenticate on its own
		}
		serve(w, req)
	}
}

func (r *Srv) Active() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.httpSrv.Active()
}

func (r *Srv) Addr() (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.httpSrv.Addr()
}

func (r *Srv) Token() string {
	return r.token
}

// Info returns the address and token together, for handing both to a client.
func (r *Srv) Info() (keybase1.HttpSrvInfo, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	addr, err := r.httpSrv.Addr()
	if err != nil {
		return keybase1.HttpSrvInfo{}, err
	}
	return keybase1.HttpSrvInfo{Address: addr, Token: r.token}, nil
}
