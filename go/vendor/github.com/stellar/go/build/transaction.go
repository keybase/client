package build

import (
	"encoding/hex"
	"fmt"

	"github.com/stellar/go/network"
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// Transaction groups the creation of a new TransactionBuilder with a call
// to Mutate.
func Transaction(muts ...TransactionMutator) (*TransactionBuilder, error) {
	result := &TransactionBuilder{}
	err := result.Mutate(muts...)
	if err != nil {
		return nil, err
	}
	err = result.Mutate(Defaults{})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// TransactionMutator is a interface that wraps the
// MutateTransaction operation.  types may implement this interface to
// specify how they modify an xdr.Transaction object
type TransactionMutator interface {
	MutateTransaction(*TransactionBuilder) error
}

// TransactionBuilder represents a Transaction that is being constructed.
type TransactionBuilder struct {
	TX                *xdr.Transaction
	NetworkPassphrase string
	BaseFee           uint64
}

// Mutate applies the provided TransactionMutators to this builder's transaction
func (b *TransactionBuilder) Mutate(muts ...TransactionMutator) error {
	if b.TX == nil {
		b.TX = &xdr.Transaction{}
	}

	for i, m := range muts {
		err := m.MutateTransaction(b)
		if err != nil {
			return errors.Wrap(err, fmt.Sprintf("mutator:%d failed", i))
		}
	}

	return nil
}

// Hash returns the hash of this builder's transaction.
func (b *TransactionBuilder) Hash() ([32]byte, error) {
	return network.HashTransaction(b.TX, b.NetworkPassphrase)
}

// HashHex returns the hex-encoded hash of this builder's transaction
func (b *TransactionBuilder) HashHex() (string, error) {
	hash, err := b.Hash()
	if err != nil {
		return "", err
	}

	return hex.EncodeToString(hash[:]), nil
}

// Sign returns an new TransactionEnvelopeBuilder using this builder's
// transaction as the basis and with signatures of that transaction from the
// provided Signers.
func (b *TransactionBuilder) Sign(signers ...string) (TransactionEnvelopeBuilder, error) {
	var result TransactionEnvelopeBuilder
	err := result.Mutate(b)
	if err != nil {
		return result, err
	}

	for _, s := range signers {
		err := result.Mutate(Sign{s})
		if err != nil {
			return result, err
		}
	}

	return result, nil
}

// ------------------------------------------------------------
//
//   Mutator implementations
//
// ------------------------------------------------------------

// MutateTransaction for AccountMergeBuilder causes the underylying Destination
// to be added to the operation list for the provided transaction
func (m AccountMergeBuilder) MutateTransaction(o *TransactionBuilder) error {
	if m.Err != nil {
		return m.Err
	}

	m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypeAccountMerge, m.Destination)
	o.TX.Operations = append(o.TX.Operations, m.O)
	return m.Err
}

// MutateTransaction for AllowTrustBuilder causes the underylying AllowTrustOp
// to be added to the operation list for the provided transaction
func (m AllowTrustBuilder) MutateTransaction(o *TransactionBuilder) error {
	if m.Err != nil {
		return m.Err
	}

	m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypeAllowTrust, m.AT)
	o.TX.Operations = append(o.TX.Operations, m.O)
	return m.Err
}

// MutateTransaction for AutoSequence loads the sequence and sets it on the tx.
// NOTE:  this mutator assumes that the source account has already been set on
// the transaction and will error if that has not occurred.
func (m AutoSequence) MutateTransaction(o *TransactionBuilder) error {
	source := o.TX.SourceAccount

	if source == (xdr.AccountId{}) {
		return errors.New("auto sequence used prior to setting source account")
	}

	seq, err := m.SequenceForAccount(source.Address())
	if err != nil {
		return errors.Wrap(err, "couldn't load account for auto sequence")
	}

	o.TX.SeqNum = seq + 1
	return nil
}

// MutateTransaction for BumpSequenceBuilder causes the underylying BumpSequenceOp
// to be added to the operation list for the provided transaction
func (m BumpSequenceBuilder) MutateTransaction(o *TransactionBuilder) error {
	if m.Err != nil {
		return m.Err
	}

	m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypeBumpSequence, m.BS)
	o.TX.Operations = append(o.TX.Operations, m.O)
	return m.Err
}

// MutateTransaction for ChangeTrustBuilder causes the underylying
// CreateAccountOp to be added to the operation list for the provided
// transaction
func (m ChangeTrustBuilder) MutateTransaction(o *TransactionBuilder) error {
	if m.Err != nil {
		return m.Err
	}

	m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypeChangeTrust, m.CT)
	o.TX.Operations = append(o.TX.Operations, m.O)
	return m.Err
}

// MutateTransaction for CreateAccountBuilder causes the underylying
// CreateAccountOp to be added to the operation list for the provided
// transaction
func (m CreateAccountBuilder) MutateTransaction(o *TransactionBuilder) error {
	if m.Err != nil {
		return m.Err
	}

	m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypeCreateAccount, m.CA)
	o.TX.Operations = append(o.TX.Operations, m.O)
	return m.Err
}

// DefaultBaseFee is used to calculate the transaction fee by default
var DefaultBaseFee uint64 = 100

