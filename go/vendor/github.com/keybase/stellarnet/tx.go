package stellarnet

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"errors"

	"github.com/stellar/go/amount"
	"github.com/stellar/go/build"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/xdr"
)

// Tx is a data structure used for making a Stellar transaction.
// After creating one with NewBaseTx(), add to it with the various
// Add* functions, and finally, Sign() it.
//
// Any errors that occur during Add* functions are delayed to return
// when the Sign() function is called in order to make the transaction
// building code cleaner.
type Tx struct {
	internal  xdr.Transaction
	source    AddressStr
	seqnoProv build.SequenceProvider
	netPass   string
	baseFee   uint64
	err       error
}

// NewBaseTx creates a Tx with the common transaction elements.
func NewBaseTx(source AddressStr, seqnoProvider build.SequenceProvider, baseFee uint64) *Tx {
	if baseFee < build.DefaultBaseFee {
		baseFee = build.DefaultBaseFee
	}
	t := &Tx{
		source:    source,
		baseFee:   baseFee,
		seqnoProv: seqnoProvider,
		netPass:   NetworkPassphrase(),
	}
	return t
}

// newBaseTxSeed is a convenience function to get the address out of `from` before
// calling NewBaseTx.
func newBaseTxSeed(from SeedStr, seqnoProvider build.SequenceProvider, baseFee uint64) (*Tx, error) {
	fromAddress, err := from.Address()
	if err != nil {
		return nil, err
	}
	return NewBaseTx(fromAddress, seqnoProvider, baseFee), nil
}

// AddPaymentOp adds a payment operation to the transaction.
func (t *Tx) AddPaymentOp(to AddressStr, amt string) {
	if t.skipAddOp() {
		return
	}

	var op xdr.PaymentOp
	op.Amount, t.err = amount.Parse(amt)
	if t.err != nil {
		return
	}
	op.Destination, t.err = to.AccountID()
	if t.err != nil {
		return
	}

	t.addOp(xdr.OperationTypePayment, op)
}

// AddCreateAccountOp adds a create_account operation to the transaction.
func (t *Tx) AddCreateAccountOp(to AddressStr, amt string) {
	if t.skipAddOp() {
		return
	}

	var op xdr.CreateAccountOp
	op.StartingBalance, t.err = amount.Parse(amt)
	if t.err != nil {
		return
	}
	op.Destination, t.err = to.AccountID()
	if t.err != nil {
		return
	}

	t.addOp(xdr.OperationTypeCreateAccount, op)
}

// AddAccountMergeOp adds an account_merge operation to the transaction.
func (t *Tx) AddAccountMergeOp(to AddressStr) {
	if t.skipAddOp() {
		return
	}

	accountID, err := to.AccountID()
	if err != nil {
		t.err = err
		return
	}

	t.addOp(xdr.OperationTypeAccountMerge, accountID)
}

// AddInflationDestinationOp adds a set_options operation for the inflation
// destination to the transaction.
func (t *Tx) AddInflationDestinationOp(to AddressStr) {
	if t.skipAddOp() {
		return
	}

	accountID, err := to.AccountID()
	if err != nil {
		t.err = err
		return
	}
	op := xdr.SetOptionsOp{InflationDest: &accountID}

	t.addOp(xdr.OperationTypeSetOptions, op)
}

// AddCreateTrustlineOp adds a change_trust operation that will establish
// a trustline.
func (t *Tx) AddCreateTrustlineOp(assetCode string, assetIssuer AddressStr, limit int64) {
	if t.skipAddOp() {
		return
	}

	if limit <= 0 {
		t.err = errors.New("limit must be greater than zero to create a trustline")
		return
	}

	asset, err := makeXDRAsset(assetCode, assetIssuer)
	if err != nil {
		t.err = err
		return
	}

	op := xdr.ChangeTrustOp{
		Line:  asset,
		Limit: xdr.Int64(limit),
	}

	t.addOp(xdr.OperationTypeChangeTrust, op)
}

// AddDeleteTrustlineOp adds a change_trust operation that will remove
// a trustline.
func (t *Tx) AddDeleteTrustlineOp(assetCode string, assetIssuer AddressStr) {
	if t.skipAddOp() {
		return
	}

	asset, err := makeXDRAsset(assetCode, assetIssuer)
	if err != nil {
		t.err = err
		return
	}

	op := xdr.ChangeTrustOp{
		Line:  asset,
		Limit: 0,
	}

	t.addOp(xdr.OperationTypeChangeTrust, op)
}

