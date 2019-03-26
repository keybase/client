package stellar

import (
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
)

type multiOp struct {
	Recipient     stellar1.AccountID
	Amount        string
	CreateAccount bool
	Op            stellar1.PaymentOp
}

// BatchMulti sends a batch of payments from the user to multiple recipients in
// a single multi-operation transaction.
func BatchMulti(mctx libkb.MetaContext, walletState *WalletState, arg stellar1.BatchLocalArg) (res stellar1.BatchResultLocal, err error) {
	mctx = mctx.WithLogTag("BMULT=" + arg.BatchID)

	startTime := time.Now()
	res.StartTime = stellar1.ToTimeMs(startTime)
	defer func() {
		if res.EndTime == 0 {
			res.EndTime = stellar1.ToTimeMs(time.Now())
		}
	}()

	// look up sender account
	senderAccountID, senderSeed, err := LookupSenderSeed(mctx)
	if err != nil {
		return res, err
	}

	mctx.Debug("Batch sender account ID: %s", senderAccountID)
	mctx.Debug("Batch size: %d", len(arg.Payments))

	results := make([]stellar1.BatchPaymentResult, len(arg.Payments))
	var multiOps []multiOp
	for i, payment := range arg.Payments {
		results[i] = stellar1.BatchPaymentResult{
			Username: libkb.NewNormalizedUsername(payment.Recipient).String(),
		}
		recipient, err := LookupRecipient(mctx, stellarcommon.RecipientInput(payment.Recipient), false /* isCLI for identify purposes */)
		if err != nil {
			mctx.Debug("LookupRecipient error: %s", err)
			makeResultError(&results[i], err)
			continue
		}

		if recipient.AccountID == nil {
			mop, err := prepareRelayOp(mctx, payment, recipient)
			if err != nil {
				makeResultError(&results[i], err)
				continue
			}
			multiOps = append(multiOps, mop)
		} else {
			mop, err := prepareDirectOp(mctx, payment, recipient)
			if err != nil {
				makeResultError(&results[i], err)
				continue
			}
			multiOps = append(multiOps, mop)
		}
	}

	baseFee := walletState.BaseFee(mctx)
	sp, unlock := NewSeqnoProvider(mctx, walletState)
	defer unlock()
	tx := stellarnet.NewBaseTx(stellarnet.AddressStr(senderAccountID), sp, baseFee)
	var post stellar1.PaymentMultiPost

	// add all the prepared ops here
	for _, mop := range multiOps {
		if mop.CreateAccount {
			tx.AddCreateAccountOp(stellarnet.AddressStr(mop.Recipient), mop.Amount)
		} else {
			tx.AddPaymentOp(stellarnet.AddressStr(mop.Recipient), mop.Amount)
		}
		post.Operations = append(post.Operations, mop.Op)
	}

	// sign the tx
	sr, err := tx.Sign(senderSeed)
	if err != nil {
		return res, err
	}
	post.SignedTransaction = sr.Signed
	post.FromDeviceID = mctx.ActiveDevice().DeviceID()

	// submit it
	submitRes, err := walletState.SubmitMultiPayment(mctx.Ctx(), post)
	if err != nil {
		// make all the results have an error
		for _, r := range results {
			makeResultError(&r, err)
		}
	} else {
		// make all ther results have success
		now := stellar1.ToTimeMs(time.Now())
		for i := 0; i < len(results); i++ {
			results[i].TxID = submitRes.TxID
			results[i].Status = stellar1.PaymentStatus_COMPLETED
			results[i].EndTime = now
		}
	}

	res.Payments = results

	return res, nil
}

func prepareDirectOp(mctx libkb.MetaContext, payment stellar1.BatchPaymentArg, recipient stellarcommon.Recipient) (multiOp, error) {
	return multiOp{}, nil
}

func prepareRelayOp(mctx libkb.MetaContext, payment stellar1.BatchPaymentArg, recipient stellarcommon.Recipient) (multiOp, error) {
	return multiOp{}, nil
}
