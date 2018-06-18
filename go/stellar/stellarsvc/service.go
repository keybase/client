package stellarsvc

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/stellar/go/amount"
)

type UISource interface {
	SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI
	IdentifyUI(g *libkb.GlobalContext, sessionID int) libkb.IdentifyUI
}

type Server struct {
	libkb.Contextified
	uiSource UISource
	remoter  remote.Remoter
}

func New(g *libkb.GlobalContext, uiSource UISource, remoter remote.Remoter) *Server {
	return &Server{
		Contextified: libkb.NewContextified(g),
		uiSource:     uiSource,
		remoter:      remoter,
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

type preambleArg struct {
	RpcName string
	// Pointer to the RPC's error return value.
	// Can be nil for RPCs that do not err.
	Err            *error
	RequireWallet  bool
	AllowLoggedOut bool
}

// Preamble
// Example usage:
//   ctx, err, fin := c.Preamble(...)
//   defer fin()
//   if err != nil { return err }
func (s *Server) Preamble(inCtx context.Context, opts preambleArg) (ctx context.Context, err error, fin func()) {
	ctx = s.logTag(inCtx)
	getFinalErr := func() error {
		if opts.Err == nil {
			return nil
		}
		return *opts.Err
	}
	fin = s.G().CTraceTimed(ctx, opts.RpcName, getFinalErr)
	if !opts.AllowLoggedOut {
		if err = s.assertLoggedIn(ctx); err != nil {
			return ctx, err, fin
		}
	}
	if opts.RequireWallet {
		s.G().Log.CDebugf(ctx, "wallet needed for %v", opts.RpcName)
		_, hasWallet, err := stellar.CreateWalletGated(ctx, s.G())
		if err != nil {
			return ctx, err, fin
		}
		if !hasWallet {
			return ctx, errors.New("logged-in user does not have a wallet"), fin
		}
	}
	return ctx, nil, fin
}

func (s *Server) BalancesLocal(ctx context.Context, accountID stellar1.AccountID) (ret []stellar1.Balance, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName: "BalancesLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return ret, err
	}

	return s.remoter.Balances(ctx, accountID)
}

func (s *Server) ImportSecretKeyLocal(ctx context.Context, arg stellar1.ImportSecretKeyLocalArg) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:       "ImportSecretKeyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	return stellar.ImportSecretKey(ctx, s.G(), arg.SecretKey, arg.MakePrimary, "")
}

func (s *Server) ExportSecretKeyLocal(ctx context.Context, accountID stellar1.AccountID) (res stellar1.SecretKey, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:       "ExportSecretKeyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	mctx := libkb.NewMetaContext(ctx, s.G())

	// Prompt for passphrase
	username := s.G().GetEnv().GetUsername().String()
	arg := libkb.DefaultPassphrasePromptArg(mctx, username)
	arg.Prompt = arg.Prompt + " to export Stellar secret keys"
	secretUI := s.uiSource.SecretUI(s.G(), 0)
	ppRes, err := secretUI.GetPassphrase(arg, nil)
	if err != nil {
		return res, err
	}
	_, err = libkb.VerifyPassphraseForLoggedInUser(mctx, ppRes.Passphrase)
	if err != nil {
		return res, err
	}
	return stellar.ExportSecretKey(ctx, s.G(), accountID)
}

func (s *Server) OwnAccountLocal(ctx context.Context, accountID stellar1.AccountID) (isOwn bool, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:       "ExportSecretKeyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return isOwn, err
	}

	return stellar.OwnAccount(ctx, s.G(), accountID)
}

