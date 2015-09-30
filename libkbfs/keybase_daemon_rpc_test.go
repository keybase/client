package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

type blockingIdentify struct {
	ctlChan chan struct{}
}

var _ keybase1.IdentifyInterface = blockingIdentify{}

func (b blockingIdentify) Identify(keybase1.IdentifyArg) (
	keybase1.IdentifyRes, error) {
	// Say we're ready, and wait for the signal to proceed.
	b.ctlChan <- struct{}{}
	<-b.ctlChan
	return keybase1.IdentifyRes{}, nil
}

type blockingSession struct {
	ctlChan chan struct{}
}

var _ keybase1.SessionInterface = blockingSession{}

func (b blockingSession) CurrentUID(int) (keybase1.UID, error) {
	// Say we're ready, and wait for the signal to proceed.
	b.ctlChan <- struct{}{}
	<-b.ctlChan
	return keybase1.UID(""), nil
}

func (b blockingSession) CurrentSession(int) (keybase1.Session, error) {
	// Say we're ready, and wait for the signal to proceed.
	b.ctlChan <- struct{}{}
	<-b.ctlChan
	return keybase1.Session{}, nil
}

func newKeybaseDaemonRPCWithFakeClient(t *testing.T) (
	KeybaseDaemonRPC, chan struct{}) {
	ctlChan := make(chan struct{})
	c := newKeybaseDaemonRPCWithInterfaces(
		blockingIdentify{ctlChan}, blockingSession{ctlChan}, nil,
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
