// this file is for the implementation of all the frontend-requested service
// endpoints for wallets.
package stellarsvc

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/relays"
	"github.com/keybase/client/go/stellar/remote"
)

const WorthCurrencyErrorCode = "ERR"
const ParticipantTypeKeybase = "keybase"
const ParticipantTypeStellar = "stellar"
const ParticipantTypeSBS = "sbs"

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
			Code:        code,
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

func (s *Server) GetUserSettingsLocal(ctx context.Context, sessionID int) (userSettings stellar1.UserSettings, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "GetUserSettingsLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return userSettings, err
	}

	userSettings, err = remote.GetUserSettings(ctx, s.G())
	if err != nil {
		return userSettings, err
	}
	return userSettings, nil
}

func (s *Server) SetAcceptedDisclaimerLocal(ctx context.Context, sessionID int) (err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "SetAcceptedDisclaimerLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return err
	}

	return remote.SetAcceptedDisclaimer(ctx, s.G())
}

func (s *Server) LinkNewWalletAccountLocal(ctx context.Context, arg stellar1.LinkNewWalletAccountLocalArg) (accountID stellar1.AccountID, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "LinkNewWalletAccountLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
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

func (s *Server) GetPaymentsLocal(ctx context.Context, arg stellar1.GetPaymentsLocalArg) (payments []stellar1.PaymentOrErrorLocal, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "GetPaymentsLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return nil, err
	}

	srvPayments, err := s.remoter.RecentPayments(ctx, arg.AccountID, 0)
	if err != nil {
		return nil, err
	}
	payments = make([]stellar1.PaymentOrErrorLocal, len(srvPayments))
	for i, p := range srvPayments {
		payments[i].Payment, err = s.transformPaymentSummary(ctx, arg.AccountID, p)
		if err != nil {
			s := err.Error()
			payments[i].Err = &s
			payments[i].Payment = nil // just to make sure
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

	details, err := s.remoter.PaymentDetails(ctx, arg.Id.String())
	if err != nil {
		return payment, err
	}

	summary, err := s.transformPaymentSummary(ctx, arg.AccountID, details.Summary)
	if err != nil {
		return payment, err
	}

	payment = stellar1.PaymentDetailsLocal{
		Id:                summary.Id,
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
	loc.SourceType = ParticipantTypeStellar
	loc.Target = p.To.String()
	loc.TargetType = ParticipantTypeStellar

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
		loc.TargetType = ParticipantTypeKeybase
	} else {
		loc.Target = p.ToAssertion
		loc.TargetType = ParticipantTypeSBS
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
				loc.TargetType = ParticipantTypeKeybase
			} else {
				loc.Target = p.Claim.ToStellar.String()
				loc.TargetType = ParticipantTypeStellar
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

func (s *Server) lookupUsernameFallback(ctx context.Context, uid keybase1.UID, acctID stellar1.AccountID) (name, kind string) {
	name, err := s.lookupUsername(ctx, uid)
	if err == nil {
		return name, ParticipantTypeKeybase
	}
	return acctID.String(), ParticipantTypeStellar
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

func (a balanceList) nativeBalanceDescription() (string, error) {
	for _, b := range a {
		if b.Asset.IsNativeXLM() {
			return stellar.FormatAmountXLM(b.Amount)
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

func (s *Server) DeleteWalletAccountLocal(ctx context.Context, arg stellar1.DeleteWalletAccountLocalArg) (err error) {
	m := libkb.NewMetaContext(s.logTag(ctx), s.G())
	defer s.G().CTraceTimed(ctx, "DeleteWalletAccountLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return err
	}

	if arg.UserAcknowledged != "yes" {
		return errors.New("User did not acknowledge")
	}

	return stellar.DeleteAccount(m, arg.AccountID)
}

func (s *Server) ChangeDisplayCurrencyLocal(ctx context.Context, arg stellar1.ChangeDisplayCurrencyLocalArg) (err error) {
	defer s.G().CTraceTimed(ctx, "ChangeDisplayCurrencyLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
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

func (s *Server) GetWalletAccountPublicKeyLocal(ctx context.Context, arg stellar1.GetWalletAccountPublicKeyLocalArg) (res string, err error) {
	defer s.G().CTraceTimed(ctx, "GetWalletAccountPublicKeyLocal", func() error { return err })()
	if arg.AccountID.IsNil() {
		return res, errors.New("passed empty AccountID")
	}
	return arg.AccountID.String(), nil
}

func (s *Server) GetWalletAccountSecretKeyLocal(ctx context.Context, arg stellar1.GetWalletAccountSecretKeyLocalArg) (res stellar1.SecretKey, err error) {
	defer s.G().CTraceTimed(ctx, "GetWalletAccountSecretKeyLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	if arg.AccountID.IsNil() {
		return res, errors.New("passed empty AccountID")
	}

	return stellar.ExportSecretKey(ctx, s.G(), arg.AccountID)
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

	formatted, err := stellar.FormatPaymentAmountXLM(amount, loc.Delta)
	if err != nil {
		return nil, err
	}

	loc.AmountDescription = formatted

	return loc, nil
}
