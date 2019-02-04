package stellar

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/relays"
	"github.com/keybase/client/go/stellar/remote"
)

// TransformPaymentSummaryGeneric converts a stellar1.PaymentSummary (p) into a
// stellar1.PaymentLocal, without any modifications based on who is viewing the transaction.
func TransformPaymentSummaryGeneric(mctx libkb.MetaContext, p stellar1.PaymentSummary, oc OwnAccountLookupCache) (*stellar1.PaymentLocal, error) {
	var emptyAccountID stellar1.AccountID
	return transformPaymentSummary(mctx, p, oc, emptyAccountID)
}

// TransformPaymentSummaryAccount converts a stellar1.PaymentSummary (p) into a
// stellar1.PaymentLocal, from the perspective of an owner of accountID.
func TransformPaymentSummaryAccount(mctx libkb.MetaContext, p stellar1.PaymentSummary, oc OwnAccountLookupCache, accountID stellar1.AccountID) (*stellar1.PaymentLocal, error) {
	return transformPaymentSummary(mctx, p, oc, accountID)
}

// transformPaymentSummary converts a stellar1.PaymentSummary (p) into a stellar1.PaymentLocal.
// accountID can be empty ("") and exchRate can be nil, if a generic response that isn't tied
// to an account is necessary.
func transformPaymentSummary(mctx libkb.MetaContext, p stellar1.PaymentSummary, oc OwnAccountLookupCache, accountID stellar1.AccountID) (*stellar1.PaymentLocal, error) {
	typ, err := p.Typ()
	if err != nil {
		return nil, err
	}

	switch typ {
	case stellar1.PaymentSummaryType_STELLAR:
		return transformPaymentStellar(mctx, accountID, p.Stellar(), oc)
	case stellar1.PaymentSummaryType_DIRECT:
		return transformPaymentDirect(mctx, accountID, p.Direct(), oc)
	case stellar1.PaymentSummaryType_RELAY:
		return transformPaymentRelay(mctx, accountID, p.Relay(), oc)
	default:
		return nil, fmt.Errorf("unrecognized payment type: %T", typ)
	}
}

func TransformRequestDetails(mctx libkb.MetaContext, details stellar1.RequestDetails) (*stellar1.RequestDetailsLocal, error) {
	fromAssertion, err := lookupUsername(mctx, details.FromUser.Uid)
	if err != nil {
		return nil, err
	}

	loc := stellar1.RequestDetailsLocal{
		Id:              details.Id,
		FromAssertion:   fromAssertion,
		FromCurrentUser: mctx.G().GetMyUID().Equal(details.FromUser.Uid),
		ToAssertion:     details.ToAssertion,
		Amount:          details.Amount,
		Asset:           details.Asset,
		Currency:        details.Currency,
		Status:          details.Status,
	}

	if details.ToUser != nil {
		loc.ToUserType = stellar1.ParticipantType_KEYBASE
	} else {
		loc.ToUserType = stellar1.ParticipantType_SBS
	}

	if details.Currency != nil {
		amountDesc, err := FormatCurrency(mctx, details.Amount, *details.Currency, FmtRound)
		if err != nil {
			amountDesc = details.Amount
			mctx.CDebugf("error formatting external currency: %s", err)
		}
		loc.AmountDescription = fmt.Sprintf("%s %s", amountDesc, *details.Currency)
	} else if details.Asset != nil {
		var code string
		if details.Asset.IsNativeXLM() {
			code = "XLM"
			if loc.FromCurrentUser {
				loc.WorthAtRequestTime, _, _ = formatWorth(mctx, &details.FromDisplayAmount, &details.FromDisplayCurrency)
			} else {
				loc.WorthAtRequestTime, _, _ = formatWorth(mctx, &details.ToDisplayAmount, &details.ToDisplayCurrency)
			}
		} else {
			code = details.Asset.Code
		}

		amountDesc, err := FormatAmountWithSuffix(mctx, details.Amount, false /* precisionTwo */, true /* simplify */, code)
		if err != nil {
			amountDesc = fmt.Sprintf("%s %s", details.Amount, code)
			mctx.CDebugf("error formatting amount for asset: %s", err)
		}
		loc.AmountDescription = amountDesc
	} else {
		return nil, errors.New("malformed request - currency/asset not defined")
	}

	return &loc, nil
}

