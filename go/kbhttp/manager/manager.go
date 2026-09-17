package manager

import (
	"context"
	"crypto/hmac"
	"errors"
	"fmt"
	"net/http"
	"runtime"
	"sync"
	"sync/atomic"

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

// srvStatus is what run last published; readers never wait on run.
type srvStatus struct {
	active bool
	info   keybase1.HttpSrvInfo
	// state is the app state run last acted on and wait the change channel it
	// waits on for it; exits counts unexpected exits it handled. Tests use them.
	state keybase1.MobileAppState
	wait  <-chan struct{}
	exits int
}

type handlerRequest struct {
	endpoint string
	desc     srvEndpoint
	done     chan struct{}
}

// Srv runs the local HTTP server. One goroutine, run, owns it: only run starts
// and stops it, reacting to app state changes, unexpected exits, handler
// registrations and shutdown.
type Srv struct {
	libkb.Contextified

	// token is set once and kept across restarts, so URLs handed out before a restart keep working.
	token            string
	listenerSource   func() kbhttp.ListenerSource
	stopInBackground bool // false on Android, where the server stays up in every state
	// notify runs on run, so it must not call HandleFunc.
	notify func(context.Context, keybase1.HttpSrvInfo)

	status       atomic.Pointer[srvStatus]
	exited       chan struct{}
	handlers     chan handlerRequest
	shutdownOnce sync.Once
	shutdownCh   chan struct{}
	done         chan struct{}

	// Owned by run.
	httpSrv   *kbhttp.Srv
	endpoints map[string]srvEndpoint
	state     keybase1.MobileAppState
	wait      <-chan struct{}
	exits     int
	// restartedSinceChange caps restarts after unexpected exits at one per app
	// state change, so a listener that keeps dying doesn't spin.
	restartedSinceChange bool
}

func NewSrv(g *libkb.GlobalContext) *Srv {
	listenerSource := func() kbhttp.ListenerSource {
		return kbhttp.NewRandomPortRangeListenerSource(g.GetEnv().GetAttachmentHTTPStartPort(), 18000)
	}
	return newSrv(g, listenerSource, runtime.GOOS != "android", func(ctx context.Context, info keybase1.HttpSrvInfo) {
		// Read NotifyRouter when notifying: the service sets it after creating this server.
		g.NotifyRouter.HandleHTTPSrvInfoUpdate(ctx, info)
	})
}

func newSrv(g *libkb.GlobalContext, listenerSource func() kbhttp.ListenerSource, stopInBackground bool,
	notify func(context.Context, keybase1.HttpSrvInfo),
) *Srv {
	token, _ := libkb.RandHexString("", 32)
	r := &Srv{
		Contextified:     libkb.NewContextified(g),
		token:            token,
		listenerSource:   listenerSource,
		stopInBackground: stopInBackground,
		notify:           notify,
		exited:           make(chan struct{}, 1),
		handlers:         make(chan handlerRequest),
		shutdownCh:       make(chan struct{}),
		done:             make(chan struct{}),
		endpoints:        make(map[string]srvEndpoint),
	}
	r.httpSrv = r.newHTTPSrv()
	g.PushShutdownHook(func(libkb.MetaContext) error {
		r.stop()
		return nil
	})
	ready := make(chan struct{})
	go r.run(g.MobileAppState.State(), ready)
	<-ready
	return r
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
	srv.OnUnexpectedExit(func() {
		select {
		case r.exited <- struct{}{}:
		default:
		}
	})
	return srv
}

func (r *Srv) wantUp(state keybase1.MobileAppState) bool {
	return !r.stopInBackground || state != keybase1.MobileAppState_BACKGROUND
}

func (r *Srv) run(state keybase1.MobileAppState, ready chan struct{}) {
	defer close(r.done)
	ctx := context.Background()
	r.state = state
	r.debug(ctx, "run: starting up in %v", state)
	r.reconcile(ctx)
	for {
		r.wait = r.G().MobileAppState.NextUpdate(r.state)
		r.publish()
		if ready != nil {
			close(ready)
			ready = nil
		}
		select {
		case <-r.wait:
			r.state = r.G().MobileAppState.State()
			r.restartedSinceChange = false
			r.reconcile(ctx)
		case <-r.exited:
			r.serverExited(ctx)
		case req := <-r.handlers:
			r.endpoints[req.endpoint] = req.desc
			// A stopped server has no mux; start registers every endpoint.
			if r.httpSrv.Active() {
				r.httpSrv.HandleFunc("/"+req.endpoint, r.checkToken(req.desc.tokenMode, req.desc.serve))
			}
			close(req.done)
		case <-r.shutdownCh:
			<-r.httpSrv.Stop()
			r.status.Store(&srvStatus{})
			return
		}
	}
}

// reconcile tears the server down only in BACKGROUND, and only where
// stopInBackground. INACTIVE (Control Center, system alerts, the app
// switcher) keeps it up, and every other state starts it if it isn't serving.
func (r *Srv) reconcile(ctx context.Context) {
	if !r.wantUp(r.state) {
		r.httpSrv.Stop()
		return
	}
	r.start(ctx)
}

// serverExited restarts a server whose listener died without a Stop, for
// example one the OS reclaimed while the app was suspended without reaching BACKGROUND.
func (r *Srv) serverExited(ctx context.Context) {
	if r.httpSrv.Active() {
		return
	}
	r.exits++
	if !r.wantUp(r.state) || r.restartedSinceChange {
		r.debug(ctx, "serverExited: not restarting in %v", r.state)
		return
	}
	r.restartedSinceChange = true
	r.debug(ctx, "serverExited: restarting in %v", r.state)
	r.start(ctx)
}

func (r *Srv) start(ctx context.Context) {
	if r.httpSrv.Active() {
		return
	}
	err := r.httpSrv.StartWithHandlers(r.registerEndpoints)
	if errors.Is(err, kbhttp.ErrPinnedPortInUse) {
		// Try again on a different port. Backing in and out of a thread then restores
		// attachments; doing nothing would need a background/foreground.
		r.debug(ctx, "start: pinned port taken, trying a new one")
		r.httpSrv = r.newHTTPSrv()
		err = r.httpSrv.StartWithHandlers(r.registerEndpoints)
	}
	if err != nil {
		r.debug(ctx, "start: failed to start HTTP server: %s", err)
		return
	}
	// Publish before notifying, so a listener reading Info gets the address it is told about.
	r.publish()
	info, err := r.Info()
	if err != nil { // Serve already exited; run handles that exit next
		return
	}
	r.debug(ctx, "start: addr: %s token: %s", info.Address, TokenPrefix(r.token))
	r.notify(ctx, info)
}

func (r *Srv) publish() {
	st := &srvStatus{state: r.state, wait: r.wait, exits: r.exits}
	if addr, err := r.httpSrv.Addr(); err == nil {
		st.active = true
		st.info = keybase1.HttpSrvInfo{Address: addr, Token: r.token}
	}
	r.status.Store(st)
}

func (r *Srv) registerEndpoints(mux *http.ServeMux) {
	for endpoint, desc := range r.endpoints {
		mux.HandleFunc("/"+endpoint, r.checkToken(desc.tokenMode, desc.serve))
	}
}

func (r *Srv) stop() {
	r.shutdownOnce.Do(func() { close(r.shutdownCh) })
	<-r.done
}

func (r *Srv) HandleFunc(endpoint string, tokenMode SrvTokenMode,
	serve func(w http.ResponseWriter, req *http.Request),
) {
	req := handlerRequest{endpoint: endpoint, desc: srvEndpoint{tokenMode: tokenMode, serve: serve}, done: make(chan struct{})}
	select {
	case r.handlers <- req:
		<-req.done
	case <-r.done:
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

func (r *Srv) Active() bool { return r.status.Load().active }

func (r *Srv) Addr() (string, error) {
	info, err := r.Info()
	return info.Address, err
}

func (r *Srv) Token() string { return r.token }

// Info returns the address and token together, for handing both to a client.
func (r *Srv) Info() (keybase1.HttpSrvInfo, error) {
	st := r.status.Load()
	if !st.active {
		return keybase1.HttpSrvInfo{}, errors.New("server not running")
	}
	return st.info, nil
}
