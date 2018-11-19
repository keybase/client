// this file is for the implementation of all the frontend-requested service
// endpoints for wallets.
package stellarsvc

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
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
			availableAmount := subtractFeeSoft(s.mctx(ctx), details.Available)
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
		ShowCancel:           summary.ShowCancel,
		AmountDescription:    summary.AmountDescription,
		Delta:                summary.Delta,
		Worth:                summary.Worth,
		WorthCurrency:        summary.WorthCurrency,
		CurrentWorth:         summary.CurrentWorth,
		CurrentWorthCurrency: summary.CurrentWorthCurrency,
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

	tracer := s.G().CTimeTracer(ctx, "BuildPaymentLocal", true)
	defer tracer.Finish()

	ctx = s.buildPaymentSlot.Use(ctx, arg.SessionID)

	if err := ctx.Err(); err != nil {
		return res, err
	}

	readyChecklist := struct {
		from       bool
		to         bool
		amount     bool
		secretNote bool
		publicMemo bool
	}{}
	log := func(format string, args ...interface{}) {
		s.G().Log.CDebugf(ctx, "bpl: "+format, args...)
	}

	bpc := stellar.GetBuildPaymentCache(s.mctx(ctx))
	if bpc == nil {
		return res, fmt.Errorf("missing build payment cache")
	}

	// -------------------- from --------------------

	tracer.Stage("from")
	fromInfo := struct {
		available bool
		from      stellar1.AccountID
	}{}
	if arg.FromPrimaryAccount != arg.From.IsNil() {
		// Exactly one of `from` and `fromPrimaryAccount` must be set.
		return res, fmt.Errorf("invalid build payment parameters")
	}
	fromPrimaryAccount := arg.FromPrimaryAccount
	if arg.FromPrimaryAccount {
		primaryAccountID, err := bpc.PrimaryAccount(s.mctx(ctx))
		if err != nil {
			log("PrimaryAccount -> err:%v", err)
			res.Banners = append(res.Banners, stellar1.SendBannerLocal{
				Level:   "error",
				Message: "Could not find primary account.",
			})
		} else {
			fromInfo.from = primaryAccountID
			fromInfo.available = true
		}
	} else {
		owns, fromPrimary, err := bpc.OwnsAccount(s.mctx(ctx), arg.From)
		if err != nil || !owns {
			log("OwnsAccount (from) -> owns:%v err:%v", owns, err)
			res.Banners = append(res.Banners, stellar1.SendBannerLocal{
				Level:   "error",
				Message: "Could not find source account.",
			})
		} else {
			fromInfo.from = arg.From
			fromInfo.available = true
			fromPrimaryAccount = fromPrimary
		}
	}
	if fromInfo.available {
		res.From = fromInfo.from
		if arg.FromSeqno == "" {
			readyChecklist.from = true
		} else {
			// Check that the seqno of the account matches the caller's expectation.
			seqno, err := bpc.AccountSeqno(s.mctx(ctx), arg.From)
			switch {
			case err != nil:
				log("AccountSeqno -> err:%v", err)
				res.Banners = append(res.Banners, stellar1.SendBannerLocal{
					Level:   "error",
					Message: "Could not get seqno for source account.",
				})
			case seqno != arg.FromSeqno:
				log("AccountSeqno -> got:%v != want:%v", seqno, arg.FromSeqno)
				res.Banners = append(res.Banners, stellar1.SendBannerLocal{
					Level:   "error",
					Message: "Activity on account since initiating send. Take another look at account history.",
				})
			default:
				readyChecklist.from = true
				fromInfo.from = arg.From
				fromInfo.available = true
			}
		}
	}

	// -------------------- to --------------------

	tracer.Stage("to")
	skipRecipient := len(arg.To) == 0
	var minAmountXLM string
	if !skipRecipient && arg.ToIsAccountID {
		_, err := libkb.ParseStellarAccountID(arg.To)
		if err != nil {
			res.ToErrMsg = err.Error()
			skipRecipient = true
		} else {
			readyChecklist.to = true
		}
	}
	if !skipRecipient {
		recipient, err := bpc.LookupRecipient(s.mctx(ctx), stellarcommon.RecipientInput(arg.To))
		if err != nil {
			log("error with recipient field %v: %v", arg.To, err)
			res.ToErrMsg = "Recipient not found."
			skipRecipient = true
		} else {
			bannerThey := "they"
			bannerTheir := "their"
			if recipient.User != nil && !arg.ToIsAccountID {
				bannerThey = recipient.User.Username.String()
				bannerTheir = fmt.Sprintf("%s's", recipient.User.Username)
			}
			if recipient.AccountID == nil && !fromPrimaryAccount {
				// This would have been a relay from a non-primary account.
				// We cannot allow that.
				res.Banners = append(res.Banners, stellar1.SendBannerLocal{
					Level:   "error",
					Message: fmt.Sprintf("Because %v hasn’t set up their wallet yet, you can only send to them from your default account.", bannerThey),
				})
			} else {
				readyChecklist.to = true
				addMinBanner := func(them, amount string) {
					res.Banners = append(res.Banners, stellar1.SendBannerLocal{
						HideOnConfirm: true,
						Level:         "info",
						Message:       fmt.Sprintf("Because it's %s first transaction, you must send at least %s XLM.", them, amount),
					})
				}
				if recipient.AccountID == nil {
					// Sending a payment to a target with no account. (relay)
					minAmountXLM = "2.01"
					addMinBanner(bannerTheir, minAmountXLM)
				} else {
					isFunded, err := bpc.IsAccountFunded(s.mctx(ctx), stellar1.AccountID(recipient.AccountID.String()))
					if err != nil {
						log("error checking recipient funding status %v: %v", *recipient.AccountID, err)
					} else if !isFunded {
						// Sending to a non-funded stellar account.
						minAmountXLM = "1"
						owns, _, err := bpc.OwnsAccount(s.mctx(ctx), stellar1.AccountID(recipient.AccountID.String()))
						log("OwnsAccount (to) -> owns:%v err:%v", owns, err)
						if !owns || err != nil {
							// Likely sending to someone else's account.
							addMinBanner(bannerTheir, minAmountXLM)
						} else {
							// Sending to our own account.
							res.Banners = append(res.Banners, stellar1.SendBannerLocal{
								HideOnConfirm: true,
								Level:         "info",
								Message:       fmt.Sprintf("Because it's the first transaction on your receiving account, you must send at least %v.", minAmountXLM),
							})
						}
					}
				}
			}
		}
	}

	// -------------------- amount + asset --------------------

	tracer.Stage("amount + asset")
	bpaArg := buildPaymentAmountArg{
		Amount:   arg.Amount,
		Currency: arg.Currency,
		Asset:    arg.Asset,
	}
	if fromInfo.available {
		bpaArg.From = &fromInfo.from
	}
	amountX := s.buildPaymentAmountHelper(ctx, bpc, bpaArg)
	res.AmountErrMsg = amountX.amountErrMsg
	res.WorthDescription = amountX.worthDescription
	res.WorthInfo = amountX.worthInfo
	res.WorthCurrency = amountX.worthCurrency
	res.DisplayAmountXLM = amountX.displayAmountXLM
	res.DisplayAmountFiat = amountX.displayAmountFiat
	res.SendingIntentionXLM = amountX.sendingIntentionXLM

	if amountX.haveAmount {
		if !amountX.asset.IsNativeXLM() {
			return res, fmt.Errorf("sending non-XLM assets is not supported")
		}
		readyChecklist.amount = true

		if fromInfo.available {
			// Check that the sender has enough asset available.
			// Note: When adding support for sending non-XLM assets, check the asset instead of XLM here.
			availableToSendXLM, err := bpc.AvailableXLMToSend(s.mctx(ctx), fromInfo.from)
			availableToSendXLM = subtractFeeSoft(s.mctx(ctx), availableToSendXLM)
			if err != nil {
				log("error getting available balance: %v", err)
			} else {
				cmp, err := stellarnet.CompareStellarAmounts(availableToSendXLM, amountX.amountOfAsset)
				switch {
				case err != nil:
					log("error comparing amounts (%v) (%v): %v", availableToSendXLM, amountX.amountOfAsset, err)
				case cmp == -1:
					log("Send amount is more than available to send %v > %v", amountX.amountOfAsset, availableToSendXLM)
					readyChecklist.amount = false // block sending
					res.AmountErrMsg = fmt.Sprintf("Your available to send is *%s XLM*.", availableToSendXLM)
					availableToSendXLMFmt, err := stellar.FormatAmount(
						availableToSendXLM, false, stellar.FmtTruncate)
					if err == nil {
						res.AmountErrMsg = fmt.Sprintf("Your available to send is *%s XLM*.", availableToSendXLMFmt)
					}
					if arg.Currency != nil && amountX.rate != nil {
						// If the user entered an amount in outside currency and an exchange
						// rate is available, attempt to show them available balance in that currency.
						availableToSendOutside, err := stellarnet.ConvertXLMToOutside(availableToSendXLM, amountX.rate.Rate)
						if err != nil {
							log("error converting available-to-send", err)
						} else {
							formattedATS, err := stellar.FormatCurrencyWithCodeSuffix(ctx, s.G(),
								availableToSendOutside, amountX.rate.Currency, stellar.FmtTruncate)
							if err != nil {
								log("error formatting available-to-send", err)
							} else {
								res.AmountErrMsg = fmt.Sprintf("Your available to send is *%s*.", formattedATS)
							}
						}
					}
				default:
					// Welcome back. How was your stay at the error handling hotel?
				}
			}
		}

		if minAmountXLM != "" {
			cmp, err := stellarnet.CompareStellarAmounts(amountX.amountOfAsset, minAmountXLM)
			switch {
			case err != nil:
				log("error comparing amounts", err)
			case cmp == -1:
				// amount is less than minAmountXLM
				readyChecklist.amount = false // block sending
				res.AmountErrMsg = fmt.Sprintf("You must send at least *%s XLM*", minAmountXLM)
			}
		}

		// Note: When adding support for sending non-XLM assets, check here that the recipient accepts the asset.
	}

	// helper so the GUI doesn't have to call FormatCurrency separately
	if arg.Currency != nil {
		res.WorthAmount = amountX.amountOfAsset
	}

	// -------------------- note + memo --------------------

	tracer.Stage("note + memo")
	if len(arg.SecretNote) <= 500 {
		readyChecklist.secretNote = true
	} else {
		res.SecretNoteErrMsg = "Note is too long."
	}

	if len(arg.PublicMemo) <= 28 {
		readyChecklist.publicMemo = true
	} else {
		res.PublicMemoErrMsg = "Memo is too long."
	}

	// -------------------- end --------------------

	if readyChecklist.from && readyChecklist.to && readyChecklist.amount && readyChecklist.secretNote && readyChecklist.publicMemo {
		res.ReadyToSend = true
	}
	// Return the context's error.
	// If just `nil` were returned then in the event of a cancellation
	// resilient parts of this function could hide it, causing
	// a bogus return value.
	return res, ctx.Err()
}

