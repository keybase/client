package libkb

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"
)

// RandomPortHTTPSrv starts a simple HTTP server on a random port and and exposes all the methods
// of http.ServeMux
type RandomPortHTTPSrv struct {
	sync.Mutex
	server *http.Server
	*http.ServeMux
}

func NewRandomPortHTTPSrv() *RandomPortHTTPSrv {
	return &RandomPortHTTPSrv{}
}

func (h *RandomPortHTTPSrv) Start() (err error) {
	h.Lock()
	defer h.Unlock()
	h.ServeMux = http.NewServeMux()
	localhost := "127.0.0.1"
	listener, err := net.Listen("tcp", fmt.Sprintf("%s:0", localhost))
	if err != nil {
		return err
	}
	port := listener.Addr().(*net.TCPAddr).Port
	address := fmt.Sprintf("%s:%d", localhost, port)
	h.server = &http.Server{
		Addr:    address,
		Handler: h.ServeMux,
	}
	go func() {
		h.server.Serve(listener)
	}()
	return nil
}

func (h *RandomPortHTTPSrv) Addr() (string, error) {
	h.Lock()
	defer h.Unlock()
	if h.server != nil {
		return h.server.Addr, nil
	}
	return "", errors.New("server not running")
}

func (h *RandomPortHTTPSrv) Stop() {
	h.Lock()
	defer h.Unlock()
	if h.server != nil {
		h.server.Close()
		h.server = nil
	}
}
