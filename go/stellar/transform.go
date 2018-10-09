package stellar

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/relays"
	"github.com/keybase/stellarnet"
)

// TransformPaymentSummaryGeneric converts a stellar1.PaymentSummary (p) into a
// stellar1.PaymentLocal, without any modifications based on who is viewing the transaction.
func TransformPaymentSummaryGeneric(mctx libkb.MetaContext, p stellar1.PaymentSummary, oc OwnAccountLookupCache) (*stellar1.PaymentLocal, error) {
	var emptyAccountID stellar1.AccountID
	return transformPaymentSummary(mctx, p, oc, emptyAccountID, nil /* exchange rate */)
}

// TransformPaymentSummaryAccount converts a stellar1.PaymentSummary (p) into a
// stellar1.PaymentLocal, from the perspective of an owner of accountID.
//
// exchRate is the current exchange rate from XLM to the "outside" currency
// that is the preference for accountID.
func TransformPaymentSummaryAccount(mctx libkb.MetaContext, p stellar1.PaymentSummary, oc OwnAccountLookupCache, accountID stellar1.AccountID, exchRate *stellar1.OutsideExchangeRate) (*stellar1.PaymentLocal, error) {
	return transformPaymentSummary(mctx, p, oc, accountID, exchRate)
}

// transformPaymentSummary converts a stellar1.PaymentSummary (p) into a stellar1.PaymentLocal.
// accountID can be empty ("") and exchRate can be nil, if a generic response that isn't tied
// to an account is necessary.
//
// exchRate is the current exchange rate from XLM to the "outside" currency
// that is the preference for accountID.
func transformPaymentSummary(mctx libkb.MetaContext, p stellar1.PaymentSummary, oc OwnAccountLookupCache, accountID stellar1.AccountID, exchRate *stellar1.OutsideExchangeRate) (*stellar1.PaymentLocal, error) {
	typ, err := p.Typ()
	if err != nil {
		return nil, err
	}

	switch typ {
	case stellar1.PaymentSummaryType_STELLAR:
		return transformPaymentStellar(mctx, accountID, p.Stellar(), oc, exchRate)
	case stellar1.PaymentSummaryType_DIRECT:
		return transformPaymentDirect(mctx, accountID, p.Direct(), oc, exchRate)
	case stellar1.PaymentSummaryType_RELAY:
		return transformPaymentRelay(mctx, accountID, p.Relay(), oc, exchRate)
	default:
		return nil, fmt.Errorf("unrecognized payment type: %s", typ)
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
		amountDesc, err := FormatCurrency(mctx.Ctx(), mctx.G(), details.Amount, *details.Currency)
		if err != nil {
			amountDesc = details.Amount
			mctx.CDebugf("error formatting external currency: %s", err)
		}
		loc.AmountDescription = fmt.Sprintf("%s %s", amountDesc, *details.Currency)
	} else if details.Asset != nil {
		var code string
		if details.Asset.IsNativeXLM() {
			code = "XLM"
		} else {
			code = details.Asset.Code
		}

		amountDesc, err := FormatAmountWithSuffix(details.Amount, false /* precisionTwo */, true /* simplify */, code)
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
func transformPaymentStellar(mctx libkb.MetaContext, acctID stellar1.AccountID, p stellar1.PaymentSummaryStellar, oc OwnAccountLookupCache, exchRate *stellar1.OutsideExchangeRate) (*stellar1.PaymentLocal, error) {
	loc, err := newPaymentLocal(mctx, p.TxID, p.Ctime, p.Amount, p.Asset, p.From, p.To, acctID, exchRate)
	if err != nil {
		return nil, err
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

// transformPaymentDirect converts a stellar1.PaymentSummaryDirect into a stellar1.PaymentLocal.
func transformPaymentDirect(mctx libkb.MetaContext, acctID stellar1.AccountID, p stellar1.PaymentSummaryDirect, oc OwnAccountLookupCache, exchRate *stellar1.OutsideExchangeRate) (*stellar1.PaymentLocal, error) {
	loc, err := newPaymentLocal(mctx, p.TxID, p.Ctime, p.Amount, p.Asset, p.FromStellar, p.ToStellar, acctID, exchRate)
	if err != nil {
		return nil, err
	}

	loc.Worth, loc.WorthCurrency, err = formatWorth(mctx, p.DisplayAmount, p.DisplayCurrency)
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

	loc.StatusSimplified = p.TxStatus.ToPaymentStatus()
	loc.StatusDescription = strings.ToLower(loc.StatusSimplified.String())
	loc.StatusDetail = p.TxErrMsg

	loc.Note, loc.NoteErr = decryptNote(mctx, p.TxID, p.NoteB64)

	return loc, nil
}

// transformPaymentRelay converts a stellar1.PaymentSummaryRelay into a stellar1.PaymentLocal.
func transformPaymentRelay(mctx libkb.MetaContext, acctID stellar1.AccountID, p stellar1.PaymentSummaryRelay, oc OwnAccountLookupCache, exchRate *stellar1.OutsideExchangeRate) (*stellar1.PaymentLocal, error) {
	var toStellar stellar1.AccountID
	if p.Claim != nil {
		toStellar = p.Claim.ToStellar
	}
	loc, err := newPaymentLocal(mctx, p.TxID, p.Ctime, p.Amount, stellar1.AssetNative(), p.FromStellar, toStellar, acctID, exchRate)
	if err != nil {
		return nil, err
	}

	loc.Worth, loc.WorthCurrency, err = formatWorth(mctx, p.DisplayAmount, p.DisplayCurrency)
	if err != nil {
		return nil, err
	}

	loc.FromAccountID = p.FromStellar
	loc.FromType = stellar1.ParticipantType_STELLAR
	if username, err := lookupUsername(mctx, p.From.Uid); err == nil {
		loc.FromUsername = username
		loc.FromType = stellar1.ParticipantType_KEYBASE
	}

	loc.ToAssertion = p.ToAssertion
	loc.ToType = stellar1.ParticipantType_SBS
	if p.To != nil {
		username, err := lookupUsername(mctx, p.To.Uid)
		if err != nil {
			mctx.CDebugf("recipient lookup failed: %s", err)
			return nil, errors.New("recipient lookup failed")
		}
		loc.ToUsername = username
		loc.ToType = stellar1.ParticipantType_KEYBASE
	}

	if p.TxStatus != stellar1.TransactionStatus_SUCCESS {
		// If the funding tx is not complete
		loc.StatusSimplified = p.TxStatus.ToPaymentStatus()
		loc.StatusDetail = p.TxErrMsg
	} else {
		loc.StatusSimplified = stellar1.PaymentStatus_CLAIMABLE
		loc.StatusDetail = "Waiting for the recipient to open the app to claim, or the sender to cancel."
		loc.ShowCancel = true
	}
	if p.Claim != nil {
		loc.StatusSimplified = p.Claim.TxStatus.ToPaymentStatus()
		loc.ToAccountID = &p.Claim.ToStellar
		loc.ToType = stellar1.ParticipantType_STELLAR
		loc.ToUsername = ""
		loc.ToAccountName = ""
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
				loc.StatusDetail = fmt.Sprintf("funded. Claim by %v is: %v", claimantUsername, loc.StatusSimplified.String())
			}
		}
	}
	loc.StatusDescription = strings.ToLower(loc.StatusSimplified.String())
	fillOwnAccounts(mctx, loc, oc)

	relaySecrets, err := relays.DecryptB64(mctx.Ctx(), mctx.G(), p.TeamID, p.BoxB64)
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

	worth, err = FormatCurrency(mctx.Ctx(), mctx.G(), *amount, stellar1.OutsideCurrencyCode(*currency))
	if err != nil {
		return "", "", err
	}

	return worth, *currency, nil
}

func lookupUsernameFallback(mctx libkb.MetaContext, uid keybase1.UID, acctID stellar1.AccountID) (name string, kind stellar1.ParticipantType) {
	name, err := lookupUsername(mctx, uid)
	if err == nil {
		return name, stellar1.ParticipantType_KEYBASE
	}
	return acctID.String(), stellar1.ParticipantType_STELLAR
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

	decrypted, err := NoteDecryptB64(mctx.Ctx(), mctx.G(), note)
	if err != nil {
		return "", fmt.Sprintf("failed to decrypt payment note: %s", err)
	}

	if decrypted.StellarID != txid {
		return "", "discarded note for wrong transaction ID"
	}

	return decrypted.Note, ""
}

func newPaymentLocal(mctx libkb.MetaContext,
	txID stellar1.TransactionID,
	ctime stellar1.TimeMs,
	amount string,
	asset stellar1.Asset,
	from, to, requester stellar1.AccountID,
	exchRate *stellar1.OutsideExchangeRate) (*stellar1.PaymentLocal, error) {
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

	formatted, err := FormatAmountDescriptionAsset(amount, asset)
	if err != nil {
		return nil, err
	}
	loc.AmountDescription = formatted

	if asset.IsNativeXLM() && exchRate != nil {
		outsideAmount, err := stellarnet.ConvertXLMToOutside(amount, exchRate.Rate)
		if err != nil {
			return nil, err
		}
		currentWorth, err := FormatCurrency(mctx.Ctx(), mctx.G(), outsideAmount, exchRate.Currency)
		if err != nil {
			return nil, err
		}
		loc.CurrentWorth = currentWorth
		loc.CurrentWorthCurrency = string(exchRate.Currency)
	}

	return loc, nil
}
