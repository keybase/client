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
const ParticipantTypeKeybase = "keybase"
const ParticipantTypeStellar = "stellar"
const ParticipantTypeSBS = "sbs"

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
				displayAmount, rateErr = stellarnet.ConvertXLMToOutside(d.Amount, rate.Rate)
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

	formatted, err := stellar.FormatPaymentAmountXLM(amount, loc.Delta)
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
