// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"time"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// CryptoClientRPC is an RPC based implementation for Crypto.
type CryptoClientRPC struct {
	CryptoClient
	config Config
}

var _ rpc.ConnectionHandler = (*CryptoClientRPC)(nil)

// NewCryptoClientRPC constructs a new RPC based Crypto implementation.
func NewCryptoClientRPC(config Config, kbCtx Context) *CryptoClientRPC {
	log := config.MakeLogger("")
	deferLog := log.CloneWithAddedDepth(1)
	c := &CryptoClientRPC{
		CryptoClient: CryptoClient{
			CryptoCommon: MakeCryptoCommon(config.Codec(), config),
			log:          log,
			deferLog:     deferLog,
		},
		config: config,
	}
	conn := NewSharedKeybaseConnection(kbCtx, config, c)
	c.CryptoClient.client = keybase1.CryptoClient{Cli: conn.GetClient()}
	c.CryptoClient.teamsClient = keybase1.TeamsClient{Cli: conn.GetClient()}
	c.CryptoClient.shutdownFn = conn.Shutdown
	return c
}

// newCryptoClientWithClient should only be used for testing.
func newCryptoClientWithClient(codec kbfscodec.Codec, log logger.Logger, client rpc.GenericClient) *CryptoClientRPC {
	deferLog := log.CloneWithAddedDepth(1)
	return &CryptoClientRPC{
		CryptoClient: CryptoClient{
			CryptoCommon: MakeCryptoCommon(codec, nil),
			log:          log,
			deferLog:     deferLog,
			client:       keybase1.CryptoClient{Cli: client},
			teamsClient:  keybase1.TeamsClient{Cli: client},
		},
	}
}

// HandlerName implements the ConnectionHandler interface.
func (CryptoClientRPC) HandlerName() string {
	return "CryptoClient"
}

// OnConnect implements the ConnectionHandler interface.
func (c *CryptoClientRPC) OnConnect(ctx context.Context, conn *rpc.Connection,
	_ rpc.GenericClient, server *rpc.Server) error {
	c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, nil)
	return nil
}

// OnConnectError implements the ConnectionHandler interface.
func (c *CryptoClientRPC) OnConnectError(err error, wait time.Duration) {
	c.log.Warning("CryptoClient: connection error: %q; retrying in %s",
		err, wait)
	c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, err)
}

// OnDoCommandError implements the ConnectionHandler interface.
func (c *CryptoClientRPC) OnDoCommandError(err error, wait time.Duration) {
	c.log.Warning("CryptoClient: docommand error: %q; retrying in %s",
		err, wait)
	c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, err)
}

// OnDisconnected implements the ConnectionHandler interface.
func (c *CryptoClientRPC) OnDisconnected(_ context.Context,
	status rpc.DisconnectStatus) {
	if status == rpc.StartingNonFirstConnection {
		c.log.Warning("CryptoClient is disconnected")
		c.config.KBFSOps().PushConnectionStatusChange(KeybaseServiceName, errDisconnected{})
	}
}

// ShouldRetry implements the ConnectionHandler interface.
func (c *CryptoClientRPC) ShouldRetry(rpcName string, err error) bool {
	return false
}

// ShouldRetryOnConnect implements the ConnectionHandler interface.
func (c *CryptoClientRPC) ShouldRetryOnConnect(err error) bool {
	_, inputCanceled := err.(libkb.InputCanceledError)
	return !inputCanceled
}
