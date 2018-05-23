// this file is for the implementation of all the frontend-requested service
// endpoints for wallets.
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

const WorthCurrencyErrorCode = "ERR"

func (s *Server) GetWalletAccountsLocal(ctx context.Context, sessionID int) (accts []stellar1.WalletAccountLocal, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "GetWalletAccountsLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return nil, err
	}

	bundle, _, err := remote.Fetch(ctx, s.G())
	if err != nil {
		return nil, err
	}

	for _, account := range bundle.Accounts {
		acct := stellar1.WalletAccountLocal{
			AccountID: account.AccountID,
			IsDefault: account.IsPrimary,
			Name:      account.Name,
		}

		balances, err := s.remoter.Balances(ctx, acct.AccountID)
		if err != nil {
			s.G().Log.CDebugf(ctx, "remote.Balances failed for %q: %s", acct.AccountID, err)
			return nil, err
		}
		acct.BalanceDescription, err = balanceList(balances).nativeBalanceDescription()
		if err != nil {
			return nil, err
		}

		accts = append(accts, acct)
	}

	// Put the primary account first, sort by name everything else
	sort.SliceStable(accts, func(i, j int) bool {
		if accts[i].IsDefault {
			return true
		}
		if accts[j].IsDefault {
			return false
		}
		return accts[i].Name < accts[j].Name
	})

	return accts, nil
}

func (s *Server) GetAccountAssetsLocal(ctx context.Context, arg stellar1.GetAccountAssetsLocalArg) (assets []stellar1.AccountAssetLocal, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "GetAccountAssetsLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return nil, err
	}

	details, err := s.remoter.Details(ctx, arg.AccountID)
	if err != nil {
		s.G().Log.CDebugf(ctx, "remote.Details failed for %q: %s", arg.AccountID, err)
		return nil, err
	}

	if len(details.Balances) == 0 {
		// add an empty xlm balance
		details.Balances = []stellar1.Balance{
			stellar1.Balance{
				Amount: "0",
				Asset:  stellar1.Asset{Type: "native"},
			},
		}
	}

	displayCurrency, err := s.remoter.GetAccountDisplayCurrency(ctx, arg.AccountID)
	if err != nil {
		return nil, err
	}
	if displayCurrency == "" {
		displayCurrency = defaultOutsideCurrency
		s.G().Log.CDebugf(ctx, "Using default display currency %s for account %s", displayCurrency, arg.AccountID)
	}
	rate, rateErr := s.remoter.ExchangeRate(ctx, displayCurrency)
	if err != nil {
		s.G().Log.CDebugf(ctx, "exchange rate error: %s", rateErr)
	}

	for _, d := range details.Balances {
		// M1 only supports native balances
		if d.Asset.Type != "native" {
			continue
		}

		fmtAmount, err := stellar.FormatAmount(d.Amount, false)
		if err != nil {
			s.G().Log.CDebugf(ctx, "FormatAmount error: %s", err)
			return nil, err
		}
		asset := stellar1.AccountAssetLocal{
			Name:         d.Asset.Type,
			BalanceTotal: fmtAmount,
			AssetCode:    d.Asset.Code,
			Issuer:       d.Asset.Issuer,
		}

		if d.Asset.Type == "native" {
			asset.Name = "Lumens"
			asset.AssetCode = "XLM"
			asset.Issuer = "Stellar"
			fmtAvailable, err := stellar.FormatAmount(details.Available, false)
			if err != nil {
				return nil, err
			}
			asset.BalanceAvailableToSend = fmtAvailable
			asset.WorthCurrency = displayCurrency

			var displayAmount string
			if rateErr == nil {
				displayAmount, rateErr = stellar.ConvertXLMToOutside(d.Amount, rate)
			}
			if rateErr != nil {
				s.G().Log.CDebugf(ctx, "error converting XLM to display currency: %s", rateErr)
				asset.Worth = "Currency conversion error"
				asset.WorthCurrency = WorthCurrencyErrorCode
			} else {
				displayFormatted, err := stellar.FormatCurrency(ctx, s.G(), displayAmount, stellar1.OutsideCurrencyCode(displayCurrency))
				if err != nil {
					s.G().Log.CDebugf(ctx, "error formatting currency: %s", err)
					asset.Worth = "Currency conversion error"
					asset.WorthCurrency = WorthCurrencyErrorCode
				} else {
					asset.Worth = displayFormatted
				}
			}
		}

		assets = append(assets, asset)
	}

	return assets, nil
}

func (s *Server) GetDisplayCurrenciesLocal(ctx context.Context, sessionID int) (currencies []stellar1.CurrencyLocal, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "GetDisplayCurrenciesLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return nil, err
	}

	conf, err := s.G().GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return nil, err
	}

	for code, def := range conf.Currencies {
		c := stellar1.CurrencyLocal{
			Description: fmt.Sprintf("%s (%s)", code, def.Symbol.Symbol),
			Code:        string(code),
			Symbol:      def.Symbol.Symbol,
			Name:        def.Name,
		}
		currencies = append(currencies, c)
	}
	sort.Slice(currencies, func(i, j int) bool {
		if currencies[i].Code == "USD" {
			return true
		}
		if currencies[j].Code == "USD" {
			return false
		}
		return currencies[i].Code < currencies[j].Code
	})

	return currencies, nil
}

type balanceList []stellar1.Balance

func (a balanceList) nativeBalanceDescription() (string, error) {
	for _, b := range a {
		if b.Asset.IsNativeXLM() {
			fmtAmount, err := stellar.FormatAmount(b.Amount, false)
			if err != nil {
				return "", err
			}
			return fmt.Sprintf("%s XLM", fmtAmount), nil
		}
	}
	return "0 XLM", nil
}

func (s *Server) ChangeWalletAccountNameLocal(ctx context.Context, arg stellar1.ChangeWalletAccountNameLocalArg) (err error) {
	m := libkb.NewMetaContext(s.logTag(ctx), s.G())
	defer s.G().CTraceTimed(ctx, "ChangeWalletAccountNameLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return err
	}

	return stellar.ChangeAccountName(m, arg.AccountID, arg.NewName)
}

func (s *Server) SetWalletAccountAsDefaultLocal(ctx context.Context, arg stellar1.SetWalletAccountAsDefaultLocalArg) (err error) {
	m := libkb.NewMetaContext(s.logTag(ctx), s.G())
	defer s.G().CTraceTimed(ctx, "SetWalletAccountAsDefaultLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return err
	}

	return stellar.SetAccountAsPrimary(m, arg.AccountID)
}
