package stellar

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/relays"
)

func localizePayment(mctx libkb.MetaContext, p stellar1.PaymentSummary) (res stellar1.PaymentCLILocal, err error) {
	typ, err := p.Typ()
	if err != nil {
		return res, fmt.Errorf("malformed payment summary: %v", err)
	}
	username := func(uid keybase1.UID) (username *string, err error) {
		uname, err := mctx.G().GetUPAKLoader().LookupUsername(mctx.Ctx(), uid)
		if err != nil {
			return nil, err
		}
		tmp := uname.String()
		return &tmp, nil
	}
	switch typ {
	case stellar1.PaymentSummaryType_STELLAR:
		p := p.Stellar()
		return stellar1.PaymentCLILocal{
			TxID:            p.TxID,
			Time:            p.Ctime,
			Status:          "Completed",
			Amount:          p.Amount,
			Asset:           p.Asset,
			FromStellar:     p.From,
			ToStellar:       &p.To,
			Unread:          p.Unread,
			IsAdvanced:      p.IsAdvanced,
			SummaryAdvanced: p.SummaryAdvanced,
			Operations:      p.Operations,
		}, nil
	case stellar1.PaymentSummaryType_DIRECT:
		p := p.Direct()
		res = stellar1.PaymentCLILocal{
			TxID:               p.TxID,
			Time:               p.Ctime,
			Amount:             p.Amount,
			Asset:              p.Asset,
			DisplayAmount:      p.DisplayAmount,
			DisplayCurrency:    p.DisplayCurrency,
			FromStellar:        p.FromStellar,
			ToStellar:          &p.ToStellar,
			SourceAsset:        p.SourceAsset,
			SourceAmountMax:    p.SourceAmountMax,
			SourceAmountActual: p.SourceAmountActual,
		}
		res.Status, res.StatusDetail = p.TxStatus.Details(p.TxErrMsg)
		res.FromUsername, err = username(p.From.Uid)
		if err != nil {
			return res, err
		}
		if p.To != nil {
			res.ToUsername, err = username(p.To.Uid)
			if err != nil {
				return res, err
			}
		}
		if len(p.NoteB64) > 0 {
			note, err := NoteDecryptB64(mctx, p.NoteB64)
			if err != nil {
				res.NoteErr = fmt.Sprintf("failed to decrypt payment note: %v", err)
			} else {
				if note.StellarID != p.TxID {
					res.NoteErr = "discarded note for wrong transaction ID"
				} else {
					res.Note = note.Note
				}
			}
			if len(res.NoteErr) > 0 {
				mctx.Warning(res.NoteErr)
			}
		}
		return res, nil
	case stellar1.PaymentSummaryType_RELAY:
		p := p.Relay()
		res = stellar1.PaymentCLILocal{
			TxID:            p.TxID,
			Time:            p.Ctime,
			Amount:          p.Amount,
			Asset:           stellar1.AssetNative(),
			DisplayAmount:   p.DisplayAmount,
			DisplayCurrency: p.DisplayCurrency,
			FromStellar:     p.FromStellar,
		}
		if p.TxStatus != stellar1.TransactionStatus_SUCCESS {
			// If the funding tx is not complete
			res.Status, res.StatusDetail = p.TxStatus.Details(p.TxErrMsg)
		} else {
			res.Status = "Claimable"
			res.StatusDetail = "Waiting for the recipient to open the app to claim, or the sender to cancel."
		}
		res.FromUsername, err = username(p.From.Uid)
		if err != nil {
			return res, err
		}
		if p.To != nil {
			res.ToUsername, err = username(p.To.Uid)
			if err != nil {
				return res, err
			}
		}
		if p.ToAssertion != "" {
			res.ToAssertion = &p.ToAssertion
		}
		// Override status with claim status
		if p.Claim != nil {
			if p.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
				// If the claim succeeded, the relay payment is done.
				switch p.Claim.Dir {
				case stellar1.RelayDirection_CLAIM:
					res.Status = "Completed"
				case stellar1.RelayDirection_YANK:
					res.Status = "Canceled"
				}
				res.ToStellar = &p.Claim.ToStellar
				res.ToUsername, err = username(p.Claim.To.Uid)
				if err != nil {
					return res, err
				}
			} else {
				claimantUsername, err := username(p.Claim.To.Uid)
				if err != nil {
					return res, err
				}
				res.Status, res.StatusDetail = p.Claim.TxStatus.Details(p.Claim.TxErrMsg)
				res.Status = fmt.Sprintf("Funded. Claim by %v is: %v", *claimantUsername, res.Status)
			}
		}
		relaySecrets, err := relays.DecryptB64(mctx, p.TeamID, p.BoxB64)
		if err == nil {
			res.Note = relaySecrets.Note
		} else {
			res.NoteErr = fmt.Sprintf("error decrypting note box: %v", err)
		}
		return res, nil
	default:
		return res, fmt.Errorf("unrecognized payment summary type: %v", typ)
	}
}
