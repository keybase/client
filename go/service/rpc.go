package service

import (
	"context"
	"net"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// connTransport implements rpc.ConnectionTransport
type connTransport struct {
	libkb.Contextified
	host string

	// mu guards the fields below: the connection dials on its own goroutine
	// while Shutdown closes the transport.
	mu              sync.Mutex
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
	conn, err := libkb.ProxyDial(t.G().Env, "tcp", t.host)
	if err != nil {
		return nil, err
	}
	transport := rpc.NewTransport(conn, libkb.NewRPCLogFactory(t.G()),
		t.G().RemoteNetworkInstrumenterStorage,
		libkb.MakeWrapError(t.G()), rpc.DefaultMaxFrameLength)
	t.mu.Lock()
	defer t.mu.Unlock()
	t.conn = conn
	t.stagedTransport = transport
	return transport, nil
}

func (t *connTransport) IsConnected() bool {
	t.mu.Lock()
	transport := t.transport
	t.mu.Unlock()
	return transport != nil && transport.IsConnected()
}

// Finalize and Close close transports outside mu: closing waits for the
// receiver, whose handlers may call IsConnected.
func (t *connTransport) Finalize() {
	t.mu.Lock()
	old := t.transport
	t.transport = t.stagedTransport
	t.stagedTransport = nil
	t.mu.Unlock()
	if old != nil {
		old.Close()
	}
}

func (t *connTransport) Close() {
	t.mu.Lock()
	conn, transport, staged := t.conn, t.transport, t.stagedTransport
	t.transport = nil
	t.stagedTransport = nil
	t.mu.Unlock()
	if conn != nil {
		conn.Close()
	}
	if transport != nil {
		transport.Close()
	}
	if staged != nil {
		staged.Close()
	}
}

func (t *connTransport) Reset() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.transport = nil
	t.stagedTransport = nil
}
