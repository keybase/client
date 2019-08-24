// this file is for the implementation of all the frontend-requested service
// endpoints for wallets.
package stellarsvc

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"unicode/utf8"

	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
)

const WorthCurrencyErrorCode = "ERR"

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

	return stellar.AllWalletAccounts(mctx, s.remoter)
}

func (s *Server) GetWalletAccountLocal(ctx context.Context, arg stellar1.GetWalletAccountLocalArg) (acct stellar1.WalletAccountLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "GetWalletAccountLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return acct, err
	}

	if arg.AccountID.IsNil() {
		mctx.Debug("GetWalletAccountLocal called with an empty account id")
		return acct, ErrAccountIDMissing
	}

	return stellar.WalletAccount(mctx, s.remoter, arg.AccountID)
}

func (s *Server) GetAccountAssetsLocal(ctx context.Context, arg stellar1.GetAccountAssetsLocalArg) (assets []stellar1.AccountAssetLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "GetAccountAssetsLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return nil, err
	}

	if arg.AccountID.IsNil() {
		s.G().Log.CDebugf(ctx, "GetAccountAssetsLocal called with an empty account id")
		return nil, ErrAccountIDMissing
	}

	details, err := stellar.AccountDetails(mctx, s.remoter, arg.AccountID)
	if err != nil {
		s.G().Log.CDebugf(ctx, "remote.Details failed for %q: %s", arg.AccountID, err)
		return nil, err
	}

	if len(details.Balances) == 0 {
		// add an empty xlm balance
		s.G().Log.CDebugf(ctx, "Account has no balances - adding default 0 XLM balance")
		stellar.EmptyAmountStack(mctx)
		details.Available = "0"
		details.Balances = []stellar1.Balance{
			{
				Amount: "0",
				Asset:  stellar1.Asset{Type: "native"},
			},
		}
	}

	if details.Available == "" {
		s.G().Log.CDebugf(ctx, "details.Available is empty: %+v", details)
		stellar.EmptyAmountStack(mctx)
		details.Available = "0"
		s.G().Log.CDebugf(ctx, `set details.Available from empty to "0"`)
	}

	displayCurrency, err := stellar.GetAccountDisplayCurrency(mctx, arg.AccountID)
	if err != nil {
		return nil, err
	}
	s.G().Log.CDebugf(ctx, "Display currency for account %q is %q", arg.AccountID, displayCurrency)
	rate, rateErr := s.remoter.ExchangeRate(ctx, displayCurrency)
	if rateErr != nil {
		s.G().Log.CDebugf(ctx, "exchange rate error: %s", rateErr)
	}

	for _, d := range details.Balances {
		fmtAmount, err := stellar.FormatAmount(mctx, d.Amount, false, stellarnet.Round)
		if err != nil {
			s.G().Log.CDebugf(ctx, "FormatAmount error: %s", err)
			return nil, err
		}

		if d.Asset.IsNativeXLM() {
			baseFee := s.walletState.BaseFee(mctx)
			availableAmount := stellar.SubtractFeeSoft(mctx, details.Available, baseFee)
			if availableAmount == "" {
				s.G().Log.CDebugf(ctx, "stellar.SubtractFeeSoft returned empty available amount, setting it to 0")
				stellar.EmptyAmountStack(mctx)
				availableAmount = "0"
			}
			fmtAvailable, err := stellar.FormatAmount(mctx, availableAmount, false, stellarnet.Round)
			if err != nil {
				return nil, err
			}

			asset := stellar1.AccountAssetLocal{
				Name:                   "Lumens",
				AssetCode:              "XLM",
				IssuerName:             "Stellar network",
				IssuerAccountID:        "",
				BalanceTotal:           fmtAmount,
				BalanceAvailableToSend: fmtAvailable,
				WorthCurrency:          displayCurrency,
			}
			fillWorths := func() (err error) {
				if rateErr != nil {
					return fmt.Errorf("rate error: %v", rateErr)
				}
				outsideAmount, err := stellarnet.ConvertXLMToOutside(d.Amount, rate.Rate)
				if err != nil {
					return fmt.Errorf("converting amount: %v", err)
				}
				fmtWorth, err := stellar.FormatCurrencyWithCodeSuffix(mctx, outsideAmount, rate.Currency, stellarnet.Round)
				if err != nil {
					return fmt.Errorf("formatting converted amount: %v", err)
				}
				asset.Worth = fmtWorth
				outsideAvailableAmount, err := stellarnet.ConvertXLMToOutside(availableAmount, rate.Rate)
				if err != nil {
					return fmt.Errorf("converting available amount: %v", err)
				}
				fmtAvailableWorth, err := stellar.FormatCurrencyWithCodeSuffix(mctx, outsideAvailableAmount, rate.Currency, stellarnet.Round)
				if err != nil {
					return fmt.Errorf("formatting converted available amount: %v", err)
				}
				asset.AvailableToSendWorth = fmtAvailableWorth
				return nil
			}
			err = fillWorths()
			if err != nil {
				s.G().Log.CDebugf(ctx, "error populating converted worth fields: %v", err)
				asset.WorthCurrency = WorthCurrencyErrorCode
				asset.Worth = "Currency conversion error"
				asset.AvailableToSendWorth = "Currency conversion error"
			}
			// Add account reserves info to main asset.
			asset.Reserves = details.Reserves
			assets = append(assets, asset)
		} else {
			assets = append(assets, stellar1.AccountAssetLocal{
				Name:                   d.Asset.Code,
				AssetCode:              d.Asset.Code,
				IssuerName:             d.Asset.IssuerName,
				IssuerAccountID:        d.Asset.Issuer,
				IssuerVerifiedDomain:   d.Asset.VerifiedDomain,
				BalanceTotal:           fmtAmount,
				BalanceAvailableToSend: fmtAmount,
				WorthCurrency:          "",
				Worth:                  "",
				AvailableToSendWorth:   "",
				Desc:                   d.Asset.Desc,
				InfoUrl:                d.Asset.InfoUrl,
				InfoUrlText:            d.Asset.InfoUrlText,
				ShowDepositButton:      d.Asset.ShowDepositButton,
				DepositButtonText:      d.Asset.DepositButtonText,
				ShowWithdrawButton:     d.Asset.ShowWithdrawButton,
				WithdrawButtonText:     d.Asset.WithdrawButtonText,
			})
		}
	}

	return assets, nil
}

