// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// +build !production

package stellarsvc

import (
	"context"
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
)

func (s *Server) WalletDumpLocal(ctx context.Context) (dump stellar1.Bundle, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "WalletDumpLocal", func() error { return err })()
	if s.G().Env.GetRunMode() != libkb.DevelRunMode {
		return dump, errors.New("WalletDump only supported in devel run mode")
	}

	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "WalletDump", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return dump, err
	}
	mctx := libkb.NewMetaContext(ctx, s.G())

	// verify passphrase
	username := s.G().GetEnv().GetUsername().String()

	arg := libkb.DefaultPassphrasePromptArg(mctx, username)
	secretUI := s.uiSource.SecretUI(s.G(), 0)
	res, err := secretUI.GetPassphrase(arg, nil)
	if err != nil {
		return dump, err
	}
	_, err = libkb.VerifyPassphraseForLoggedInUser(mctx, res.Passphrase)
	if err != nil {
		return dump, err
	}
	dump, _, err = remote.Fetch(ctx, s.G())

	return dump, err
}