func (s *Server) SendCLILocal(ctx context.Context, arg stellar1.SendCLILocalArg) (res stellar1.SendResultCLILocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:       "SendCLILocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	if !arg.Asset.IsNativeXLM() {
		return res, fmt.Errorf("sending non-XLM assets is not supported")
	}

	// make sure that the xlm amount is close to the display amount the
	// user thinks they are sending.
	if err = s.checkDisplayAmount(ctx, arg); err != nil {
		return res, err
	}

	displayBalance := stellar.DisplayBalance{
		Amount:   arg.DisplayAmount,
		Currency: arg.DisplayCurrency,
	}
	uis := libkb.UIs{
		IdentifyUI: s.uiSource.IdentifyUI(s.G(), 0),
	}
	m := libkb.NewMetaContext(ctx, s.G()).WithUIs(uis)

	sendRes, err := stellar.SendPayment(m, s.remoter, stellar.SendPaymentArg{
		From:           arg.FromAccountID,
		To:             stellarcommon.RecipientInput(arg.Recipient),
		Amount:         arg.Amount,
		DisplayBalance: displayBalance,
		SecretNote:     arg.Note,
		ForceRelay:     arg.ForceRelay,
		QuickReturn:    false,
		PublicMemo:     arg.PublicNote,
	})
	if err != nil {
		return res, err
	}
	return stellar1.SendResultCLILocal{
		KbTxID: sendRes.KbTxID,
		TxID:   sendRes.TxID,
	}, nil
}

func (s *Server) ClaimCLILocal(ctx context.Context, arg stellar1.ClaimCLILocalArg) (res stellar1.RelayClaimResult, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:       "ClaimCLILocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	var into stellar1.AccountID
	if arg.Into != nil {
		into = *arg.Into
	} else {
		// Default to claiming into the user's primary wallet.
		into, err = stellar.GetOwnPrimaryAccountID(ctx, s.G())
		if err != nil {
			return res, err
		}
	}
	return stellar.Claim(ctx, s.G(), s.remoter, arg.TxID, into, nil, nil)
}

func (s *Server) RecentPaymentsCLILocal(ctx context.Context, accountID *stellar1.AccountID) (res []stellar1.PaymentOrErrorCLILocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:       "RecentPaymentsCLILocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
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
	return stellar.RecentPaymentsCLILocal(ctx, s.G(), s.remoter, selectAccountID)
}

func (s *Server) PaymentDetailCLILocal(ctx context.Context, txID string) (res stellar1.PaymentCLILocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName: "PaymentDetailCLILocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	return stellar.PaymentDetailCLILocal(ctx, s.G(), s.remoter, txID)
}

// WalletInitLocal creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe to call even if the user has a bundle already.
func (s *Server) WalletInitLocal(ctx context.Context) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName: "WalletInitLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}

	_, err = stellar.CreateWallet(ctx, s.G())
	return err
}

func (s *Server) SetDisplayCurrency(ctx context.Context, arg stellar1.SetDisplayCurrencyArg) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:       fmt.Sprintf("SetDisplayCurrency(%s, %s)", arg.AccountID, arg.Currency),
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	return remote.SetAccountDefaultCurrency(ctx, s.G(), arg.AccountID, arg.Currency)
}

type exchangeRateMap map[string]stellar1.OutsideExchangeRate

const defaultOutsideCurrency = "USD"

// getLocalCurrencyAndExchangeRate gets display currency setting
// for accountID and fetches exchange rate is set.
//
// Arguments `account` and `exchangeRates` may end up mutated.
func getLocalCurrencyAndExchangeRate(ctx context.Context, g *libkb.GlobalContext, account *stellar1.OwnAccountCLILocal, exchangeRates exchangeRateMap) error {
	displayCurrency, err := remote.GetAccountDisplayCurrency(ctx, g, account.AccountID)
	if err != nil {
		return err
	}
	if displayCurrency == "" {
		displayCurrency = defaultOutsideCurrency
		g.Log.CDebugf(ctx, "Using default display currency %s for account %s",
			displayCurrency, account.AccountID)
	}
	rate, ok := exchangeRates[displayCurrency]
	if !ok {
		var err error
		rate, err = remote.ExchangeRate(ctx, g, displayCurrency)
		if err != nil {
			return err
		}
		exchangeRates[displayCurrency] = rate
	}
	account.ExchangeRate = &rate
	return nil
}