func (s *Server) GetDisplayCurrenciesLocal(ctx context.Context, sessionID int) (currencies []stellar1.CurrencyLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "GetDisplayCurrenciesLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return nil, err
	}

	conf, err := s.G().GetStellar().GetServerDefinitions(mctx.Ctx())
	if err != nil {
		return nil, err
	}

	for code := range conf.Currencies {
		c, ok := conf.GetCurrencyLocal(code)
		if ok {
			currencies = append(currencies, c)
		}
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

func (s *Server) AcceptDisclaimerLocal(ctx context.Context, sessionID int) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "AcceptDisclaimerLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}

	err = remote.SetAcceptedDisclaimer(mctx.Ctx(), s.G())
	if err != nil {
		return err
	}
	stellar.InformAcceptedDisclaimer(mctx.Ctx(), s.G())
	cwg, err := stellar.CreateWalletGated(mctx)
	if err != nil {
		return err
	}
	if !cwg.HasWallet {
		return fmt.Errorf("user wallet not created")
	}

	err = s.walletState.RefreshAll(mctx, "AcceptDisclaimer")
	if err != nil {
		mctx.Debug("AcceptDisclaimer RefreshAll error: %s", err)
	}

	return nil
}

func (s *Server) LinkNewWalletAccountLocal(ctx context.Context, arg stellar1.LinkNewWalletAccountLocalArg) (accountID stellar1.AccountID, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "LinkNewWalletAccountLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return "", err
	}

	_, accountID, _, err = libkb.ParseStellarSecretKey(string(arg.SecretKey))
	if err != nil {
		return "", err
	}

	err = stellar.ImportSecretKey(mctx, arg.SecretKey, false, arg.Name)
	if err != nil {
		return "", err
	}

	err = s.walletState.RefreshAll(mctx, "LinkNewWalletAccount")
	if err != nil {
		mctx.Debug("LinkNewWalletAccountLocal RefreshAll error: %s", err)
	}

	return accountID, nil
}

