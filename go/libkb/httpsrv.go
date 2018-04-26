package libkb

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"
)

type HTTPSrvListenerSource interface {
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
	Contextified

	listenerSource HTTPSrvListenerSource
	server         *http.Server
	active         bool
}

func NewHTTPSrv(g *GlobalContext, listenerSource HTTPSrvListenerSource) *HTTPSrv {
	return &HTTPSrv{
		Contextified:   NewContextified(g),
		listenerSource: listenerSource,
	}
}

func (h *HTTPSrv) Start() (err error) {
	h.Lock()
	defer h.Unlock()
	if h.active {
		h.G().Log.Debug("HTTPSrv: already running, not starting again")
		// Just bail out of this if we are already running
		return errHTTPServerAlreadyRunning
	}
	h.ServeMux = http.NewServeMux()
	listener, address, err := h.listenerSource.GetListener()
	if err != nil {
		h.G().Log.Debug("HTTPSrv: failed to get a listener: %s", err)
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
		h.G().Log.Debug("HTTPSrv: server starting on: %s", address)
		if err := h.server.Serve(listener); err != nil {
			h.G().Log.Debug("HTTPSrv: server died: %s", err)
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
