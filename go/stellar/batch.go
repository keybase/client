package stellar

import (
	"errors"
	"sort"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/relays"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/build"
)

func Batch(mctx libkb.MetaContext, walletState *WalletState, arg stellar1.BatchLocalArg) (res stellar1.BatchResultLocal, err error) {
	mctx = mctx.WithLogTag(arg.BatchID)

	startTime := time.Now()
	res.StartTime = stellar1.ToTimeMs(startTime)
	defer func() {
		res.EndTime = stellar1.ToTimeMs(time.Now())
	}()

	// look up sender account
	senderAccountID, senderSeed, err := LookupSenderSeed(mctx)
	if err != nil {
		return res, err
	}

	mctx.CDebugf("Batch sender account ID: %s", senderAccountID)
	mctx.CDebugf("Batch size: %d", len(arg.Payments))

	// prepare the payments
	prepared, err := PrepareBatchPayments(mctx, walletState, senderSeed, arg.Payments)
	if err != nil {
		return res, err
	}

	res.PreparedTime = stellar1.ToTimeMs(time.Now())

	// make a listener that will get payment status updates
	listenerID, listenerCh, err := DefaultLoader(mctx.G()).GetListener()
	if err != nil {
		return res, err
	}
	defer DefaultLoader(mctx.G()).RemoveListener(listenerID)

	resultList := make([]stellar1.BatchPaymentResult, len(prepared))
	waiting := make(map[stellar1.TransactionID]int)

	// submit the payments
	// need to submit tx one at a time, in order
	for i := 0; i < len(prepared); i++ {
		if prepared[i] == nil {
			// this should never happen
			return res, errors.New("batch prepare failed")
		}

		bpResult := stellar1.BatchPaymentResult{
			Username:  prepared[i].Username.String(),
			StartTime: stellar1.ToTimeMs(time.Now()),
		}
		if prepared[i].Error != nil {
			bpResult.EndTime = stellar1.ToTimeMs(time.Now())
			bpResult.Error = prepared[i].Error.Error()
			bpResult.Status = stellar1.PaymentStatus_ERROR
		} else {
			// submit the transaction
			mctx.CDebugf("submitting batch payment seqno %d", prepared[i].Seqno)

			if err := walletState.AddPendingTx(mctx.Ctx(), senderAccountID, prepared[i].TxID, prepared[i].Seqno); err != nil {
				mctx.CDebugf("error calling AddPendingTx: %s", err)
			}

			var submitRes stellar1.PaymentResult
			switch {
			case prepared[i].Direct != nil:
				submitRes, err = walletState.SubmitPayment(mctx.Ctx(), *prepared[i].Direct)
			case prepared[i].Relay != nil:
				submitRes, err = walletState.SubmitRelayPayment(mctx.Ctx(), *prepared[i].Relay)
			default:
				bpResult.Error = "no prepared direct or relay payment"
				bpResult.Status = stellar1.PaymentStatus_ERROR
			}

			bpResult.SubmittedTime = stellar1.ToTimeMs(time.Now())

			if err != nil {
				mctx.CDebugf("error submitting batch payment seqno %d, txid %s: %s", prepared[i].Seqno, prepared[i].TxID, err)
				bpResult.Error = err.Error()
				bpResult.Status = stellar1.PaymentStatus_ERROR
			} else if bpResult.Status != stellar1.PaymentStatus_ERROR { // check to make sure default in switch above didn't happen
				bpResult.TxID = submitRes.StellarID
				if submitRes.Pending {
					bpResult.Status = stellar1.PaymentStatus_PENDING
					// add the tx id and the index of this payment to a waiting list
					waiting[bpResult.TxID] = i
				} else {
					bpResult.Status = stellar1.PaymentStatus_COMPLETED
					bpResult.EndTime = stellar1.ToTimeMs(time.Now())
				}
			}
		}
		resultList[i] = bpResult
	}

	res.AllSubmittedTime = stellar1.ToTimeMs(time.Now())

	// wait for the payments
	waitingCount := len(waiting)
	mctx.CDebugf("waiting for %d payments to complete", waitingCount)

	for waitingCount > 0 {
		select {
		case <-time.After(5 * time.Second):
			if time.Since(startTime) > time.Duration(arg.TimeoutSecs)*time.Second {
				mctx.CDebugf("ran out of time waiting for tx status updates (%d remaining)", waitingCount)
				res.Payments = resultList
				calculateStats(&res)
				return res, nil
			}
		case update := <-listenerCh:
			mctx.CDebugf("received update: %+v", update)
			index, ok := waiting[update.TxID]
			if ok {
				mctx.CDebugf("received status update for %s: %s", update.TxID, update.Status)
				resultList[index].Status = update.Status
				if update.Status != stellar1.PaymentStatus_PENDING {
					waitingCount--
					resultList[index].EndTime = stellar1.ToTimeMs(time.Now())
					mctx.CDebugf("no longer waiting for %s status updates (%d remaining)", update.TxID, waitingCount)
				}
			}
		}
	}

	mctx.CDebugf("done waiting for payments to complete")

	res.Payments = resultList
	calculateStats(&res)

	return res, nil
}

