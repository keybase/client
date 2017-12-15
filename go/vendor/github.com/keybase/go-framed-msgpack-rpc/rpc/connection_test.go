package rpc

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/backoff"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

type unitTester struct {
	numConnects      int
	numConnectErrors int
	numDisconnects   int
	doneChan         chan bool
	errToThrow       error
	alwaysFail       bool
}

// HandlerName implements the ConnectionHandler interface.
func (unitTester) HandlerName() string {
	return "unitTester"
}

// OnConnect implements the ConnectionHandler interface.
func (ut *unitTester) OnConnect(context.Context, *Connection, GenericClient, *Server) error {
	ut.numConnects++
	return nil
}

// OnConnectError implements the ConnectionHandler interface.
func (ut *unitTester) OnConnectError(error, time.Duration) {
	ut.numConnectErrors++
}

// OnDoCommandError implements the ConnectionHandler interace
func (ut *unitTester) OnDoCommandError(error, time.Duration) {
}

// OnDisconnected implements the ConnectionHandler interface.
func (ut *unitTester) OnDisconnected(context.Context, DisconnectStatus) {
	ut.numDisconnects++
}

// ShouldRetry implements the ConnectionHandler interface.
func (ut *unitTester) ShouldRetry(name string, err error) bool {
	_, isThrottle := err.(throttleError)
	return isThrottle
}

var errCanceled = errors.New("Canceled!")

// ShouldRetryOnConnect implements the ConnectionHandler interface.
func (ut *unitTester) ShouldRetryOnConnect(err error) bool {
	return err != errCanceled
}

// Dial implements the ConnectionTransport interface.
func (ut *unitTester) Dial(ctx context.Context) (
	Transporter, error) {
	if ut.alwaysFail || ut.numConnectErrors == 0 {
		return nil, ut.errToThrow
	}
	return nil, nil
}

// IsConnected implements the ConnectionTransport interface.
func (ut *unitTester) IsConnected() bool {
	return ut.numConnects == 1
}

// Finalize implements the ConnectionTransport interface.
func (ut *unitTester) Finalize() {
	// Do this here so that we guarantee that conn.client is
	// non-nil, and therefore conn.IsConnected() before we're
	// done.
	ut.doneChan <- true
}

// Close implements the ConnectionTransport interface.
func (ut *unitTester) Close() {
}

// Did the test pass?
func (ut *unitTester) Err() error {
	if ut.numConnects != 1 {
		return fmt.Errorf("expected 1 connect, got: %d", ut.numConnects)
	}
	if ut.numConnectErrors != 1 {
		return fmt.Errorf("expected 1 connect error, got: %d", ut.numConnectErrors)
	}
	if ut.numDisconnects != 1 {
		return fmt.Errorf("expected 1 disconnected error, got: %d", ut.numDisconnects)
	}
	return nil
}

func (ut *unitTester) WaitForDoneOrBust(t *testing.T,
	timeout time.Duration, opName string) {
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-ut.doneChan:
		break
	case <-timer.C:
		t.Fatalf("%s timeout", opName)
	}
}

// Test a basic reconnect flow.
func TestReconnectBasic(t *testing.T) {
	unitTester := &unitTester{
		doneChan:   make(chan bool),
		errToThrow: errors.New("intentional error to trigger reconnect"),
	}
	output := testLogOutput{t}
	reconnectBackoffFn := func() backoff.BackOff {
		reconnectBackoff := backoff.NewExponentialBackOff()
		reconnectBackoff.InitialInterval = 5 * time.Millisecond
		return reconnectBackoff
	}
	opts := ConnectionOpts{
		WrapErrorFunc:    testWrapError,
		TagsFunc:         testLogTags,
		ReconnectBackoff: reconnectBackoffFn,
	}
	conn := NewConnectionWithTransport(unitTester, unitTester,
		testErrorUnwrapper{}, output, opts)

	// start connecting now
	conn.getReconnectChan()

	defer conn.Shutdown()
	timeout := time.After(2 * time.Second)
	select {
	case <-unitTester.doneChan:
		break
	case <-timeout:
		break
	}
	if err := unitTester.Err(); err != nil {
		t.Fatal(err)
	}
}