// transformPaymentStellar converts a stellar1.PaymentSummaryStellar into a stellar1.PaymentLocal.
func transformPaymentStellar(mctx libkb.MetaContext, acctID stellar1.AccountID, p stellar1.PaymentSummaryStellar, oc OwnAccountLookupCache) (*stellar1.PaymentLocal, error) {
	loc, err := newPaymentLocal(mctx, p.TxID, p.Ctime, p.Amount, p.Asset)
	if err != nil {
		return nil, err
	}

	isSender := p.From.Eq(acctID)
	isRecipient := p.To.Eq(acctID)
	switch {
	case isSender && isRecipient:
		loc.Delta = stellar1.BalanceDelta_NONE
	case isSender:
		loc.Delta = stellar1.BalanceDelta_DECREASE
	case isRecipient:
		loc.Delta = stellar1.BalanceDelta_INCREASE
	}

	loc.FromAccountID = p.From
	loc.FromType = stellar1.ParticipantType_STELLAR
	loc.ToAccountID = &p.To
	loc.ToType = stellar1.ParticipantType_STELLAR
	fillOwnAccounts(mctx, loc, oc)

	loc.StatusSimplified = stellar1.PaymentStatus_COMPLETED
	loc.StatusDescription = strings.ToLower(loc.StatusSimplified.String())
	loc.Unread = p.Unread

	return loc, nil
}

func formatWorthAtSendTime(mctx libkb.MetaContext, p stellar1.PaymentSummaryDirect, isSender bool) (worthAtSendTime, worthCurrencyAtSendTime string, err error) {
	if p.DisplayCurrency == nil || len(*p.DisplayCurrency) == 0 {
		if isSender {
			return formatWorth(mctx, &p.FromDisplayAmount, &p.FromDisplayCurrency)
		}
		return formatWorth(mctx, &p.ToDisplayAmount, &p.ToDisplayCurrency)
	}
	// payment has a display currency, don't need this field
	return "", "", nil
}

// transformPaymentDirect converts a stellar1.PaymentSummaryDirect into a stellar1.PaymentLocal.
func transformPaymentDirect(mctx libkb.MetaContext, acctID stellar1.AccountID, p stellar1.PaymentSummaryDirect, oc OwnAccountLookupCache) (*stellar1.PaymentLocal, error) {
	loc, err := newPaymentLocal(mctx, p.TxID, p.Ctime, p.Amount, p.Asset)
	if err != nil {
		return nil, err
	}

	isSender := p.FromStellar.Eq(acctID)
	isRecipient := p.ToStellar.Eq(acctID)
	switch {
	case isSender && isRecipient:
		loc.Delta = stellar1.BalanceDelta_NONE
	case isSender:
		loc.Delta = stellar1.BalanceDelta_DECREASE
	case isRecipient:
		loc.Delta = stellar1.BalanceDelta_INCREASE
	}

	loc.Worth, _, err = formatWorth(mctx, p.DisplayAmount, p.DisplayCurrency)
	if err != nil {
		return nil, err
	}

	loc.FromAccountID = p.FromStellar
	loc.FromType = stellar1.ParticipantType_STELLAR
	if username, err := lookupUsername(mctx, p.From.Uid); err == nil {
		loc.FromUsername = username
		loc.FromType = stellar1.ParticipantType_KEYBASE
	}

	loc.ToAccountID = &p.ToStellar
	loc.ToType = stellar1.ParticipantType_STELLAR
	if p.To != nil {
		if username, err := lookupUsername(mctx, p.To.Uid); err == nil {
			loc.ToUsername = username
			loc.ToType = stellar1.ParticipantType_KEYBASE
		}
	}

	fillOwnAccounts(mctx, loc, oc)
	switch {
	case loc.FromAccountName != "":
		// we are sender
		loc.WorthAtSendTime, _, err = formatWorthAtSendTime(mctx, p, true)
	case loc.ToAccountName != "":
		// we are recipient
		loc.WorthAtSendTime, _, err = formatWorthAtSendTime(mctx, p, false)
	}
	if err != nil {
		return nil, err
	}

	loc.StatusSimplified = p.TxStatus.ToPaymentStatus()
	loc.StatusDescription = strings.ToLower(loc.StatusSimplified.String())
	loc.StatusDetail = p.TxErrMsg

	loc.Note, loc.NoteErr = decryptNote(mctx, p.TxID, p.NoteB64)

	return loc, nil
}

