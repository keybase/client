// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libhttpserver

import (
	"errors"
	"net/http"
	"sync"

	"github.com/keybase/client/go/kbfs/env"
	"github.com/keybase/client/go/kbhttp"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
)

// appStateServer runs an HTTP server that is up in every app state except
// BACKGROUND. Moving between up states (for example an INACTIVE blip from
// Control Center) leaves a running server alone, so in-flight requests
// survive, and restarts one that is not serving.
type appStateServer struct {
	appStateUpdater env.AppStateUpdater
	logger          logger.Logger
	newSource       func() kbhttp.ListenerSource
	register        func(mux *http.ServeMux)

	// mu guards everything below and serializes starts and stops.
	mu       sync.Mutex
	server   *kbhttp.Srv
	shutdown bool
	// changes counts the app-state changes the monitor has acted on, and
	// exitRestart is one past its value at the last restart after an
	// unexpected exit, so a listener that keeps dying restarts at most once
	// per change.
	changes     uint64
	exitRestart uint64
	// exits counts handled unexpected exits, for tests.
	exits int
	// beforeExitRestart, if set, runs in serverExited between reading the
	// app state and acting on it. Tests only.
	beforeExitRestart func()
	// monitorState is the state the monitor last acted on, and monitorWait
	// the change channel it waits on for that state; tests use them to wait
	// until the monitor has caught up.
	monitorState keybase1.MobileAppState
	monitorWait  <-chan struct{}

	shutdownCh  chan struct{}
	monitorDone chan struct{}
}

func newAppStateServer(
	appStateUpdater env.AppStateUpdater, log logger.Logger,
	newSource func() kbhttp.ListenerSource, register func(mux *http.ServeMux),
) *appStateServer {
	s := &appStateServer{
		appStateUpdater: appStateUpdater,
		logger:          log,
		newSource:       newSource,
		register:        register,
		shutdownCh:      make(chan struct{}),
		monitorDone:     make(chan struct{}),
	}
	s.server = s.newServer()
	return s
}

// start starts serving unless the app is in BACKGROUND, and follows app-state
// changes until Shutdown. An error starting the server is returned, and
// nothing is left running.
func (s *appStateServer) start() error {
	s.mu.Lock()
	state := s.appStateUpdater.AppState()
	var err error
	if wantUp(state) {
		err = s.startLocked()
	}
	s.mu.Unlock()
	if err != nil {
		close(s.monitorDone)
		return err
	}
	go s.monitorAppState(state)
	return nil
}

func wantUp(state keybase1.MobileAppState) bool {
	return state != keybase1.MobileAppState_BACKGROUND
}

func (s *appStateServer) newServer() *kbhttp.Srv {
	server := kbhttp.NewSrv(s.logger, s.newSource())
	server.OnUnexpectedExit(s.serverExited)
	return server
}

// startLocked starts the server unless it is serving or shut down. Handlers
// are registered before it accepts connections, so a restart never answers
// 404.
func (s *appStateServer) startLocked() error {
	if s.shutdown || s.server.Active() {
		return nil
	}
	err := s.server.StartWithHandlers(s.register)
	if errors.Is(err, kbhttp.ErrPinnedPortInUse) {
		// Pick a new port like we never had a server before.
		s.server = s.newServer()
		err = s.server.StartWithHandlers(s.register)
	}
	return err
}

func (s *appStateServer) reconcileLocked(state keybase1.MobileAppState) {
	if !wantUp(state) {
		<-s.server.Stop()
		return
	}
	if err := s.startLocked(); err != nil {
		s.logger.Error("Starting server in %v failed: %v", state, err)
	}
}

func (s *appStateServer) monitorAppState(state keybase1.MobileAppState) {
	defer close(s.monitorDone)
	for {
		next := s.appStateUpdater.NextAppStateUpdate(state)
		s.mu.Lock()
		s.monitorState, s.monitorWait = state, next
		s.mu.Unlock()
		select {
		case <-next:
		case <-s.shutdownCh:
			return
		}
		s.mu.Lock()
		// Read the state under mu, so an unexpected exit deciding concurrently
		// sees either the state before this change or its outcome.
		state = s.appStateUpdater.AppState()
		s.changes++
		s.reconcileLocked(state)
		s.mu.Unlock()
	}
}

// serverExited restarts a server whose listener died without a Stop, for
// example one the OS reclaimed while the app was suspended.
func (s *appStateServer) serverExited() {
	s.mu.Lock()
	defer s.mu.Unlock()
	state := s.appStateUpdater.AppState()
	if s.beforeExitRestart != nil {
		s.beforeExitRestart()
	}
	s.exits++
	if !wantUp(state) || s.exitRestart == s.changes+1 {
		s.logger.Debug("Not restarting server after it exited in %v", state)
		return
	}
	s.exitRestart = s.changes + 1
	if err := s.startLocked(); err != nil {
		s.logger.Error("Restarting server after it exited failed: %v", err)
	}
}

// Addr returns the address the server is listening on, if it is running.
func (s *appStateServer) Addr() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.server.Addr()
}

// Shutdown stops the server for good and waits for it and the monitor to
// exit.
func (s *appStateServer) Shutdown() {
	s.mu.Lock()
	if !s.shutdown {
		s.shutdown = true
		close(s.shutdownCh)
		<-s.server.Stop()
	}
	s.mu.Unlock()
	<-s.monitorDone
}
