package manager

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/kbhttp"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle/lifecycletest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// listeners hands out pinned random-port listener sources, as NewSrv does,
// and remembers the last listener so a test can kill it underneath the
// server.
type listeners struct {
	sync.Mutex
	calls int
	last  net.Listener
	// failing makes new listeners fail on their first Accept, so Serve
	// returns right away.
	failing atomic.Bool
	// armed makes the next GetListener close blocked and wait on block,
	// which release closes.
	armed   bool
	block   chan struct{}
	blocked chan struct{}
}

type failingListener struct {
	net.Listener
}

func (failingListener) Accept() (net.Conn, error) {
	return nil, errors.New("listener failed")
}

type trackedSource struct {
	l   *listeners
	src kbhttp.ListenerSource
}

func (s trackedSource) GetListener() (net.Listener, string, error) {
	s.l.Lock()
	armed := s.l.armed
	s.l.armed = false
	block, blocked := s.l.block, s.l.blocked
	s.l.Unlock()
	if armed {
		close(blocked)
		<-block
	}
	listener, address, err := s.src.GetListener()
	s.l.Lock()
	defer s.l.Unlock()
	s.l.calls++
	if err == nil {
		s.l.last = listener
		if s.l.failing.Load() {
			listener = failingListener{listener}
		}
	}
	return listener, address, err
}

func (l *listeners) source() kbhttp.ListenerSource {
	return trackedSource{l: l, src: kbhttp.NewRandomPortRangeListenerSource(20000, 60000)}
}

func (l *listeners) Calls() int {
	l.Lock()
	defer l.Unlock()
	return l.calls
}

// blockNext makes the next GetListener wait for release.
func (l *listeners) blockNext() {
	l.Lock()
	defer l.Unlock()
	l.armed = true
	l.block = make(chan struct{})
	l.blocked = make(chan struct{})
}

// waitBlocked waits until a GetListener is held by blockNext.
func (l *listeners) waitBlocked(t *testing.T) {
	t.Helper()
	l.Lock()
	blocked := l.blocked
	l.Unlock()
	select {
	case <-blocked:
	case <-time.After(10 * time.Second):
		require.Fail(t, "no GetListener reached the block")
	}
}

func (l *listeners) release() {
	l.Lock()
	defer l.Unlock()
	close(l.block)
}

func (l *listeners) kill(t *testing.T) {
	l.Lock()
	defer l.Unlock()
	require.NoError(t, l.last.Close())
}

var client = &http.Client{
	Timeout:   5 * time.Second,
	Transport: &http.Transport{DisableKeepAlives: true},
}

// appState records each turn of run, which asks for the next update once
// per turn, after publishing.
type appState struct {
	*libkb.MobileAppState
	mu    sync.Mutex
	turns int
	wait  <-chan struct{}
}

func (a *appState) NextUpdate(last keybase1.MobileAppState) <-chan struct{} {
	wait := a.MobileAppState.NextUpdate(last)
	a.mu.Lock()
	defer a.mu.Unlock()
	a.turns++
	a.wait = wait
	return wait
}

func app(srv *Srv) *appState { return srv.appState.(*appState) }

func setup(t *testing.T, state keybase1.MobileAppState, stopInBackground bool) (*Srv, *listeners) {
	return setupWithNotify(t, state, stopInBackground, func(context.Context, keybase1.HttpSrvInfo) {})
}

func setupWithNotify(t *testing.T, state keybase1.MobileAppState, stopInBackground bool,
	notify func(context.Context, keybase1.HttpSrvInfo),
) (*Srv, *listeners) {
	tc := libkb.SetupTest(t, "kbhttp", 2)
	t.Cleanup(tc.Cleanup)
	tc.G.MobileAppState.Update(state)
	l := &listeners{}
	srv, err := New("Srv", tc.G.Log, &appState{MobileAppState: tc.G.MobileAppState}, l.source, stopInBackground, notify)
	require.NoError(t, err)
	t.Cleanup(srv.Shutdown)
	// New returns having acted on the launch state; HandleFunc below would wait for run anyway.
	require.Equal(t, srv.wantUp(state), srv.Active(), "launch state not applied when New returned")
	srv.HandleFunc("test", SrvTokenModeDefault, func(w http.ResponseWriter, req *http.Request) {
		fmt.Fprint(w, "ok")
	})
	return srv, l
}

