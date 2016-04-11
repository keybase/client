package service

import (
	"errors"
	"fmt"
	"net"
	"net/url"

	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type fmpURIScheme string

const (
	fmpSchemeStandard fmpURIScheme = "fmprpc"
	fmpSchemeTLS      fmpURIScheme = "fmprpc+tls"
)

type fmpURI struct {
	Scheme   fmpURIScheme
	HostPort string
	Host     string
}

var errInvalidFMPScheme = errors.New("invalid framed msgpack rpc scheme")
var errNoHost = errors.New("missing host in framed msgpack rpc URI")

func parseFMPURI(s string) (*fmpURI, error) {
	uri, err := url.Parse(s)
	if err != nil {
		return nil, err
	}

	f := &fmpURI{HostPort: uri.Host}

	switch fmpURIScheme(uri.Scheme) {
	case fmpSchemeStandard:
		f.Scheme = fmpSchemeStandard
	case fmpSchemeTLS:
		f.Scheme = fmpSchemeTLS
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

func (f *fmpURI) UseTLS() bool {
	return f.Scheme == fmpSchemeTLS
}

func (f *fmpURI) String() string {
	return fmt.Sprintf("%s://%s", f.Scheme, f.HostPort)
}

// connTransport implements rpc.ConnectionTransport
type connTransport struct {
	libkb.Contextified
	host            string
	conn            net.Conn
	transport       rpc.Transporter
	stagedTransport rpc.Transporter
}

var _ rpc.ConnectionTransport = (*connTransport)(nil)

func newConnTransport(g *libkb.GlobalContext, host string) *connTransport {
	return &connTransport{
		Contextified: libkb.NewContextified(g),
		host:         host,
	}
}

func (t *connTransport) Dial(context.Context) (rpc.Transporter, error) {
	var err error
	t.conn, err = net.Dial("tcp", t.host)
	if err != nil {
		return nil, err
	}
	t.stagedTransport = rpc.NewTransport(t.conn, libkb.NewRPCLogFactory(t.G()), libkb.WrapError)
	return t.stagedTransport, nil
}

func (t *connTransport) IsConnected() bool {
	return t.transport != nil && t.transport.IsConnected()
}

func (t *connTransport) Finalize() {
	t.transport = t.stagedTransport
	t.stagedTransport = nil
}

func (t *connTransport) Close() {
	t.conn.Close()
}
