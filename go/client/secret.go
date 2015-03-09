package main

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type SecretUIServer struct {
	eng libkb.SecretUI
}

func NewSecretUIProtocol() rpc2.Protocol {
	return keybase_1.SecretUiProtocol(&SecretUIServer{G_UI.GetSecretUI()})
}

func (s *SecretUIServer) GetSecret(arg keybase_1.GetSecretArg) (res keybase_1.SecretEntryRes, err error) {
	var resp *keybase_1.SecretEntryRes
	resp, err = s.eng.GetSecret(arg.Pinentry, arg.Terminal)
	if resp != nil {
		res = *resp
	}
	return
}

func (s *SecretUIServer) GetNewPassphrase(arg keybase_1.GetNewPassphraseArg) (string, error) {
	return s.eng.GetNewPassphrase(arg)
}

func (s *SecretUIServer) GetKeybasePassphrase(arg keybase_1.GetKeybasePassphraseArg) (string, error) {
	return s.eng.GetKeybasePassphrase(arg)
}