// transformPaymentRelay converts a stellar1.PaymentSummaryRelay into a stellar1.PaymentLocal.
func transformPaymentRelay(mctx libkb.MetaContext, acctID stellar1.AccountID, p stellar1.PaymentSummaryRelay, oc OwnAccountLookupCache) (*stellar1.PaymentLocal, error) {
	loc, err := newPaymentLocal(mctx, p.TxID, p.Ctime, p.Amount, stellar1.AssetNative())
	if err != nil {
		return nil, err
	}

	// isSender compares uid but not eldest-seqno because relays can survive resets.
	isSender := p.From.Uid.Equal(mctx.G().GetMyUID())
	loc.Delta = stellar1.BalanceDelta_INCREASE
	if isSender {
		loc.Delta = stellar1.BalanceDelta_DECREASE
	}

	loc.Worth, _, err = formatWorth(mctx, p.DisplayAmount, p.DisplayCurrency)
	if err != nil {
		return nil, err
	}

	loc.FromAccountID = p.FromStellar
	loc.FromUsername, err = lookupUsername(mctx, p.From.Uid)
	if err != nil {
		mctx.CDebugf("sender lookup failed: %s", err)
		return nil, errors.New("sender lookup failed")
	}
	loc.FromType = stellar1.ParticipantType_KEYBASE

	loc.ToAssertion = p.ToAssertion
	loc.ToType = stellar1.ParticipantType_SBS
	toName := loc.ToAssertion
	if p.To != nil {
		username, err := lookupUsername(mctx, p.To.Uid)
		if err != nil {
			mctx.CDebugf("recipient lookup failed: %s", err)
			return nil, errors.New("recipient lookup failed")
		}
		loc.ToUsername = username
		loc.ToType = stellar1.ParticipantType_KEYBASE
		toName = username
	}

	if p.TxStatus != stellar1.TransactionStatus_SUCCESS {
		// The funding tx is not complete.
		loc.StatusSimplified = p.TxStatus.ToPaymentStatus()
		loc.StatusDetail = p.TxErrMsg
	} else {
		loc.StatusSimplified = stellar1.PaymentStatus_CLAIMABLE
		if isSender {
			loc.StatusDetail = fmt.Sprintf("%v can claim this when they set up their wallet.", toName)
			loc.ShowCancel = true
		}
	}
	if p.Claim != nil {
		loc.StatusSimplified = p.Claim.ToPaymentStatus()
		loc.ToAccountID = &p.Claim.ToStellar
		loc.ToType = stellar1.ParticipantType_STELLAR
		loc.ToUsername = ""
		loc.ToAccountName = ""
		if p.Claim.ToPaymentStatus() == stellar1.PaymentStatus_CANCELED {
			// canceled payment. blank out toAssertion and stow in originalToAssertion
			// set delta to what it would have been had the payment completed
			loc.ToAssertion = ""
			loc.OriginalToAssertion = p.ToAssertion
			loc.Delta = stellar1.BalanceDelta_INCREASE
			if acctID == p.FromStellar {
				loc.Delta = stellar1.BalanceDelta_DECREASE
			}
		}
		if username, err := lookupUsername(mctx, p.Claim.To.Uid); err == nil {
			loc.ToUsername = username
			loc.ToType = stellar1.ParticipantType_KEYBASE
		}
		if p.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
			// If the claim succeeded, the relay payment is done.
			loc.ShowCancel = false
			loc.StatusDetail = ""
		} else {
			claimantUsername, err := lookupUsername(mctx, p.Claim.To.Uid)
			if err != nil {
				return nil, err
			}
			if p.Claim.TxErrMsg != "" {
				loc.StatusDetail = p.Claim.TxErrMsg
			} else {
				words := "is in the works"
				switch p.Claim.TxStatus {
				case stellar1.TransactionStatus_PENDING:
					words = "is pending"
				case stellar1.TransactionStatus_SUCCESS:
					words = "has succeeded"
				case stellar1.TransactionStatus_ERROR_TRANSIENT, stellar1.TransactionStatus_ERROR_PERMANENT:
					words = "has failed"
				}
				loc.StatusDetail = fmt.Sprintf("Funded. %v's claim %v.", claimantUsername, words)
			}
		}
	}
	loc.StatusDescription = strings.ToLower(loc.StatusSimplified.String())
	fillOwnAccounts(mctx, loc, oc)

	relaySecrets, err := relays.DecryptB64(mctx, p.TeamID, p.BoxB64)
	if err == nil {
		loc.Note = relaySecrets.Note
	} else {
		loc.NoteErr = fmt.Sprintf("error decrypting note: %s", err)
	}

	return loc, nil
}

