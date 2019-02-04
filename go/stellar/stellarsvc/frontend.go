// this file is for the implementation of all the frontend-requested service
// endpoints for wallets.
package stellarsvc

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"unicode/utf8"

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
		mctx.CDebugf("GetWalletAccountLocal called with an empty account id")
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
		fmtAmount, err := stellar.FormatAmount(mctx, d.Amount, false, stellar.FmtRound)
		if err != nil {
			s.G().Log.CDebugf(ctx, "FormatAmount error: %s", err)
			return nil, err
		}

		if d.Asset.IsNativeXLM() {
			availableAmount := stellar.SubtractFeeSoft(mctx, details.Available)
			if availableAmount == "" {
				s.G().Log.CDebugf(ctx, "stellar.SubtractFeeSoft returned empty available amount, setting it to 0")
				stellar.EmptyAmountStack(mctx)
				availableAmount = "0"
			}
			fmtAvailable, err := stellar.FormatAmount(mctx, availableAmount, false, stellar.FmtRound)
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
				fmtWorth, err := stellar.FormatCurrencyWithCodeSuffix(mctx, outsideAmount, rate.Currency, stellar.FmtRound)
				if err != nil {
					return fmt.Errorf("formatting converted amount: %v", err)
				}
				asset.Worth = fmtWorth
				outsideAvailableAmount, err := stellarnet.ConvertXLMToOutside(availableAmount, rate.Rate)
				if err != nil {
					return fmt.Errorf("converting available amount: %v", err)
				}
				fmtAvailableWorth, err := stellar.FormatCurrencyWithCodeSuffix(mctx, outsideAvailableAmount, rate.Currency, stellar.FmtRound)
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

	s.walletState.RefreshAll(mctx, "AcceptDisclaimer")

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

	s.walletState.RefreshAll(mctx, "LinkNewWalletAccount")

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

	srvPayments, err := s.remoter.RecentPayments(ctx, arg.AccountID, arg.Cursor, 0, true)
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
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "GetPaymentDetailsLocal", func() error { return err })()
	mctx := libkb.NewMetaContext(ctx, s.G())
	err = s.assertLoggedIn(mctx)
	if err != nil {
		return payment, err
	}

	oc := stellar.NewOwnAccountLookupCache(mctx)
	details, err := s.remoter.PaymentDetails(ctx, stellar1.TransactionIDFromPaymentID(arg.Id).String())
	if err != nil {
		return payment, err
	}

	var summary *stellar1.PaymentLocal

	// AccountID argument is optional.
	if arg.AccountID != nil {
		summary, err = stellar.TransformPaymentSummaryAccount(mctx, details.Summary, oc, *arg.AccountID)
	} else {
		summary, err = stellar.TransformPaymentSummaryGeneric(mctx, details.Summary, oc)
	}
	if err != nil {
		return payment, err
	}

	payment = stellar1.PaymentDetailsLocal{
		Id:                  summary.Id,
		TxID:                stellar1.TransactionIDFromPaymentID(summary.Id),
		Time:                summary.Time,
		StatusSimplified:    summary.StatusSimplified,
		StatusDescription:   summary.StatusDescription,
		StatusDetail:        summary.StatusDetail,
		ShowCancel:          summary.ShowCancel,
		AmountDescription:   summary.AmountDescription,
		Delta:               summary.Delta,
		Worth:               summary.Worth,
		WorthAtSendTime:     summary.WorthAtSendTime,
		FromType:            summary.FromType,
		ToType:              summary.ToType,
		FromAccountID:       summary.FromAccountID,
		FromAccountName:     summary.FromAccountName,
		FromUsername:        summary.FromUsername,
		ToAccountID:         summary.ToAccountID,
		ToAccountName:       summary.ToAccountName,
		ToUsername:          summary.ToUsername,
		ToAssertion:         summary.ToAssertion,
		OriginalToAssertion: summary.OriginalToAssertion,
		Note:                summary.Note,
		NoteErr:             summary.NoteErr,
		PublicNote:          details.Memo,
		PublicNoteType:      details.MemoType,
		IssuerDescription:   summary.IssuerDescription,
		IssuerAccountID:     summary.IssuerAccountID,
		ExternalTxURL:       details.ExternalTxURL,
	}

	return payment, nil
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

	details, err := s.remoter.PaymentDetails(mctx.Ctx(), stellar1.TransactionIDFromPaymentID(arg.PaymentID).String())
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

func (s *Server) ChangeWalletAccountNameLocal(ctx context.Context, arg stellar1.ChangeWalletAccountNameLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ChangeWalletAccountNameLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	if arg.AccountID.IsNil() {
		mctx.CDebugf("ChangeWalletAccountNameLocal called with an empty account id")
		return ErrAccountIDMissing
	}

	return stellar.ChangeAccountName(mctx, arg.AccountID, arg.NewName)
}