type buildPaymentAmountArg struct {
	// See buildPaymentLocal in avdl from which these args are copied.
	Amount   string
	Currency *stellar1.OutsideCurrencyCode
	Asset    *stellar1.Asset
	From     *stellar1.AccountID
}

type buildPaymentAmountResult struct {
	haveAmount       bool // whether `amountOfAsset` and `asset` are valid
	amountOfAsset    string
	asset            stellar1.Asset
	amountErrMsg     string
	worthDescription string
	worthInfo        string
	worthCurrency    string
	// Rate may be nil if there was an error fetching it.
	rate                *stellar1.OutsideExchangeRate
	displayAmountXLM    string
	displayAmountFiat   string
	sendingIntentionXLM bool
}

func (s *Server) buildPaymentAmountHelper(ctx context.Context, bpc stellar.BuildPaymentCache, arg buildPaymentAmountArg) (res buildPaymentAmountResult) {
	log := func(format string, args ...interface{}) {
		s.G().Log.CDebugf(ctx, "bpl: "+format, args...)
	}
	res.asset = stellar1.AssetNative()
	switch {
	case arg.Currency != nil && arg.Asset == nil:
		// Amount is of outside currency.
		res.sendingIntentionXLM = false
		convertAmountOutside := "0"
		if arg.Amount == "" {
			// No amount given. Still convert for 0.
		} else {
			amount, err := stellarnet.ParseAmount(arg.Amount)
			if err != nil || amount.Sign() < 0 {
				// Invalid or negative amount.
				res.amountErrMsg = "Invalid amount."
				return res
			}
			if amount.Sign() > 0 {
				// Only save the amount if it's non-zero. So that =="0" later works.
				convertAmountOutside = arg.Amount
			}
		}
		xrate, err := bpc.GetOutsideExchangeRate(s.mctx(ctx), *arg.Currency)
		if err != nil {
			log("error getting exchange rate for %v: %v", arg.Currency, err)
			res.amountErrMsg = fmt.Sprintf("Could not get exchange rate for %v", arg.Currency.String())
			return res
		}
		res.rate = &xrate
		xlmAmount, err := stellarnet.ConvertOutsideToXLM(convertAmountOutside, xrate.Rate)
		if err != nil {
			log("error converting: %v", err)
			res.amountErrMsg = fmt.Sprintf("Could not convert to XLM")
			return res
		}
		res.amountOfAsset = xlmAmount
		xlmAmountFormatted, err := stellar.FormatAmountDescriptionXLM(xlmAmount)
		if err != nil {
			log("error formatting converted XLM amount: %v", err)
			res.amountErrMsg = fmt.Sprintf("Could not convert to XLM")
			return res
		}
		res.worthDescription = xlmAmountFormatted
		res.worthCurrency = string(*arg.Currency)
		if convertAmountOutside != "0" {
			// haveAmount gates whether the send button is enabled.
			// Only enable after `worthDescription` is set.
			// Don't allow the user to send if they haven't seen `worthDescription`,
			// since that's what they are really sending.
			res.haveAmount = true
		}
		res.worthInfo, err = s.buildPaymentWorthInfo(ctx, xrate)
		if err != nil {
			log("error making worth info: %v", err)
			res.worthInfo = ""
		}

		res.displayAmountXLM = xlmAmountFormatted
		res.displayAmountFiat, err = stellar.FormatCurrencyWithCodeSuffix(ctx, s.G(),
			convertAmountOutside, *arg.Currency, stellar.FmtRound)
		if err != nil {
			log("error converting for displayAmountFiat: %q / %q : %s", convertAmountOutside, arg.Currency, err)
			res.displayAmountFiat = ""
		}

		return res
	case arg.Currency == nil:
		res.sendingIntentionXLM = true
		if arg.Asset != nil {
			res.asset = *arg.Asset
		}
		// Amount is of asset.
		useAmount := "0"
		if arg.Amount != "" {
			amountInt64, err := stellarnet.ParseStellarAmount(arg.Amount)
			if err != nil || amountInt64 <= 0 {
				res.amountErrMsg = "Invalid amount."
				return res
			}
			res.amountOfAsset = arg.Amount
			res.haveAmount = true
			useAmount = arg.Amount
		}
		if !res.asset.IsNativeXLM() {
			res.sendingIntentionXLM = false
			// If sending non-XLM asset, don't try to show a worth.
			return res
		}
		// Attempt to show the converted amount in outside currency.
		// Unlike when sending based on outside currency, conversion is not critical.
		if arg.From == nil {
			log("missing from address so can't convert XLM amount")
			return res
		}
		currency, err := bpc.GetOutsideCurrencyPreference(s.mctx(ctx), *arg.From)
		if err != nil {
			log("error getting preferred currency for %v: %v", *arg.From, err)
			return res
		}
		xrate, err := bpc.GetOutsideExchangeRate(s.mctx(ctx), currency)
		if err != nil {
			log("error getting exchange rate for %v: %v", currency, err)
			return res
		}
		res.rate = &xrate
		outsideAmount, err := stellarnet.ConvertXLMToOutside(useAmount, xrate.Rate)
		if err != nil {
			log("error converting: %v", err)
			return res
		}
		outsideAmountFormatted, err := stellar.FormatCurrencyWithCodeSuffix(ctx, s.G(),
			outsideAmount, xrate.Currency, stellar.FmtRound)
		if err != nil {
			log("error formatting converted outside amount: %v", err)
			return res
		}
		res.worthDescription = outsideAmountFormatted
		res.worthCurrency = string(currency)
		res.worthInfo, err = s.buildPaymentWorthInfo(ctx, xrate)
		if err != nil {
			log("error making worth info: %v", err)
			res.worthInfo = ""
		}

		res.displayAmountXLM, err = stellar.FormatAmountDescriptionXLM(arg.Amount)
		if err != nil {
			log("error formatting xlm %q: %s", arg.Amount, err)
			res.displayAmountXLM = ""
		}
		if arg.Amount != "" {
			res.displayAmountFiat, err = stellar.FormatCurrencyWithCodeSuffix(ctx, s.G(),
				outsideAmount, xrate.Currency, stellar.FmtRound)
			if err != nil {
				log("error formatting fiat %q / %v: %s", outsideAmount, xrate.Currency, err)
				res.displayAmountFiat = ""
			}
		}

		return res
	default:
		// This is an API contract problem.
		s.G().Log.CWarningf(ctx, "Only one of Asset and Currency parameters should be filled")
		res.amountErrMsg = "Error in communication"
		return res
	}
}

