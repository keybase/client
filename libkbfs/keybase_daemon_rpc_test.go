package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

type blockingClient struct {
	ctlChan chan struct{}
}

var _ keybase1.GenericClient = blockingClient{}

func (b blockingClient) Call(ctx context.Context, s string, args interface{},
	res interface{}) error {
	// Say we're ready, and wait for the signal to proceed.
	b.ctlChan <- struct{}{}
	<-b.ctlChan
	return nil
}

func newKeybaseDaemonRPCWithFakeClient(t *testing.T) (
	KeybaseDaemonRPC, chan struct{}) {
	ctlChan := make(chan struct{})
	c := newKeybaseDaemonRPCWithClient(
		cancelableClient{blockingClient{ctlChan}},
		logger.NewTestLogger(t))
	return c, ctlChan
}

// If we cancel the RPC before the RPC returns, the call should error quickly.
func TestKeybaseDaemonRPCIdentifyCanceled(t *testing.T) {
	c, ctlChan := newKeybaseDaemonRPCWithFakeClient(t)
	f := func(ctx context.Context) error {
		_, err := c.Identify(ctx, "")
		return err
	}
	testWithCanceledContext(t, context.Background(), ctlChan, ctlChan, f)
}

// If we cancel the RPC before the RPC returns, the call should error quickly.
func TestKBPKIClientGetCurrentCryptPublicKeyCanceled(t *testing.T) {
	c, ctlChan := newKeybaseDaemonRPCWithFakeClient(t)
	f := func(ctx context.Context) error {
		_, err := c.CurrentSession(ctx, 0)
		return err
	}
	testWithCanceledContext(t, context.Background(), ctlChan, ctlChan, f)
}

// TODO: Add tests for Favorite* methods, too.