func (s *Server) GetPaymentsLocal(ctx context.Context, arg stellar1.GetPaymentsLocalArg) (page stellar1.PaymentsPageLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "GetPaymentsLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return page, err
	}

	if arg.AccountID.IsNil() {
		s.G().Log.CDebugf(ctx, "GetPaymentsLocal called with an empty account id")
		return page, ErrAccountIDMissing
	}

	rpArg := remote.RecentPaymentsArg{
		AccountID:       arg.AccountID,
		Cursor:          arg.Cursor,
		SkipPending:     true,
		IncludeAdvanced: true,
	}
	srvPayments, err := s.remoter.RecentPayments(ctx, rpArg)
	if err != nil {
		return page, err
	}

	return stellar.RemoteRecentPaymentsToPage(mctx, s.remoter, arg.AccountID, srvPayments)
}

func (s *Server) GetPendingPaymentsLocal(ctx context.Context, arg stellar1.GetPendingPaymentsLocalArg) (payments []stellar1.PaymentOrErrorLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "GetPendingPaymentsLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return nil, err
	}

	if arg.AccountID.IsNil() {
		s.G().Log.CDebugf(ctx, "GetPendingPaymentsLocal called with an empty account id")
		return payments, ErrAccountIDMissing
	}

	pending, err := s.remoter.PendingPayments(ctx, arg.AccountID, 0)
	if err != nil {
		return nil, err
	}

	return stellar.RemotePendingToLocal(mctx, s.remoter, arg.AccountID, pending)
}

func (s *Server) GetPaymentDetailsLocal(ctx context.Context, arg stellar1.GetPaymentDetailsLocalArg) (payment stellar1.PaymentDetailsLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "GetPaymentDetailsLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return payment, err
	}

	if arg.AccountID.IsNil() {
		return payment, errors.New("AccountID required for GetPaymentDetailsLocal")
	}

	oc := stellar.NewOwnAccountLookupCache(mctx)
	details, err := s.remoter.PaymentDetails(ctx, arg.AccountID, stellar1.TransactionIDFromPaymentID(arg.Id).String())
	if err != nil {
		return payment, err
	}

	summary, err := stellar.TransformPaymentSummaryAccount(mctx, details.Summary, oc, arg.AccountID)
	if err != nil {
		return payment, err
	}

	var fee string
	if details.FeeCharged != "" {
		fee, err = stellar.FormatAmountDescriptionXLM(mctx, details.FeeCharged)
		if err != nil {
			return payment, err
		}
	}

	summary.TxID = stellar1.TransactionIDFromPaymentID(summary.Id)

	return stellar1.PaymentDetailsLocal{
		Summary: *summary,
		Details: stellar1.PaymentDetailsOnlyLocal{
			PublicNote:            details.Memo,
			PublicNoteType:        details.MemoType,
			ExternalTxURL:         details.ExternalTxURL,
			FeeChargedDescription: fee,
			PathIntermediate:      details.PathIntermediate,
		},
	}, nil
}

func (s *Server) GetGenericPaymentDetailsLocal(ctx context.Context, arg stellar1.GetGenericPaymentDetailsLocalArg) (payment stellar1.PaymentDetailsLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "GetGenericPaymentDetailsLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return payment, err
	}

	oc := stellar.NewOwnAccountLookupCache(mctx)
	details, err := s.remoter.PaymentDetailsGeneric(ctx, stellar1.TransactionIDFromPaymentID(arg.Id).String())
	if err != nil {
		return payment, err
	}

	summary, err := stellar.TransformPaymentSummaryGeneric(mctx, details.Summary, oc)
	if err != nil {
		return payment, err
	}

	summary.TxID = stellar1.TransactionIDFromPaymentID(summary.Id)

	return stellar1.PaymentDetailsLocal{
		Summary: *summary,
		Details: stellar1.PaymentDetailsOnlyLocal{
			PublicNote:     details.Memo,
			PublicNoteType: details.MemoType,
			ExternalTxURL:  details.ExternalTxURL,
		},
	}, nil
}

func (s *Server) CancelPaymentLocal(ctx context.Context, arg stellar1.CancelPaymentLocalArg) (res stellar1.RelayClaimResult, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "CancelPaymentLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	details, err := s.remoter.PaymentDetailsGeneric(mctx.Ctx(), stellar1.TransactionIDFromPaymentID(arg.PaymentID).String())
	if err != nil {
		return res, err
	}
	typ, err := details.Summary.Typ()
	if err != nil {
		return res, err
	}
	if typ != stellar1.PaymentSummaryType_RELAY {
		return res, errors.New("tried to cancel a non-relay payment")
	}
	relay := details.Summary.Relay()
	dir := stellar1.RelayDirection_YANK
	return stellar.Claim(mctx, s.walletState, relay.KbTxID.String(), relay.FromStellar, &dir, nil)
}

