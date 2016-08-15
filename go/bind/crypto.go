// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/service"
	"github.com/keybase/kbfs/libkbfs"
)

type crypto struct {
	libkbfs.CryptoClient
}

func newCrypto(kbCtx *libkb.GlobalContext, config libkbfs.Config, log logger.Logger) libkbfs.Crypto {
	cryptoHandler := service.NewCryptoHandler(kbCtx)
	return &crypto{
		CryptoClient: *libkbfs.NewCryptoClient(config, cryptoHandler, log),
	}
}

func newCryptoRPC(kbCtx *libkb.GlobalContext, config libkbfs.Config, log logger.Logger) libkbfs.Crypto {
	return libkbfs.NewCryptoClientRPC(config, kbCtx)
}
