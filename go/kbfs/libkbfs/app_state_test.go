// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// fakeAppState is a settable env.AppStateUpdater. appWaits and netWaits
// receive the state passed to every NextAppStateUpdate and
// NextNetworkStateUpdate call, while they have room.
type fakeAppState struct {
	lock       sync.Mutex
	appState   keybase1.MobileAppState
	netState   keybase1.MobileNetworkState
	appChanged chan struct{}
	netChanged chan struct{}
	appWaits   chan keybase1.MobileAppState
	netWaits   chan keybase1.MobileNetworkState
}

func newFakeAppState(
	appState keybase1.MobileAppState, netState keybase1.MobileNetworkState,
) *fakeAppState {
	return &fakeAppState{
		appState:   appState,
		netState:   netState,
		appChanged: make(chan struct{}),
		netChanged: make(chan struct{}),
		appWaits:   make(chan keybase1.MobileAppState, 1000),
		netWaits:   make(chan keybase1.MobileNetworkState, 1000),
	}
}

var closedAppStateCh = func() chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}()

func (f *fakeAppState) NextAppStateUpdate(
	lastState keybase1.MobileAppState,
) <-chan struct{} {
	f.lock.Lock()
	defer f.lock.Unlock()
	select {
	case f.appWaits <- lastState:
	default:
	}
	if lastState != f.appState {
		return closedAppStateCh
	}
	return f.appChanged
}

func (f *fakeAppState) NextNetworkStateUpdate(
	lastState keybase1.MobileNetworkState,
) <-chan struct{} {
	f.lock.Lock()
	defer f.lock.Unlock()
	select {
	case f.netWaits <- lastState:
	default:
	}
	if lastState != f.netState {
		return closedAppStateCh
	}
	return f.netChanged
}

func (f *fakeAppState) AppState() keybase1.MobileAppState {
	f.lock.Lock()
	defer f.lock.Unlock()
	return f.appState
}

func (f *fakeAppState) NetworkState() keybase1.MobileNetworkState {
	f.lock.Lock()
	defer f.lock.Unlock()
	return f.netState
}

// setAppState changes the app state and waits until someone waits for the
// next change from it.
func (f *fakeAppState) setAppState(t *testing.T, state keybase1.MobileAppState) {
	t.Helper()
	f.drain()
	f.setAppStateNoWait(state)
	waitFor(t, f.appWaits, state)
}

// setNetworkState changes the network state and waits until someone waits
// for the next change from it.
func (f *fakeAppState) setNetworkState(t *testing.T, state keybase1.MobileNetworkState) {
	t.Helper()
	f.drain()
	f.setNetworkStateNoWait(state)
	waitFor(t, f.netWaits, state)
}

func (f *fakeAppState) drain() {
	for {
		select {
		case <-f.appWaits:
		case <-f.netWaits:
		default:
			return
		}
	}
}

func waitFor[T comparable](t *testing.T, waits <-chan T, want T) {
	t.Helper()
	timeout := time.After(10 * time.Second)
	for {
		select {
		case got := <-waits:
			if got == want {
				return
			}
		case <-timeout:
			t.Fatalf("nothing waited for a change from %v", want)
		}
	}
}

func (f *fakeAppState) setAppStateNoWait(state keybase1.MobileAppState) {
	f.lock.Lock()
	defer f.lock.Unlock()
	if f.appState != state {
		f.appState = state
		close(f.appChanged)
		f.appChanged = make(chan struct{})
	}
}

func (f *fakeAppState) setNetworkStateNoWait(state keybase1.MobileNetworkState) {
	f.lock.Lock()
	defer f.lock.Unlock()
	if f.netState != state {
		f.netState = state
		close(f.netChanged)
		f.netChanged = make(chan struct{})
	}
}

type fbmNoTimedQRConfig struct {
	Config
}

func (c fbmNoTimedQRConfig) Mode() InitMode {
	return modeTestWithNoTimedQR{modeTest{NewInitModeFromType(InitDefault)}}
}

