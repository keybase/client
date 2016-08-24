// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kex2

import (
	"errors"
	"net"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type baseDevice struct {
	conn     net.Conn
	xp       rpc.Transporter
	deviceID DeviceID
	start    chan struct{}
	canceled bool
}

// KexBaseArg are arguments common to both Provisioner and Provisionee
type KexBaseArg struct {
	Ctx           context.Context
	Mr            MessageRouter
	Secret        Secret
	DeviceID      keybase1.DeviceID // For now, this deviceID is different from the one in the transport
	SecretChannel <-chan Secret
	Timeout       time.Duration
}

// ErrCanceled is returned if Kex is canceled by the caller via the Context argument
var ErrCanceled = errors.New("kex canceled by caller")