func (s *Server) SetWalletAccountAsDefaultLocal(ctx context.Context, arg stellar1.SetWalletAccountAsDefaultLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "SetWalletAccountAsDefaultLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	if arg.AccountID.IsNil() {
		mctx.CDebugf("SetWalletAccountAsDefaultLocal called with an empty account id")
		return ErrAccountIDMissing
	}

	return stellar.SetAccountAsPrimary(mctx, arg.AccountID)
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
		mctx.CDebugf("DeleteWalletAccountLocal called with an empty account id")
		return ErrAccountIDMissing
	}

	return stellar.DeleteAccount(mctx, arg.AccountID)
}

func (s *Server) ChangeDisplayCurrencyLocal(ctx context.Context, arg stellar1.ChangeDisplayCurrencyLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ChangeDisplayCurrencyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	if arg.AccountID.IsNil() {
		return ErrAccountIDMissing
	}
	return remote.SetAccountDefaultCurrency(mctx.Ctx(), s.G(), arg.AccountID, string(arg.Currency))
}

func (s *Server) GetDisplayCurrencyLocal(ctx context.Context, arg stellar1.GetDisplayCurrencyLocalArg) (res stellar1.CurrencyLocal, err error) {
	defer s.G().CTraceTimed(ctx, "GetDisplayCurrencyLocal", func() error { return err })()
	mctx := libkb.NewMetaContext(ctx, s.G())
	if err = s.assertLoggedIn(mctx); err != nil {
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

	owns, _, err := stellar.OwnAccount(mctx, arg.From)
	if err != nil {
		return res, err
	}
	if !owns {
		return res, fmt.Errorf("account %s is not owned by current user", arg.From)
	}

	ourBalances, err := s.remoter.Balances(mctx.Ctx(), arg.From)
	if err != nil {
		return res, err
	}

	res = []stellar1.SendAssetChoiceLocal{}
	for _, bal := range ourBalances {
		asset := bal.Asset
		if asset.IsNativeXLM() {
			// We are only doing non-native assets here.
			continue
		}
		choice := stellar1.SendAssetChoiceLocal{
			Asset:   asset,
			Enabled: true,
			Left:    bal.Asset.Code,
			Right:   bal.Asset.Issuer,
		}
		res = append(res, choice)
	}

	if arg.To != "" {
		recipient, err := stellar.LookupRecipient(mctx, stellarcommon.RecipientInput(arg.To), false)
		if err != nil {
			s.G().Log.CDebugf(ctx, "Skipping asset filtering: stellar.LookupRecipient for %q failed with: %s",
				arg.To, err)
			return res, nil
		}

		theirBalancesHash := make(map[string]bool)
		assetHashCode := func(a stellar1.Asset) string {
			return fmt.Sprintf("%s%s%s", a.Type, a.Code, a.Issuer)
		}

		if recipient.AccountID != nil {
			theirBalances, err := s.remoter.Balances(mctx.Ctx(), stellar1.AccountID(recipient.AccountID.String()))
			if err != nil {
				s.G().Log.CDebugf(ctx, "Skipping asset filtering: remoter.Balances for %q failed with: %s",
					recipient.AccountID, err)
				return res, nil
			}
			for _, bal := range theirBalances {
				theirBalancesHash[assetHashCode(bal.Asset)] = true
			}
		}

		for i, choice := range res {
			available := theirBalancesHash[assetHashCode(choice.Asset)]
			if !available {
				choice.Enabled = false
				recipientStr := "Recipient"
				if recipient.User != nil {
					recipientStr = recipient.User.Username.String()
				}
				choice.Subtext = fmt.Sprintf("%s does not accept %s", recipientStr, choice.Asset.Code)
				res[i] = choice
			}
		}
	}

	return res, nil
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
		mctx.CDebugf("IsAccountMobileOnlyLocal called with an empty account id")
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
		mctx.CDebugf("IsAccountMobileOnlyLocal called with an empty account id")
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
		mctx.CDebugf("SetAccountMobileOnlyLocal called with an empty account id")
		return ErrAccountIDMissing
	}

	return s.remoter.SetAccountMobileOnly(mctx.Ctx(), arg.AccountID)
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
		mctx.CDebugf("SetAccountAllDevicesLocal called with an empty account id")
		return ErrAccountIDMissing
	}

	return s.remoter.MakeAccountAllDevices(mctx.Ctx(), arg.AccountID)
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
		mctx.CDebugf("GetInflationDestinationLocal called with an empty account id")
		return res, ErrAccountIDMissing
	}

	return stellar.GetInflationDestination(mctx, arg.AccountID)
}

func (s *Server) AirdropDetailsLocal(ctx context.Context, sessionID int) (details string, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "AirdropDetailsLocal",
		Err:           &err,
		RequireWallet: false,
	})
	defer fin()
	if err != nil {
		return "", err
	}

	return remote.AirdropDetails(mctx)
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