func formatWorth(mctx libkb.MetaContext, amount, currency *string) (worth, worthCurrency string, err error) {
	if amount == nil || currency == nil {
		return "", "", nil
	}

	if len(*amount) == 0 || len(*currency) == 0 {
		return "", "", nil
	}

	worth, err = FormatCurrencyWithCodeSuffix(mctx, *amount, stellar1.OutsideCurrencyCode(*currency), FmtRound)
	if err != nil {
		return "", "", err
	}

	return worth, *currency, nil
}

func lookupUsername(mctx libkb.MetaContext, uid keybase1.UID) (string, error) {
	uname, err := mctx.G().GetUPAKLoader().LookupUsername(mctx.Ctx(), uid)
	if err != nil {
		return "", err
	}
	return uname.String(), nil
}

func fillOwnAccounts(mctx libkb.MetaContext, loc *stellar1.PaymentLocal, oc OwnAccountLookupCache) {
	lookupOwnAccountQuick := func(accountID *stellar1.AccountID) (accountName string) {
		if accountID == nil {
			return ""
		}
		own, name, err := oc.OwnAccount(mctx.Ctx(), *accountID)
		if err != nil || !own {
			return ""
		}
		if name != "" {
			return name
		}
		return accountID.String()
	}
	loc.FromAccountName = lookupOwnAccountQuick(&loc.FromAccountID)
	loc.ToAccountName = lookupOwnAccountQuick(loc.ToAccountID)
	if loc.FromAccountName != "" && loc.ToAccountName != "" {
		loc.FromType = stellar1.ParticipantType_OWNACCOUNT
		loc.ToType = stellar1.ParticipantType_OWNACCOUNT
	}
}

func decryptNote(mctx libkb.MetaContext, txid stellar1.TransactionID, note string) (plaintext, errOutput string) {
	if len(note) == 0 {
		return "", ""
	}

	decrypted, err := NoteDecryptB64(mctx, note)
	if err != nil {
		return "", fmt.Sprintf("failed to decrypt payment note: %s", err)
	}

	if decrypted.StellarID != txid {
		return "", "discarded note for wrong transaction ID"
	}

	return decrypted.Note, ""
}

func newPaymentLocal(mctx libkb.MetaContext, txID stellar1.TransactionID, ctime stellar1.TimeMs, amount string, asset stellar1.Asset) (*stellar1.PaymentLocal, error) {
	loc := stellar1.NewPaymentLocal(txID, ctime)

	formatted, err := FormatAmountDescriptionAsset(mctx, amount, asset)
	if err != nil {
		return nil, err
	}
	loc.AmountDescription = formatted

	if !asset.IsNativeXLM() {
		loc.IssuerDescription = FormatAssetIssuerString(asset)
		issuerAcc := stellar1.AccountID(asset.Issuer)
		loc.IssuerAccountID = &issuerAcc
	}

	return loc, nil
}

func RemoteRecentPaymentsToPage(mctx libkb.MetaContext, remoter remote.Remoter, accountID stellar1.AccountID, remotePage stellar1.PaymentsPage) (page stellar1.PaymentsPageLocal, err error) {
	oc := NewOwnAccountLookupCache(mctx)
	page.Payments = make([]stellar1.PaymentOrErrorLocal, len(remotePage.Payments))
	for i, p := range remotePage.Payments {
		page.Payments[i].Payment, err = TransformPaymentSummaryAccount(mctx, p, oc, accountID)
		if err != nil {
			mctx.CDebugf("RemoteRecentPaymentsToPage error transforming payment %v: %v", i, err)
			s := err.Error()
			page.Payments[i].Err = &s
			page.Payments[i].Payment = nil // just to make sure
		}
	}
	page.Cursor = remotePage.Cursor

	if remotePage.OldestUnread != nil {
		oldestUnread := stellar1.NewPaymentID(*remotePage.OldestUnread)
		page.OldestUnread = &oldestUnread
	}

	return page, nil

}