func (s *Server) ValidateAccountIDLocal(ctx context.Context, arg stellar1.ValidateAccountIDLocalArg) (err error) {
	_, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "ValidateAccountIDLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}
	_, err = libkb.ParseStellarAccountID(arg.AccountID.String())
	return err
}

func (s *Server) ValidateSecretKeyLocal(ctx context.Context, arg stellar1.ValidateSecretKeyLocalArg) (err error) {
	_, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "ValidateSecretKeyLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}
	_, _, _, err = libkb.ParseStellarSecretKey(arg.SecretKey.SecureNoLogString())
	return err
}

func (s *Server) ValidateAccountNameLocal(ctx context.Context, arg stellar1.ValidateAccountNameLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "ValidateAccountNameLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}
	// Make sure to keep this validation in sync with ChangeAccountName.
	if arg.Name == "" {
		return fmt.Errorf("name required")
	}
	runes := utf8.RuneCountInString(arg.Name)
	if runes > stellar.AccountNameMaxRunes {
		return fmt.Errorf("account name can be %v characters at the longest but was %v", stellar.AccountNameMaxRunes, runes)
	}
	// If this becomes a bottleneck, cache non-critical wallet info on G.Stellar.
	currentBundle, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		s.G().Log.CErrorf(ctx, "error fetching bundle: %v", err)
		// Return nil since the name is probably fine.
		return nil
	}
	for _, account := range currentBundle.Accounts {
		if arg.Name == account.Name {
			return fmt.Errorf("you already have an account with that name")
		}
	}
	return nil
}

func (s *Server) ChangeWalletAccountNameLocal(ctx context.Context, arg stellar1.ChangeWalletAccountNameLocalArg) (acct stellar1.WalletAccountLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ChangeWalletAccountNameLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return acct, err
	}

	if arg.AccountID.IsNil() {
		mctx.Debug("ChangeWalletAccountNameLocal called with an empty account id")
		return acct, ErrAccountIDMissing
	}

	err = stellar.ChangeAccountName(mctx, s.walletState, arg.AccountID, arg.NewName)
	if err != nil {
		return acct, err
	}
	return stellar.WalletAccount(mctx, s.remoter, arg.AccountID)
}

func (s *Server) SetWalletAccountAsDefaultLocal(ctx context.Context, arg stellar1.SetWalletAccountAsDefaultLocalArg) (accts []stellar1.WalletAccountLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "SetWalletAccountAsDefaultLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return accts, err
	}

	if arg.AccountID.IsNil() {
		mctx.Debug("SetWalletAccountAsDefaultLocal called with an empty account id")
		return accts, ErrAccountIDMissing
	}

	err = stellar.SetAccountAsPrimary(mctx, s.walletState, arg.AccountID)
	if err != nil {
		return accts, err
	}
	return stellar.AllWalletAccounts(mctx, s.remoter)
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

func (s *Server) ChangeDisplayCurrencyLocal(ctx context.Context, arg stellar1.ChangeDisplayCurrencyLocalArg) (res stellar1.CurrencyLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ChangeDisplayCurrencyLocal",
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
	err = remote.SetAccountDefaultCurrency(mctx.Ctx(), s.G(), arg.AccountID, string(arg.Currency))
	if err != nil {
		return res, err
	}
	return stellar.GetCurrencySetting(mctx, arg.AccountID)
}

func (s *Server) GetDisplayCurrencyLocal(ctx context.Context, arg stellar1.GetDisplayCurrencyLocalArg) (res stellar1.CurrencyLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "GetDisplayCurrencyLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	accountID := arg.AccountID
	if accountID == nil {
		primaryAccountID, err := stellar.GetOwnPrimaryAccountID(mctx)
		if err != nil {
			return res, err
		}
		accountID = &primaryAccountID
	}
	return stellar.GetCurrencySetting(mctx, *accountID)
}