// MutateTransaction for Defaults sets reasonable defaults on the transaction being built
func (m Defaults) MutateTransaction(o *TransactionBuilder) error {

	if o.BaseFee == 0 {
		o.BaseFee = DefaultBaseFee
	}
	if o.TX.Fee == 0 {
		o.TX.Fee = xdr.Uint32(int(o.BaseFee) * len(o.TX.Operations))
	}

	if o.NetworkPassphrase == "" {
		o.NetworkPassphrase = DefaultNetwork.Passphrase
	}
	return nil
}

// MutateTransaction for InflationBuilder causes the underylying
// InflationOp to be added to the operation list for the provided
// transaction
func (m InflationBuilder) MutateTransaction(o *TransactionBuilder) error {
	if m.Err != nil {
		return m.Err
	}

	m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypeInflation, nil)
	o.TX.Operations = append(o.TX.Operations, m.O)
	return m.Err
}

// MutateTransaction for ManageDataBuilder causes the underylying
// ManageData to be added to the operation list for the provided
// transaction
func (m ManageDataBuilder) MutateTransaction(o *TransactionBuilder) error {
	if m.Err != nil {
		return m.Err
	}

	m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypeManageData, m.MD)
	o.TX.Operations = append(o.TX.Operations, m.O)
	return m.Err
}

// MutateTransaction for ManageOfferBuilder causes the underylying
// ManageData to be added to the operation list for the provided
// transaction
func (m ManageOfferBuilder) MutateTransaction(o *TransactionBuilder) error {
	if m.Err != nil {
		return m.Err
	}

	if m.PassiveOffer {
		m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypeCreatePassiveOffer, m.PO)
		o.TX.Operations = append(o.TX.Operations, m.O)
	} else {
		m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypeManageOffer, m.MO)
		o.TX.Operations = append(o.TX.Operations, m.O)
	}
	return m.Err
}

// MutateTransaction for MemoHash sets the memo.
func (m MemoHash) MutateTransaction(o *TransactionBuilder) (err error) {
	o.TX.Memo, err = xdr.NewMemo(xdr.MemoTypeMemoHash, m.Value)
	return
}

// MutateTransaction for MemoID sets the memo.
func (m MemoID) MutateTransaction(o *TransactionBuilder) (err error) {
	o.TX.Memo, err = xdr.NewMemo(xdr.MemoTypeMemoId, xdr.Uint64(m.Value))
	return
}

// MutateTransaction for MemoReturn sets the memo.
func (m MemoReturn) MutateTransaction(o *TransactionBuilder) (err error) {
	o.TX.Memo, err = xdr.NewMemo(xdr.MemoTypeMemoReturn, m.Value)
	return
}

// MutateTransaction for MemoText sets the memo.
func (m MemoText) MutateTransaction(o *TransactionBuilder) (err error) {

	if len([]byte(m.Value)) > MemoTextMaxLength {
		err = errors.New("Memo too long; over 28 bytes")
		return
	}

	o.TX.Memo, err = xdr.NewMemo(xdr.MemoTypeMemoText, m.Value)
	return
}

func (m Timebounds) MutateTransaction(o *TransactionBuilder) error {
	o.TX.TimeBounds = &xdr.TimeBounds{MinTime: xdr.Uint64(m.MinTime), MaxTime: xdr.Uint64(m.MaxTime)}
	return nil
}

// MutateTransaction for Network sets the Network ID to use when signing this transaction
func (m Network) MutateTransaction(o *TransactionBuilder) error {
	o.NetworkPassphrase = m.Passphrase
	return nil
}

// MutateTransaction for PaymentBuilder causes the underylying PaymentOp
// or PathPaymentOp to be added to the operation list for the provided transaction
func (m PaymentBuilder) MutateTransaction(o *TransactionBuilder) error {
	if m.Err != nil {
		return m.Err
	}

	if m.PathPayment {
		m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypePathPayment, m.PP)
		o.TX.Operations = append(o.TX.Operations, m.O)
		return m.Err
	}

	m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypePayment, m.P)
	o.TX.Operations = append(o.TX.Operations, m.O)
	return m.Err
}

// MutateTransaction for SetOptionsBuilder causes the underylying
// SetOptionsOp to be added to the operation list for the provided
// transaction
func (m SetOptionsBuilder) MutateTransaction(o *TransactionBuilder) error {
	if m.Err != nil {
		return m.Err
	}

	m.O.Body, m.Err = xdr.NewOperationBody(xdr.OperationTypeSetOptions, m.SO)
	o.TX.Operations = append(o.TX.Operations, m.O)
	return m.Err
}

// MutateTransaction for Sequence sets the SeqNum on the transaction.
func (m Sequence) MutateTransaction(o *TransactionBuilder) error {
	o.TX.SeqNum = xdr.SequenceNumber(m.Sequence)
	return nil
}

// MutateTransaction for SourceAccount sets the transaction's SourceAccount
// to the pubilic key for the address provided
func (m SourceAccount) MutateTransaction(o *TransactionBuilder) error {
	return setAccountId(m.AddressOrSeed, &o.TX.SourceAccount)
}

// MutateTransaction for BaseFee sets the base fee
func (m BaseFee) MutateTransaction(o *TransactionBuilder) error {
	o.BaseFee = m.Amount

	return nil
}
