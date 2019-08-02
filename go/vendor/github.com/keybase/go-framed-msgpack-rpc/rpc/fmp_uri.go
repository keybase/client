package rpc

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/url"
)

const (
	fmpSchemeStandard = "fmprpc"
	fmpSchemeTLS      = "fmprpc+tls"
)

// FMPURI represents a URI with an FMP scheme.
type FMPURI struct {
	Scheme   string
	HostPort string
	Host     string
}

// ParseFMPURI parses an FMPURI.
func ParseFMPURI(s string) (*FMPURI, error) {
	uri, err := url.Parse(s)
	if err != nil {
		return nil, err
	}

	f := &FMPURI{Scheme: uri.Scheme, HostPort: uri.Host}

	switch f.Scheme {
	case fmpSchemeStandard, fmpSchemeTLS:
	default:
		return nil, fmt.Errorf("invalid framed msgpack rpc scheme %s", uri.Scheme)
	}

	host, _, err := net.SplitHostPort(f.HostPort)
	if err != nil {
		return nil, err
	}
	if len(host) == 0 {
		return nil, fmt.Errorf("missing host in address %s", f.HostPort)
	}
	f.Host = host

	return f, nil
}

func (f *FMPURI) UseTLS() bool {
	return f.Scheme == fmpSchemeTLS
}

func (f *FMPURI) String() string {
	return fmt.Sprintf("%s://%s", f.Scheme, f.HostPort)
}

func (f *FMPURI) DialWithConfig(config *tls.Config) (net.Conn, error) {
	network, addr := "tcp", f.HostPort
	if f.UseTLS() {
		return tls.Dial(network, addr, config)
	}
	return net.Dial(network, addr)
}

func (f *FMPURI) Dial() (net.Conn, error) {
	return f.DialWithConfig(nil)
}