func fetch(info keybase1.HttpSrvInfo) (int, error) {
	return fetchPath(info, "test")
}

// fetchPath returns the HTTP status, or 0 with an error when no response came
// back.
func fetchPath(info keybase1.HttpSrvInfo, endpoint string) (int, error) {
	resp, err := client.Get(fmt.Sprintf("http://%s/%s?token=%s", info.Address, endpoint, info.Token))
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}
	if resp.StatusCode != http.StatusOK || string(body) != "ok" {
		return resp.StatusCode, fmt.Errorf("status %d body %q", resp.StatusCode, body)
	}
	return resp.StatusCode, nil
}

// waitLoop waits until run has published for the current app state and
// waits for its next change. Handler requests are synchronous, and exits are
// awaited with waitTurns, so no event a caller made is still pending.
func waitLoop(t *testing.T, srv *Srv) {
	t.Helper()
	require.Eventually(t, func() bool {
		a := app(srv)
		a.mu.Lock()
		wait := a.wait
		a.mu.Unlock()
		if wait == nil {
			return false
		}
		select {
		case <-wait:
			return false
		default:
			return true
		}
	}, 10*time.Second, time.Millisecond, "run did not catch up")
}

func turns(srv *Srv) int {
	a := app(srv)
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.turns
}

// waitTurns waits until run has handled events up to turn n, and no more.
func waitTurns(t *testing.T, srv *Srv, n int) {
	t.Helper()
	require.Eventually(t, func() bool { return turns(srv) >= n }, 10*time.Second, time.Millisecond,
		"run did not reach turn %d", n)
	require.Equal(t, n, turns(srv))
}

// killUntilDown kills the listener until an unexpected exit is not
// restarted, because this app state change already had its restart.
func killUntilDown(t *testing.T, srv *Srv, l *listeners) {
	t.Helper()
	for range 2 {
		n := turns(srv)
		l.kill(t)
		waitTurns(t, srv, n+1)
		if !srv.Active() {
			return
		}
	}
	t.Fatal("server kept restarting after unexpected exits")
}

func requireServing(t *testing.T, srv *Srv) keybase1.HttpSrvInfo {
	t.Helper()
	require.True(t, srv.Active(), "server not active")
	info, err := srv.Info()
	require.NoError(t, err)
	_, err = fetch(info)
	require.NoError(t, err)
	return info
}

func requireStopped(t *testing.T, srv *Srv) {
	t.Helper()
	require.False(t, srv.Active(), "server still active")
	_, err := srv.Info()
	require.Error(t, err)
}

func TestDeadListenerRestartsOnTransition(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitLoop(t, srv)
	requireServing(t, srv)
	for _, next := range []keybase1.MobileAppState{
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	} {
		killUntilDown(t, srv, l)
		app(srv).Update(next)
		waitLoop(t, srv)
		requireServing(t, srv)
	}
}

func TestDeadListenerRestartsWithoutTransition(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitLoop(t, srv)
	first := requireServing(t, srv)
	n := turns(srv)
	l.kill(t)
	waitTurns(t, srv, n+1)
	again := requireServing(t, srv)
	require.Equal(t, first.Token, again.Token)
	require.Equal(t, 2, l.Calls())
}

func TestUnexpectedExitRestartsOncePerStateChange(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitLoop(t, srv)
	requireServing(t, srv)

	n := turns(srv)
	l.failing.Store(true)
	l.kill(t)
	// The restart's listener fails at once; its exit must not restart again.
	// run handles each exit before the next start, so once both exits are
	// handled the listener count is final.
	waitTurns(t, srv, n+2)
	require.Equal(t, 2, l.Calls(), "restart loop on a failing listener")
	requireStopped(t, srv)

	// A new app state change allows one more restart after run's own start:
	// turns for the change, the start's exit and the restart's exit.
	n = turns(srv)
	app(srv).Update(keybase1.MobileAppState_INACTIVE)
	waitTurns(t, srv, n+3)
	require.Equal(t, 4, l.Calls(), "restart loop on a failing listener")

	l.failing.Store(false)
	app(srv).Update(keybase1.MobileAppState_FOREGROUND)
	waitLoop(t, srv)
	requireServing(t, srv)
}

