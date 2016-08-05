// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/service"
	"github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/kbfs/fsrpc"
	"github.com/keybase/kbfs/libkbfs"
)

// kbfsServiceHandler provides keybase services to KBFS
type kbfsServiceProvider struct {
	*libkbfs.KeybaseServiceBase
	ctx *libkb.GlobalContext
	ui  *ui
}

func newServiceProvider(kbCtx *libkb.GlobalContext, config libkbfs.Config, log logger.Logger) libkbfs.KeybaseService {
	ksp := &kbfsServiceProvider{
		KeybaseServiceBase: libkbfs.NewKeybaseServiceBase(config, kbCtx, log),
		ctx:                kbCtx,
		ui:                 newUI(kbCtx),
	}

	ksp.FillClients(
		service.NewIdentifyHandler(kbCtx, ksp.ui),
		service.NewUserHandler(kbCtx, ksp.ui),
		service.NewSessionHandler(kbCtx),
		service.NewFavoriteHandler(kbCtx, ksp.ui),
		service.NewKBFSHandler(kbCtx),
	)

	return ksp
}

func (*kbfsServiceProvider) Shutdown() {
	// No resources to cleanup
}

// newServiceRPCProvider returns an RPC based service provider
func newServiceRPCProvider(kbCtx *libkb.GlobalContext, config libkbfs.Config, log logger.Logger) libkbfs.KeybaseService {
	keybaseService := libkbfs.NewKeybaseDaemonRPC(config, kbCtx, log, true)
	keybaseService.AddProtocols([]rpc.Protocol{
		keybase1.FsProtocol(fsrpc.NewFS(config, log)),
	})
	return keybaseService
}