func (s *Server) GetWalletAccountPublicKeyLocal(ctx context.Context, arg stellar1.GetWalletAccountPublicKeyLocalArg) (res string, err error) {
	_, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:        "GetWalletAccountPublicKeyLocal",
		Err:            &err,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	if arg.AccountID.IsNil() {
		return res, ErrAccountIDMissing
	}
	return arg.AccountID.String(), nil
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

func (s *Server) GetSendAssetChoicesLocal(ctx context.Context, arg stellar1.GetSendAssetChoicesLocalArg) (res []stellar1.SendAssetChoiceLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "GetSendAssetChoicesLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	return stellar.GetSendAssetChoicesLocal(mctx, s.remoter, arg)
}

func (s *Server) StartBuildPaymentLocal(ctx context.Context, sessionID int) (res stellar1.BuildPaymentID, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "StartBuildPaymentLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}
	return stellar.StartBuildPaymentLocal(mctx)
}

func (s *Server) StopBuildPaymentLocal(ctx context.Context, arg stellar1.StopBuildPaymentLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "StopBuildPaymentLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}
	stellar.StopBuildPaymentLocal(mctx, arg.Bid)
	return nil
}

func (s *Server) BuildPaymentLocal(ctx context.Context, arg stellar1.BuildPaymentLocalArg) (res stellar1.BuildPaymentResLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "BuildPaymentLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}
	return stellar.BuildPaymentLocal(mctx, arg)
}

func (s *Server) ReviewPaymentLocal(ctx context.Context, arg stellar1.ReviewPaymentLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ReviewPaymentLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}
	return stellar.ReviewPaymentLocal(mctx, s.uiSource.StellarUI(), arg)
}

func (s *Server) SendPaymentLocal(ctx context.Context, arg stellar1.SendPaymentLocalArg) (res stellar1.SendPaymentResLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "SendPaymentLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}
	return stellar.SendPaymentLocal(mctx, arg)
}

func (s *Server) SendPathLocal(ctx context.Context, arg stellar1.SendPathLocalArg) (res stellar1.SendPaymentResLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "SendPathLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	sendRes, err := stellar.SendPathPaymentGUI(mctx, s.walletState, stellar.SendPathPaymentArg{
		From:        arg.Source,
		To:          stellarcommon.RecipientInput(arg.Recipient),
		Path:        arg.Path,
		SecretNote:  arg.Note,
		PublicMemo:  stellarnet.NewMemoText(arg.PublicNote),
		QuickReturn: true,
	})
	if err != nil {
		return res, err
	}
	return stellar1.SendPaymentResLocal{
		KbTxID:     sendRes.KbTxID,
		Pending:    sendRes.Pending,
		JumpToChat: sendRes.JumpToChat,
	}, nil
}

func (s *Server) CreateWalletAccountLocal(ctx context.Context, arg stellar1.CreateWalletAccountLocalArg) (res stellar1.AccountID, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "CreateWalletAccountLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}
	return stellar.CreateNewAccount(mctx, arg.Name)
}

func (s *Server) BuildRequestLocal(ctx context.Context, arg stellar1.BuildRequestLocalArg) (res stellar1.BuildRequestResLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "BuildRequestLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}
	return stellar.BuildRequestLocal(mctx, arg)
}

func (s *Server) GetRequestDetailsLocal(ctx context.Context, arg stellar1.GetRequestDetailsLocalArg) (res stellar1.RequestDetailsLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "GetRequestDetailsLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return stellar1.RequestDetailsLocal{}, err
	}

	details, err := s.remoter.RequestDetails(mctx.Ctx(), arg.ReqID)
	if err != nil {
		return stellar1.RequestDetailsLocal{}, err
	}

	local, err := stellar.TransformRequestDetails(mctx, details)
	if err != nil {
		return stellar1.RequestDetailsLocal{}, err
	}

	return *local, nil
}

func (s *Server) MakeRequestLocal(ctx context.Context, arg stellar1.MakeRequestLocalArg) (res stellar1.KeybaseRequestID, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "MakeRequestLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return "", err
	}

	return stellar.MakeRequestGUI(mctx, s.remoter, stellar.MakeRequestArg{
		To:       stellarcommon.RecipientInput(arg.Recipient),
		Amount:   arg.Amount,
		Asset:    arg.Asset,
		Currency: arg.Currency,
		Note:     arg.Note,
	})
}

