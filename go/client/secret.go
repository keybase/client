// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type SecretUIServer struct {
	eng libkb.SecretUI
}

func NewSecretUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.SecretUiProtocol(&SecretUIServer{g.UI.GetSecretUI()})
}

func (s *SecretUIServer) GetPassphrase(_ context.Context, arg keybase1.GetPassphraseArg) (keybase1.GetPassphraseRes, error) {
	return s.eng.GetPassphrase(arg.Pinentry, arg.Terminal)
}
