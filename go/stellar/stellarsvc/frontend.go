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

func (s *Server) GetWalletAccountsLocal(ctx context.Context, sessionID int) (accts []stellar1.WalletAccountLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "GetWalletAccountsLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return nil, err
	}

	bundle, _, err := remote.Fetch(ctx, s.G())
	if err != nil {
		return nil, err
	}

	for _, entry := range bundle.Accounts {
		acct, err := s.accountLocal(ctx, entry)
		if err != nil {
			return nil, err
		}

		accts = append(accts, acct)
	}

	// Put the primary account first, then sort by name, then by account ID
	sort.SliceStable(accts, func(i, j int) bool {
		if accts[i].IsDefault {
			return true
		}
		if accts[j].IsDefault {
			return false
		}
		if accts[i].Name == accts[j].Name {
			return accts[i].AccountID < accts[j].AccountID
		}
		return accts[i].Name < accts[j].Name
	})

	return accts, nil
}

func (s *Server) GetWalletAccountLocal(ctx context.Context, arg stellar1.GetWalletAccountLocalArg) (acct stellar1.WalletAccountLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "GetWalletAccountLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return acct, err
	}

	bundle, _, err := remote.Fetch(ctx, s.G())
	if err != nil {
		return acct, err
	}

	entry, err := bundle.Lookup(arg.AccountID)
	if err != nil {
		return acct, err
	}

	return s.accountLocal(ctx, entry)
}

func (s *Server) accountLocal(ctx context.Context, entry stellar1.BundleEntry) (stellar1.WalletAccountLocal, error) {
	var empty stellar1.WalletAccountLocal
	details, err := s.accountDetails(ctx, entry.AccountID)
	if err != nil {
		s.G().Log.CDebugf(ctx, "remote.Details failed for %q: %s", entry.AccountID, err)
		return empty, err
	}
	balance, err := balanceList(details.Balances).balanceDescription()
	if err != nil {
		return empty, err
	}

	acct := stellar1.WalletAccountLocal{
		AccountID:          entry.AccountID,
		IsDefault:          entry.IsPrimary,
		Name:               entry.Name,
		BalanceDescription: balance,
		Seqno:              details.Seqno,
	}

	return acct, nil

}

func (s *Server) GetAccountAssetsLocal(ctx context.Context, arg stellar1.GetAccountAssetsLocalArg) (assets []stellar1.AccountAssetLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "GetAccountAssetsLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return nil, err
	}

	mctx := libkb.NewMetaContext(ctx, s.G())

	details, err := s.accountDetails(ctx, arg.AccountID)
	if err != nil {
		s.G().Log.CDebugf(ctx, "remote.Details failed for %q: %s", arg.AccountID, err)
		return nil, err
	}

	if len(details.Balances) == 0 {
		// add an empty xlm balance
		s.G().Log.CDebugf(ctx, "Account has no balances - adding default 0 XLM balance")
		details.Balances = []stellar1.Balance{
			{
				Amount: "0",
				Asset:  stellar1.Asset{Type: "native"},
			},
		}
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
		fmtAmount, err := stellar.FormatAmount(d.Amount, false, stellar.FmtRound)
		if err != nil {
			s.G().Log.CDebugf(ctx, "FormatAmount error: %s", err)
			return nil, err
		}

		if d.Asset.IsNativeXLM() {
			availableAmount := stellar.SubtractFeeSoft(s.mctx(ctx), details.Available)
			fmtAvailable, err := stellar.FormatAmount(availableAmount, false, stellar.FmtRound)
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
				fmtWorth, err := stellar.FormatCurrencyWithCodeSuffix(ctx, s.G(),
					outsideAmount, rate.Currency, stellar.FmtRound)
				if err != nil {
					return fmt.Errorf("formatting converted amount: %v", err)
				}
				asset.Worth = fmtWorth
				outsideAvailableAmount, err := stellarnet.ConvertXLMToOutside(availableAmount, rate.Rate)
				if err != nil {
					return fmt.Errorf("converting available amount: %v", err)
				}
				fmtAvailableWorth, err := stellar.FormatCurrencyWithCodeSuffix(ctx, s.G(),
					outsideAvailableAmount, rate.Currency, stellar.FmtRound)
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
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "GetDisplayCurrenciesLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return nil, err
	}

	conf, err := s.G().GetStellar().GetServerDefinitions(ctx)
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
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "HasAcceptedDisclaimerLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return false, err
	}

	return stellar.HasAcceptedDisclaimer(ctx, s.G())
}

func (s *Server) AcceptDisclaimerLocal(ctx context.Context, sessionID int) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "AcceptDisclaimerLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}

	err = remote.SetAcceptedDisclaimer(ctx, s.G())
	if err != nil {
		return err
	}
	stellar.InformAcceptedDisclaimer(ctx, s.G())
	crg, err := stellar.CreateWalletGated(ctx, s.G())
	if err != nil {
		return err
	}
	if !crg.HasWallet {
		return fmt.Errorf("user wallet not created")
	}
	return nil
}

