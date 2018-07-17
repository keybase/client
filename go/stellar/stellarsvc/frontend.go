// this file is for the implementation of all the frontend-requested service
// endpoints for wallets.
package stellarsvc

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/relays"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
	stellaramount "github.com/stellar/go/amount"
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
		acct.BalanceDescription, err = balanceList(balances).balanceDescription()
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

func (s *Server) GetAccountAssetsLocal(ctx context.Context, arg stellar1.GetAccountAssetsLocalArg) (assets []stellar1.AccountAssetLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "GetAccountAssetsLocal",
		Err:     &err,
	})
	defer fin()
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
		s.G().Log.CDebugf(ctx, "Account has no balances - adding default 0 XLM balance")
		details.Balances = []stellar1.Balance{
			stellar1.Balance{
				Amount: "0",
				Asset:  stellar1.Asset{Type: "native"},
			},
		}
	}

	displayCurrency, err := remote.GetAccountDisplayCurrency(ctx, s.G(), arg.AccountID)
	if err != nil {
		return nil, err
	}
	s.G().Log.CDebugf(ctx, "Display currency for account %q is %q", arg.AccountID, displayCurrency)
	if displayCurrency == "" {
		displayCurrency = defaultOutsideCurrency
		s.G().Log.CDebugf(ctx, "Using default display currency %s for account %s", displayCurrency, arg.AccountID)
	}
	rate, rateErr := s.remoter.ExchangeRate(ctx, displayCurrency)
	if rateErr != nil {
		s.G().Log.CDebugf(ctx, "exchange rate error: %s", rateErr)
	}

	for _, d := range details.Balances {
		fmtAmount, err := stellar.FormatAmount(d.Amount, false)
		if err != nil {
			s.G().Log.CDebugf(ctx, "FormatAmount error: %s", err)
			return nil, err
		}

		if d.Asset.IsNativeXLM() {
			availableAmount := subtractFeeSoft(s.mctx(ctx), details.Available)
			fmtAvailable, err := stellar.FormatAmount(availableAmount, false)
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
				fmtWorth, err := stellar.FormatCurrency(ctx, s.G(), outsideAmount, rate.Currency)
				if err != nil {
					return fmt.Errorf("formatting converted amount: %v", err)
				}
				asset.Worth = fmtWorth
				outsideAvailableAmount, err := stellarnet.ConvertXLMToOutside(availableAmount, rate.Rate)
				if err != nil {
					return fmt.Errorf("converting available amount: %v", err)
				}
				fmtAvailableWorth, err := stellar.FormatCurrency(ctx, s.G(), outsideAvailableAmount, rate.Currency)
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
			assets = append(assets, asset)
		} else {
			assets = append(assets, stellar1.AccountAssetLocal{
				Name:                   d.Asset.Code,
				AssetCode:              d.Asset.Code,
				IssuerName:             "", // TODO get verified asset names
				IssuerAccountID:        d.Asset.Issuer,
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

func (s *Server) GetWalletSettingsLocal(ctx context.Context, sessionID int) (ret stellar1.WalletSettings, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "GetWalletSettingsLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return ret, err
	}
	ret.AcceptedDisclaimer, err = remote.GetAcceptedDisclaimer(ctx, s.G())
	if err != nil {
		return ret, err
	}
	return ret, nil
}

func (s *Server) SetAcceptedDisclaimerLocal(ctx context.Context, sessionID int) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName:       "SetAcceptedDisclaimerLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	return remote.SetAcceptedDisclaimer(ctx, s.G())
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

	srvPayments, err := s.remoter.RecentPayments(ctx, arg.AccountID, arg.Cursor, 0)
	if err != nil {
		return page, err
	}
	page.Payments = make([]stellar1.PaymentOrErrorLocal, len(srvPayments.Payments))
	for i, p := range srvPayments.Payments {
		page.Payments[i].Payment, err = s.transformPaymentSummary(ctx, arg.AccountID, p)
		if err != nil {
			s := err.Error()
			page.Payments[i].Err = &s
			page.Payments[i].Payment = nil // just to make sure
		}
	}
	page.Cursor = srvPayments.Cursor

	return page, nil
}

func (s *Server) GetPaymentDetailsLocal(ctx context.Context, arg stellar1.GetPaymentDetailsLocalArg) (payment stellar1.PaymentDetailsLocal, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "GetPaymentDetailsLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return payment, err
	}

	details, err := s.remoter.PaymentDetails(ctx, arg.Id.TxID.String())
	if err != nil {
		return payment, err
	}

	summary, err := s.transformPaymentSummary(ctx, arg.AccountID, details.Summary)
	if err != nil {
		return payment, err
	}

	payment = stellar1.PaymentDetailsLocal{
		Id:                summary.Id,
		TxID:              summary.Id.TxID,
		Time:              summary.Time,
		StatusSimplified:  summary.StatusSimplified,
		StatusDescription: summary.StatusDescription,
		StatusDetail:      summary.StatusDetail,
		AmountDescription: summary.AmountDescription,
		Delta:             summary.Delta,
		Worth:             summary.Worth,
		WorthCurrency:     summary.WorthCurrency,
		Source:            summary.Source,
		SourceType:        summary.SourceType,
		Target:            summary.Target,
		TargetType:        summary.TargetType,
		Note:              summary.Note,
		NoteErr:           summary.NoteErr,
		PublicNote:        details.Memo,
		PublicNoteType:    details.MemoType,
	}

	return payment, nil
}

func (s *Server) transformPaymentSummary(ctx context.Context, acctID stellar1.AccountID, p stellar1.PaymentSummary) (*stellar1.PaymentLocal, error) {
	typ, err := p.Typ()
	if err != nil {
		return nil, err
	}

	switch typ {
	case stellar1.PaymentSummaryType_STELLAR:
		return s.transformPaymentStellar(ctx, acctID, p.Stellar())
	case stellar1.PaymentSummaryType_DIRECT:
		return s.transformPaymentDirect(ctx, acctID, p.Direct())
	case stellar1.PaymentSummaryType_RELAY:
		return s.transformPaymentRelay(ctx, acctID, p.Relay())
	default:
		return nil, fmt.Errorf("unrecognized payment type: %s", typ)
	}
}

func (s *Server) transformPaymentStellar(ctx context.Context, acctID stellar1.AccountID, p stellar1.PaymentSummaryStellar) (*stellar1.PaymentLocal, error) {
	loc, err := newPaymentLocal(p.TxID, p.Ctime, p.Amount, p.From, p.To, acctID)
	if err != nil {
		return nil, err
	}

	loc.Source = p.From.String()
	loc.SourceType = stellar1.ParticipantType_STELLAR
	loc.Target = p.To.String()
	loc.TargetType = stellar1.ParticipantType_STELLAR

	loc.StatusSimplified = stellar1.PaymentStatus_COMPLETED
	loc.StatusDescription = strings.ToLower(loc.StatusSimplified.String())

	return loc, nil
}

func (s *Server) transformPaymentDirect(ctx context.Context, acctID stellar1.AccountID, p stellar1.PaymentSummaryDirect) (*stellar1.PaymentLocal, error) {
	loc, err := newPaymentLocal(p.TxID, p.Ctime, p.Amount, p.FromStellar, p.ToStellar, acctID)
	if err != nil {
		return nil, err
	}

	loc.Worth, loc.WorthCurrency, err = s.formatWorth(ctx, p.DisplayAmount, p.DisplayCurrency)
	if err != nil {
		return nil, err
	}

	loc.Source, loc.SourceType = s.lookupUsernameFallback(ctx, p.From.Uid, p.FromStellar)

	if p.To != nil {
		loc.Target, loc.TargetType = s.lookupUsernameFallback(ctx, p.To.Uid, p.ToStellar)
	} else {
		loc.Target = p.ToStellar.String()
		loc.TargetType = stellar1.ParticipantType_STELLAR
	}

	loc.StatusSimplified = p.TxStatus.ToPaymentStatus()
	loc.StatusDescription = strings.ToLower(loc.StatusSimplified.String())
	loc.StatusDetail = p.TxErrMsg

	loc.Note, loc.NoteErr = s.decryptNote(ctx, p.TxID, p.NoteB64)

	return loc, nil
}

func (s *Server) transformPaymentRelay(ctx context.Context, acctID stellar1.AccountID, p stellar1.PaymentSummaryRelay) (*stellar1.PaymentLocal, error) {
	var toStellar stellar1.AccountID
	if p.Claim != nil {
		toStellar = p.Claim.ToStellar
	}
	loc, err := newPaymentLocal(p.TxID, p.Ctime, p.Amount, p.FromStellar, toStellar, acctID)
	if err != nil {
		return nil, err
	}

	loc.Worth, loc.WorthCurrency, err = s.formatWorth(ctx, p.DisplayAmount, p.DisplayCurrency)
	if err != nil {
		return nil, err
	}

	loc.Source, loc.SourceType = s.lookupUsernameFallback(ctx, p.From.Uid, p.FromStellar)

	if p.To != nil {
		name, err := s.lookupUsername(ctx, p.To.Uid)
		if err != nil {
			s.G().Log.CDebugf(ctx, "recipient lookup failed: %s", err)
			return nil, errors.New("recipient lookup failed")
		}
		loc.Target = name
		loc.TargetType = stellar1.ParticipantType_KEYBASE
	} else {
		loc.Target = p.ToAssertion
		loc.TargetType = stellar1.ParticipantType_SBS
	}

	if p.TxStatus != stellar1.TransactionStatus_SUCCESS {
		// If the funding tx is not complete
		loc.StatusSimplified = p.TxStatus.ToPaymentStatus()
		loc.StatusDetail = p.TxErrMsg
	} else {
		loc.StatusSimplified = stellar1.PaymentStatus_CLAIMABLE
		loc.StatusDetail = "Waiting for the recipient to open the app to claim, or the sender to cancel."
	}
	if p.Claim != nil {
		loc.StatusSimplified = p.Claim.TxStatus.ToPaymentStatus()
		if p.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
			// If the claim succeeded, the relay payment is done.
			name, err := s.lookupUsername(ctx, p.Claim.To.Uid)
			if err == nil {
				loc.Target = name
				loc.TargetType = stellar1.ParticipantType_KEYBASE
			} else {
				loc.Target = p.Claim.ToStellar.String()
				loc.TargetType = stellar1.ParticipantType_STELLAR
			}
		} else {
			claimantUsername, err := s.lookupUsername(ctx, p.Claim.To.Uid)
			if err != nil {
				return nil, err
			}
			if p.Claim.TxErrMsg != "" {
				loc.StatusDetail = p.Claim.TxErrMsg
			} else {
				loc.StatusDetail = fmt.Sprintf("funded. Claim by %v is: %v", claimantUsername, loc.StatusSimplified.String())
			}
		}
	}
	loc.StatusDescription = strings.ToLower(loc.StatusSimplified.String())

	relaySecrets, err := relays.DecryptB64(ctx, s.G(), p.TeamID, p.BoxB64)
	if err == nil {
		loc.Note = relaySecrets.Note
	} else {
		loc.NoteErr = fmt.Sprintf("error decrypting note: %s", err)
	}

	return loc, nil
}