// A BACKGROUND that lands while an exit-restart is starting must leave the server stopped.
func TestUnexpectedExitRacingBackground(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitLoop(t, srv)
	requireServing(t, srv)
	l.blockNext()
	l.kill(t)
	l.waitBlocked(t) // run is inside start, waiting for a listener
	app(srv).Update(keybase1.MobileAppState_BACKGROUND)
	l.release()
	waitLoop(t, srv)
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, app(srv).State())
	requireStopped(t, srv)
}

func TestNothingStartsAfterShutdown(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitLoop(t, srv)
	requireServing(t, srv)
	srv.Shutdown()
	requireStopped(t, srv)
	calls := l.Calls()
	app(srv).Update(keybase1.MobileAppState_BACKGROUND)
	app(srv).Update(keybase1.MobileAppState_FOREGROUND)
	select { // an exit signal nobody handles
	case srv.exited <- struct{}{}:
	default:
	}
	registered := make(chan struct{})
	go func() {
		srv.HandleFunc("late", SrvTokenModeDefault, func(http.ResponseWriter, *http.Request) {})
		close(registered)
	}()
	select {
	case <-registered:
	case <-time.After(10 * time.Second):
		require.Fail(t, "HandleFunc hung after Shutdown")
	}
	require.Never(t, func() bool { return srv.Active() || l.Calls() != calls }, 200*time.Millisecond, 10*time.Millisecond)
}

// notify must see the address it announces, so a client reading Info right away gets it.
func TestInfoUpdateAnnouncesAPublishedAddress(t *testing.T) {
	var srv *Srv
	seen := make(chan error, 10)
	srv, _ = setupWithNotify(t, keybase1.MobileAppState_BACKGROUND, true, func(_ context.Context, info keybase1.HttpSrvInfo) {
		got, err := srv.Info()
		if err == nil && got != info {
			err = fmt.Errorf("Info %v while announcing %v", got, info)
		}
		seen <- err
	})
	app(srv).Update(keybase1.MobileAppState_FOREGROUND)
	select {
	case err := <-seen:
		require.NoError(t, err)
	case <-time.After(10 * time.Second):
		require.Fail(t, "no HTTPSrvInfoUpdate")
	}
}

func TestHandlerAddedWhileServingAnswers(t *testing.T) {
	srv, _ := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitLoop(t, srv)
	srv.HandleFunc("late", SrvTokenModeDefault, func(w http.ResponseWriter, _ *http.Request) { fmt.Fprint(w, "ok") })
	info, err := srv.Info()
	require.NoError(t, err)
	resp, err := client.Get(fmt.Sprintf("http://%s/late?token=%s", info.Address, info.Token))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestInactiveKeepsServingBackgroundStops(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitLoop(t, srv)
	first := requireServing(t, srv)
	require.Equal(t, 1, l.Calls())

	app(srv).Update(keybase1.MobileAppState_INACTIVE)
	waitLoop(t, srv)
	require.Equal(t, first, requireServing(t, srv))
	require.Equal(t, 1, l.Calls(), "INACTIVE restarted the server")

	app(srv).Update(keybase1.MobileAppState_BACKGROUND)
	waitLoop(t, srv)
	requireStopped(t, srv)
	_, err := fetch(first)
	require.Error(t, err)

	app(srv).Update(keybase1.MobileAppState_FOREGROUND)
	waitLoop(t, srv)
	again := requireServing(t, srv)
	// Usually 2; another process may take the pinned port while stopped.
	require.GreaterOrEqual(t, l.Calls(), 2)
	require.Equal(t, first.Token, again.Token, "token changed across a restart")
	require.Equal(t, first.Token, srv.Token())
	_, err = fetch(keybase1.HttpSrvInfo{Address: again.Address, Token: first.Token})
	require.NoError(t, err)
}

func TestBackgroundLaunchStartsOnlyWhenLeavingBackground(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_BACKGROUND, true)
	require.Equal(t, 0, l.Calls(), "server started during a background launch")
	requireStopped(t, srv)
	waitLoop(t, srv)
	require.Equal(t, 0, l.Calls())

	app(srv).Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
	waitLoop(t, srv)
	requireServing(t, srv)
}