func (s *Server) LinkNewWalletAccountLocal(ctx context.Context, arg stellar1.LinkNewWalletAccountLocalArg) (accountID stellar1.AccountID, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
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

	err = stellar.ImportSecretKey(ctx, s.G(), arg.SecretKey, false, arg.Name)
	if err != nil {
		return "", err
	}

	return accountID, nil
}

func (s *Server) GetPaymentsLocal(ctx context.Context, arg stellar1.GetPaymentsLocalArg) (page stellar1.PaymentsPageLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "GetPaymentsLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return page, err
	}

	oc := stellar.NewOwnAccountLookupCache(ctx, s.G())
	srvPayments, err := s.remoter.RecentPayments(ctx, arg.AccountID, arg.Cursor, 0, true)
	if err != nil {
		return page, err
	}

	mctx := libkb.NewMetaContext(ctx, s.G())

	exchRate := s.accountExchangeRate(mctx, arg.AccountID)

	page.Payments = make([]stellar1.PaymentOrErrorLocal, len(srvPayments.Payments))
	for i, p := range srvPayments.Payments {
		page.Payments[i].Payment, err = stellar.TransformPaymentSummaryAccount(mctx, p, oc, arg.AccountID, exchRate)
		if err != nil {
			s.G().Log.CDebugf(ctx, "GetPaymentsLocal error transforming payment %v: %v", i, err)
			s := err.Error()
			page.Payments[i].Err = &s
			page.Payments[i].Payment = nil // just to make sure
		}
	}
	page.Cursor = srvPayments.Cursor

	if srvPayments.OldestUnread != nil {
		oldestUnread := stellar1.NewPaymentID(*srvPayments.OldestUnread)
		page.OldestUnread = &oldestUnread
	}

	return page, nil
}

func (s *Server) GetPendingPaymentsLocal(ctx context.Context, arg stellar1.GetPendingPaymentsLocalArg) (payments []stellar1.PaymentOrErrorLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "GetPendingPaymentsLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return nil, err
	}

	oc := stellar.NewOwnAccountLookupCache(ctx, s.G())
	pending, err := s.remoter.PendingPayments(ctx, arg.AccountID, 0)
	if err != nil {
		return nil, err
	}

	mctx := libkb.NewMetaContext(ctx, s.G())

	exchRate := s.accountExchangeRate(mctx, arg.AccountID)

	payments = make([]stellar1.PaymentOrErrorLocal, len(pending))
	for i, p := range pending {
		payment, err := stellar.TransformPaymentSummaryAccount(mctx, p, oc, arg.AccountID, exchRate)
		if err != nil {
			s := err.Error()
			payments[i].Err = &s
			payments[i].Payment = nil // just to make sure

		} else {
			payments[i].Payment = payment
			payments[i].Err = nil
		}
	}

	return payments, nil
}

func (s *Server) GetPaymentDetailsLocal(ctx context.Context, arg stellar1.GetPaymentDetailsLocalArg) (payment stellar1.PaymentDetailsLocal, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "GetPaymentDetailsLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return payment, err
	}

	oc := stellar.NewOwnAccountLookupCache(ctx, s.G())
	details, err := s.remoter.PaymentDetails(ctx, stellar1.TransactionIDFromPaymentID(arg.Id).String())
	if err != nil {
		return payment, err
	}

	mctx := libkb.NewMetaContext(ctx, s.G())
	var summary *stellar1.PaymentLocal

	// AccountID argument is optional.
	if arg.AccountID != nil {
		exchRate := s.accountExchangeRate(mctx, *arg.AccountID)
		summary, err = stellar.TransformPaymentSummaryAccount(mctx, details.Summary, oc, *arg.AccountID, exchRate)
	} else {
		summary, err = stellar.TransformPaymentSummaryGeneric(mctx, details.Summary, oc)
	}
	if err != nil {
		return payment, err
	}

	payment = stellar1.PaymentDetailsLocal{
		Id:                   summary.Id,
		TxID:                 stellar1.TransactionIDFromPaymentID(summary.Id),
		Time:                 summary.Time,
		StatusSimplified:     summary.StatusSimplified,
		StatusDescription:    summary.StatusDescription,
		StatusDetail:         summary.StatusDetail,
		AmountDescription:    summary.AmountDescription,
		Delta:                summary.Delta,
		Worth:                summary.Worth,
		WorthCurrency:        summary.WorthCurrency,
		FromType:             summary.FromType,
		ToType:               summary.ToType,
		FromAccountID:        summary.FromAccountID,
		FromAccountName:      summary.FromAccountName,
		FromUsername:         summary.FromUsername,
		ToAccountID:          summary.ToAccountID,
		ToAccountName:        summary.ToAccountName,
		ToUsername:           summary.ToUsername,
		ToAssertion:          summary.ToAssertion,
		OriginalToAssertion:  summary.OriginalToAssertion,
		Note:                 summary.Note,
		NoteErr:              summary.NoteErr,
		PublicNote:           details.Memo,
		PublicNoteType:       details.MemoType,
		CurrentWorth:         summary.CurrentWorth,
		CurrentWorthCurrency: summary.CurrentWorthCurrency,
		ExternalTxURL:        details.ExternalTxURL,
	}

	return payment, nil
}