func (s *Server) CancelRequestLocal(ctx context.Context, arg stellar1.CancelRequestLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "CancelRequestLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}

	return s.remoter.CancelRequest(mctx.Ctx(), arg.ReqID)
}

func (s *Server) MarkAsReadLocal(ctx context.Context, arg stellar1.MarkAsReadLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "MarkAsReadLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	if arg.AccountID.IsNil() {
		mctx.Debug("IsAccountMobileOnlyLocal called with an empty account id")
		return ErrAccountIDMissing
	}

	err = s.remoter.MarkAsRead(mctx.Ctx(), arg.AccountID, stellar1.TransactionIDFromPaymentID(arg.MostRecentID))
	if err != nil {
		return err
	}

	go stellar.RefreshUnreadCount(s.G(), arg.AccountID)

	return nil
}

func (s *Server) IsAccountMobileOnlyLocal(ctx context.Context, arg stellar1.IsAccountMobileOnlyLocalArg) (mobileOnly bool, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "IsAccountMobileOnlyLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return false, err
	}

	if arg.AccountID.IsNil() {
		mctx.Debug("IsAccountMobileOnlyLocal called with an empty account id")
		return false, ErrAccountIDMissing
	}

	return s.remoter.IsAccountMobileOnly(mctx.Ctx(), arg.AccountID)
}

func (s *Server) SetAccountMobileOnlyLocal(ctx context.Context, arg stellar1.SetAccountMobileOnlyLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "SetAccountMobileOnlyLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}

	if arg.AccountID.IsNil() {
		mctx.Debug("SetAccountMobileOnlyLocal called with an empty account id")
		return ErrAccountIDMissing
	}

	if err = s.remoter.SetAccountMobileOnly(mctx.Ctx(), arg.AccountID); err != nil {
		return err
	}

	if err = s.walletState.UpdateAccountEntries(mctx, "set account mobile only"); err != nil {
		return err
	}

	return nil
}

func (s *Server) SetAccountAllDevicesLocal(ctx context.Context, arg stellar1.SetAccountAllDevicesLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "SetAccountAllDevicesLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}

	if arg.AccountID.IsNil() {
		mctx.Debug("SetAccountAllDevicesLocal called with an empty account id")
		return ErrAccountIDMissing
	}

	if err = s.remoter.MakeAccountAllDevices(mctx.Ctx(), arg.AccountID); err != nil {
		return err
	}

	if err = s.walletState.UpdateAccountEntries(mctx, "set account all devices"); err != nil {
		return err
	}

	return nil
}

func (s *Server) GetPredefinedInflationDestinationsLocal(ctx context.Context, sessionID int) (ret []stellar1.PredefinedInflationDestination, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "GetPredefinedInflationDestinations",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return ret, err
	}
	return stellar.GetPredefinedInflationDestinations(mctx)
}

func (s *Server) SetInflationDestinationLocal(ctx context.Context, arg stellar1.SetInflationDestinationLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "SetInflationDestinationLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}
	return stellar.SetInflationDestinationLocal(mctx, arg)
}

func (s *Server) GetInflationDestinationLocal(ctx context.Context, arg stellar1.GetInflationDestinationLocalArg) (res stellar1.InflationDestinationResultLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "GetInflationDestinationLocal",
		Err:           &err,
		RequireWallet: false,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	if arg.AccountID.IsNil() {
		mctx.Debug("GetInflationDestinationLocal called with an empty account id")
		return res, ErrAccountIDMissing
	}

	return stellar.GetInflationDestination(mctx, arg.AccountID)
}

func (s *Server) AirdropDetailsLocal(ctx context.Context, sessionID int) (resp stellar1.AirdropDetails, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "AirdropDetailsLocal",
		Err:           &err,
		RequireWallet: false,
	})
	defer fin()
	if err != nil {
		return stellar1.AirdropDetails{}, err
	}

	isPromoted, details, disclaimer, err := remote.AirdropDetails(mctx)
	if err != nil {
		return stellar1.AirdropDetails{}, err
	}
	return stellar1.AirdropDetails{IsPromoted: isPromoted, Details: details, Disclaimer: disclaimer}, nil

}

func (s *Server) AirdropRegisterLocal(ctx context.Context, arg stellar1.AirdropRegisterLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "AirdropRegisterLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	return remote.AirdropRegister(mctx, arg.Register)
}

