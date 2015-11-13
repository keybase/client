// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type SecretUIServer struct {
	eng libkb.SecretUI
}

func NewSecretUIProtocol(g *libkb.GlobalContext) rpc.Protocol {
	return keybase1.SecretUiProtocol(&SecretUIServer{g.UI.GetSecretUI()})
}

func (s *SecretUIServer) GetSecret(_ context.Context, arg keybase1.GetSecretArg) (res keybase1.SecretEntryRes, err error) {
	var resp *keybase1.SecretEntryRes
	resp, err = s.eng.GetSecret(arg.Pinentry, arg.Terminal)
	if resp != nil {
		res = *resp
	}
	return
}

func (s *SecretUIServer) GetNewPassphrase(_ context.Context, arg keybase1.GetNewPassphraseArg) (keybase1.GetPassphraseRes, error) {
	return s.eng.GetNewPassphrase(arg)
}

func (s *SecretUIServer) GetKeybasePassphrase(_ context.Context, arg keybase1.GetKeybasePassphraseArg) (keybase1.GetPassphraseRes, error) {
	return s.eng.GetKeybasePassphrase(arg)
}

func (s *SecretUIServer) GetPaperKeyPassphrase(_ context.Context, arg keybase1.GetPaperKeyPassphraseArg) (string, error) {
	return s.eng.GetPaperKeyPassphrase(arg)
}

func (s *SecretUIServer) GetPassphrase(_ context.Context, arg keybase1.GetPassphraseArg) (keybase1.GetPassphraseRes, error) {
	return s.eng.GetPassphrase(arg.Pinentry, arg.Terminal)
}