func (s *Server) CancelPaymentLocal(ctx context.Context, arg stellar1.CancelPaymentLocalArg) (res stellar1.RelayClaimResult, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "CancelPaymentLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	details, err := s.remoter.PaymentDetails(ctx, stellar1.TransactionIDFromPaymentID(arg.PaymentID).String())
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
	return stellar.Claim(ctx, s.G(), s.remoter, relay.KbTxID.String(), relay.FromStellar, &dir, nil)
}

type balanceList []stellar1.Balance

// Example: "56.0227002 XLM + more"
func (a balanceList) balanceDescription() (res string, err error) {
	var more bool
	for _, b := range a {
		if b.Asset.IsNativeXLM() {
			res, err = stellar.FormatAmountDescriptionXLM(b.Amount)
			if err != nil {
				return "", err
			}
		} else {
			more = true
		}
	}
	if res == "" {
		res = "0 XLM"
	}
	if more {
		res += " + more"
	}
	return res, nil
}

func (s *Server) ValidateAccountIDLocal(ctx context.Context, arg stellar1.ValidateAccountIDLocalArg) (err error) {
	_, err, fin := s.Preamble(ctx, preambleArg{
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
	_, err, fin := s.Preamble(ctx, preambleArg{
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
	ctx, err, fin := s.Preamble(ctx, preambleArg{
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
	currentBundle, _, err := remote.Fetch(ctx, s.G())
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
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "ChangeWalletAccountNameLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}
	return stellar.ChangeAccountName(s.mctx(ctx), arg.AccountID, arg.NewName)
}

func (s *Server) SetWalletAccountAsDefaultLocal(ctx context.Context, arg stellar1.SetWalletAccountAsDefaultLocalArg) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "SetWalletAccountAsDefaultLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	return stellar.SetAccountAsPrimary(s.mctx(ctx), arg.AccountID)
}

func (s *Server) DeleteWalletAccountLocal(ctx context.Context, arg stellar1.DeleteWalletAccountLocalArg) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
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

	return stellar.DeleteAccount(s.mctx(ctx), arg.AccountID)
}

func (s *Server) ChangeDisplayCurrencyLocal(ctx context.Context, arg stellar1.ChangeDisplayCurrencyLocalArg) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "ChangeDisplayCurrencyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	if arg.AccountID.IsNil() {
		return errors.New("passed empty AccountID")
	}
	conf, err := s.G().GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return err
	}
	if _, ok := conf.Currencies[arg.Currency]; !ok {
		return fmt.Errorf("Unknown currency code: %q", arg.Currency)
	}
	return remote.SetAccountDefaultCurrency(ctx, s.G(), arg.AccountID, string(arg.Currency))
}

func (s *Server) GetDisplayCurrencyLocal(ctx context.Context, arg stellar1.GetDisplayCurrencyLocalArg) (res stellar1.CurrencyLocal, err error) {
	defer s.G().CTraceTimed(ctx, "GetDisplayCurrencyLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	accountID := arg.AccountID
	if accountID == nil {
		primaryAccountID, err := stellar.GetOwnPrimaryAccountID(ctx, s.G())
		if err != nil {
			return res, err
		}
		accountID = &primaryAccountID
	}
	return stellar.GetCurrencySetting(s.mctx(ctx), s.remoter, *accountID)
}

func (s *Server) GetWalletAccountPublicKeyLocal(ctx context.Context, arg stellar1.GetWalletAccountPublicKeyLocalArg) (res string, err error) {
	_, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:        "GetWalletAccountPublicKeyLocal",
		Err:            &err,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	if arg.AccountID.IsNil() {
		return res, errors.New("passed empty AccountID")
	}
	return arg.AccountID.String(), nil
}

func (s *Server) GetWalletAccountSecretKeyLocal(ctx context.Context, arg stellar1.GetWalletAccountSecretKeyLocalArg) (res stellar1.SecretKey, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "GetWalletAccountSecretKeyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	if arg.AccountID.IsNil() {
		return res, errors.New("passed empty AccountID")
	}
	return stellar.ExportSecretKey(ctx, s.G(), arg.AccountID)
}

func (s *Server) GetSendAssetChoicesLocal(ctx context.Context, arg stellar1.GetSendAssetChoicesLocalArg) (res []stellar1.SendAssetChoiceLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "GetSendAssetChoicesLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	owns, _, err := stellar.OwnAccount(ctx, s.G(), arg.From)
	if err != nil {
		return res, err
	}
	if !owns {
		return res, fmt.Errorf("account %s is not owned by current user", arg.From)
	}

	ourBalances, err := s.remoter.Balances(ctx, arg.From)
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
		mctx := s.mctx(ctx)

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
			theirBalances, err := s.remoter.Balances(ctx, stellar1.AccountID(recipient.AccountID.String()))
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

func (s *Server) BuildPaymentLocal(ctx context.Context, arg stellar1.BuildPaymentLocalArg) (res stellar1.BuildPaymentResLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "BuildPaymentLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}
	return stellar.BuildPaymentLocal(s.mctx(ctx), arg)
}

func (s *Server) SendPaymentLocal(ctx context.Context, arg stellar1.SendPaymentLocalArg) (res stellar1.SendPaymentResLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "SendPaymentLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}
	return stellar.SendPaymentLocal(s.mctx(ctx), arg)
}

func (s *Server) CreateWalletAccountLocal(ctx context.Context, arg stellar1.CreateWalletAccountLocalArg) (res stellar1.AccountID, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "CreateWalletAccountLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}
	return stellar.CreateNewAccount(s.mctx(ctx), arg.Name)
}

func (s *Server) BuildRequestLocal(ctx context.Context, arg stellar1.BuildRequestLocalArg) (res stellar1.BuildRequestResLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "BuildRequestLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}
	return stellar.BuildRequestLocal(s.mctx(ctx), arg)
}

func (s *Server) GetRequestDetailsLocal(ctx context.Context, arg stellar1.GetRequestDetailsLocalArg) (res stellar1.RequestDetailsLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "GetRequestDetailsLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return stellar1.RequestDetailsLocal{}, err
	}

	details, err := s.remoter.RequestDetails(ctx, arg.ReqID)
	if err != nil {
		return stellar1.RequestDetailsLocal{}, err
	}

	m := libkb.NewMetaContext(ctx, s.G())
	local, err := stellar.TransformRequestDetails(m, details)
	if err != nil {
		return stellar1.RequestDetailsLocal{}, err
	}

	return *local, nil
}

func (s *Server) MakeRequestLocal(ctx context.Context, arg stellar1.MakeRequestLocalArg) (res stellar1.KeybaseRequestID, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "MakeRequestLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return "", err
	}

	m := libkb.NewMetaContext(ctx, s.G())

	return stellar.MakeRequestGUI(m, s.remoter, stellar.MakeRequestArg{
		To:       stellarcommon.RecipientInput(arg.Recipient),
		Amount:   arg.Amount,
		Asset:    arg.Asset,
		Currency: arg.Currency,
		Note:     arg.Note,
	})
}