func (s *Server) AirdropStatusLocal(ctx context.Context, sessionID int) (status stellar1.AirdropStatus, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "AirdropStatusLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return stellar1.AirdropStatus{}, err
	}

	return stellar.AirdropStatus(mctx)
}

func (s *Server) AddTrustlineLocal(ctx context.Context, arg stellar1.AddTrustlineLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "AddTrustline",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	return stellar.AddTrustlineLocal(mctx, arg)
}

func (s *Server) DeleteTrustlineLocal(ctx context.Context, arg stellar1.DeleteTrustlineLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "AddTrustline",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}
	return stellar.DeleteTrustlineLocal(mctx, arg)
}

func (s *Server) ChangeTrustlineLimitLocal(ctx context.Context, arg stellar1.ChangeTrustlineLimitLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ChangeTrustlineLimit",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}
	return stellar.ChangeTrustlineLimitLocal(mctx, arg)
}

func (s *Server) GetTrustlinesLocal(ctx context.Context, arg stellar1.GetTrustlinesLocalArg) (ret []stellar1.Balance, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "GetTrustlinesLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return ret, err
	}
	return s.getTrustlinesAccountID(mctx, arg.AccountID)
}

func (s *Server) GetTrustlinesForRecipientLocal(ctx context.Context, arg stellar1.GetTrustlinesForRecipientLocalArg) (ret stellar1.RecipientTrustlinesLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "GetTrustlinesByRecipientLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return ret, err
	}

	recipient, err := stellar.LookupRecipient(mctx, stellarcommon.RecipientInput(arg.Recipient), false)
	if err != nil {
		return ret, err
	}
	if recipient.AccountID == nil {
		return ret, errors.New("recipient has no stellar accounts")
	}

	trustlines, err := s.getTrustlinesAccountID(mctx, stellar1.AccountID(*recipient.AccountID))
	if err != nil {
		return ret, err
	}
	for _, t := range trustlines {
		if !t.IsAuthorized {
			continue
		}
		ret.Trustlines = append(ret.Trustlines, t)
	}

	if recipient.User != nil {
		ret.RecipientType = stellar1.ParticipantType_KEYBASE
	} else {
		ret.RecipientType = stellar1.ParticipantType_STELLAR
	}

	return ret, nil
}

func (s *Server) getTrustlinesAccountID(mctx libkb.MetaContext, accountID stellar1.AccountID) (ret []stellar1.Balance, err error) {
	balances, err := s.remoter.Balances(mctx.Ctx(), accountID)
	if err != nil {
		return ret, err
	}
	if len(balances) == 0 {
		// Account is not on the network - no balances means no trustlines.
		return ret, nil
	}
	ret = make([]stellar1.Balance, 0, len(balances)-1)
	for _, balance := range balances {
		if !balance.Asset.IsNativeXLM() {
			ret = append(ret, balance)
		}
	}
	return ret, nil
}

func (s *Server) FindPaymentPathLocal(ctx context.Context, arg stellar1.FindPaymentPathLocalArg) (res stellar1.PaymentPathLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "FindPaymentPathLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return stellar1.PaymentPathLocal{}, err
	}

	path, err := stellar.FindPaymentPath(mctx, s.remoter, arg.From, arg.To, arg.SourceAsset, arg.DestinationAsset, arg.Amount)
	if err != nil {
		return stellar1.PaymentPathLocal{}, err
	}

	res.FullPath = path

	res.SourceDisplay, err = stellar.FormatAmount(mctx, path.SourceAmount, false, stellarnet.Round)
	if err != nil {
		return stellar1.PaymentPathLocal{}, err
	}
	res.SourceMaxDisplay, err = stellar.FormatAmount(mctx, path.SourceAmountMax, false, stellarnet.Round)
	if err != nil {
		return stellar1.PaymentPathLocal{}, err
	}
	res.DestinationDisplay, err = stellar.FormatAmount(mctx, path.DestinationAmount, false, stellarnet.Round)
	if err != nil {
		return stellar1.PaymentPathLocal{}, err
	}

	destAmt, err := stellarnet.ParseAmount(path.DestinationAmount)
	if err != nil {
		return stellar1.PaymentPathLocal{}, err
	}
	srcAmt, err := stellarnet.ParseAmount(path.SourceAmount)
	if err != nil {
		return stellar1.PaymentPathLocal{}, err
	}
	srcAmt.Quo(srcAmt, destAmt)

	exchangeRateLeft, err := stellar.FormatAmountDescriptionAsset(mctx, "1", path.DestinationAsset)
	if err != nil {
		return stellar1.PaymentPathLocal{}, err
	}
	exchangeRateRight, err := stellar.FormatAmountDescriptionAsset(mctx, srcAmt.FloatString(7), path.SourceAsset)

	if err != nil {
		return stellar1.PaymentPathLocal{}, err
	}
	res.ExchangeRate = fmt.Sprintf("%s = %s", exchangeRateLeft, exchangeRateRight)

	if len(path.SourceInsufficientBalance) > 0 {
		availableToSpend, err := stellar.FormatAmountDescriptionAssetEx2(mctx, path.SourceInsufficientBalance, path.SourceAsset)
		if err != nil {
			return stellar1.PaymentPathLocal{}, err
		}
		res.AmountError = fmt.Sprintf("You only have %s available to spend.", availableToSpend)
	}

	return res, nil
}