func (s *Server) buildPaymentWorthInfo(ctx context.Context, rate stellar1.OutsideExchangeRate) (worthInfo string, err error) {
	oneOutsideFormatted, err := stellar.FormatCurrency(ctx, s.G(), "1", rate.Currency, stellar.FmtRound)
	if err != nil {
		return "", err
	}
	amountXLM, err := stellarnet.ConvertOutsideToXLM("1", rate.Rate)
	if err != nil {
		return "", err
	}
	amountXLMFormatted, err := stellar.FormatAmountDescriptionXLM(amountXLM)
	if err != nil {
		return "", err
	}
	worthInfo = fmt.Sprintf("%s = %s\nSource: coinmarketcap.com", oneOutsideFormatted, amountXLMFormatted)
	return worthInfo, nil
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

	if len(arg.From) == 0 {
		return res, fmt.Errorf("missing from account ID parameter")
	}

	var fromSeqno *uint64
	if arg.FromSeqno != "" {
		fsq, err := strconv.ParseUint(arg.FromSeqno, 10, 64)
		if err != nil {
			return res, fmt.Errorf("invalid from seqno (%v): %v", arg.FromSeqno, err)
		}
		fromSeqno = &fsq
	}

	to := arg.To
	if arg.ToIsAccountID {
		toAccountID, err := libkb.ParseStellarAccountID(arg.To)
		if err != nil {
			if verr, ok := err.(libkb.VerboseError); ok {
				s.G().Log.CDebugf(ctx, verr.Verbose())
			}
			return res, fmt.Errorf("recipient: %v", err)
		}
		to = toAccountID.String()
	}

	if !arg.Asset.IsNativeXLM() {
		return res, fmt.Errorf("sending non-XLM assets is not supported")
	}

	var displayBalance stellar.DisplayBalance
	if arg.WorthAmount != "" {
		if arg.WorthCurrency == nil {
			return res, fmt.Errorf("missing worth currency")
		}
		displayBalance = stellar.DisplayBalance{
			Amount:   arg.WorthAmount,
			Currency: arg.WorthCurrency.String(),
		}
	}

	mctx := libkb.NewMetaContext(ctx, s.G())
	sendRes, err := stellar.SendPaymentGUI(mctx, s.remoter, stellar.SendPaymentArg{
		From:           arg.From,
		FromSeqno:      fromSeqno,
		To:             stellarcommon.RecipientInput(to),
		Amount:         arg.Amount,
		DisplayBalance: displayBalance,
		SecretNote:     arg.SecretNote,
		PublicMemo:     arg.PublicMemo,
		ForceRelay:     false,
		QuickReturn:    arg.QuickReturn,
	})
	if err != nil {
		return res, err
	}
	return stellar1.SendPaymentResLocal{
		KbTxID:  sendRes.KbTxID,
		Pending: sendRes.Pending,
	}, nil

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

	tracer := s.G().CTimeTracer(ctx, "BuildRequestLocal", true)
	defer tracer.Finish()

	ctx = s.buildPaymentSlot.Use(ctx, arg.SessionID)
	if err := ctx.Err(); err != nil {
		return res, err
	}

	readyChecklist := struct {
		to         bool
		amount     bool
		secretNote bool
	}{}
	log := func(format string, args ...interface{}) {
		s.G().Log.CDebugf(ctx, "brl: "+format, args...)
	}

	bpc := stellar.GetBuildPaymentCache(s.mctx(ctx))
	if bpc == nil {
		return res, fmt.Errorf("missing build payment cache")
	}

	// -------------------- to --------------------

	tracer.Stage("to")
	skipRecipient := len(arg.To) == 0
	if !skipRecipient {
		_, err := bpc.LookupRecipient(s.mctx(ctx), stellarcommon.RecipientInput(arg.To))
		if err != nil {
			log("error with recipient field %v: %v", arg.To, err)
			res.ToErrMsg = "Recipient not found."
			skipRecipient = true
		} else {
			readyChecklist.to = true
		}
	}

	// -------------------- amount + asset --------------------

	tracer.Stage("amount + asset")
	bpaArg := buildPaymentAmountArg{
		Amount:   arg.Amount,
		Currency: arg.Currency,
		Asset:    arg.Asset,
	}

	// For requests From is always the primary account.
	primaryAccountID, err := bpc.PrimaryAccount(s.mctx(ctx))
	if err != nil {
		log("PrimaryAccount -> err:%v", err)
		res.Banners = append(res.Banners, stellar1.SendBannerLocal{
			Level:   "error",
			Message: "Could not find primary account.",
		})
	} else {
		bpaArg.From = &primaryAccountID
	}

	amountX := s.buildPaymentAmountHelper(ctx, bpc, bpaArg)
	res.AmountErrMsg = amountX.amountErrMsg
	res.WorthDescription = amountX.worthDescription
	res.WorthInfo = amountX.worthInfo
	res.DisplayAmountXLM = amountX.displayAmountXLM
	res.DisplayAmountFiat = amountX.displayAmountFiat
	res.SendingIntentionXLM = amountX.sendingIntentionXLM
	readyChecklist.amount = amountX.haveAmount

	// -------------------- note --------------------

	tracer.Stage("note")
	if len(arg.SecretNote) <= 500 {
		readyChecklist.secretNote = true
	} else {
		res.SecretNoteErrMsg = "Note is too long."
	}

	// -------------------- end --------------------

	if readyChecklist.to && readyChecklist.amount && readyChecklist.secretNote {
		res.ReadyToRequest = true
	}
	// Return the context's error.
	// If just `nil` were returned then in the event of a cancellation
	// resilient parts of this function could hide it, causing
	// a bogus return value.
	return res, ctx.Err()
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

// Subtract a 100 stroop fee from the available balance.
// This shows the real available balance assuming an intent to send a 1 op tx.
// Does not error out, just shows the inaccurate answer.
func subtractFeeSoft(mctx libkb.MetaContext, availableStr string) string {
	available, err := stellarnet.ParseStellarAmount(availableStr)
	if err != nil {
		mctx.CDebugf("error parsing available balance: %v", err)
		return availableStr
	}
	available -= 100
	if available < 0 {
		available = 0
	}
	return stellarnet.StringFromStellarAmount(available)
}
