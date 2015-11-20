package libkbfs

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type unitTester struct {
	numConnects      int
	numConnectErrors int
	numDisconnects   int
	doneChan         chan bool
}

// OnConnect implements the ConnectionHandler interface.
func (ut *unitTester) OnConnect(context.Context, *Connection, keybase1.GenericClient, *rpc.Server) error {
	ut.numConnects++
	ut.doneChan <- true
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
func (ut *unitTester) OnDisconnected() {
	ut.numDisconnects++
}

// ShouldThrottle implements the ConnectionHandler interface.
func (ut *unitTester) ShouldThrottle(err error) bool {
	_, isThrottle := err.(throttleError)
	return isThrottle
}

// Dial implements the ConnectionTransport interface.
func (ut *unitTester) Dial(ctx context.Context) (
	rpc.Transporter, error) {
	if ut.numConnectErrors == 0 {
		return nil, errors.New("intentional error to trigger reconnect")
	}
	return nil, nil
}

// IsConnected implements the ConnectionTransport interface.
func (ut *unitTester) IsConnected() bool {
	return ut.numConnects == 1
}

// Finalize implements the ConnectionTransport interface.
func (ut *unitTester) Finalize() {
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
	if ut.numDisconnects != 0 {
		return fmt.Errorf("expected no disconnected errors, got: %d", ut.numDisconnects)
	}
	return nil
}

// Test a basic reconnect flow.
func TestReconnectBasic(t *testing.T) {
	config := NewConfigLocal()
	unitTester := &unitTester{doneChan: make(chan bool)}
	conn := newConnectionWithTransport(config, unitTester, unitTester, libkb.ErrorUnwrapper{}, true)
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

type throttleError struct {
	Err error
}

func (e throttleError) ToStatus() (s keybase1.Status) {
	s.Code = 1
	s.Name = "THROTTLE"
	s.Desc = e.Err.Error()
	return
}

func (e throttleError) Error() string {
	return e.Err.Error()
}

type testErrorUnwrapper struct{}

var _ rpc.ErrorUnwrapper = testErrorUnwrapper{}

func (eu testErrorUnwrapper) MakeArg() interface{} {
	return &keybase1.Status{}
}

func (eu testErrorUnwrapper) UnwrapError(arg interface{}) (appError error, dispatchError error) {
	s, ok := arg.(*keybase1.Status)
	if !ok {
		return nil, errors.New("Error converting arg to keybase1.Status object")
	}
	if s == nil || s.Code == 0 {
		return nil, nil
	}

	switch s.Code {
	case 1:
		appError = throttleError{errors.New("throttle")}
		break
	default:
		panic("Unknown testing error")
	}
	return appError, nil
}

// Test DoCommand with throttling.
func TestDoCommandThrottle(t *testing.T) {
	config := NewConfigLocal()
	setTestLogger(config, t)
	unitTester := &unitTester{doneChan: make(chan bool)}

	throttleErr := errors.New("throttle")
	conn := newConnectionWithTransport(config, unitTester, unitTester, testErrorUnwrapper{}, true)
	defer conn.Shutdown()
	<-unitTester.doneChan

	throttle := true
	ctx := context.Background()
	err := conn.DoCommand(ctx, func(keybase1.GenericClient) error {
		if throttle {
			throttle = false
			err, _ := conn.errorUnwrapper.UnwrapError(libkb.WrapError(throttleError{Err: throttleErr}))
			return err
		}
		return nil
	})

	if err != nil {
		t.Fatal(err)
	}
}