func (s *Server) lookupUsernameFallback(ctx context.Context, uid keybase1.UID, acctID stellar1.AccountID) (name string, kind stellar1.ParticipantType) {
	name, err := s.lookupUsername(ctx, uid)
	if err == nil {
		return name, stellar1.ParticipantType_KEYBASE
	}
	return acctID.String(), stellar1.ParticipantType_STELLAR
}

func (s *Server) lookupUsername(ctx context.Context, uid keybase1.UID) (string, error) {
	uname, err := s.G().GetUPAKLoader().LookupUsername(ctx, uid)
	if err != nil {
		return "", err
	}
	return uname.String(), nil
}

func (s *Server) formatWorth(ctx context.Context, amount, currency *string) (worth, worthCurrency string, err error) {
	if amount == nil || currency == nil {
		return "", "", nil
	}

	if len(*amount) == 0 || len(*currency) == 0 {
		return "", "", nil
	}

	worth, err = stellar.FormatCurrency(ctx, s.G(), *amount, stellar1.OutsideCurrencyCode(*currency))
	if err != nil {
		return "", "", err
	}

	return worth, *currency, nil
}

func (s *Server) decryptNote(ctx context.Context, txid stellar1.TransactionID, note string) (plaintext, errOutput string) {
	if len(note) == 0 {
		return "", ""
	}

	decrypted, err := stellar.NoteDecryptB64(ctx, s.G(), note)
	if err != nil {
		return "", fmt.Sprintf("failed to decrypt payment note: %s", err)
	}

	if decrypted.StellarID != txid {
		return "", "discarded note for wrong transaction ID"
	}

	return decrypted.Note, ""
}

