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
	"github.com/keybase/client/go/logger"
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

type handlerRequest struct {
	endpoint string
	desc     srvEndpoint
	done     chan struct{}
}

// Srv runs a local HTTP server. One goroutine, run, owns it: only run starts
// and stops it, reacting to app state changes, unexpected exits, handler
// registrations and shutdown.
type Srv struct {
	name string // prefixes every log line, so each server's lines are told apart
	log  logger.Logger
	// appState reads the current app state and nextAppState waits for the next
	// change, as libkb.MobileAppState and kbfs's env.AppStateUpdater spell them.
	appState     func() keybase1.MobileAppState
	nextAppState func(lastState keybase1.MobileAppState) <-chan struct{}
	// token is set once and kept across restarts, so URLs handed out before a restart keep working.
	token            string
	listenerSource   func() kbhttp.ListenerSource
	stopInBackground bool // false on Android, where the server stays up in every state
	// notify runs on run, so it must not call HandleFunc.
	notify func(context.Context, keybase1.HttpSrvInfo)

	// status is what run last published, empty while not serving; readers never wait on run.
	status       atomic.Pointer[keybase1.HttpSrvInfo]
	exited       chan struct{}
	handlers     chan handlerRequest
	shutdownOnce sync.Once
	shutdownCh   chan struct{}
	done         chan struct{}

	// Owned by run.
	httpSrv   *kbhttp.Srv
	endpoints map[string]srvEndpoint
	state     keybase1.MobileAppState
	// restartedSinceChange caps restarts after unexpected exits at one per app
	// state change, so a listener that keeps dying doesn't spin.
	restartedSinceChange bool
}

// NewSrv runs the service's HTTP server until the service shuts down.
func NewSrv(g *libkb.GlobalContext) *Srv {
	listenerSource := func() kbhttp.ListenerSource {
		return kbhttp.NewRandomPortRangeListenerSource(g.GetEnv().GetAttachmentHTTPStartPort(), 18000)
	}
	// A failed start is logged, and the next app state change tries again.
	r, _ := New("Srv", g.GetLog(), g.MobileAppState.State, g.MobileAppState.NextUpdate, listenerSource,
		runtime.GOOS != "android", func(ctx context.Context, info keybase1.HttpSrvInfo) {
			// e2e tests match this line; only this server logs it.
			g.GetLog().CDebugf(ctx, "Srv: start: addr: %s token: %s", info.Address, TokenPrefix(info.Token))
			// Read NotifyRouter when notifying: the service sets it after creating this server.
			g.NotifyRouter.HandleHTTPSrvInfoUpdate(ctx, info)
		})
	g.PushShutdownHook(func(libkb.MetaContext) error {
		r.Shutdown()
		return nil
	})
	return r
}

// New returns a server that has acted on the current app state, with the error
// of that first start, if any. The server runs until Shutdown either way, and
// the next app state change tries again -- but only where the app state moves,
// which is mobile, so a caller on desktop decides for itself whether a failed
// first start is fatal.
func New(name string, log logger.Logger, appState func() keybase1.MobileAppState,
	nextAppState func(lastState keybase1.MobileAppState) <-chan struct{},
	listenerSource func() kbhttp.ListenerSource, stopInBackground bool,
	notify func(context.Context, keybase1.HttpSrvInfo),
) (*Srv, error) {
	token, _ := libkb.RandHexString("", 32)
	r := &Srv{
		name:             name,
		log:              log,
		appState:         appState,
		nextAppState:     nextAppState,
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
	// Publish an empty status before run can be observed, so readers never dereference nil.
	r.status.Store(&keybase1.HttpSrvInfo{})
	r.httpSrv = r.newHTTPSrv()
	ready := make(chan error)
	go r.run(ready)
	return r, <-ready
}

func (r *Srv) debug(ctx context.Context, msg string, args ...any) {
	r.log.CDebugf(ctx, "%s: %s", r.name, fmt.Sprintf(msg, args...))
}

// TokenPrefix shortens a token for logging.
func TokenPrefix(token string) string {
	if len(token) > 8 {
		return token[:8] + "..."
	}
	return token
}

func (r *Srv) newHTTPSrv() *kbhttp.Srv {
	srv := kbhttp.NewSrv(r.log, r.listenerSource())
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

// run owns the server. ready takes the first start's error, once run has acted
// on the app state it started in and published the result.
func (r *Srv) run(ready chan<- error) {
	defer close(r.done)
	ctx := context.Background()
	r.state = r.appState()
	r.debug(ctx, "run: starting up in %v", r.state)
	err := r.reconcile(ctx)
	r.publish()
	ready <- err
	for {
		select {
		case <-r.nextAppState(r.state):
			r.state = r.appState()
			r.restartedSinceChange = false
			_ = r.reconcile(ctx)
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
			r.status.Store(&keybase1.HttpSrvInfo{})
			return
		}
		r.publish()
	}
}

// reconcile tears the server down only in BACKGROUND, and only where
// stopInBackground. INACTIVE (Control Center, system alerts, the app
// switcher) keeps it up, and every other state starts it if it isn't serving.
func (r *Srv) reconcile(ctx context.Context) error {
	if !r.wantUp(r.state) {
		r.httpSrv.Stop()
		return nil
	}
	return r.start(ctx)
}

// serverExited restarts a server whose listener died without a Stop, for
// example one the OS reclaimed while the app was suspended without reaching BACKGROUND.
func (r *Srv) serverExited(ctx context.Context) {
	if r.httpSrv.Active() {
		return
	}
	if !r.wantUp(r.state) || r.restartedSinceChange {
		r.debug(ctx, "serverExited: not restarting in %v", r.state)
		return
	}
	r.restartedSinceChange = true
	r.debug(ctx, "serverExited: restarting in %v", r.state)
	_ = r.start(ctx)
}

func (r *Srv) start(ctx context.Context) error {
	if r.httpSrv.Active() {
		return nil
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
		r.log.CWarningf(ctx, "%s: start: failed to start HTTP server: %s", r.name, err)
		return err
	}
	// Publish before notifying, so a listener reading Info gets the address it is told about.
	info := r.publish()
	if info.Address == "" { // Serve already exited; run handles that exit next
		return nil
	}
	r.notify(ctx, info)
	return nil
}

func (r *Srv) publish() keybase1.HttpSrvInfo {
	var info keybase1.HttpSrvInfo
	if addr, err := r.httpSrv.Addr(); err == nil {
		info = keybase1.HttpSrvInfo{Address: addr, Token: r.token}
	}
	r.status.Store(&info)
	return info
}

func (r *Srv) registerEndpoints(mux *http.ServeMux) {
	for endpoint, desc := range r.endpoints {
		mux.HandleFunc("/"+endpoint, r.checkToken(desc.tokenMode, desc.serve))
	}
}

// Shutdown stops the server for good and waits for run to exit.
func (r *Srv) Shutdown() {
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

func (r *Srv) Addr() (string, error) {
	info, err := r.Info()
	return info.Address, err
}

func (r *Srv) Token() string { return r.token }

// Info returns the address and token together, for handing both to a client.
func (r *Srv) Info() (keybase1.HttpSrvInfo, error) {
	info := *r.status.Load()
	if info.Address == "" {
		return keybase1.HttpSrvInfo{}, errors.New("server not running")
	}
	return info, nil
}