// Test a basic reconnect flow.
func TestForceReconnect(t *testing.T) {
	unitTester := &unitTester{
		doneChan:   make(chan bool),
		errToThrow: errors.New("intentional error to trigger reconnect"),
	}
	output := testLogOutput{t}
	reconnectBackoffFn := func() backoff.BackOff {
		reconnectBackoff := backoff.NewExponentialBackOff()
		reconnectBackoff.InitialInterval = 5 * time.Millisecond
		return reconnectBackoff
	}
	opts := ConnectionOpts{
		WrapErrorFunc:    testWrapError,
		TagsFunc:         testLogTags,
		ReconnectBackoff: reconnectBackoffFn,
	}
	conn := NewConnectionWithTransport(unitTester, unitTester,
		testErrorUnwrapper{}, output, opts)

	defer conn.Shutdown()
	unitTester.WaitForDoneOrBust(t, 2*time.Second, "initial connect")

	forceReconnectErrCh := make(chan error)
	go func() {
		forceReconnectErrCh <- conn.ForceReconnect(context.Background())
	}()
	unitTester.WaitForDoneOrBust(t, 2*time.Second, "initial connect")
	require.NoError(t, <-forceReconnectErrCh)
}

// Test when a user cancels a connection.
func TestReconnectCanceled(t *testing.T) {
	cancelErr := errCanceled
	unitTester := &unitTester{
		doneChan:   make(chan bool),
		errToThrow: cancelErr,
		alwaysFail: true,
	}
	output := testLogOutput{t}
	opts := ConnectionOpts{
		WrapErrorFunc: testWrapError,
		TagsFunc:      testLogTags,
	}
	conn := NewConnectionWithTransport(unitTester, unitTester,
		testErrorUnwrapper{}, output, opts)
	defer conn.Shutdown()
	// Test that any command fails with the expected error.
	err := conn.DoCommand(context.Background(), "test",
		func(GenericClient) error { return nil })
	if err != cancelErr {
		t.Fatalf("Error wasn't InputCanceled: %v", err)
	}
}

// Test DoCommand with throttling.
func TestDoCommandThrottle(t *testing.T) {
	unitTester := &unitTester{
		doneChan: make(chan bool),
	}

	throttleErr := errors.New("throttle")
	output := testLogOutput{t}
	commandBackoffFn := func() backoff.BackOff {
		commandBackoff := backoff.NewExponentialBackOff()
		commandBackoff.InitialInterval = 5 * time.Millisecond
		return commandBackoff
	}
	opts := ConnectionOpts{
		WrapErrorFunc:  testWrapError,
		TagsFunc:       testLogTags,
		CommandBackoff: commandBackoffFn,
	}
	conn := NewConnectionWithTransport(unitTester, unitTester,
		testErrorUnwrapper{}, output, opts)
	defer conn.Shutdown()
	<-unitTester.doneChan

	throttle := true
	ctx := context.Background()
	err := conn.DoCommand(ctx, "test", func(GenericClient) error {
		if throttle {
			throttle = false
			err, _ := conn.errorUnwrapper.UnwrapError(
				throttleError{Err: throttleErr}.ToStatus())
			return err
		}
		return nil
	})

	if err != nil {
		t.Fatal(err)
	}
}

func TestConnectionClientCallError(t *testing.T) {
	serverConn, conn := MakeConnectionForTest(t)
	defer conn.Shutdown()

	c := connectionClient{conn}
	errCh := make(chan error, 1)
	go func() {
		errCh <- c.Call(context.Background(), "callRpc", nil, nil)
	}()
	serverConn.Close()
	err := <-errCh
	require.Error(t, err)
}

func TestConnectionClientNotifyError(t *testing.T) {
	serverConn, conn := MakeConnectionForTest(t)
	defer conn.Shutdown()

	c := connectionClient{conn}
	errCh := make(chan error, 1)
	go func() {
		errCh <- c.Notify(context.Background(), "notifyRpc", nil)
	}()
	serverConn.Close()
	err := <-errCh
	require.Error(t, err)
}

func TestConnectionClientCallCancel(t *testing.T) {
	serverConn, conn := MakeConnectionForTest(t)
	defer conn.Shutdown()

	c := connectionClient{conn}
	errCh := make(chan error, 1)
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		errCh <- c.Call(ctx, "callRpc", nil, nil)
	}()

	// Wait for Call to make progress.
	n, err := serverConn.Read([]byte{1})
	require.Equal(t, n, 1)
	require.NoError(t, err)

	cancel()

	err = <-errCh
	require.Equal(t, err, ctx.Err())
}

func TestConnectionClientNotifyCancel(t *testing.T) {
	serverConn, conn := MakeConnectionForTest(t)
	defer conn.Shutdown()

	c := connectionClient{conn}
	errCh := make(chan error, 1)
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		errCh <- c.Notify(ctx, "notifyRpc", nil)
	}()

	// Wait for Notify to make progress.
	n, err := serverConn.Read([]byte{1})
	require.Equal(t, n, 1)
	require.NoError(t, err)

	cancel()

	err = <-errCh
	require.Equal(t, err, ctx.Err())
}
