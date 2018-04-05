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

func (s *Server) RecentPaymentsCLILocal(ctx context.Context, accountID *stellar1.AccountID) (res []stellar1.RecentPaymentCLILocal, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "RecentPaymentsCLILocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return nil, err
	}
	var selectAccountID stellar1.AccountID
	if accountID == nil {
		selectAccountID, err = stellar.GetOwnPrimaryAccountID(ctx, s.G())
		if err != nil {
			return nil, err
		}
	} else {
		selectAccountID = *accountID
	}
	payments, err := remote.RecentPayments(ctx, s.G(), selectAccountID, 0)
	if err != nil {
		return nil, err
	}
	for _, x := range payments {
		y := stellar1.RecentPaymentCLILocal{
			StellarTxID: x.StellarTxID,
			Status:      "pending",
			Amount:      x.Amount,
			Asset:       x.Asset,
			FromStellar: x.From,
			ToStellar:   x.To,
		}
		if x.Stellar != nil {
			y.Status = "completed"
		}
		if x.Keybase != nil {
			y.Time = x.Keybase.Ctime
			switch x.Keybase.Status {
			case stellar1.TransactionStatus_PENDING:
				y.Status = "pending"
			case stellar1.TransactionStatus_SUCCESS:
				y.Status = "completed"
			case stellar1.TransactionStatus_ERROR_TRANSIENT:
				y.Status = "error"
				y.StatusDetail = x.Keybase.SubmitErrMsg
			case stellar1.TransactionStatus_ERROR_PERMANENT:
				y.Status = "error"
				y.StatusDetail = x.Keybase.SubmitErrMsg
			default:
				y.Status = "unknown"
				y.StatusDetail = x.Keybase.SubmitErrMsg
			}
			y.DisplayAmount = x.Keybase.DisplayAmount
			y.DisplayCurrency = x.Keybase.DisplayCurrency
			fromUsername, err := s.G().GetUPAKLoader().LookupUsername(ctx, x.Keybase.FromUID)
			if err == nil {
				tmp := fromUsername.String()
				y.FromUsername = &tmp
			}
			if x.Keybase.ToUID != nil {
				toUsername, err := s.G().GetUPAKLoader().LookupUsername(ctx, *x.Keybase.ToUID)
				if err == nil {
					tmp := toUsername.String()
					y.ToUsername = &tmp
				}
			}
		}
		if x.Stellar != nil {
			y.Time = x.Stellar.Ctime
		}
		res = append(res, y)
	}
	return res, nil
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
