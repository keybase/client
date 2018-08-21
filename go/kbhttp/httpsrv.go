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
	"github.com/keybase/gregor/base/log"
)

type ListenerSource interface {
	GetListener() (net.Listener, string, error)
}

type RandomPortListenerSource struct{}

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

func NewRandomPortListenerSource() *RandomPortListenerSource {
	return &RandomPortListenerSource{}
}

type PortRangeListenerSource struct {
	sync.Mutex
	pinnedPort int
	low, high  int
}

func NewPortRangeListenerSource(low, high int) *PortRangeListenerSource {
	return &PortRangeListenerSource{
		low:  low,
		high: high,
	}
}

func NewFixedPortListenerSource(port int) *PortRangeListenerSource {
	return NewPortRangeListenerSource(port, port)
}

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

var errHTTPServerAlreadyRunning = errors.New("http server already running")

// HTTPSrv starts a simple HTTP server with a parameter for a module to provide a listener source
type HTTPSrv struct {
	sync.Mutex
	*http.ServeMux
	log logger.Logger

	listenerSource ListenerSource
	server         *http.Server
	active         bool
}

func NewHTTPSrv(log logger.Logger, listenerSource ListenerSource) *HTTPSrv {
	return &HTTPSrv{
		log:            log,
		listenerSource: listenerSource,
	}
}

func (h *HTTPSrv) Start() (err error) {
	h.Lock()
	defer h.Unlock()
	if h.active {
		log.Debug("HTTPSrv: already running, not starting again")
		// Just bail out of this if we are already running
		return errHTTPServerAlreadyRunning
	}
	h.ServeMux = http.NewServeMux()
	listener, address, err := h.listenerSource.GetListener()
	if err != nil {
		h.log.Debug("HTTPSrv: failed to get a listener: %s", err)
		return err
	}
	h.server = &http.Server{
		Addr:    address,
		Handler: h.ServeMux,
	}
	go func() {
		h.Lock()
		h.active = true
		h.Unlock()
		h.log.Debug("HTTPSrv: server starting on: %s", address)
		if err := h.server.Serve(listener); err != nil {
			h.log.Debug("HTTPSrv: server died: %s", err)
		}
		h.Lock()
		h.active = false
		h.Unlock()
	}()
	return nil
}

func (h *HTTPSrv) Active() bool {
	h.Lock()
	defer h.Unlock()
	return h.active
}

func (h *HTTPSrv) Addr() (string, error) {
	h.Lock()
	defer h.Unlock()
	if h.server != nil {
		return h.server.Addr, nil
	}
	return "", errors.New("server not running")
}

func (h *HTTPSrv) Stop() {
	h.Lock()
	defer h.Unlock()
	if h.server != nil {
		h.server.Close()
		h.server = nil
	}
}