var allStates = []keybase1.MobileAppState{
	keybase1.MobileAppState_FOREGROUND,
	keybase1.MobileAppState_INACTIVE,
	keybase1.MobileAppState_BACKGROUNDACTIVE,
	keybase1.MobileAppState_BACKGROUND,
}

func TestUpUnlessBackground(t *testing.T) {
	for _, initial := range allStates {
		t.Run(initial.String(), func(t *testing.T) {
			srv, _ := setup(t, initial, true)
			for range 2 {
				for _, next := range allStates {
					app(srv).Update(next)
					waitLoop(t, srv)
					if next == keybase1.MobileAppState_BACKGROUND {
						requireStopped(t, srv)
					} else {
						requireServing(t, srv)
					}
				}
			}
		})
	}
}

// An INACTIVE or BACKGROUNDACTIVE blip neither restarts the server nor breaks
// a request in flight.
func TestBlipKeepsRequestInFlight(t *testing.T) {
	for _, blip := range []keybase1.MobileAppState{
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	} {
		t.Run(blip.String(), func(t *testing.T) {
			srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
			entered, hold := make(chan struct{}), make(chan struct{})
			srv.HandleFunc("hold", SrvTokenModeDefault, func(w http.ResponseWriter, _ *http.Request) {
				close(entered)
				<-hold
				fmt.Fprint(w, "ok")
			})
			waitLoop(t, srv)
			info := requireServing(t, srv)
			res := make(chan error, 1)
			go func() {
				_, err := fetchPath(info, "hold")
				res <- err
			}()
			select {
			case <-entered:
			case <-time.After(10 * time.Second):
				require.Fail(t, "request did not arrive")
			}
			for _, state := range []keybase1.MobileAppState{blip, keybase1.MobileAppState_FOREGROUND} {
				app(srv).Update(state)
				waitLoop(t, srv)
			}
			close(hold)
			require.NoError(t, <-res, "in-flight request broke across %v", blip)
			require.Equal(t, info, requireServing(t, srv))
			require.Equal(t, 1, l.Calls(), "server restarted across %v", blip)
		})
	}
}

// Without stopping in the background (Android), the server serves in every
// state, and a dead one comes back on any transition or once after it exits.
func TestNotStoppingInBackgroundStaysUp(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_BACKGROUND, false)
	waitLoop(t, srv)
	requireServing(t, srv)
	for _, next := range []keybase1.MobileAppState{
		keybase1.MobileAppState_BACKGROUNDACTIVE,
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUND,
	} {
		app(srv).Update(next)
		waitLoop(t, srv)
		requireServing(t, srv)
	}

	n := turns(srv)
	l.kill(t)
	waitTurns(t, srv, n+1)
	requireServing(t, srv)

	for _, next := range []keybase1.MobileAppState{
		keybase1.MobileAppState_BACKGROUNDACTIVE,
		keybase1.MobileAppState_BACKGROUND,
	} {
		killUntilDown(t, srv, l)
		app(srv).Update(next)
		waitLoop(t, srv)
		requireServing(t, srv)
	}
}

type failingSource struct{}

func (failingSource) GetListener() (net.Listener, string, error) {
	return nil, "", errors.New("no listener")
}