func PrepareBatchPayments(mctx libkb.MetaContext, walletState *WalletState, senderSeed stellarnet.SeedStr, payments []stellar1.BatchPaymentArg) ([]*MiniPrepared, error) {
	mctx.CDebugf("preparing %d batch payments", len(payments))

	prepared := make(chan *MiniPrepared)

	sp := NewSeqnoProvider(mctx, walletState)
	for _, payment := range payments {
		go func(p stellar1.BatchPaymentArg) {
			prepared <- prepareBatchPayment(mctx, walletState, sp, senderSeed, p)
		}(payment)
	}

	// prepared chan could be out of order, so sort by seqno
	preparedList := make([]*MiniPrepared, len(payments))
	for i := 0; i < len(payments); i++ {
		preparedList[i] = <-prepared
	}
	sort.Slice(preparedList, func(a, b int) bool { return preparedList[a].Seqno < preparedList[b].Seqno })

	return preparedList, nil
}

func prepareBatchPayment(mctx libkb.MetaContext, remoter remote.Remoter, sp build.SequenceProvider, senderSeed stellarnet.SeedStr, payment stellar1.BatchPaymentArg) *MiniPrepared {
	recipient, err := LookupRecipient(mctx, stellarcommon.RecipientInput(payment.Recipient), false /* isCLI for identify purposes */)
	if err != nil {
		mctx.CDebugf("LookupRecipient error: %s", err)
		return &MiniPrepared{
			Username: libkb.NewNormalizedUsername(payment.Recipient),
			Error:    errors.New("error looking up recipient"),
		}
	}

	if recipient.AccountID == nil {
		return prepareBatchPaymentRelay(mctx, remoter, sp, senderSeed, payment, recipient)
	}
	return prepareBatchPaymentDirect(mctx, remoter, sp, senderSeed, payment, recipient)
}

func prepareBatchPaymentDirect(mctx libkb.MetaContext, remoter remote.Remoter, sp build.SequenceProvider, senderSeed stellarnet.SeedStr, payment stellar1.BatchPaymentArg, recipient stellarcommon.Recipient) *MiniPrepared {
	result := &MiniPrepared{Username: libkb.NewNormalizedUsername(payment.Recipient)}
	funded, err := isAccountFunded(mctx.Ctx(), remoter, stellar1.AccountID(recipient.AccountID.String()))
	if err != nil {
		result.Error = err
		return result
	}

	result.Direct = &stellar1.PaymentDirectPost{
		FromDeviceID: mctx.G().ActiveDevice.DeviceID(),
		To:           &recipient.User.UV,
		QuickReturn:  true,
	}

	var signResult stellarnet.SignResult
	if funded {
		signResult, err = stellarnet.PaymentXLMTransaction(senderSeed, *recipient.AccountID, payment.Amount, "", sp, nil)
	} else {
		signResult, err = stellarnet.CreateAccountXLMTransaction(senderSeed, *recipient.AccountID, payment.Amount, "", sp, nil)
	}
	if err != nil {
		result.Error = err
		return result
	}

	result.Direct.SignedTransaction = signResult.Signed
	result.Seqno = signResult.Seqno
	result.TxID = stellar1.TransactionID(signResult.TxHash)

	return result
}

func prepareBatchPaymentRelay(mctx libkb.MetaContext, remoter remote.Remoter, sp build.SequenceProvider, senderSeed stellarnet.SeedStr, payment stellar1.BatchPaymentArg, recipient stellarcommon.Recipient) *MiniPrepared {
	result := &MiniPrepared{Username: libkb.NewNormalizedUsername(payment.Recipient)}

	appKey, teamID, err := relays.GetKey(mctx, recipient)
	if err != nil {
		result.Error = err
		return result
	}

	relay, err := relays.Create(relays.Input{
		From:          stellar1.SecretKey(senderSeed),
		AmountXLM:     payment.Amount,
		EncryptFor:    appKey,
		SeqnoProvider: sp,
		Timebounds:    nil,
	})
	if err != nil {
		result.Error = err
		return result
	}

	post := stellar1.PaymentRelayPost{
		FromDeviceID:      mctx.ActiveDevice().DeviceID(),
		ToAssertion:       string(recipient.Input),
		RelayAccount:      relay.RelayAccountID,
		TeamID:            teamID,
		BoxB64:            relay.EncryptedB64,
		SignedTransaction: relay.FundTx.Signed,
		QuickReturn:       true,
	}
	if recipient.User != nil {
		post.To = &recipient.User.UV
	}

	result.Relay = &post
	result.Seqno = relay.FundTx.Seqno
	result.TxID = stellar1.TransactionID(relay.FundTx.TxHash)

	return result
}

func calculateStats(res *stellar1.BatchResultLocal) {

}