func RemotePendingToLocal(mctx libkb.MetaContext, remoter remote.Remoter, accountID stellar1.AccountID, pending []stellar1.PaymentSummary) (payments []stellar1.PaymentOrErrorLocal, err error) {
	oc := NewOwnAccountLookupCache(mctx)

	payments = make([]stellar1.PaymentOrErrorLocal, len(pending))
	for i, p := range pending {
		payment, err := TransformPaymentSummaryAccount(mctx, p, oc, accountID)
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

func AccountDetailsToWalletAccountLocal(mctx libkb.MetaContext, accountID stellar1.AccountID, details stellar1.AccountDetails, isPrimary bool, accountName string, accountMode stellar1.AccountMode) (stellar1.WalletAccountLocal, error) {

	var empty stellar1.WalletAccountLocal
	balance, err := balanceList(details.Balances).balanceDescription(mctx)
	if err != nil {
		return empty, err
	}

	isMobile := mctx.G().GetAppType() == libkb.MobileAppType
	ctime, err := mctx.G().ActiveDevice.Ctime(mctx)
	ctimeEpochSeconds := int64(ctime) / 1000
	deviceAge := time.Since(time.Unix(ctimeEpochSeconds, 0)).Hours() / 24.0 // in days

	acct := stellar1.WalletAccountLocal{
		AccountID:           accountID,
		IsDefault:           isPrimary,
		Name:                accountName,
		BalanceDescription:  balance,
		Seqno:               details.Seqno,
		AccountMode:         accountMode,
		AccountModeEditable: isMobile && deviceAge > 7,
	}

	conf, err := mctx.G().GetStellar().GetServerDefinitions(mctx.Ctx())
	if err == nil {
		currency, ok := conf.GetCurrencyLocal(stellar1.OutsideCurrencyCode(details.DisplayCurrency))
		if ok {
			acct.CurrencyLocal = currency
		}
	}

	return acct, nil
}

type balanceList []stellar1.Balance

// Example: "56.0227002 XLM + more"
func (a balanceList) balanceDescription(mctx libkb.MetaContext) (res string, err error) {
	var more bool
	for _, b := range a {
		if b.Asset.IsNativeXLM() {
			res, err = FormatAmountDescriptionXLM(mctx, b.Amount)
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

// TransformToAirdropStatus takes the result from api server status_check
// and transforms it into stellar1.AirdropStatus.
func TransformToAirdropStatus(status remote.AirdropStatusAPI) stellar1.AirdropStatus {
	var out stellar1.AirdropStatus
	switch {
	case status.AlreadyRegistered:
		out.State = stellar1.AirdropAccepted
	case status.Qualifications.QualifiesOverall:
		out.State = stellar1.AirdropQualified
	default:
		out.State = stellar1.AirdropUnqualified
	}

	dq := stellar1.AirdropQualification{
		Title: status.AirdropConfig.MinActiveDevicesTitle,
		Valid: status.Qualifications.HasEnoughDevices,
	}
	out.Rows = append(out.Rows, dq)

	aq := stellar1.AirdropQualification{
		Title: status.AirdropConfig.AccountCreationTitle,
	}

	var used []string
	for k, q := range status.Qualifications.ServiceChecks {
		if q.Qualifies {
			aq.Valid = true
			break
		}
		if q.Username == "" {
			continue
		}
		if !q.IsOldEnough {
			continue
		}
		if q.IsUsedAlready {
			used = append(used, fmt.Sprintf("%s@%s", q.Username, k))
		}
	}
	if !aq.Valid {
		aq.Subtitle = status.AirdropConfig.AccountCreationSubtitle
		if len(used) > 0 {
			usedDisplay := strings.Join(used, ", ")
			aq.Subtitle += " " + fmt.Sprintf(status.AirdropConfig.AccountUsed, usedDisplay)
		}
	}
	out.Rows = append(out.Rows, aq)

	return out
}