// New reports a failed first start, which kbfs treats as fatal.
func TestNewReturnsFirstStartError(t *testing.T) {
	tc := libkb.SetupTest(t, "kbhttp", 2)
	defer tc.Cleanup()
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	srv, err := New("Srv", tc.G.Log, tc.G.MobileAppState, func() kbhttp.ListenerSource { return failingSource{} }, true,
		func(context.Context, keybase1.HttpSrvInfo) {})
	require.Error(t, err)
	requireStopped(t, srv)
	srv.Shutdown()
}

func TestScenarioReplay(t *testing.T) {
	for _, sc := range lifecycletest.Scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			stopInBackground := sc.Platform == lifecycletest.IOS
			srv, l := setup(t, sc.Platform.InitialState(), stopInBackground)
			lifecycletest.Play(t, app(srv).MobileAppState, sc, func(h *lifecycletest.Harness, i int, step lifecycletest.Step) {
				waitLoop(t, srv)
				if !srv.wantUp(step.Want) {
					if srv.Active() {
						t.Fatalf("step %d %v: server up in BACKGROUND", i, step.Do)
					}
					return
				}
				if !srv.Active() {
					t.Fatalf("step %d %v: server down in %v", i, step.Do, step.Want)
				}
				info, err := srv.Info()
				require.NoError(t, err)
				if _, err := fetch(info); err != nil {
					t.Fatalf("step %d %v: %v", i, step.Do, err)
				}
				// Leave the server dead before a step that moves to another
				// up state, which must bring it back.
				if i+1 < len(sc.Steps) {
					next := sc.Steps[i+1].Want
					if next != step.Want && srv.wantUp(next) {
						killUntilDown(t, srv, l)
					}
				}
			})
		})
	}
}

func TestPinnedPortTakenPicksNewAddress(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitLoop(t, srv)
	first := requireServing(t, srv)

	// Readers race run replacing the server, for the race detector.
	stop := make(chan struct{})
	var readers sync.WaitGroup
	for _, read := range []func(){
		func() { _ = srv.Active() },
		func() { _, _ = srv.Addr() },
		func() { _, _ = srv.Info() },
	} {
		readers.Add(1)
		go func() {
			defer readers.Done()
			for {
				select {
				case <-stop:
					return
				default:
				}
				read()
				runtime.Gosched()
			}
		}()
	}

	app(srv).Update(keybase1.MobileAppState_BACKGROUND)
	waitLoop(t, srv)
	requireStopped(t, srv)
	squatter, err := net.Listen("tcp", first.Address)
	require.NoError(t, err)
	defer squatter.Close()

	app(srv).Update(keybase1.MobileAppState_FOREGROUND)
	waitLoop(t, srv)
	close(stop)
	readers.Wait()

	again := requireServing(t, srv)
	require.NotEqual(t, first.Address, again.Address)
	require.Equal(t, first.Token, again.Token)
	require.Equal(t, 3, l.Calls())
}

// requestWorker fetches until stop closes. A request racing a restart may
// fail to connect, but any response it gets must be a good one.
func requestWorker(srv *Srv, stale keybase1.HttpSrvInfo, stop chan struct{}, ok *atomic.Int64, bad chan error) {
	for i := 0; ; i++ {
		select {
		case <-stop:
			return
		default:
		}
		info := stale
		if i%2 == 0 {
			var err error
			if info, err = srv.Info(); err != nil {
				runtime.Gosched()
				continue
			}
		}
		status, err := fetch(info)
		switch {
		case err == nil:
			ok.Add(1)
		case status != 0:
			select {
			case bad <- err:
			default:
			}
		}
	}
}

func TestConcurrentRequestsDuringRestart(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitLoop(t, srv)
	first := requireServing(t, srv)

	stop := make(chan struct{})
	bad := make(chan error, 1)
	var ok atomic.Int64
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			requestWorker(srv, first, stop, &ok, bad)
		}()
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := range 100 {
			srv.HandleFunc(fmt.Sprintf("extra%d", i), SrvTokenModeUnchecked, func(http.ResponseWriter, *http.Request) {})
		}
	}()

	for range 50 {
		app(srv).Update(keybase1.MobileAppState_BACKGROUND)
		waitLoop(t, srv)
		app(srv).Update(keybase1.MobileAppState_FOREGROUND)
		waitLoop(t, srv)
		time.Sleep(time.Millisecond)
	}
	close(stop)
	wg.Wait()

	select {
	case err := <-bad:
		t.Fatalf("bad response during restarts: %v", err)
	default:
	}
	require.Positive(t, ok.Load())
	require.GreaterOrEqual(t, l.Calls(), 51)
	require.Equal(t, first.Token, requireServing(t, srv).Token)
}