func (s *Server) FuzzyAssetSearchLocal(ctx context.Context, arg stellar1.FuzzyAssetSearchLocalArg) (res []stellar1.Asset, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "FuzzyAssetSearchLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	remoteArg := stellar1.FuzzyAssetSearchArg{
		SearchString: arg.SearchString,
	}
	return stellar.FuzzyAssetSearch(mctx, s.remoter, remoteArg)
}

func (s *Server) ListPopularAssetsLocal(ctx context.Context, sessionID int) (res stellar1.AssetListResult, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ListPopularAssetsLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	remoteArg := stellar1.ListPopularAssetsArg{}
	return stellar.ListPopularAssets(mctx, s.remoter, remoteArg)
}

func (s *Server) GetStaticConfigLocal(ctx context.Context) (res stellar1.StaticConfig, err error) {
	return stellar1.StaticConfig{
		PaymentNoteMaxLength: libkb.MaxStellarPaymentNoteLength,
		RequestNoteMaxLength: msgchecker.RequestPaymentTextMaxLength,
		PublicMemoMaxLength:  libkb.MaxStellarPaymentPublicNoteLength,
	}, nil
}

func (s *Server) AssetDepositLocal(ctx context.Context, arg stellar1.AssetDepositLocalArg) (res stellar1.AssetActionResultLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "AssetDepositLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	ai, err := s.prepareAnchorInteractor(mctx, arg.AccountID, arg.Asset)
	if err != nil {
		return res, err
	}

	return ai.Deposit(mctx)
}

func (s *Server) AssetWithdrawLocal(ctx context.Context, arg stellar1.AssetWithdrawLocalArg) (res stellar1.AssetActionResultLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "AssetWithdrawLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	ai, err := s.prepareAnchorInteractor(mctx, arg.AccountID, arg.Asset)
	if err != nil {
		return res, err
	}

	return ai.Withdraw(mctx)
}

func (s *Server) prepareAnchorInteractor(mctx libkb.MetaContext, accountID stellar1.AccountID, asset stellar1.Asset) (*anchorInteractor, error) {
	// check that the user owns accountID
	own, _, err := stellar.OwnAccountCached(mctx, accountID)
	if err != nil {
		return nil, err
	}
	if !own {
		return nil, errors.New("caller doesn't own account")
	}

	// check that accountID has a trustline to the asset
	trustlines, err := s.getTrustlinesAccountID(mctx, accountID)
	if err != nil {
		return nil, err
	}
	var fullAsset stellar1.Asset
	for _, tl := range trustlines {
		if tl.Asset.Code == asset.Code && tl.Asset.Issuer == asset.Issuer {
			fullAsset = tl.Asset
			break
		}
	}
	if fullAsset.Code == "" || fullAsset.Issuer == "" {
		return nil, errors.New("caller doesn't have trustline to asset")
	}

	var seed *stellar1.SecretKey
	if fullAsset.AuthEndpoint != "" {
		// get the secret key for account id
		_, bundle, err := stellar.LookupSender(mctx, accountID)
		if err != nil {
			return nil, err
		}
		seed = &bundle.Signers[0]
	}

	// all good from the user's perspective, proceed...
	return newAnchorInteractor(accountID, seed, fullAsset), nil
}
