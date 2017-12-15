package rpc

import (
	"fmt"
	"io"
	"net"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

var testPort int = 8089

type longCallResult struct {
	res interface{}
	err error
}

func prepServer(listener chan error) error {
	server := &server{port: testPort}

	serverReady := make(chan struct{})
	var err error
	go func() {
		err = server.Run(serverReady, listener)
	}()
	<-serverReady
	// TODO: Fix the race here -- when serverReady is closed by
	// server.Run, err is in an indeterminate state.
	return err
}

func prepClient(t *testing.T) (TestClient, net.Conn) {
	c, err := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", testPort))
	require.Nil(t, err, "a dialer error occurred")

	xp := NewTransport(c, nil, nil)
	return TestClient{GenericClient: NewClient(xp, nil, nil)}, c
}

func prepTest(t *testing.T) (TestClient, chan error, net.Conn) {
	listener := make(chan error)
	prepServer(listener)
	cli, conn := prepClient(t)
	return cli, listener, conn
}

func endTest(t *testing.T, c net.Conn, listener chan error) {
	c.Close()
	err := <-listener
	require.EqualError(t, err, io.EOF.Error(), "expected EOF")
}

func TestCall(t *testing.T) {
	cli, listener, conn := prepTest(t)
	defer endTest(t, conn, listener)

	B := 34
	for A := 10; A < 23; A += 2 {
		res, err := cli.Add(context.Background(), AddArgs{A: A, B: B})
		require.Nil(t, err, "an error occurred while adding parameters")
		require.Equal(t, A+B, res, "Result should be the two parameters added together")
	}
}

func TestBrokenCall(t *testing.T) {
	cli, listener, conn := prepTest(t)
	defer endTest(t, conn, listener)

	err := cli.BrokenMethod()
	require.EqualError(t, err, "method 'broken' not found in protocol 'test.1.testp'")

	err = cli.BrokenProtocol()
	require.EqualError(t, err, "protocol not found: test.2.testp")
}

func TestNotify(t *testing.T) {
	cli, listener, conn := prepTest(t)
	defer endTest(t, conn, listener)

	pi := 31415

	err := cli.UpdateConstants(context.Background(), Constants{Pi: pi})
	require.Nil(t, err, "Unexpected error on notify: %v", err)

	constants, err := cli.GetConstants(context.Background())
	require.Nil(t, err, "Unexpected error on GetConstants: %v", err)
	require.Equal(t, pi, constants.Pi, "we set the constant properly via Notify")
}

func TestLongCall(t *testing.T) {
	cli, listener, conn := prepTest(t)
	defer endTest(t, conn, listener)

	longResult, err := cli.LongCall(context.Background())
	require.Nil(t, err, "call should have succeeded")
	require.Equal(t, longResult, 100, "call should have succeeded")
}

func TestLongCallCancel(t *testing.T) {
	cli, listener, conn := prepTest(t)
	defer endTest(t, conn, listener)

	ctx, cancel := context.WithCancel(context.Background())
	ctx = AddRpcTagsToContext(ctx, CtxRpcTags{"hello": []string{"world"}})

	resultCh := make(chan longCallResult)
	runInBg(func() error {
		var longResult interface{}
		var err error
		longResult, err = cli.LongCall(ctx)
		resultCh <- longCallResult{longResult, err}
		longResult, err = cli.LongCallResult(context.Background())
		resultCh <- longCallResult{longResult, err}
		longResult, err = cli.LongCallDebugTags(context.Background())
		resultCh <- longCallResult{longResult, err}
		return nil
	})
	// TODO figure out a way to avoid this sleep
	time.Sleep(time.Millisecond)
	cancel()
	res := <-resultCh
	require.EqualError(t, res.err, context.Canceled.Error())
	require.Equal(t, 0, res.res, "call should be canceled")

	res = <-resultCh
	require.Nil(t, res.err, "call should have succeeded")
	require.Equal(t, -1, res.res, "canceled call should have set the longCallResult to canceled")

	res = <-resultCh
	require.Nil(t, res.err, "call should have succeeded")
	require.Equal(t, CtxRpcTags{"hello": []interface{}{"world"}}, res.res, "canceled call should have set the debug tags")
}

func TestClosedConnection(t *testing.T) {
	cli, listener, conn := prepTest(t)
	defer endTest(t, conn, listener)

	resultCh := make(chan longCallResult)
	runInBg(func() error {
		var longResult interface{}
		var err error
		longResult, err = cli.LongCall(context.Background())
		resultCh <- longCallResult{longResult, err}
		return nil
	})
	// TODO figure out a way to avoid this sleep
	time.Sleep(time.Millisecond)
	conn.Close()
	res := <-resultCh
	require.EqualError(t, res.err, io.EOF.Error())
	require.Equal(t, 0, res.res)
}