type balanceList []stellar1.Balance

// Example: "56.0227002 XLM + more"
func (a balanceList) balanceDescription() (res string, err error) {
	var more bool
	for _, b := range a {
		if b.Asset.IsNativeXLM() {
			res, err = stellar.FormatAmountXLM(b.Amount)
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
	ctx, err, fin := s.Preamble(ctx, preambleArg{
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
	ctx, err, fin := s.Preamble(ctx, preambleArg{
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
	if arg.Name == "" {
		// No name is always acceptable.
		return nil
	}
	if utf8.RuneCountInString(arg.Name) > 60 {
		return fmt.Errorf("account name is too long")
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
			return fmt.Errorf("that account name is already taken")
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
	if arg.AccountID.IsNil() {
		return res, errors.New("passed empty AccountID")
	}
	return stellar.GetCurrencySetting(s.mctx(ctx), s.remoter, arg.AccountID)
}

func (s *Server) GetWalletAccountPublicKeyLocal(ctx context.Context, arg stellar1.GetWalletAccountPublicKeyLocalArg) (res string, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
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

	// Not implemented. CORE-8087
	return res, fmt.Errorf("GetSendAssetChoicesLocal not implemented")
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

	readyChecklist := struct {
		from       bool
		to         bool
		amount     bool
		secretNote bool
		publicMemo bool
	}{}
	uis := libkb.UIs{
		IdentifyUI: s.uiSource.IdentifyUI(s.G(), arg.SessionID),
	}
	log := func(format string, args ...interface{}) {
		s.G().Log.CDebugf(ctx, "bpl: "+format, args...)
	}

	bpc := stellar.GetBuildPaymentCache(s.mctx(ctx), s.remoter)
	if bpc == nil {
		return res, fmt.Errorf("missing build payment cache")
	}

	// -------------------- from --------------------

	tracer.Stage("from")
	fromInfo := struct {
		available bool
		from      stellar1.AccountID
	}{}
	owns, err := bpc.OwnsAccount(s.mctx(ctx), arg.From)
	if err != nil || !owns {
		log("UserOwnsAccount -> owns:%v err:%v", owns, err)
		res.Banners = append(res.Banners, stellar1.SendBannerLocal{
			Level:   "error",
			Message: "Could not find source account.",
		})
	} else {
		fromInfo.from = arg.From
		fromInfo.available = true
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
	var skipRecipient bool
	var minAmountXLM string
	if arg.ToIsAccountID {
		_, err := libkb.ParseStellarAccountID(arg.To)
		if err != nil {
			res.ToErrMsg = err.Error()
			skipRecipient = true
		} else {
			readyChecklist.to = true
		}
	}
	if !skipRecipient {
		recipient, err := bpc.LookupRecipient(s.mctx(ctx).WithUIs(uis), stellarcommon.RecipientInput(arg.To))
		if err != nil {
			log("error with recipient field %v: %v", arg.To, err)
			res.ToErrMsg = "recipient not found"
			skipRecipient = true
		} else {
			readyChecklist.to = true
			addMinBanner := func(them, amount string) {
				res.Banners = append(res.Banners, stellar1.SendBannerLocal{
					Level:   "info",
					Message: fmt.Sprintf("Because it's %s first transaction, you must send at least %s XLM.", them, amount),
				})
			}
			bannerThem := "their"
			if recipient.User != nil {
				bannerThem = fmt.Sprintf("%s's", recipient.User.GetNormalizedName())
			}
			if recipient.AccountID == nil {
				// Sending a payment to a target with no account. (relay)
				minAmountXLM = "2.01"
				addMinBanner(bannerThem, minAmountXLM)
			} else {
				isFunded, err := bpc.IsAccountFunded(s.mctx(ctx), stellar1.AccountID(recipient.AccountID.String()))
				if err != nil {
					log("error checking recipient funding status %v: %v", *recipient.AccountID, err)
				} else if !isFunded {
					// Sending to a non-funded stellar account.
					minAmountXLM = "1"
					addMinBanner(bannerThem, minAmountXLM)
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
					log("error comparing amounts", err)
				case cmp == -1:
					// Send amount is more than the available to send.
					readyChecklist.amount = false // block sending
					res.AmountErrMsg = fmt.Sprintf("Your available to send is *%s XLM*", availableToSendXLM)
					availableToSendXLMFmt, err := stellar.FormatAmount(availableToSendXLM, false)
					if err == nil {
						res.AmountErrMsg = fmt.Sprintf("Your available to send is *%s XLM*", availableToSendXLMFmt)
					}
					if arg.Currency != nil && amountX.rate != nil {
						// If the user entered an amount in outside currency and an exchange
						// rate is available, attempt to show them available balance in that currency.
						availableToSendOutside, err := stellarnet.ConvertXLMToOutside(availableToSendXLM, amountX.rate.Rate)
						if err != nil {
							log("error converting available-to-send", err)
						} else {
							formattedATS, err := stellar.FormatCurrency(ctx, s.G(), availableToSendOutside, amountX.rate.Currency)
							if err != nil {
								log("error formatting available-to-send", err)
							} else {
								res.AmountErrMsg = fmt.Sprintf("Your available to send is *%s*", formattedATS)
							}
						}
					}
				default:
					// Welcome back. How was your stay at the error handling hotel?
				}
			}
		}

		// Note: When adding support for sending non-XLM assets, check here that the recipient accepts the asset.
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
	return res, nil
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
	// Rate may be nil if there was an error fetching it.
	rate *stellar1.OutsideExchangeRate
}

func (s *Server) buildPaymentAmountHelper(ctx context.Context, bpc stellar.BuildPaymentCache, arg buildPaymentAmountArg) (res buildPaymentAmountResult) {
	log := func(format string, args ...interface{}) {
		s.G().Log.CDebugf(ctx, "bpl: "+format, args...)
	}
	res.asset = stellar1.AssetNative()
	switch {
	case arg.Currency != nil && arg.Asset == nil:
		// Amount is of outside currency.
		convertAmountOutside := "0"
		if arg.Amount == "" {
			// No amount given. Still convert for 0.
		} else {
			amount, err := stellarnet.ParseDecimalStrict(arg.Amount)
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
		xlmAmountFormatted, err := stellar.FormatAmountXLM(xlmAmount)
		if err != nil {
			log("error formatting converted XLM amount: %v", err)
			res.amountErrMsg = fmt.Sprintf("Could not convert to XLM")
			return res
		}
		res.worthDescription = fmt.Sprintf("This is *%s*", xlmAmountFormatted)
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
		return res
	case arg.Currency == nil:
		// Amount is of asset.
		useAmount := "0"
		if arg.Amount != "" {
			amountInt64, err := stellaramount.ParseInt64(arg.Amount)
			if err != nil || amountInt64 <= 0 {
				res.amountErrMsg = "Invalid amount."
				return res
			}
			res.amountOfAsset = arg.Amount
			res.haveAmount = true
			useAmount = arg.Amount
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
		outsideAmountFormatted, err := stellar.FormatCurrency(ctx, s.G(), outsideAmount, xrate.Currency)
		if err != nil {
			log("error formatting converted outside amount: %v", err)
			return res
		}
		res.worthDescription = fmt.Sprintf("This is *%s*", outsideAmountFormatted)
		res.worthInfo, err = s.buildPaymentWorthInfo(ctx, xrate)
		if err != nil {
			log("error making worth info: %v", err)
			res.worthInfo = ""
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
	oneOutsideFormatted, err := stellar.FormatCurrency(ctx, s.G(), "1", rate.Currency)
	if err != nil {
		return "", err
	}
	amountXLM, err := stellarnet.ConvertOutsideToXLM("1", rate.Rate)
	if err != nil {
		return "", err
	}
	amountXLMFormatted, err := stellar.FormatAmountXLM(amountXLM)
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

	uis := libkb.UIs{
		IdentifyUI: s.uiSource.IdentifyUI(s.G(), arg.SessionID),
	}
	mctx := libkb.NewMetaContext(ctx, s.G()).WithUIs(uis)
	sendRes, err := stellar.SendPayment(mctx, s.remoter, stellar.SendPaymentArg{
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

func newPaymentLocal(txID stellar1.TransactionID, ctime stellar1.TimeMs, amount string, from, to, requester stellar1.AccountID) (*stellar1.PaymentLocal, error) {
	loc := stellar1.NewPaymentLocal(txID, ctime)

	isSender := from == requester
	isRecipient := to == requester
	switch {
	case isSender && isRecipient:
		// sent to self
		loc.Delta = stellar1.BalanceDelta_NONE
	case isSender:
		loc.Delta = stellar1.BalanceDelta_DECREASE
	case isRecipient:
		loc.Delta = stellar1.BalanceDelta_INCREASE
	}

	formatted, err := stellar.FormatAmountXLM(amount)
	if err != nil {
		return nil, err
	}
	loc.AmountDescription = formatted

	return loc, nil
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

func (s *Server) GetRequestDetailsLocal(ctx context.Context, reqID stellar1.KeybaseRequestID) (res stellar1.RequestDetailsLocal, err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "GetRequestDetailsLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	details, err := s.remoter.RequestDetails(ctx, reqID)
	if err != nil {
		return res, err
	}

	fromAssertion, err := s.lookupUsername(ctx, details.FromUser.Uid)
	if err != nil {
		return res, fmt.Errorf("Failed to lookup username for %s: %s", details.FromUser.Uid, err)
	}

	res = stellar1.RequestDetailsLocal{
		Id:              details.Id,
		FromAssertion:   fromAssertion,
		FromCurrentUser: s.G().GetMyUID().Equal(details.FromUser.Uid),
		ToAssertion:     details.ToAssertion,
		Amount:          details.Amount,
		Asset:           details.Asset,
		Currency:        details.Currency,
		Completed:       !details.FundingKbTxID.IsNil(),
		FundingKbTxID:   details.FundingKbTxID,
		Status:          details.Status,
	}

	if details.ToUser != nil {
		res.ToUserType = stellar1.ParticipantType_KEYBASE
	} else {
		res.ToUserType = stellar1.ParticipantType_SBS
	}

	if details.Currency != nil {
		converToXLM := func() error {
			rate, err := s.remoter.ExchangeRate(ctx, details.Currency.String())
			if err != nil {
				return err
			}
			amountDesc, err := stellar.FormatAmountWithSuffix(details.Amount, false, rate.Currency.String())
			if err != nil {
				return err
			}
			xlms, err := stellarnet.ConvertOutsideToXLM(res.Amount, rate.Rate)
			if err != nil {
				return err
			}
			xlmDesc, err := stellar.FormatAmountWithSuffix(xlms, false, "XLM")
			if err != nil {
				return err
			}
			res.AmountDescription = amountDesc
			res.AmountStellar = xlms
			res.AmountStellarDescription = xlmDesc
			return nil
		}

		if err := converToXLM(); err != nil {
			s.G().Log.CDebugf(ctx, "error converting outside currency to XLM: %v", err)
		}
	} else if details.Asset != nil {
		// TODO: Pass info about issuer if Asset is not XLM.
		var code string
		if details.Asset.IsNativeXLM() {
			code = "XLM"
		} else {
			code = details.Asset.Code
		}
		res.AmountStellar = details.Amount
		xlmDesc, err := stellar.FormatAmountWithSuffix(details.Amount, false, code)
		if err == nil {
			res.AmountDescription = xlmDesc
			res.AmountStellarDescription = xlmDesc
		} else {
			s.G().Log.CDebugf(ctx, "error formatting Stellar amount: %v", err)
		}
	} else {
		return stellar1.RequestDetailsLocal{}, fmt.Errorf("malformed request - currency/asset not defined")
	}

	return res, nil
}

func (s *Server) CancelRequestLocal(ctx context.Context, reqID stellar1.KeybaseRequestID) (err error) {
	ctx, err, fin := s.Preamble(ctx, preambleArg{
		RPCName: "CancelRequestLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}

	return s.remoter.CancelRequest(ctx, reqID)
}

// Subtract a 100 stroop fee from the available balance.
// This shows the real available balance assuming an intent to send a 1 op tx.
// Does not error out, just shows the inaccurate answer.
func subtractFeeSoft(mctx libkb.MetaContext, availableStr string) string {
	available, err := stellaramount.ParseInt64(availableStr)
	if err != nil {
		mctx.CDebugf("error parsing available balance: %v", err)
		return availableStr
	}
	available -= 100
	if available < 0 {
		available = 0
	}
	return stellaramount.StringFromInt64(available)
}
