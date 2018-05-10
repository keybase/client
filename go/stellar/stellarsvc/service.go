package stellarsvc

import (
	"context"
	"fmt"
	"sort"

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

func (s *Server) BalancesLocal(ctx context.Context, accountID stellar1.AccountID) (ret []stellar1.Balance, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "BalancesLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return nil, err
	}

	return s.remoter.Balances(ctx, accountID)
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

func (s *Server) ExportSecretKeyLocal(ctx context.Context, accountID stellar1.AccountID) (res stellar1.SecretKey, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "ExportSecretKeyLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return res, err
	}

	// Prompt for passphrase
	username := s.G().GetEnv().GetUsername().String()
	arg := libkb.DefaultPassphrasePromptArg(s.G(), username)
	arg.Prompt = arg.Prompt + " to export Stellar secret keys"
	secretUI := s.uiSource.SecretUI(s.G(), 0)
	ppRes, err := secretUI.GetPassphrase(arg, nil)
	if err != nil {
		return res, err
	}
	pwdOk := false
	_, err = s.G().LoginState().VerifyPlaintextPassphrase(ppRes.Passphrase, func(lctx libkb.LoginContext) error {
		pwdOk = true
		return nil
	})
	if err != nil {
		return res, err
	}
	if !pwdOk {
		return res, libkb.PassphraseError{}
	}

	return stellar.ExportSecretKey(ctx, s.G(), accountID)
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
	if !arg.Asset.IsNativeXLM() {
		return stellar1.PaymentResult{}, fmt.Errorf("sending non-XLM assets is not supported")
	}
	return stellar.SendPayment(ctx, s.G(), s.remoter, stellar.RecipientInput(arg.Recipient), arg.Amount, arg.Note)
}

func (s *Server) RecentPaymentsCLILocal(ctx context.Context, accountID *stellar1.AccountID) (res []stellar1.PaymentCLILocal, err error) {
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
	return stellar.RecentPaymentsCLILocal(ctx, s.G(), s.remoter, selectAccountID)
}

func (s *Server) PaymentDetailCLILocal(ctx context.Context, txID string) (res stellar1.PaymentCLILocal, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "PaymentDetailCLILocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	return stellar.PaymentDetailCLILocal(ctx, s.G(), s.remoter, txID)
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

func (s *Server) SetDisplayCurrency(ctx context.Context, arg stellar1.SetDisplayCurrencyArg) (err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("SetDisplayCurrency(%s, %s)", arg.AccountID, arg.Currency),
		func() error { return err })()

	if err := s.assertLoggedIn(ctx); err != nil {
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
func getLocalCurrencyAndExchangeRate(ctx context.Context, g *libkb.GlobalContext, account *stellar1.LocalOwnAccount, exchangeRates exchangeRateMap) error {
	displayCurrency, err := remote.GetAccountDisplayCurrency(ctx, g, account.AccountID)
	if err != nil {
		return err
	}
	if displayCurrency == "" {
		displayCurrency = defaultOutsideCurrency
		g.Log.CDebugf(ctx, "Setting default display currency %s for account %s",
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

func (s *Server) WalletGetLocalAccounts(ctx context.Context) (ret []stellar1.LocalOwnAccount, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "WalletGetLocalAccounts", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return nil, err
	}

	dump, _, err := remote.Fetch(ctx, s.G())
	if err != nil {
		return nil, err
	}

	var accountError error
	exchangeRates := make(exchangeRateMap)
	for _, account := range dump.Accounts {
		accID := account.AccountID
		acc := stellar1.LocalOwnAccount{
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
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, fmt.Sprintf("ExchangeRateLocal(%s)", string(currency)), func() error { return err })()
	return remote.ExchangeRate(ctx, s.G(), string(currency))
}

func (s *Server) GetAvailableLocalCurrencies(ctx context.Context) (ret map[stellar1.OutsideCurrencyCode]stellar1.OutsideCurrencyDefinition, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "GetAvailableCurrencies", func() error { return err })()

	conf, err := s.G().GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return ret, err
	}

	return conf.Currencies, nil
}

func (s *Server) FormatLocalCurrencyString(ctx context.Context, arg stellar1.FormatLocalCurrencyStringArg) (res string, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "FormatCurrencyString", func() error { return err })()

	res = arg.Amount
	conf, err := s.G().GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return res, err
	}

	currency, ok := conf.Currencies[arg.Code]
	if !ok {
		return res, fmt.Errorf("Could not find currency %q", arg.Code)
	}

	if currency.Symbol.Postfix {
		res = fmt.Sprintf("%s %s", arg.Amount, currency.Symbol.Symbol)
	} else {
		res = fmt.Sprintf("%s%s", currency.Symbol.Symbol, arg.Amount)
	}

	return res, nil
}