// addOp adds an operation to the internal transaction.
func (t *Tx) addOp(opType xdr.OperationType, op interface{}) {
	body, err := xdr.NewOperationBody(opType, op)
	if err != nil {
		t.err = err
		return
	}
	wop := xdr.Operation{
		Body: body,
	}
	t.internal.Operations = append(t.internal.Operations, wop)
}

// skipAddOp returns true if there is already a condition that
// prevents any further Add* operations.
func (t *Tx) skipAddOp() bool {
	if t.err != nil {
		return true
	}
	if t.IsFull() {
		t.err = ErrTxOpFull
		return true
	}

	return false
}

func (t *Tx) haveMemo() bool {
	return t.internal.Memo.Type != xdr.MemoTypeMemoNone
}

// skipAddMemo returns true if there is already a condition that
// prevents any further AddMemo* calls.
func (t *Tx) skipAddMemo() bool {
	if t.err != nil {
		return true
	}
	if t.haveMemo() {
		t.err = ErrMemoExists
		return true
	}

	return false
}

// AddMemoText adds a text memo to the transaction.  There can only
// be one memo.
func (t *Tx) AddMemoText(memo string) {
	if t.skipAddMemo() {
		return
	}

	m, err := xdr.NewMemo(xdr.MemoTypeMemoText, memo)
	if err != nil {
		t.err = err
		return
	}

	t.internal.Memo = m
}

// AddMemoID adds an ID memo to the transaction.  There can only
// be one memo.
func (t *Tx) AddMemoID(id *uint64) {
	if id == nil {
		return
	}
	if t.skipAddMemo() {
		return
	}

	m, err := xdr.NewMemo(xdr.MemoTypeMemoId, xdr.Uint64(*id))
	if err != nil {
		t.err = err
		return
	}
	t.internal.Memo = m
}

// AddTimeBounds adds time bounds to the transaction.
func (t *Tx) AddTimeBounds(min, max uint64) {
	if t.err != nil {
		return
	}
	if t.internal.TimeBounds != nil {
		t.err = ErrTimeBoundsExist
		return
	}

	t.internal.TimeBounds = &xdr.TimeBounds{
		MinTime: xdr.Uint64(min),
		MaxTime: xdr.Uint64(max),
	}
}

// AddBuiltTimeBounds adds time bounds to the transaction with a *build.Timebounds.
func (t *Tx) AddBuiltTimeBounds(bt *build.Timebounds) {
	if bt == nil {
		return
	}
	t.AddTimeBounds(bt.MinTime, bt.MaxTime)
}

// IsFull returns true if there are already 100 operations in the transaction.
func (t *Tx) IsFull() bool {
	return len(t.internal.Operations) >= 100
}

// SignResult contains the result of signing a transaction.
type SignResult struct {
	Seqno  uint64
	Signed string // signed transaction (base64)
	TxHash string // transaction hash (hex)
}

// Sign builds the transaction and signs it.
func (t *Tx) Sign(from SeedStr) (SignResult, error) {
	if t.err != nil {
		return SignResult{}, errMap(t.err)
	}
	if len(t.internal.Operations) == 0 {
		return SignResult{}, errMap(ErrNoOps)
	}
	return t.sign(from)
}

func (t *Tx) sign(signers ...SeedStr) (SignResult, error) {
	seqno, err := t.seqnoProv.SequenceForAccount(t.source.String())
	if err != nil {
		return SignResult{}, err
	}
	t.internal.SeqNum = seqno + 1
	t.internal.Fee = xdr.Uint32(t.baseFee * uint64(len(t.internal.Operations)))
	t.internal.SourceAccount, err = t.source.AccountID()
	if err != nil {
		return SignResult{}, err
	}

	hash, err := network.HashTransaction(&t.internal, t.netPass)
	if err != nil {
		return SignResult{}, err
	}

	envelope := xdr.TransactionEnvelope{Tx: t.internal}

	for _, signer := range signers {
		kp, err := keypair.Parse(signer.SecureNoLogString())
		if err != nil {
			return SignResult{}, err
		}
		sig, err := kp.SignDecorated(hash[:])
		if err != nil {
			return SignResult{}, err
		}

		envelope.Signatures = append(envelope.Signatures, sig)
	}

	var buf bytes.Buffer
	_, err = xdr.Marshal(&buf, envelope)
	if err != nil {
		return SignResult{}, err
	}
	signed := base64.StdEncoding.EncodeToString(buf.Bytes())
	txHashHex := hex.EncodeToString(hash[:])

	return SignResult{
		Seqno:  uint64(t.internal.SeqNum),
		Signed: signed,
		TxHash: txHashHex,
	}, nil

}
