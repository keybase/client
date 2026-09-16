// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libhttpserver

import (
	"errors"
	"fmt"
	"io"
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
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// mobileAppState adapts libkb's app state to env.AppStateUpdater, as
// env.KBFSContext does.
type mobileAppState struct {
	*libkb.MobileAppState
}

func (m mobileAppState) NextAppStateUpdate(last keybase1.MobileAppState) <-chan struct{} {
	return m.NextUpdate(last)
}

func (m mobileAppState) AppState() keybase1.MobileAppState { return m.State() }

func (m mobileAppState) NextNetworkStateUpdate(keybase1.MobileNetworkState) <-chan struct{} {
	return nil
}

func (m mobileAppState) NetworkState() keybase1.MobileNetworkState {
	return keybase1.MobileNetworkState_NONE
}

// listeners hands out pinned random-port listener sources and remembers the
// last listener, so a test can kill it underneath the server.
type listeners struct {
	sync.Mutex
	calls int
	last  net.Listener
	// failing makes new listeners fail on their first Accept, so Serve
	// returns right away.
	failing atomic.Bool
	// onListen, if set, runs with the address of each new listener before
	// the server gets it.
	onListen func(address string)
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
	s.l.calls++
	onListen := s.l.onListen
	if err == nil {
		s.l.last = listener
		if s.l.failing.Load() {
			listener = failingListener{listener}
		}
	}
	s.l.Unlock()
	if err == nil && onListen != nil {
		onListen(address)
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
	Timeout:   10 * time.Second,
	Transport: &http.Transport{DisableKeepAlives: true},
}

type testServer struct {
	*appStateServer
	l        *listeners
	appState *libkb.MobileAppState
	// hold, while set, blocks requests to /files/hold until it closes;
	// entered receives a value when such a request arrives.
	hold    chan struct{}
	entered chan struct{}
	// slowRegister delays handler registration.
	slowRegister atomic.Bool
}

func setupServer(t *testing.T, state keybase1.MobileAppState) *testServer {
	tc := libkb.SetupTest(t, "libhttpserver", 2)
	t.Cleanup(tc.Cleanup)
	tc.G.MobileAppState.Update(state)
	return startServer(t, tc.G.MobileAppState, true)
}

func startServer(t *testing.T, appState *libkb.MobileAppState, stopInBackground bool) *testServer {
	ts := &testServer{
		l:        &listeners{},
		appState: appState,
		hold:     make(chan struct{}),
		entered:  make(chan struct{}, 10),
	}
	register := func(mux *http.ServeMux) {
		if ts.slowRegister.Load() {
			time.Sleep(100 * time.Millisecond)
		}
		mux.HandleFunc(requestPathRoot, func(w http.ResponseWriter, req *http.Request) {
			if req.URL.Path == requestPathRoot+"hold" {
				ts.entered <- struct{}{}
				<-ts.hold
			}
			fmt.Fprint(w, "ok")
		})
	}
	ts.appStateServer = newAppStateServer(
		mobileAppState{appState}, logger.NewTestLogger(t), ts.l.source, register,
		stopInBackground)
	require.NoError(t, ts.start())
	t.Cleanup(ts.Shutdown)
	return ts
}

func fetchAddr(addr, path string) (int, error) {
	resp, err := client.Get(fmt.Sprintf("http://%s%s%s", addr, requestPathRoot, path))
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, err
	}
	if resp.StatusCode != http.StatusOK || string(body) != "ok" {
		return resp.StatusCode, fmt.Errorf("status %d body %q", resp.StatusCode, body)
	}
	return resp.StatusCode, nil
}

// waitMonitor waits until the monitor has acted on the current state and is
// waiting for the next change.
func (ts *testServer) waitMonitor(t *testing.T) {
	t.Helper()
	require.Eventually(t, func() bool {
		ts.mu.Lock()
		state, wait := ts.monitorState, ts.monitorWait
		ts.mu.Unlock()
		if wait == nil || wait != ts.appState.NextUpdate(state) {
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

func (ts *testServer) update(t *testing.T, state keybase1.MobileAppState) {
	t.Helper()
	ts.appState.Update(state)
	ts.waitMonitor(t)
}

func (ts *testServer) exitCount() int {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	return ts.exits
}

func (ts *testServer) waitExits(t *testing.T, n int) {
	t.Helper()
	require.Eventually(t, func() bool { return ts.exitCount() >= n }, 10*time.Second,
		time.Millisecond, "unexpected exit %d was not handled", n)
	require.Equal(t, n, ts.exitCount())
}

func (ts *testServer) active() bool {
	_, err := ts.Addr()
	return err == nil
}

// killUntilDown kills the listener until an unexpected exit is not
// restarted, because this app-state change already had its restart.
func (ts *testServer) killUntilDown(t *testing.T) {
	t.Helper()
	for range 2 {
		n := ts.exitCount()
		ts.l.kill(t)
		ts.waitExits(t, n+1)
		if !ts.active() {
			return
		}
	}
	t.Fatal("server kept restarting after unexpected exits")
}

func (ts *testServer) requireServing(t *testing.T) string {
	t.Helper()
	addr, err := ts.Addr()
	require.NoError(t, err, "server not running")
	_, err = fetchAddr(addr, "x")
	require.NoError(t, err)
	return addr
}

func (ts *testServer) requireStopped(t *testing.T) {
	t.Helper()
	_, err := ts.Addr()
	require.Error(t, err, "server still running")
}

var allStates = []keybase1.MobileAppState{
	keybase1.MobileAppState_FOREGROUND,
	keybase1.MobileAppState_INACTIVE,
	keybase1.MobileAppState_BACKGROUNDACTIVE,
	keybase1.MobileAppState_BACKGROUND,
}

func TestAppStateServerUpUnlessBackground(t *testing.T) {
	for _, initial := range allStates {
		t.Run(initial.String(), func(t *testing.T) {
			ts := setupServer(t, initial)
			ts.waitMonitor(t)
			check := func() {
				t.Helper()
				if ts.appState.State() != keybase1.MobileAppState_BACKGROUND {
					ts.requireServing(t)
				} else {
					ts.requireStopped(t)
				}
			}
			check()
			for range 2 {
				for _, next := range allStates {
					ts.update(t, next)
					check()
				}
			}
		})
	}
	ts := setupServer(t, keybase1.MobileAppState_BACKGROUND)
	require.Zero(t, ts.l.Calls(), "server started during a background launch")
}

// An INACTIVE blip (Control Center, a system alert) neither restarts the
// server nor breaks a request in flight.
func TestAppStateServerInactiveBlipKeepsRequests(t *testing.T) {
	for _, blip := range [][]keybase1.MobileAppState{
		{keybase1.MobileAppState_INACTIVE, keybase1.MobileAppState_FOREGROUND},
		{keybase1.MobileAppState_BACKGROUNDACTIVE, keybase1.MobileAppState_FOREGROUND},
	} {
		t.Run(fmt.Sprint(blip), func(t *testing.T) {
			ts := setupServer(t, keybase1.MobileAppState_FOREGROUND)
			ts.waitMonitor(t)
			addr := ts.requireServing(t)

			res := make(chan error, 1)
			go func() {
				_, err := fetchAddr(addr, "hold")
				res <- err
			}()
			select {
			case <-ts.entered:
			case <-time.After(10 * time.Second):
				t.Fatal("request did not arrive")
			}
			for _, state := range blip {
				ts.update(t, state)
			}
			close(ts.hold)
			require.NoError(t, <-res, "in-flight request broke across %v", blip)
			require.Equal(t, addr, ts.requireServing(t))
			require.Equal(t, 1, ts.l.Calls(), "server restarted across %v", blip)
		})
	}
}

func TestAppStateServerRestartsDeadServer(t *testing.T) {
	ts := setupServer(t, keybase1.MobileAppState_FOREGROUND)
	ts.waitMonitor(t)
	ts.requireServing(t)

	// Without a transition, a dead server restarts once.
	ts.l.kill(t)
	ts.waitExits(t, 1)
	ts.requireServing(t)
	require.Equal(t, 2, ts.l.Calls())

	// A listener that keeps failing does not restart in a loop.
	ts.l.failing.Store(true)
	ts.l.kill(t)
	ts.waitExits(t, 2)
	require.Equal(t, 2, ts.l.Calls(), "restart loop on a failing listener")
	ts.requireStopped(t)

	// Every up state brings a dead server back.
	ts.l.failing.Store(false)
	for _, next := range []keybase1.MobileAppState{
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_BACKGROUNDACTIVE,
	} {
		ts.update(t, next)
		ts.requireServing(t)
		ts.killUntilDown(t)
	}
	ts.update(t, keybase1.MobileAppState_FOREGROUND)
	ts.requireServing(t)
}

// A BACKGROUND applied while an unexpected exit is deciding whether to
// restart must not leave the server up.
func TestAppStateServerExitRacingBackground(t *testing.T) {
	ts := setupServer(t, keybase1.MobileAppState_FOREGROUND)
	ts.waitMonitor(t)
	ts.requireServing(t)

	ts.mu.Lock()
	ts.beforeExitRestart = func() {
		// serverExited has read FOREGROUND. The monitor is idle, so mu is
		// held here only if serverExited holds it; otherwise let the monitor
		// fully apply BACKGROUND before serverExited acts on its stale read.
		holdsMu := !ts.mu.TryLock()
		if !holdsMu {
			ts.mu.Unlock()
		}
		ts.appState.Update(keybase1.MobileAppState_BACKGROUND)
		if !holdsMu {
			ts.waitMonitor(t)
		}
	}
	ts.mu.Unlock()

	ts.l.kill(t)
	ts.waitExits(t, 1)
	ts.waitMonitor(t)
	ts.requireStopped(t)
}

// A request that reaches a restarting server is answered by its handler,
// never with a 404 from a server that has not registered it yet.
func TestAppStateServerNo404DuringRestart(t *testing.T) {
	ts := setupServer(t, keybase1.MobileAppState_FOREGROUND)
	ts.waitMonitor(t)
	ts.requireServing(t)
	ts.slowRegister.Store(true)

	restarts := map[string]func(){
		"exit": func() {
			n := ts.exitCount()
			ts.l.kill(t)
			ts.waitExits(t, n+1)
		},
		"foreground": func() {
			ts.update(t, keybase1.MobileAppState_BACKGROUND)
			ts.update(t, keybase1.MobileAppState_FOREGROUND)
		},
	}
	for name, restart := range restarts {
		// The request connects as soon as the new listener exists and is
		// served once the server accepts it.
		res := make(chan error, 1)
		ts.l.Lock()
		ts.l.onListen = func(address string) {
			go func() {
				_, err := fetchAddr(address, "x")
				res <- err
			}()
		}
		ts.l.Unlock()
		restart()
		require.NoError(t, <-res, "request during a restart by %s", name)
		ts.l.Lock()
		ts.l.onListen = nil
		ts.l.Unlock()
		ts.requireServing(t)
	}
}

// Without stopping in the background (Android), the server serves in every
// state, and a dead one comes back on any transition or once after it exits.
func TestAppStateServerNotStoppingInBackgroundStaysUp(t *testing.T) {
	tc := libkb.SetupTest(t, "libhttpserver", 2)
	defer tc.Cleanup()
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	ts := startServer(t, tc.G.MobileAppState, false)
	ts.waitMonitor(t)
	ts.requireServing(t)
	for _, next := range []keybase1.MobileAppState{
		keybase1.MobileAppState_BACKGROUNDACTIVE,
		keybase1.MobileAppState_BACKGROUND,
		keybase1.MobileAppState_FOREGROUND,
		keybase1.MobileAppState_INACTIVE,
		keybase1.MobileAppState_BACKGROUND,
	} {
		ts.update(t, next)
		ts.requireServing(t)
	}

	n := ts.exitCount()
	ts.l.kill(t)
	ts.waitExits(t, n+1)
	ts.requireServing(t)

	ts.killUntilDown(t)
	ts.update(t, keybase1.MobileAppState_BACKGROUNDACTIVE)
	ts.requireServing(t)
	ts.killUntilDown(t)
	ts.update(t, keybase1.MobileAppState_BACKGROUND)
	ts.requireServing(t)
}

func TestAppStateServerScenarioReplay(t *testing.T) {
	for _, sc := range lifecycletest.Scenarios {
		t.Run(sc.Name, func(t *testing.T) {
			tc := libkb.SetupTest(t, "libhttpserver", 2)
			defer tc.Cleanup()
			tc.G.MobileAppState.Update(sc.Platform.InitialState())
			// Android keeps the server up in every state.
			stopInBackground := sc.Platform == lifecycletest.IOS
			wantUp := func(state keybase1.MobileAppState) bool {
				return !stopInBackground || state != keybase1.MobileAppState_BACKGROUND
			}
			ts := startServer(t, tc.G.MobileAppState, stopInBackground)
			lifecycletest.Play(t, tc.G.MobileAppState, sc, func(h *lifecycletest.Harness, i int, step lifecycletest.Step) {
				ts.waitMonitor(t)
				if !wantUp(step.Want) {
					if ts.active() {
						t.Fatalf("step %d %v: server up in BACKGROUND", i, step.Do)
					}
					return
				}
				addr, err := ts.Addr()
				if err != nil {
					t.Fatalf("step %d %v: server down in %v", i, step.Do, step.Want)
				}
				if _, err := fetchAddr(addr, "x"); err != nil {
					t.Fatalf("step %d %v: %v", i, step.Do, err)
				}
				// Leave the server dead before a step that moves to another
				// up state, which must bring it back.
				if i+1 < len(sc.Steps) {
					next := sc.Steps[i+1].Want
					if next != step.Want && wantUp(next) {
						ts.killUntilDown(t)
					}
				}
			})
		})
	}
}

// Transitions, deaths and requests racing each other leave a working server
// and no goroutines after Shutdown.
func TestAppStateServerStress(t *testing.T) {
	tc := libkb.SetupTest(t, "libhttpserver", 2)
	defer tc.Cleanup()
	baseline := runtime.NumGoroutine()
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	ts := startServer(t, tc.G.MobileAppState, true)

	stop := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; ; i++ {
			select {
			case <-stop:
				return
			default:
			}
			tc.G.MobileAppState.Update(allStates[i%len(allStates)])
		}
	}()
	for range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stop:
					return
				default:
				}
				if addr, err := ts.Addr(); err == nil {
					if status, err := fetchAddr(addr, "x"); err != nil && status != 0 && status != http.StatusOK {
						t.Errorf("request: %v", err)
					}
				}
			}
		}()
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			case <-time.After(5 * time.Millisecond):
			}
			ts.l.Lock()
			if ts.l.last != nil {
				_ = ts.l.last.Close()
			}
			ts.l.Unlock()
		}
	}()
	time.Sleep(time.Second)
	close(stop)
	wg.Wait()

	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	ts.waitMonitor(t)
	ts.update(t, keybase1.MobileAppState_FOREGROUND)
	ts.requireServing(t)

	ts.Shutdown()
	ts.requireStopped(t)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_BACKGROUND)
	tc.G.MobileAppState.Update(keybase1.MobileAppState_FOREGROUND)
	ts.serverExited()
	require.False(t, ts.active(), "server started after Shutdown")
	require.Eventually(t, func() bool {
		return runtime.NumGoroutine() <= baseline+5
	}, 10*time.Second, 10*time.Millisecond, "goroutines outlived Shutdown")
}
