// this file is for the implementation of the frontend-requested service
// endpoints for wallets.
package stellarsvc

import (
	"context"
	"errors"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
)

var ErrAccountIDMissing = errors.New("account id parameter missing")

func (s *Server) GetWalletAccountsLocal(ctx context.Context, sessionID int) (accts []stellar1.WalletAccountLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "GetWalletAccountsLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return nil, err
	}

	return stellar.AllWalletAccounts(mctx)
}

func (s *Server) HasAcceptedDisclaimerLocal(ctx context.Context, sessionID int) (accepted bool, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "HasAcceptedDisclaimerLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return false, err
	}

	return stellar.HasAcceptedDisclaimer(mctx.Ctx(), s.G())
}

func (s *Server) DeleteWalletAccountLocal(ctx context.Context, arg stellar1.DeleteWalletAccountLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "DeleteWalletAccountLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	if arg.UserAcknowledged != "yes" {
		return errors.New("User did not acknowledge")
	}

	if arg.AccountID.IsNil() {
		mctx.Debug("DeleteWalletAccountLocal called with an empty account id")
		return ErrAccountIDMissing
	}

	return stellar.DeleteAccount(mctx, arg.AccountID)
}

func (s *Server) GetWalletAccountSecretKeyLocal(ctx context.Context, arg stellar1.GetWalletAccountSecretKeyLocalArg) (res stellar1.SecretKey, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "GetWalletAccountSecretKeyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	if arg.AccountID.IsNil() {
		return res, ErrAccountIDMissing
	}
	return stellar.ExportSecretKey(mctx, arg.AccountID)
}
