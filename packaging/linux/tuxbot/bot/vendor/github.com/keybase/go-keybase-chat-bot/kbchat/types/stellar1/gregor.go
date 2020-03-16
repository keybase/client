// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/stellar1/gregor.avdl

package stellar1

type PaymentStatusMsg struct {
	AccountID AccountID            `codec:"accountID" json:"accountID"`
	KbTxID    KeybaseTransactionID `codec:"kbTxID" json:"kbTxID"`
	TxID      TransactionID        `codec:"txID" json:"txID"`
}

func (o PaymentStatusMsg) DeepCopy() PaymentStatusMsg {
	return PaymentStatusMsg{
		AccountID: o.AccountID.DeepCopy(),
		KbTxID:    o.KbTxID.DeepCopy(),
		TxID:      o.TxID.DeepCopy(),
	}
}

type RequestStatusMsg struct {
	ReqID KeybaseRequestID `codec:"reqID" json:"reqID"`
}

func (o RequestStatusMsg) DeepCopy() RequestStatusMsg {
	return RequestStatusMsg{
		ReqID: o.ReqID.DeepCopy(),
	}
}

type PaymentNotificationMsg struct {
	AccountID AccountID `codec:"accountID" json:"accountID"`
	PaymentID PaymentID `codec:"paymentID" json:"paymentID"`
}

func (o PaymentNotificationMsg) DeepCopy() PaymentNotificationMsg {
	return PaymentNotificationMsg{
		AccountID: o.AccountID.DeepCopy(),
		PaymentID: o.PaymentID.DeepCopy(),
	}
}
