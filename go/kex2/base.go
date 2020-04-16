// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kex2

import (
	"errors"
	"net"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type LogContext interface {
	Debug(format string, args ...interface{})
}

type baseDevice struct {
	conn         net.Conn        //nolint
	xp           rpc.Transporter //nolint
	deviceID     DeviceID        //nolint
	start        chan struct{}
	stopOnce     sync.Once
	stopCh       chan struct{}
	serverDoneCh <-chan struct{}
}

// KexBaseArg are arguments common to both Provisioner and Provisionee
type KexBaseArg struct {
	Ctx           context.Context
	LogCtx        LogContext
	Mr            MessageRouter
	Secret        Secret
	DeviceID      keybase1.DeviceID // For now, this deviceID is different from the one in the transport
	SecretChannel <-chan Secret
	Timeout       time.Duration
}

// ErrCanceled is returned if Kex is canceled by the caller via the Context argument
var ErrCanceled = errors.New("kex canceled by caller")

// closeConnectionAndWaitForShutdown ignores any errors in closing the connection
func (b *baseDevice) closeConnectionAndWaitForShutdown() {
	_ = b.closeConnection()
	// wait for the server to shutdown
	if b.serverDoneCh != nil {
		<-b.serverDoneCh
	}
	b.stopOnce.Do(func() {
		close(b.stopCh)
	})
}

func (b *baseDevice) closeConnection() (err error) {
	// close the connection
	if b.conn != nil {
		err = b.conn.Close()
	}
	if b.xp != nil {
		b.xp.CloseBlocking()
	}
	return err
}
