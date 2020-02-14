package stellar

import (
	"context"
	"net"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
)

// ConnPair is like Unix's SocketPair, but uses TCP so it should work on all platforms.
// Copy/pasta'ed from: https://gist.github.com/tsavola/cd847385989f1ae497dbbcd2bba68753
func connPair() (serverConn, clientConn net.Conn, err error) {
	l, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return nil, nil, err
	}
	defer l.Close()

	addr := l.Addr()
	var err2 error
	done := make(chan struct{})

	go func() {
		defer close(done)
		clientConn, err2 = net.Dial(addr.Network(), addr.String())
	}()

	serverConn, err = l.Accept()
	<-done

	if err == nil {
		err = err2
	}
	if err != nil {
		if clientConn != nil {
			clientConn.Close()
		}
		if serverConn != nil {
			serverConn.Close()
		}
	}
	return serverConn, clientConn, err
}

func newTestClient(conn net.Conn) *Client {
	return &Client{
		dialFunc: func(m libkb.MetaContext) (net.Conn, error) { return conn, nil },
	}
}

type testProcessor struct {
	details keybase1.AirdropDetails
	err     error
	doneCh  chan struct{}
}

var _ RequestProcessor = (*testProcessor)(nil)

func newTestProcessor() *testProcessor {
	return &testProcessor{
		doneCh: make(chan struct{}),
	}
}

func (p *testProcessor) Reg1(c context.Context, uid keybase1.UID, kid keybase1.BinaryKID, err error) {
}
func (p *testProcessor) Close(ctx context.Context, err error) {}

func (p *testProcessor) Reg2(ctx context.Context, details keybase1.AirdropDetails, err error) {
	p.details = details
	p.err = err
	p.doneCh <- struct{}{}
}

func TestReg(t *testing.T) {
	tc := libkb.SetupTest(t, "stellar", 2)
	defer tc.Cleanup()
	fu, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)
	serverConn, clientConn, err := connPair()
	require.NoError(t, err)
	tp := newTestProcessor()
	mctx := tc.MetaContext()
	xp := libkb.NewTransportFromSocket(mctx.G(), serverConn, keybase1.NetworkSource_REMOTE)
	srv := rpc.NewServer(xp, libkb.MakeWrapError(mctx.G()))
	err = HandleRequest(mctx.Ctx(), xp, srv, tp)
	require.NoError(t, err)
	go func() {
		cli := newTestClient(clientConn)
		err := cli.Register(mctx)
		require.NoError(t, err)
	}()
	<-tp.doneCh
	require.NoError(t, tp.err)
	require.Equal(t, tp.details.Uid, fu.GetUID())
}