func (s *Server) WalletGetAccountsCLILocal(ctx context.Context) (ret []stellar1.OwnAccountCLILocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:       "WalletGetAccountsCLILocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return ret, err
	}

	currentBundle, _, err := remote.Fetch(ctx, s.G())
	if err != nil {
		return nil, err
	}

	var accountError error
	exchangeRates := make(exchangeRateMap)
	for _, account := range currentBundle.Accounts {
		accID := account.AccountID
		acc := stellar1.OwnAccountCLILocal{
			AccountID: accID,
			IsPrimary: account.IsPrimary,
			Name:      account.Name,
		}

		balances, err := s.remoter.Balances(ctx, accID)
		if err != nil {
			accountError = err
			s.G().Log.Warning("Could not load balance for %q", accID)
			continue
		}

		acc.Balance = balances

		if err := getLocalCurrencyAndExchangeRate(ctx, s.G(), &acc, exchangeRates); err != nil {
			s.G().Log.Warning("Could not load local currency exchange rate for %q", accID)
		}

		ret = append(ret, acc)
	}

	// Put the primary account first
	sort.SliceStable(ret, func(i, j int) bool {
		if ret[i].IsPrimary {
			return true
		}
		if ret[j].IsPrimary {
			return false
		}
		return i < j
	})

	return ret, accountError
}

func (s *Server) ExchangeRateLocal(ctx context.Context, currency stellar1.OutsideCurrencyCode) (res stellar1.OutsideExchangeRate, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:        fmt.Sprintf("ExchangeRateLocal(%s)", string(currency)),
		Err:            &err,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	return remote.ExchangeRate(ctx, s.G(), string(currency))
}

func (s *Server) GetAvailableLocalCurrencies(ctx context.Context) (ret map[stellar1.OutsideCurrencyCode]stellar1.OutsideCurrencyDefinition, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:        "GetAvailableLocalCurrencies",
		Err:            &err,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return ret, err
	}

	conf, err := s.G().GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return ret, err
	}
	return conf.Currencies, nil
}

func (s *Server) FormatLocalCurrencyString(ctx context.Context, arg stellar1.FormatLocalCurrencyStringArg) (res string, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RpcName:        "FormatLocalCurrencyString",
		Err:            &err,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	return stellar.FormatCurrency(ctx, s.G(), arg.Amount, arg.Code)
}

// check that the display amount is within 1% of current exchange rates
func (s *Server) checkDisplayAmount(ctx context.Context, arg stellar1.SendCLILocalArg) error {
	if arg.DisplayAmount == "" {
		return nil
	}

	exchangeRate, err := s.remoter.ExchangeRate(ctx, arg.DisplayCurrency)
	if err != nil {
		return err
	}

	xlmAmount, err := stellar.ConvertOutsideToXLM(arg.DisplayAmount, exchangeRate)
	if err != nil {
		return err
	}

	currentAmt, err := amount.ParseInt64(xlmAmount)
	if err != nil {
		return err
	}

	argAmt, err := amount.ParseInt64(arg.Amount)
	if err != nil {
		return err
	}

	if percentageAmountChange(currentAmt, argAmt) > 1.0 {
		s.G().Log.CDebugf(ctx, "large exchange rate delta: argAmt: %d, currentAmt: %d", argAmt, currentAmt)
		return errors.New("current exchange rates have changed more than 1%")
	}

	return nil
}

func (s *Server) mctx(ctx context.Context) libkb.MetaContext {
	return libkb.NewMetaContext(ctx, s.G())
}

func percentageAmountChange(a, b int64) float64 {
	if a == 0 && b == 0 {
		return 0.0
	}
	mid := 0.5 * float64(a+b)
	return math.Abs(100.0 * float64(a-b) / mid)
}
