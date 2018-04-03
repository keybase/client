package stellarsvc

import (
	"context"
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/remote"
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

func (s *Server) assertLoggedIn(ctx context.Context) error {
	loggedIn := s.G().ActiveDevice.Valid()
	if !loggedIn {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func (s *Server) logTag(ctx context.Context) context.Context {
	return libkb.WithLogTag(ctx, "WA")
}

func (s *Server) BalancesLocal(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	var err error
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "BalancesLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return nil, err
	}

	return remote.Balances(ctx, s.G(), accountID)
}

func (s *Server) ImportSecretKeyLocal(ctx context.Context, arg stellar1.ImportSecretKeyLocalArg) (err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "ImportSecretKeyLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return err
	}
	return stellar.ImportSecretKey(ctx, s.G(), arg.SecretKey, arg.MakePrimary)
}

func (s *Server) OwnAccountLocal(ctx context.Context, accountID stellar1.AccountID) (isOwn bool, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "OwnAccountLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return false, err
	}

	return stellar.OwnAccount(ctx, s.G(), accountID)
}

func (s *Server) SendLocal(ctx context.Context, arg stellar1.SendLocalArg) (stellar1.PaymentResult, error) {
	var err error
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "SendLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return stellar1.PaymentResult{}, err
	}

	return stellar.SendPayment(ctx, s.G(), stellar.RecipientInput(arg.Recipient), arg.Amount)
}

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

	// verify passphrase
	username := s.G().GetEnv().GetUsername().String()

	arg := libkb.DefaultPassphrasePromptArg(s.G(), username)
	secretUI := s.uiSource.SecretUI(s.G(), 0)
	res, err := secretUI.GetPassphrase(arg, nil)
	if err != nil {
		return dump, err
	}
	pwdOk := false
	_, err = s.G().LoginState().VerifyPlaintextPassphrase(res.Passphrase, func(lctx libkb.LoginContext) error {
		pwdOk = true

		return nil
	})
	if err != nil {
		return dump, err
	}
	if !pwdOk {
		return dump, libkb.PassphraseError{}
	}

	dump, _, err = remote.Fetch(ctx, s.G())

	return dump, err
}

// WalletInitLocal creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe to call even if the user has a bundle already.
func (s *Server) WalletInitLocal(ctx context.Context) (err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "WalletInitLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return err
	}
	_, err = stellar.CreateWallet(ctx, s.G())
	return err
}
