// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func newChangeArg(newPassphrase string, force bool) keybase1.PassphraseChangeArg {
	return keybase1.PassphraseChangeArg{
		Passphrase: newPassphrase,
		Force:      force,
	}
}

func passphraseChange(g *libkb.GlobalContext, arg keybase1.PassphraseChangeArg) error {
	cli, err := GetAccountClient(g)
	if err != nil {
		return err
	}
	protocols := []rpc.Protocol{
		NewSecretUIProtocol(g),
	}
	if err := RegisterProtocolsWithContext(protocols, g); err != nil {
		return err
	}
	return cli.PassphraseChange(context.TODO(), arg)
}

func hasServerKeys(g *libkb.GlobalContext) (res keybase1.HasServerKeysRes, err error) {
	cli, err := GetAccountClient(g)
	if err != nil {
		return res, err
	}
	return cli.HasServerKeys(context.TODO(), 0 /* SessionID */)
}
