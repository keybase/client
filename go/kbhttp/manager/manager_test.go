package manager

import (
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

func (l *listeners) kill(t *testing.T) {
	l.Lock()
	defer l.Unlock()
	require.NoError(t, l.last.Close())
}

var client = &http.Client{
	Timeout:   5 * time.Second,
	Transport: &http.Transport{DisableKeepAlives: true},
}

func setup(t *testing.T, state keybase1.MobileAppState, stopInBackground bool) (*Srv, *listeners) {
	tc := libkb.SetupTest(t, "kbhttp", 2)
	t.Cleanup(tc.Cleanup)
	tc.G.MobileAppState.Update(state)
	l := &listeners{}
	srv := newSrv(tc.G, l.source, stopInBackground)
	srv.HandleFunc("test", SrvTokenModeDefault, func(w http.ResponseWriter, req *http.Request) {
		fmt.Fprint(w, "ok")
	})
	return srv, l
}

// fetch returns the HTTP status, or 0 with an error when no response came
// back.
func fetch(info keybase1.HttpSrvInfo) (int, error) {
	resp, err := client.Get(fmt.Sprintf("http://%s/test?token=%s", info.Address, info.Token))
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

// waitMonitor waits until the monitor has acted on the current state and is
// waiting for the next change.
func waitMonitor(t *testing.T, srv *Srv) {
	t.Helper()
	require.Eventually(t, func() bool {
		srv.mu.Lock()
		state, wait := srv.monitorState, srv.monitorWait
		srv.mu.Unlock()
		if wait == nil || wait != srv.G().MobileAppState.NextUpdate(state) {
			return false
		}
		select {
		case <-wait:
			return false
		default:
			return true
		}
	}, 10*time.Second, time.Millisecond, "monitor did not catch up")
}

func exits(srv *Srv) int {
	srv.mu.Lock()
	defer srv.mu.Unlock()
	return srv.exits
}

func waitExits(t *testing.T, srv *Srv, n int) {
	t.Helper()
	require.Eventually(t, func() bool { return exits(srv) >= n }, 10*time.Second, time.Millisecond,
		"unexpected exit %d was not handled", n)
	require.Equal(t, n, exits(srv))
}

// killUntilDown kills the listener until an unexpected exit is not
// restarted, because this app state change already had its restart.
func killUntilDown(t *testing.T, srv *Srv, l *listeners) {
	t.Helper()
	for range 2 {
		n := exits(srv)
		l.kill(t)
		waitExits(t, srv, n+1)
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
	waitMonitor(t, srv)
	requireServing(t, srv)
	for _, next := range []keybase1.MobileAppState{
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	} {
		killUntilDown(t, srv, l)
		srv.G().MobileAppState.Update(next)
		waitMonitor(t, srv)
		requireServing(t, srv)
	}
}

func TestDeadListenerRestartsWithoutTransition(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitMonitor(t, srv)
	first := requireServing(t, srv)
	l.kill(t)
	waitExits(t, srv, 1)
	again := requireServing(t, srv)
	require.Equal(t, first.Token, again.Token)
	require.Equal(t, 2, l.Calls())
}

func TestUnexpectedExitRestartsOncePerGeneration(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitMonitor(t, srv)
	requireServing(t, srv)

	l.failing.Store(true)
	l.kill(t)
	// The restart's listener fails at once; its exit must not restart again.
	// Each exit decides and starts under mu, so once two exits are handled
	// the listener count is final.
	waitExits(t, srv, 2)
	require.Equal(t, 2, l.Calls(), "restart loop on a failing listener")
	requireStopped(t, srv)

	// A new app state change allows one more restart after the monitor's own.
	srv.G().MobileAppState.Update(keybase1.MobileAppState_INACTIVE)
	waitMonitor(t, srv)
	waitExits(t, srv, 4)
	require.Equal(t, 4, l.Calls(), "restart loop on a failing listener")

	l.failing.Store(false)
	srv.G().MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	waitMonitor(t, srv)
	requireServing(t, srv)
}

// A BACKGROUND applied while an unexpected exit is deciding whether to
// restart must not leave the server up.
func TestUnexpectedExitRacingBackground(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitMonitor(t, srv)
	requireServing(t, srv)

	srv.mu.Lock()
	srv.beforeExitRestart = func() {
		// serverExited has read FOREGROUND. The monitor is idle, so mu is
		// held here only if serverExited holds it; otherwise let the monitor
		// fully apply BACKGROUND before serverExited acts on its stale read.
		holdsMu := !srv.mu.TryLock()
		if !holdsMu {
			srv.mu.Unlock()
		}
		srv.G().MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
		if !holdsMu {
			waitMonitor(t, srv)
		}
	}
	srv.mu.Unlock()

	l.kill(t)
	waitExits(t, srv, 1)
	waitMonitor(t, srv)
	require.Equal(t, keybase1.MobileAppState_BACKGROUND, srv.G().MobileAppState.State())
	requireStopped(t, srv)
}

func TestNothingStartsAfterShutdown(t *testing.T) {
	srv, _ := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitMonitor(t, srv)
	requireServing(t, srv)
	srv.stop()
	requireStopped(t, srv)
	srv.reconcile(keybase1.MobileAppState_FOREGROUND)
	require.False(t, srv.Active(), "reconcile restarted the server after shutdown")
	srv.serverExited()
	require.False(t, srv.Active(), "an unexpected exit restarted the server after shutdown")
}

func TestInactiveKeepsServingBackgroundStops(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, true)
	waitMonitor(t, srv)
	first := requireServing(t, srv)
	require.Equal(t, 1, l.Calls())

	srv.G().MobileAppState.Update(keybase1.MobileAppState_INACTIVE)
	waitMonitor(t, srv)
	require.Equal(t, first, requireServing(t, srv))
	require.Equal(t, 1, l.Calls(), "INACTIVE restarted the server")

	srv.G().MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	waitMonitor(t, srv)
	requireStopped(t, srv)
	_, err := fetch(first)
	require.Error(t, err)

	srv.G().MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	waitMonitor(t, srv)
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
	waitMonitor(t, srv)
	require.Equal(t, 0, l.Calls())

	srv.G().MobileAppState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
	waitMonitor(t, srv)
	requireServing(t, srv)
}

func TestNotStoppingInBackgroundStaysUp(t *testing.T) {
	srv, l := setup(t, keybase1.MobileAppState_BACKGROUND, false)
	waitMonitor(t, srv)
	requireServing(t, srv)
	for _, next := range []keybase1.MobileAppState{
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_BACKGROUND,
	} {
		srv.G().MobileAppState.Update(next)
		waitMonitor(t, srv)
		requireServing(t, srv)
	}
	killUntilDown(t, srv, l)
	srv.G().MobileAppState.Update(keybase1.MobileAppState_BACKGROUNDACTIVE)
	waitMonitor(t, srv)
	requireServing(t, srv)
}

func TestScenarioReplay(t *testing.T) {
	for _, sc := range lifecycletest.Scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			stopInBackground := sc.Platform == lifecycletest.IOS
			srv, l := setup(t, keybase1.MobileAppState_FOREGROUND, stopInBackground)
			lifecycletest.Play(t, srv.G().MobileAppState, sc, func(h *lifecycletest.Harness, i int, step lifecycletest.Step) {
				waitMonitor(t, srv)
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
	waitMonitor(t, srv)
	first := requireServing(t, srv)

	// Each reader calls one accessor only, so no other locked call between
	// its reads hides an unlocked read of the replaced server from the race
	// detector.
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

	srv.G().MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	waitMonitor(t, srv)
	requireStopped(t, srv)
	squatter, err := net.Listen("tcp", first.Address)
	require.NoError(t, err)
	defer squatter.Close()

	srv.G().MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	waitMonitor(t, srv)
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
	waitMonitor(t, srv)
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
		srv.G().MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
		waitMonitor(t, srv)
		srv.G().MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
		waitMonitor(t, srv)
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

func TestStressTransitionsAndRequests(t *testing.T) {
	tc := libkb.SetupTest(t, "kbhttp", 1)
	defer tc.Cleanup()
	baseline := runtime.NumGoroutine()

	l := &listeners{}
	srv := newSrv(tc.G, l.source, true)
	srv.HandleFunc("test", SrvTokenModeDefault, func(w http.ResponseWriter, req *http.Request) {
		fmt.Fprint(w, "ok")
	})
	waitMonitor(t, srv)
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
	for w := range 4 {
		writers.Add(1)
		go func() {
			defer writers.Done()
			rng := rand.New(rand.NewSource(int64(w)))
			for range 300 {
				tc.G.MobileAppState.Update(states[rng.Intn(len(states))])
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

	// Make a real change so the monitor must wake for it.
	final := keybase1.MobileAppState_INACTIVE
	if tc.G.MobileAppState.State() == final {
		final = keybase1.MobileAppState_FOREGROUND
	}
	tc.G.MobileAppState.Update(final)
	waitMonitor(t, srv)
	require.Equal(t, token, requireServing(t, srv).Token)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	waitMonitor(t, srv)
	requireStopped(t, srv)
	t.Logf("%d good responses, %d listeners", ok.Load(), l.Calls())

	srv.stop()
	select {
	case <-srv.monitorDone:
	case <-time.After(10 * time.Second):
		t.Fatal("monitor did not exit on shutdown")
	}

	deadline := time.Now().Add(10 * time.Second)
	for runtime.NumGoroutine() > baseline+5 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	require.LessOrEqual(t, runtime.NumGoroutine(), baseline+5, "leaked goroutines")
}
