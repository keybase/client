package rpc

import (
	"io"
	"net"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func dispatchTestCallWithContext(t *testing.T, ctx context.Context) (dispatcher, *callContainer, chan error) {
	conn1, conn2 := net.Pipe()
	dispatchOut := newFramedMsgpackEncoder(conn1)
	calls := newCallContainer()
	pkt := newPacketHandler(conn2, createMessageTestProtocol(), calls)

	logFactory := NewSimpleLogFactory(SimpleLogOutput{}, SimpleLogOptions{})
	d := newDispatch(dispatchOut, calls, logFactory.NewLog(nil))

	done := runInBg(func() error {
		return d.Call(ctx, "abc.hello", new(interface{}), new(interface{}), nil)
	})

	// Necessary to ensure the call is far enough along to
	// be ready to respond
	_, decoderErr := pkt.NextFrame()
	require.Nil(t, decoderErr, "Expected no error")
	return d, calls, done
}

func dispatchTestCall(t *testing.T) (dispatcher, *callContainer, chan error) {
	return dispatchTestCallWithContext(t, context.Background())
}

func sendResponse(c *call, err error) {
	c.resultCh <- &rpcResponseMessage{
		err: err,
		c:   c,
	}
}

func TestDispatchSuccessfulCall(t *testing.T) {
	d, calls, done := dispatchTestCall(t)

	c := calls.RetrieveCall(0)
	require.NotNil(t, c, "Expected c not to be nil")

	sendResponse(c, nil)
	err := <-done
	require.Nil(t, err, "Expected no error")

	d.Close()
}

func TestDispatchCanceledBeforeResult(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	d, calls, done := dispatchTestCallWithContext(t, ctx)

	c := calls.RetrieveCall(0)
	require.NotNil(t, c, "Expected c not to be nil")

	cancel()

	// Should not hang.
	sendResponse(c, nil)

	err := <-done
	require.True(t, err == nil || err == context.Canceled,
		"Expected call to complete successfully or be cancelled")

	require.Nil(t, calls.RetrieveCall(0),
		"Expected call to be removed from the container")

	d.Close()
}

func TestDispatchCanceledAfterResult(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	d, calls, done := dispatchTestCallWithContext(t, ctx)

	c := calls.RetrieveCall(0)
	require.NotNil(t, c, "Expected c not to be nil")

	sendResponse(c, nil)

	cancel()

	err := <-done
	require.True(t, err == nil || err == context.Canceled,
		"Expected call to complete successfully or be cancelled")

	require.Nil(t, calls.RetrieveCall(0),
		"Expected call to be removed from the container")

	d.Close()
}

func TestDispatchEOF(t *testing.T) {
	d, _, done := dispatchTestCall(t)

	d.Close()
	err := <-done
	require.Equal(t, io.EOF, err, "Expected EOF")
}

func TestDispatchCallAfterClose(t *testing.T) {
	d, calls, done := dispatchTestCall(t)

	c := calls.RetrieveCall(0)
	sendResponse(c, nil)

	err := <-done
	d.Close()

	done = runInBg(func() error {
		return d.Call(context.Background(), "whatever", new(interface{}), new(interface{}), nil)
	})
	err = <-done
	require.Equal(t, io.EOF, err)
}

func TestDispatchCancelEndToEnd(t *testing.T) {
	dispatchConn, _ := net.Pipe()
	logFactory := NewSimpleLogFactory(SimpleLogOutput{}, SimpleLogOptions{})
	enc := newFramedMsgpackEncoder(dispatchConn)
	cc := newCallContainer()
	d := newDispatch(enc, cc, logFactory.NewLog(nil))

	ctx1, cancel1 := context.WithCancel(context.Background())

	ch := make(chan error)
	go func() {
		err := d.Call(ctx1, "abc.hello", nil, new(interface{}), nil)
		ch <- err
	}()

	cancel1()
	err := <-ch
	require.Equal(t, err, context.Canceled)
}