func (s *Server) CancelRequestLocal(ctx context.Context, arg stellar1.CancelRequestLocalArg) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "CancelRequestLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}

	return s.remoter.CancelRequest(ctx, arg.ReqID)
}

func (s *Server) MarkAsReadLocal(ctx context.Context, arg stellar1.MarkAsReadLocalArg) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "MarkAsReadLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	err = s.remoter.MarkAsRead(ctx, arg.AccountID, stellar1.TransactionIDFromPaymentID(arg.MostRecentID))
	if err != nil {
		return err
	}

	go stellar.RefreshUnreadCount(s.G(), arg.AccountID)

	return nil
}

func (s *Server) IsAccountMobileOnlyLocal(ctx context.Context, arg stellar1.IsAccountMobileOnlyLocalArg) (mobileOnly bool, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "IsAccountMobileOnlyLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return false, err
	}

	return s.remoter.IsAccountMobileOnly(ctx, arg.AccountID)
}

func (s *Server) SetAccountMobileOnlyLocal(ctx context.Context, arg stellar1.SetAccountMobileOnlyLocalArg) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "SetAccountMobileOnlyLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}

	return s.remoter.SetAccountMobileOnly(ctx, arg.AccountID)
}

// accountExchangeRate gets the exchange rate for the logged in user's currency
// preference for accountID.  If any errors occur, it logs them and returns a
// nil result.
func (s *Server) accountExchangeRate(mctx libkb.MetaContext, accountID stellar1.AccountID) *stellar1.OutsideExchangeRate {
	exchRate, err := stellar.AccountExchangeRate(mctx, s.remoter, accountID)
	if err != nil {
		// this shouldn't be fatal, just a temporary inconvenience
		mctx.CInfof("error getting exchange rate for %s: %s", accountID, err)
		return nil
	}

	return &exchRate
}
