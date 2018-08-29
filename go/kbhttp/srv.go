// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbhttp

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"

	"github.com/keybase/client/go/logger"
)

// ListenerSource represents where an HTTP server should listen.
type ListenerSource interface {
	GetListener() (net.Listener, string, error)
}

// RandomPortListenerSource means listen on a random port.
type RandomPortListenerSource struct{}

// GetListener implements ListenerSource.
func (r RandomPortListenerSource) GetListener() (net.Listener, string, error) {
	localhost := "127.0.0.1"
	listener, err := net.Listen("tcp", fmt.Sprintf("%s:0", localhost))
	if err != nil {
		return nil, "", err
	}
	port := listener.Addr().(*net.TCPAddr).Port
	address := fmt.Sprintf("%s:%d", localhost, port)
	return listener, address, nil
}

// NewRandomPortListenerSource creates a new RandomPortListenerSource.
func NewRandomPortListenerSource() *RandomPortListenerSource {
	return &RandomPortListenerSource{}
}

// PortRangeListenerSource means listen on the given range.
type PortRangeListenerSource struct {
	sync.Mutex
	pinnedPort int
	low, high  int
}

// NewPortRangeListenerSource creates a new PortListenerSource
// listening on low to high (inclusive).
func NewPortRangeListenerSource(low, high int) *PortRangeListenerSource {
	return &PortRangeListenerSource{
		low:  low,
		high: high,
	}
}

// NewFixedPortListenerSource creates a new PortListenerSource
// listening on the given port.
func NewFixedPortListenerSource(port int) *PortRangeListenerSource {
	return NewPortRangeListenerSource(port, port)
}

// GetListener implements ListenerSource.
func (p *PortRangeListenerSource) GetListener() (listener net.Listener, address string, err error) {
	p.Lock()
	defer p.Unlock()
	var errMsg string
	localhost := "127.0.0.1"
	if p.pinnedPort > 0 {
		address = fmt.Sprintf("%s:%d", localhost, p.pinnedPort)
		listener, err = net.Listen("tcp", address)
		if err == nil {
			return listener, address, nil
		}
		errMsg = fmt.Sprintf("failed to bind to pinned port: %d err: %s", p.pinnedPort, err)
	} else {
		for port := p.low; port <= p.high; port++ {
			address = fmt.Sprintf("%s:%d", localhost, port)
			listener, err = net.Listen("tcp", address)
			if err == nil {
				p.pinnedPort = port
				return listener, address, nil
			}
		}
		errMsg = "failed to bind to port in range"
	}
	return listener, address, errors.New(errMsg)
}

var errAlreadyRunning = errors.New("http server already running")

// Srv starts a simple HTTP server with a parameter for a module to provide a listener source
type Srv struct {
	sync.Mutex
	*http.ServeMux
	log logger.Logger

	listenerSource ListenerSource
	server         *http.Server
}

// NewSrv creates a new HTTP server with the given listener
// source.
func NewSrv(log logger.Logger, listenerSource ListenerSource) *Srv {
	return &Srv{
		log:            log,
		listenerSource: listenerSource,
	}
}

// Start starts listening on the server's listener source.
func (h *Srv) Start() (err error) {
	h.Lock()
	defer h.Unlock()
	if h.server != nil {
		h.log.Debug("kbhttp.Srv: already running, not starting again")
		// Just bail out of this if we are already running
		return errAlreadyRunning
	}
	h.ServeMux = http.NewServeMux()
	listener, address, err := h.listenerSource.GetListener()
	if err != nil {
		h.log.Debug("kbhttp.Srv: failed to get a listener: %s", err)
		return err
	}
	h.server = &http.Server{
		Addr:    address,
		Handler: h.ServeMux,
	}
	go func(server *http.Server) {
		h.log.Debug("kbhttp.Srv: server starting on: %s", address)
		if err := server.Serve(listener); err != nil {
			h.log.Debug("kbhttp.Srv: server died: %s", err)
		}
	}(h.server)
	return nil
}

// Active returns true if the server is active.
func (h *Srv) Active() bool {
	h.Lock()
	defer h.Unlock()
	return h.server != nil
}

// Addr returns the server's address, if it's running.
func (h *Srv) Addr() (string, error) {
	h.Lock()
	defer h.Unlock()
	if h.server != nil {
		return h.server.Addr, nil
	}
	return "", errors.New("server not running")
}

// Stop stops listening on the server's listener source.
func (h *Srv) Stop() {
	h.Lock()
	defer h.Unlock()
	if h.server != nil {
		h.server.Close()
		h.server = nil
	}
}
