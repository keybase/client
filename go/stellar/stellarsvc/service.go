// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package stellarsvc

import (
	"context"
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
)

type UISource interface {
	SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI
}

type Server struct {
	libkb.Contextified
	uiSource UISource
}

func New(g *libkb.GlobalContext, uiSource UISource) *Server {
	return &Server{
		Contextified: libkb.NewContextified(g),
		uiSource:     uiSource,
	}
}

func (s *Server) assertLoggedIn(mctx libkb.MetaContext) error {
	loggedIn := mctx.ActiveDevice().Valid()
	if !loggedIn {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func (s *Server) logTag(ctx context.Context) context.Context {
	return libkb.WithLogTag(ctx, "WA")
}

type preambleArg struct {
	RPCName string
	// Pointer to the RPC's error return value.
	// Can be nil for RPCs that do not err.
	Err           *error
	RequireWallet bool
}

// Preamble
// Example usage:
//
//	ctx, err, fin := c.Preamble(...)
//	defer fin()
//	if err != nil { return err }
func (s *Server) Preamble(inCtx context.Context, opts preambleArg) (mctx libkb.MetaContext, fin func(), err error) {
	mctx = libkb.NewMetaContext(s.logTag(inCtx), s.G())
	fin = mctx.Trace("LRPC "+opts.RPCName, opts.Err)

	if err = s.assertLoggedIn(mctx); err != nil {
		return mctx, fin, err
	}

	if opts.RequireWallet {
		cwg, err := stellar.CreateWalletGated(mctx)
		if err != nil {
			return mctx, fin, err
		}
		if !cwg.HasWallet {
			if !cwg.AcceptedDisclaimer {
				// Synthesize an AppStatusError so the CLI and GUI can match on these errors.
				err = libkb.NewAppStatusError(&libkb.AppStatus{
					Code: libkb.SCStellarNeedDisclaimer,
					Name: "STELLAR_NEED_DISCLAIMER",
					Desc: "user hasn't yet accepted the Stellar disclaimer",
				})
				return mctx, fin, err
			}
			return mctx, fin, errors.New("logged-in user does not have a wallet")
		}
	}

	return mctx, fin, nil
}

func (s *Server) ExportSecretKeyLocal(ctx context.Context, accountID stellar1.AccountID) (res stellar1.SecretKey, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ExportSecretKeyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	// Prompt for passphrase
	username := s.G().GetEnv().GetUsername().String()
	arg := libkb.DefaultPassphrasePromptArg(mctx, username)
	arg.Prompt += " to export Stellar secret keys"
	secretUI := s.uiSource.SecretUI(s.G(), 0)
	ppRes, err := secretUI.GetPassphrase(arg, nil)
	if err != nil {
		return res, err
	}
	_, err = libkb.VerifyPassphraseForLoggedInUser(mctx, ppRes.Passphrase)
	if err != nil {
		return res, err
	}
	return stellar.ExportSecretKey(mctx, accountID)
}
