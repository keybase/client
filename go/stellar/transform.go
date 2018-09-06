package stellar

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/relays"
)

func TransformPaymentSummary(m libkb.MetaContext, acctID stellar1.AccountID, p stellar1.PaymentSummary) (*stellar1.PaymentLocal, error) {
	typ, err := p.Typ()
	if err != nil {
		return nil, err
	}

	switch typ {
	case stellar1.PaymentSummaryType_STELLAR:
		return transformPaymentStellar(m, acctID, p.Stellar())
	case stellar1.PaymentSummaryType_DIRECT:
		return transformPaymentDirect(m, acctID, p.Direct())
	case stellar1.PaymentSummaryType_RELAY:
		return transformPaymentRelay(m, acctID, p.Relay())
	default:
		return nil, fmt.Errorf("unrecognized payment type: %s", typ)
	}
}

func transformPaymentStellar(m libkb.MetaContext, acctID stellar1.AccountID, p stellar1.PaymentSummaryStellar) (*stellar1.PaymentLocal, error) {
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

func transformPaymentDirect(m libkb.MetaContext, acctID stellar1.AccountID, p stellar1.PaymentSummaryDirect) (*stellar1.PaymentLocal, error) {
	loc, err := newPaymentLocal(p.TxID, p.Ctime, p.Amount, p.FromStellar, p.ToStellar, acctID)
	if err != nil {
		return nil, err
	}

	loc.Worth, loc.WorthCurrency, err = formatWorth(m, p.DisplayAmount, p.DisplayCurrency)
	if err != nil {
		return nil, err
	}

	loc.Source, loc.SourceType = lookupUsernameFallback(m, p.From.Uid, p.FromStellar)

	if p.To != nil {
		loc.Target, loc.TargetType = lookupUsernameFallback(m, p.To.Uid, p.ToStellar)
	} else {
		loc.Target = p.ToStellar.String()
		loc.TargetType = stellar1.ParticipantType_STELLAR
	}

	loc.StatusSimplified = p.TxStatus.ToPaymentStatus()
	loc.StatusDescription = strings.ToLower(loc.StatusSimplified.String())
	loc.StatusDetail = p.TxErrMsg

	loc.Note, loc.NoteErr = decryptNote(m, p.TxID, p.NoteB64)

	return loc, nil
}

func transformPaymentRelay(m libkb.MetaContext, acctID stellar1.AccountID, p stellar1.PaymentSummaryRelay) (*stellar1.PaymentLocal, error) {
	var toStellar stellar1.AccountID
	if p.Claim != nil {
		toStellar = p.Claim.ToStellar
	}
	loc, err := newPaymentLocal(p.TxID, p.Ctime, p.Amount, p.FromStellar, toStellar, acctID)
	if err != nil {
		return nil, err
	}

	loc.Worth, loc.WorthCurrency, err = formatWorth(m, p.DisplayAmount, p.DisplayCurrency)
	if err != nil {
		return nil, err
	}

	loc.Source, loc.SourceType = lookupUsernameFallback(m, p.From.Uid, p.FromStellar)

	if p.To != nil {
		name, err := lookupUsername(m, p.To.Uid)
		if err != nil {
			m.CDebugf("recipient lookup failed: %s", err)
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
		loc.ShowCancel = true
	}
	if p.Claim != nil {
		loc.StatusSimplified = p.Claim.TxStatus.ToPaymentStatus()
		if p.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
			// If the claim succeeded, the relay payment is done.
			loc.ShowCancel = false
			loc.StatusDetail = ""
			name, err := lookupUsername(m, p.Claim.To.Uid)
			if err == nil {
				loc.Target = name
				loc.TargetType = stellar1.ParticipantType_KEYBASE
			} else {
				loc.Target = p.Claim.ToStellar.String()
				loc.TargetType = stellar1.ParticipantType_STELLAR
			}
		} else {
			claimantUsername, err := lookupUsername(m, p.Claim.To.Uid)
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

	relaySecrets, err := relays.DecryptB64(m.Ctx(), m.G(), p.TeamID, p.BoxB64)
	if err == nil {
		loc.Note = relaySecrets.Note
	} else {
		loc.NoteErr = fmt.Sprintf("error decrypting note: %s", err)
	}

	return loc, nil
}

func formatWorth(m libkb.MetaContext, amount, currency *string) (worth, worthCurrency string, err error) {
	if amount == nil || currency == nil {
		return "", "", nil
	}

	if len(*amount) == 0 || len(*currency) == 0 {
		return "", "", nil
	}

	worth, err = FormatCurrency(m.Ctx(), m.G(), *amount, stellar1.OutsideCurrencyCode(*currency))
	if err != nil {
		return "", "", err
	}

	return worth, *currency, nil
}

func lookupUsernameFallback(m libkb.MetaContext, uid keybase1.UID, acctID stellar1.AccountID) (name string, kind stellar1.ParticipantType) {
	name, err := lookupUsername(m, uid)
	if err == nil {
		return name, stellar1.ParticipantType_KEYBASE
	}
	return acctID.String(), stellar1.ParticipantType_STELLAR
}

func lookupUsername(m libkb.MetaContext, uid keybase1.UID) (string, error) {
	uname, err := m.G().GetUPAKLoader().LookupUsername(m.Ctx(), uid)
	if err != nil {
		return "", err
	}
	return uname.String(), nil
}

func decryptNote(m libkb.MetaContext, txid stellar1.TransactionID, note string) (plaintext, errOutput string) {
	if len(note) == 0 {
		return "", ""
	}

	decrypted, err := NoteDecryptB64(m.Ctx(), m.G(), note)
	if err != nil {
		return "", fmt.Sprintf("failed to decrypt payment note: %s", err)
	}

	if decrypted.StellarID != txid {
		return "", "discarded note for wrong transaction ID"
	}

	return decrypted.Note, ""
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

	formatted, err := FormatAmountXLM(amount)
	if err != nil {
		return nil, err
	}
	loc.AmountDescription = formatted

	return loc, nil
}
