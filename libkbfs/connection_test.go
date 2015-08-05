package libkbfs

import (
	"errors"
	"fmt"
	"testing"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

type unitTester struct {
	numConnects      int
	numConnectErrors int
	doneChan         chan bool
}

// OnConnect implements the ConnectionHandler interface.
func (ut *unitTester) OnConnect(context.Context, *Connection, keybase1.GenericClient) error {
	ut.numConnects++
	ut.doneChan <- true
	return nil
}

// OnConnectError implements the ConnectionHandler interface.
func (ut *unitTester) OnConnectError(error, time.Duration) {
	ut.numConnectErrors++
}

// Dial implements the ConnectionTransport interface.
func (ut *unitTester) Dial(ctx context.Context, srvAddr string) (
	keybase1.GenericClient, error) {
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

// Did the test pass?
func (ut *unitTester) Err() error {
	if ut.numConnects != 1 {
		return fmt.Errorf("expected 1 connect, got: %d", ut.numConnects)
	}
	if ut.numConnectErrors != 1 {
		return fmt.Errorf("expected 1 connect error, got: %d", ut.numConnectErrors)
	}
	return nil
}

// Test a basic reconnect flow.
func TestReconnectBasic(t *testing.T) {
	ctx := context.Background()
	config := NewConfigLocal()
	unitTester := &unitTester{doneChan: make(chan bool)}
	conn := newConnectionWithTransport(ctx, config, "", unitTester, unitTester)
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
