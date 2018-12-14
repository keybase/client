package build

import (
	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// SetOptions groups the creation of a new SetOptions with a call to Mutate.
func SetOptions(muts ...interface{}) (result SetOptionsBuilder) {
	result.Mutate(muts...)
	return
}

// SetOptionsMutator is a interface that wraps the
// MutateSetOptions operation.  types may implement this interface to
// specify how they modify an xdr.SetOptionsOp object
type SetOptionsMutator interface {
	MutateSetOptions(*xdr.SetOptionsOp) error
}

// SetOptionsBuilder represents a transaction that is being built.
type SetOptionsBuilder struct {
	O   xdr.Operation
	SO  xdr.SetOptionsOp
	Err error
}

// Mutate applies the provided mutators to this builder's payment or operation.
func (b *SetOptionsBuilder) Mutate(muts ...interface{}) {
	for _, m := range muts {
		var err error
		switch mut := m.(type) {
		case SetOptionsMutator:
			err = mut.MutateSetOptions(&b.SO)
		case OperationMutator:
			err = mut.MutateOperation(&b.O)
		default:
			err = errors.New("Mutator type not allowed")
		}

		if err != nil {
			b.Err = errors.Wrap(err, "SetOptionsBuilder error")
			return
		}
	}
}

// MutateSetOptions for HomeDomain sets the SetOptionsOp's HomeDomain field
func (m HomeDomain) MutateSetOptions(o *xdr.SetOptionsOp) (err error) {
	if len(m) > 32 {
		return errors.New("HomeDomain is too long")
	}

	value := xdr.String32(m)
	o.HomeDomain = &value
	return
}

// MutateTransaction for HomeDomain allows creating an operation using a single mutator
func (m HomeDomain) MutateTransaction(t *TransactionBuilder) error {
	return mutateTransactionBuilder(t, m)
}

// MutateSetOptions for InflationDest sets the SetOptionsOp's InflationDest field
func (m InflationDest) MutateSetOptions(o *xdr.SetOptionsOp) (err error) {
	o.InflationDest = &xdr.AccountId{}
	err = setAccountId(string(m), o.InflationDest)
	return
}

// MutateTransaction for InflationDest allows creating an operation using a single mutator
func (m InflationDest) MutateTransaction(t *TransactionBuilder) error {
	return mutateTransactionBuilder(t, m)
}

// MutateSetOptions for MasterWeight sets the SetOptionsOp's MasterWeight field
func (m MasterWeight) MutateSetOptions(o *xdr.SetOptionsOp) (err error) {
	val := xdr.Uint32(m)
	o.MasterWeight = &val
	return
}

// MutateTransaction for MasterWeight allows creating an operation using a single mutator
func (m MasterWeight) MutateTransaction(t *TransactionBuilder) error {
	return mutateTransactionBuilder(t, m)
}

// AddSigner creates Signer mutator that sets account's signer
func AddSigner(address string, weight uint32) Signer {
	return Signer{address, weight}
}

// RemoveSigner creates Signer mutator that removes account's signer
func RemoveSigner(address string) Signer {
	return Signer{address, 0}
}

// MutateSetOptions for Signer sets the SetOptionsOp's signer field
func (m Signer) MutateSetOptions(o *xdr.SetOptionsOp) error {

	var signer xdr.Signer
	signer.Weight = xdr.Uint32(m.Weight)
	err := signer.Key.SetAddress(m.Address)
	if err != nil {
		return errors.Wrap(err, "failed to set address")
	}

	o.Signer = &signer
	return nil
}

// MutateTransaction for Signer allows creating an operation using a single mutator
func (m Signer) MutateTransaction(t *TransactionBuilder) error {
	return mutateTransactionBuilder(t, m)
}

// SetThresholds creates Thresholds mutator
func SetThresholds(low, medium, high uint32) Thresholds {
	return Thresholds{
		Low:    &low,
		Medium: &medium,
		High:   &high,
	}
}

// SetLowThreshold creates Thresholds mutator that sets account's low threshold
func SetLowThreshold(value uint32) Thresholds {
	return Thresholds{Low: &value}
}

// SetMediumThreshold creates Thresholds mutator that sets account's medium threshold
func SetMediumThreshold(value uint32) Thresholds {
	return Thresholds{Medium: &value}
}

// SetHighThreshold creates Thresholds mutator that sets account's high threshold
func SetHighThreshold(value uint32) Thresholds {
	return Thresholds{High: &value}
}

// MutateSetOptions for Thresholds sets the SetOptionsOp's thresholds fields
func (m Thresholds) MutateSetOptions(o *xdr.SetOptionsOp) (err error) {
	if m.Low != nil {
		val := xdr.Uint32(*m.Low)
		o.LowThreshold = &val
	}

	if m.Medium != nil {
		val := xdr.Uint32(*m.Medium)
		o.MedThreshold = &val
	}

	if m.High != nil {
		val := xdr.Uint32(*m.High)
		o.HighThreshold = &val
	}

	return
}

// MutateTransaction for Thresholds allows creating an operation using a single mutator
func (m Thresholds) MutateTransaction(t *TransactionBuilder) error {
	return mutateTransactionBuilder(t, m)
}

// SetAuthRequired sets AuthRequiredFlag on SetOptions operation
func SetAuthRequired() SetFlag {
	return SetFlag(xdr.AccountFlagsAuthRequiredFlag)
}

// SetAuthRevocable sets AuthRevocableFlag on SetOptions operation
func SetAuthRevocable() SetFlag {
	return SetFlag(xdr.AccountFlagsAuthRevocableFlag)
}

// SetAuthImmutable sets AuthImmutableFlag on SetOptions operation
func SetAuthImmutable() SetFlag {
	return SetFlag(xdr.AccountFlagsAuthImmutableFlag)
}

// MutateSetOptions for SetFlag sets the SetOptionsOp's SetFlags field
func (m SetFlag) MutateSetOptions(o *xdr.SetOptionsOp) (err error) {
	if !isFlagValid(xdr.AccountFlags(m)) {
		return errors.New("Unknown flag in SetFlag mutator")
	}

	var val xdr.Uint32
	if o.SetFlags == nil {
		val = xdr.Uint32(m)
	} else {
		val = xdr.Uint32(m) | *o.SetFlags
	}
	o.SetFlags = &val
	return
}

// MutateTransaction for SetFlag allows creating an operation using a single mutator
func (m SetFlag) MutateTransaction(t *TransactionBuilder) error {
	return mutateTransactionBuilder(t, m)
}

// ClearAuthRequired clears AuthRequiredFlag on SetOptions operation
func ClearAuthRequired() ClearFlag {
	return ClearFlag(xdr.AccountFlagsAuthRequiredFlag)
}

// ClearAuthRevocable clears AuthRevocableFlag on SetOptions operation
func ClearAuthRevocable() ClearFlag {
	return ClearFlag(xdr.AccountFlagsAuthRevocableFlag)
}

// ClearAuthImmutable clears AuthImmutableFlag on SetOptions operation
func ClearAuthImmutable() ClearFlag {
	return ClearFlag(xdr.AccountFlagsAuthImmutableFlag)
}

// MutateSetOptions for ClearFlag sets the SetOptionsOp's ClearFlags field
func (m ClearFlag) MutateSetOptions(o *xdr.SetOptionsOp) (err error) {
	if !isFlagValid(xdr.AccountFlags(m)) {
		return errors.New("Unknown flag in SetFlag mutator")
	}

	var val xdr.Uint32
	if o.ClearFlags == nil {
		val = xdr.Uint32(m)
	} else {
		val = xdr.Uint32(m) | *o.ClearFlags
	}
	o.ClearFlags = &val
	return
}

// MutateTransaction for ClearFlag allows creating an operation using a single mutator
func (m ClearFlag) MutateTransaction(t *TransactionBuilder) error {
	return mutateTransactionBuilder(t, m)
}

func isFlagValid(flag xdr.AccountFlags) bool {
	if flag != xdr.AccountFlagsAuthRequiredFlag &&
		flag != xdr.AccountFlagsAuthRevocableFlag &&
		flag != xdr.AccountFlagsAuthImmutableFlag {
		return false
	}
	return true
}

func mutateTransactionBuilder(t *TransactionBuilder, m SetOptionsMutator) error {
	builder := SetOptions(m)
	if builder.Err != nil {
		return builder.Err
	}
	t.Mutate(builder)
	return nil
}
