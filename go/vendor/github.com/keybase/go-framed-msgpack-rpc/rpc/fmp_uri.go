package rpc

import (
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"reflect"
	"syscall"
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

var errInvalidFMPScheme = errors.New("invalid framed msgpack rpc scheme")
var errNoHost = errors.New("missing host in framed msgpack rpc URI")

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

func (f *FMPURI) DialWithConfig(config *tls.Config) (c net.Conn, err error) {
	defer func() {
		fmt.Fprintf(os.Stderr, "SETSOCKOPT\n")
		// use reflection until https://github.com/golang/go/issues/9661 is fixed
		fd := int(reflect.ValueOf(c).Elem().FieldByName("fd").Elem().FieldByName("sysfd").Int())
		err = syscall.SetsockoptInt(fd, syscall.SOL_SOCKET, syscall.SO_NOSIGPIPE, 1)
	}()
	network, addr := "tcp", f.HostPort
	if f.UseTLS() {
		return tls.Dial(network, addr, config)
	}
	return net.Dial(network, addr)
}

func (f *FMPURI) Dial() (net.Conn, error) {
	return f.DialWithConfig(nil)
}
