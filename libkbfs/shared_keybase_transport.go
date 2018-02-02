// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"sync"

	"github.com/keybase/backoff"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// NewSharedKeybaseConnection returns a connection that tries to
// connect to the local keybase daemon.
func NewSharedKeybaseConnection(kbCtx Context, config Config,
	handler rpc.ConnectionHandler) *rpc.Connection {
	transport := &SharedKeybaseTransport{kbCtx: kbCtx}
	constBackoff := backoff.NewConstantBackOff(RPCReconnectInterval)
	opts := rpc.ConnectionOpts{
		WrapErrorFunc:    libkb.WrapError,
		TagsFunc:         libkb.LogTagsFromContext,
		ReconnectBackoff: func() backoff.BackOff { return constBackoff },
	}
	return rpc.NewConnectionWithTransport(
		handler, transport, libkb.ErrorUnwrapper{},
		logger.LogOutputWithDepthAdder{Logger: config.MakeLogger("")}, opts)
}

// SharedKeybaseTransport is a ConnectionTransport implementation that
// uses a shared local socket to a keybase daemon.
type SharedKeybaseTransport struct {
	kbCtx Context

	// Protects everything below.
	mutex           sync.Mutex
	transport       rpc.Transporter
	stagedTransport rpc.Transporter
}

// Test that SharedKeybaseTransport fully implements the
// ConnectionTransport interface.
var _ rpc.ConnectionTransport = (*SharedKeybaseTransport)(nil)

// Dial is an implementation of the ConnectionTransport interface.
func (kt *SharedKeybaseTransport) Dial(ctx context.Context) (
	rpc.Transporter, error) {
	_, transport, _, err := kt.kbCtx.GetSocket(true)
	if err != nil {
		return nil, err
	}

	kt.mutex.Lock()
	defer kt.mutex.Unlock()
	kt.stagedTransport = transport
	return transport, nil
}

// IsConnected is an implementation of the ConnectionTransport interface.
func (kt *SharedKeybaseTransport) IsConnected() bool {
	kt.mutex.Lock()
	defer kt.mutex.Unlock()
	return kt.transport != nil && kt.transport.IsConnected()
}

// Finalize is an implementation of the ConnectionTransport interface.
func (kt *SharedKeybaseTransport) Finalize() {
	kt.mutex.Lock()
	defer kt.mutex.Unlock()
	kt.transport = kt.stagedTransport
	kt.stagedTransport = nil
}

// Close is an implementation of the ConnectionTransport interface.
func (kt *SharedKeybaseTransport) Close() {
	// Since this is a shared connection, do nothing.
}