// The folder block manager's app-state waits end on shutdown while the app
// is backgrounded.
func TestFolderBlockManagerPausedLoopsExitOnShutdown(t *testing.T) {
	loops := map[string]func(fbm *folderBlockManager){
		"reclaimQuota":    (*folderBlockManager).reclaimQuotaInBackground,
		"cleanDiskCaches": (*folderBlockManager).cleanDiskCachesInBackground,
	}
	for name, loop := range loops {
		t.Run(name, func(t *testing.T) {
			appState := newFakeAppState(
				keybase1.MobileAppState_BACKGROUND,
				keybase1.MobileNetworkState_WIFI)
			fbm := &folderBlockManager{
				appStateUpdater:      appState,
				config:               fbmNoTimedQRConfig{},
				log:                  logger.NewTestLogger(t),
				shutdownChan:         make(chan struct{}),
				forceReclamationChan: make(chan struct{}, 1),
				latestMergedChan:     make(chan struct{}, 1),
			}
			done := make(chan struct{})
			go func() {
				defer close(done)
				loop(fbm)
			}()

			waitFor(t, appState.appWaits, keybase1.MobileAppState_BACKGROUND)
			fbm.shutdown()
			select {
			case <-done:
			case <-time.After(10 * time.Second):
				t.Fatal("paused loop did not exit on shutdown")
			}
		})
	}
}

// requirePaused checks the prefetcher's pause after the state changes that
// setAppState/setNetworkState waited for.
func requirePaused(t *testing.T, q *blockRetrievalQueue, want bool, msg string) {
	t.Helper()
	paused, _ := q.Prefetcher().(*blockPrefetcher).getPaused()
	require.Equal(t, want, paused, msg)
}

// Neither pause reason ends the other's pause.
func TestPrefetcherPauseReasonsDoNotUndoEachOther(t *testing.T) {
	for _, appFirst := range []bool{false, true} {
		t.Run(fmt.Sprintf("appFirst=%t", appFirst), func(t *testing.T) {
			bg := newFakeBlockGetter(false)
			config := newTestBlockRetrievalConfig(t, bg, nil)
			appState := newFakeAppState(
				keybase1.MobileAppState_FOREGROUND,
				keybase1.MobileNetworkState_WIFI)
			q := newBlockRetrievalQueue(1, 1, 0, config, appState)
			require.NotNil(t, q)
			prefetchSyncCh := make(chan struct{})
			defer shutdownPrefetcherTest(t, q, prefetchSyncCh)
			<-q.TogglePrefetcher(true, prefetchSyncCh, nil)
			// The first iteration reads the network state; the second waits
			// for a change from it.
			notifySyncCh(t, prefetchSyncCh)
			notifySyncCh(t, prefetchSyncCh)
			waitFor(t, appState.netWaits, keybase1.MobileNetworkState_WIFI)
			requirePaused(t, q, false, "paused in the foreground on wifi")

			if appFirst {
				appState.setAppState(t, keybase1.MobileAppState_BACKGROUND)
				requirePaused(t, q, true, "not paused in the background")
				appState.setNetworkState(t, keybase1.MobileNetworkState_CELLULAR)
				requirePaused(t, q, true, "not paused in the background on cellular")
			} else {
				appState.setNetworkState(t, keybase1.MobileNetworkState_CELLULAR)
				requirePaused(t, q, true, "not paused on cellular")
				appState.setAppState(t, keybase1.MobileAppState_BACKGROUND)
				requirePaused(t, q, true, "not paused in the background on cellular")
			}

			appState.setAppState(t, keybase1.MobileAppState_INACTIVE)
			requirePaused(t, q, true, "an app-state change undid the cellular pause")
			appState.setAppState(t, keybase1.MobileAppState_FOREGROUND)
			requirePaused(t, q, true, "foregrounding undid the cellular pause")

			appState.setAppState(t, keybase1.MobileAppState_BACKGROUND)
			requirePaused(t, q, true, "not paused in the background on cellular")
			appState.setNetworkState(t, keybase1.MobileNetworkState_WIFI)
			requirePaused(t, q, true, "leaving cellular undid the background pause")

			appState.setAppStateNoWait(keybase1.MobileAppState_FOREGROUND)
			require.Eventually(t, func() bool {
				paused, _ := q.Prefetcher().(*blockPrefetcher).getPaused()
				return !paused
			}, 10*time.Second, time.Millisecond, "still paused in the foreground on wifi")
		})
	}
}
