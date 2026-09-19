package service

import (
	"context"
	"runtime"
	"sync"
	"testing"

	"github.com/keybase/client/go/kbhttp"
	"github.com/keybase/client/go/kbhttp/manager"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/libkb/lifecycle"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// newTestClientStateService sets up what SetupCriticalSubServices does for
// clientState: the http server and the reader.
func newTestClientStateService(t *testing.T, g *libkb.GlobalContext) *Service {
	t.Helper()
	svc := NewService(g, false)
	svc.httpSrv = manager.NewSrv(g)
	g.NotifyRouter.SetClientStateReader(svc.readClientState)
	return svc
}

var allClientStateChannels = keybase1.NotificationChannels{App: true, Session: true, Service: true}

const (
	methodClientState = "keybase.1.NotifyApp.clientState"
	methodAppState    = "keybase.1.NotifyApp.mobileAppStateChanged"
	methodHTTPSrvInfo = "keybase.1.NotifyService.HTTPSrvInfoUpdate"
	methodLoggedIn    = "keybase.1.NotifySession.loggedIn"
)

func decodeClientState(t *testing.T, m libkb.RecordedNotify) keybase1.ClientState {
	t.Helper()
	require.Equal(t, methodClientState, m.Method)
	var arg keybase1.ClientStateArg
	require.NoError(t, m.Decode(&arg))
	return arg.State
}

func clientStatesOf(t *testing.T, msgs []libkb.RecordedNotify) (ret []keybase1.ClientState) {
	t.Helper()
	for _, m := range msgs {
		if m.Method == methodClientState {
			ret = append(ret, decodeClientState(t, m))
		}
	}
	return ret
}

// testLoginWrite makes the session valid the way a login does before it
// announces itself.
func testLoginWrite(t *testing.T, tc libkb.TestContext, name string) {
	t.Helper()
	sig, err := libkb.GenerateNaclSigningKeyPair()
	require.NoError(t, err)
	enc, err := libkb.GenerateNaclDHKeyPair()
	require.NoError(t, err)
	deviceID, err := libkb.NewDeviceID()
	require.NoError(t, err)
	uv := keybase1.UserVersion{Uid: libkb.UsernameToUID(name), EldestSeqno: 1}
	require.NoError(t, libkb.NewMetaContextForTest(tc).SwitchUserNewConfigActiveDevice(uv,
		libkb.NewNormalizedUsername(name), nil, deviceID, sig, enc, "testdevice", libkb.KeychainModeNone))
}

// A client applies what it gets in arrival order, so the state as of
// subscribing has to arrive before any change announced after it.
func TestSnapshotIsFirstOnConnection(t *testing.T) {
	tc := libkb.SetupTest(t, "notify", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	svc := newTestClientStateService(t, g)
	svc.settleInitialLoginAttempt(context.Background())

	rec := libkb.NewNotifyRecorder(g, allClientStateChannels)
	defer rec.Close()
	g.NotifyRouter.HandleLogout(context.Background())
	g.MobileLifecycle.UIInactive()
	rec.Flush()

	msgs := rec.Messages()
	require.NotEmpty(t, msgs)
	first := decodeClientState(t, msgs[0])
	require.NotNil(t, first.Session)
	info, err := svc.httpSrv.Info()
	require.NoError(t, err)
	require.Equal(t, &info, first.HttpSrvInfo)
	require.Greater(t, len(msgs), 1, "the changes after it arrive after it")
}

// Each field has one writer, which queues its notification in write order, and
// a clientState reads every field when it is sent, so whatever interleaving the
// writers and the clientStates take, the last value a connection receives for a
// field is the field's current value.
func TestLastMessagePerFieldIsLatest(t *testing.T) {
	// Two Ps: the writers still run in parallel, but goroutines started in a row
	// no longer reliably run in the order they were started, which is what a
	// fan-out of one goroutine per message gets wrong. With one P per core that
	// fan-out passes this test almost every time.
	defer runtime.GOMAXPROCS(runtime.GOMAXPROCS(2))
	tc := libkb.SetupTest(t, "notify", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	svc := NewService(g, false)
	// A fresh port on every bind, unlike the service's pinned one, so each
	// rebind is an address change the server announces.
	srv, err := manager.New("Srv", g.GetLog(), g.MobileAppState.State, g.MobileAppState.NextUpdate,
		func() kbhttp.ListenerSource { return kbhttp.NewAutoPortListenerSource() }, true,
		g.NotifyRouter.HandleHTTPSrvInfoUpdate)
	require.NoError(t, err)
	svc.httpSrv = srv
	g.NotifyRouter.SetClientStateReader(svc.readClientState)
	svc.settleInitialLoginAttempt(context.Background())

	rec := libkb.NewNotifyRecorder(g, allClientStateChannels)
	defer rec.Close()

	ctx := context.Background()
	var wg sync.WaitGroup
	// 50 app state updates from 5 goroutines. Each move from BACKGROUND to the
	// foreground rebinds the http server, which is the http address's writer.
	for i := range 5 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range 10 {
				switch (i + j) % 3 {
				case 0:
					g.MobileLifecycle.UIActive()
				case 1:
					g.MobileLifecycle.UIInactive()
				default:
					g.MobileLifecycle.UIBackground(false, lifecycle.BackgroundTaskDeps{})
				}
			}
		}()
	}
	// clientStates interleaved with all of it
	wg.Add(1)
	go func() {
		defer wg.Done()
		for range 20 {
			g.NotifyRouter.AnnounceClientState(ctx)
		}
	}()
	wg.Wait()
	// Stops the http server's writer for good: nothing moves the address after this.
	svc.httpSrv.Shutdown()
	rec.Flush()

	var lastAppState *keybase1.MobileAppState
	var lastHTTP *keybase1.HttpSrvInfo
	var appStateChanges []keybase1.MobileAppState
	var httpChanges []keybase1.HttpSrvInfo
	for _, m := range rec.Messages() {
		switch m.Method {
		case methodClientState:
			state := decodeClientState(t, m)
			lastAppState = &state.AppState
			lastHTTP = state.HttpSrvInfo
		case methodAppState:
			var arg keybase1.MobileAppStateChangedArg
			require.NoError(t, m.Decode(&arg))
			lastAppState = &arg.State
			appStateChanges = append(appStateChanges, arg.State)
		case methodHTTPSrvInfo:
			var arg keybase1.HTTPSrvInfoUpdateArg
			require.NoError(t, m.Decode(&arg))
			lastHTTP = &arg.Info
			httpChanges = append(httpChanges, arg.Info)
		}
	}
	// Each writer announces only a change, so in write order no two of its
	// notifications in a row carry the same value.
	for i := 1; i < len(appStateChanges); i++ {
		require.NotEqual(t, appStateChanges[i-1], appStateChanges[i], "app state notification %d", i)
	}
	for i := 1; i < len(httpChanges); i++ {
		require.NotEqual(t, httpChanges[i-1], httpChanges[i], "http notification %d", i)
	}
	require.NotNil(t, lastAppState)
	require.Equal(t, g.MobileAppState.State(), *lastAppState)
	info, err := svc.httpSrv.Info()
	require.NoError(t, err)
	require.NotNil(t, lastHTTP)
	require.Equal(t, info, *lastHTTP)
	require.NotEmpty(t, httpChanges, "the http server rebound while connected")
}

// The identity comes from clientState alone, so a completed login is followed
// by one that carries it.
func TestSessionChangeFollowedBySnapshot(t *testing.T) {
	tc := libkb.SetupTest(t, "notify", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	svc := newTestClientStateService(t, g)
	svc.settleInitialLoginAttempt(context.Background())

	rec := libkb.NewNotifyRecorder(g, allClientStateChannels)
	defer rec.Close()
	rec.Flush()
	before := len(rec.Messages())

	testLoginWrite(t, tc, "testuser")
	g.NotifyRouter.SendLogin(context.Background(), "testuser", false)
	rec.Flush()

	after := rec.Messages()[before:]
	require.Len(t, after, 2)
	require.Equal(t, methodLoggedIn, after[0].Method)
	state := decodeClientState(t, after[1])
	require.NotNil(t, state.Session)
	require.True(t, state.Session.LoggedIn)
	require.Equal(t, "testuser", state.Session.Username)
}

// Before the startup login attempt settles there is no session to describe --
// not a logged-out one -- so the clientState says nothing about it, and the
// attempt settling sends one that does.
func TestNullSessionUntilLoginSettles(t *testing.T) {
	tc := libkb.SetupTest(t, "notify", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	svc := newTestClientStateService(t, g)

	rec := libkb.NewNotifyRecorder(g, allClientStateChannels)
	defer rec.Close()
	rec.Flush()
	states := clientStatesOf(t, rec.Messages())
	require.Len(t, states, 1)
	require.Nil(t, states[0].Session, "the startup login attempt has not run")

	svc.settleInitialLoginAttempt(context.Background())
	rec.Flush()
	states = clientStatesOf(t, rec.Messages())
	require.Len(t, states, 2)
	require.NotNil(t, states[1].Session, "the attempt settled, so there is a session to report")
	require.False(t, states[1].Session.LoggedIn, "logged out in a fresh test context")
}

// SetNotifications is what registers the channels, and a connection that
// registers app notifications gets its clientState from it.
func TestSetNotificationsQueuesClientState(t *testing.T) {
	tc := libkb.SetupTest(t, "notify", 0)
	defer tc.Cleanup()
	g := tc.G
	g.SetService()
	newTestClientStateService(t, g)

	rec := libkb.NewNotifyRecorder(g, keybase1.NotificationChannels{})
	defer rec.Close()
	h := NewNotifyCtlHandler(nil, rec.ID, g)
	require.NoError(t, h.SetNotifications(context.Background(), keybase1.NotificationChannels{Session: true}))
	require.True(t, g.NotifyRouter.GetChannels(rec.ID).Session)
	rec.Flush()
	require.Empty(t, rec.Messages(), "clientState rides NotifyApp, which this client did not register")

	require.NoError(t, h.SetNotifications(context.Background(), allClientStateChannels))
	rec.Flush()
	require.Len(t, clientStatesOf(t, rec.Messages()), 1)
}
