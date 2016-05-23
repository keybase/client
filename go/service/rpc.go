package service

import (
	"github.com/keybase/client/go/libkb"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
	"net"
)

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