// Transitions, listener deaths, handler registrations and requests racing
// each other leave a working server and no goroutines after Shutdown.
func TestStressTransitionsAndRequests(t *testing.T) {
	tc := libkb.SetupTest(t, "kbhttp", 1)
	defer tc.Cleanup()
	baseline := runtime.NumGoroutine()

	l := &listeners{}
	srv, err := New("Srv", tc.G.Log, &appState{MobileAppState: tc.G.MobileAppState}, l.source, true,
		func(context.Context, keybase1.HttpSrvInfo) {})
	require.NoError(t, err)
	srv.HandleFunc("test", SrvTokenModeDefault, func(w http.ResponseWriter, req *http.Request) {
		fmt.Fprint(w, "ok")
	})
	waitLoop(t, srv)
	first := requireServing(t, srv)
	token := first.Token
	states := []keybase1.MobileAppState{
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	}

	stop := make(chan struct{})
	bad := make(chan error, 1)
	var ok atomic.Int64
	var workers, writers sync.WaitGroup
	for range 4 {
		workers.Add(1)
		go func() {
			defer workers.Done()
			requestWorker(srv, first, stop, &ok, bad)
		}()
	}
	workers.Add(1)
	go func() {
		defer workers.Done()
		for i := 0; ; i++ {
			select {
			case <-stop:
				return
			default:
			}
			if i < 200 {
				srv.HandleFunc(fmt.Sprintf("extra%d", i), SrvTokenModeUnchecked, func(http.ResponseWriter, *http.Request) {})
			}
			_ = srv.Active()
			_, _ = srv.Addr()
			if info, err := srv.Info(); err == nil && info.Token != token {
				select {
				case bad <- fmt.Errorf("token changed to %s", info.Token):
				default:
				}
			}
			runtime.Gosched()
		}
	}()
	workers.Add(1)
	go func() {
		defer workers.Done()
		for {
			select {
			case <-stop:
				return
			case <-time.After(5 * time.Millisecond):
			}
			l.Lock()
			if l.last != nil {
				_ = l.last.Close()
			}
			l.Unlock()
		}
	}()
	for w := range 4 {
		writers.Add(1)
		go func() {
			defer writers.Done()
			rng := rand.New(rand.NewSource(int64(w)))
			for range 300 {
				app(srv).Update(states[rng.Intn(len(states))])
				if rng.Intn(4) == 0 {
					time.Sleep(time.Duration(rng.Intn(200)) * time.Microsecond)
				}
			}
		}()
	}

	done := make(chan struct{})
	go func() {
		writers.Wait()
		close(stop)
		workers.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(60 * time.Second):
		t.Fatal("deadlock: transitions and requests did not finish")
	}
	select {
	case err := <-bad:
		t.Fatalf("bad response during transitions: %v", err)
	default:
	}

	// BACKGROUND stops every server, so no exit from a killed listener can
	// restart one later; leaving it is a real change run must wake for.
	for _, state := range []keybase1.MobileAppState{
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_FOREGROUND,
	} {
		app(srv).Update(state)
		waitLoop(t, srv)
	}
	require.Equal(t, token, requireServing(t, srv).Token)
	app(srv).Update(keybase1.MobileAppState_BACKGROUND)
	waitLoop(t, srv)
	requireStopped(t, srv)
	t.Logf("%d good responses, %d listeners", ok.Load(), l.Calls())

	srv.Shutdown()

	deadline := time.Now().Add(10 * time.Second)
	for runtime.NumGoroutine() > baseline+5 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	require.LessOrEqual(t, runtime.NumGoroutine(), baseline+5, "leaked goroutines")
}
