// Package build implements a builder system for constructing various xdr
// structures used by the stellar network, most importanly transactions.
//
// At the core of this package is the *Builder and *Mutator types.  A Builder
// object (ex. PaymentBuilder, TransactionBuilder) contain an underlying xdr
// struct that is being iteratively built by having zero or more Mutator structs
// applied to it. See ExampleTransactionBuilder in main_test.go for an example.
//
package build

import (
	"math"

	"github.com/stellar/go/amount"
	"github.com/stellar/go/network"
	"github.com/stellar/go/xdr"
)

const (
	// MemoTextMaxLength represents the maximum number of bytes a valid memo of
	// type "MEMO_TEXT" can be.
	MemoTextMaxLength = 28
)

var (
	// PublicNetwork is a mutator that configures the transaction for submission
	// to the main public stellar network.
	PublicNetwork = Network{network.PublicNetworkPassphrase}

	// TestNetwork is a mutator that configures the transaction for submission
	// to the test stellar network (often called testnet).
	TestNetwork = Network{network.TestNetworkPassphrase}

	// DefaultNetwork is a mutator that configures the
	// transaction for submission to the default stellar
	// network.  Integrators may change this value to
	// another `Network` mutator if they would like to
	// effect the default in a process-global manner.
	// Replace or set your own custom passphrase on this
	// var to set the default network for the process.
	DefaultNetwork = Network{}
)

// Amount is a mutator capable of setting the amount
type Amount string

// Asset is struct used in path_payment mutators
type Asset struct {
	Code   string
	Issuer string
	Native bool
}

// AllowTrustAsset is a mutator capable of setting the asset on
// an operations that have one.
type AllowTrustAsset struct {
	Code string
}

// Authorize is a mutator capable of setting the `authorize` flag
type Authorize struct {
	Value bool
}

// AutoSequence loads the sequence to use for the transaction from an external
// provider.
type AutoSequence struct {
	SequenceProvider
}

// BumpTo sets sequence number on BumpSequence operation
type BumpTo int64

// NativeAsset is a helper method to create native Asset object
func NativeAsset() Asset {
	return Asset{Native: true}
}

// CreditAsset is a helper method to create credit Asset object
func CreditAsset(code, issuer string) Asset {
	return Asset{code, issuer, false}
}

// CreditAmount is a mutator that configures a payment to be using credit
// asset and have the amount provided.
type CreditAmount struct {
	Code   string
	Issuer string
	Amount string
}

// Defaults is a mutator that sets defaults
type Defaults struct{}

// Destination is a mutator capable of setting the destination on
// an operations that have one.
type Destination struct {
	AddressOrSeed string
}

// InflationDest is a mutator capable of setting the inflation destination
type InflationDest string

// HomeDomain is a mutator capable of setting home domain of the account
type HomeDomain string

// MemoHash is a mutator that sets a memo on the mutated transaction of type
// MEMO_HASH.
type MemoHash struct {
	Value xdr.Hash
}

// Limit is a mutator that sets a limit on the change_trust operation
type Limit Amount

// MasterWeight is a mutator that sets account's master weight
type MasterWeight uint32

// MaxLimit represents the maximum value that can be passed as trutline Limit
var MaxLimit = Limit(amount.String(math.MaxInt64))

// MemoID is a mutator that sets a memo on the mutated transaction of type
// MEMO_ID.
type MemoID struct {
	Value uint64
}

// MemoReturn is a mutator that sets a memo on the mutated transaction of type
// MEMO_RETURN.
type MemoReturn struct {
	Value xdr.Hash
}

// MemoText is a mutator that sets a memo on the mutated transaction of type
// MEMO_TEXT.
type MemoText struct {
	Value string
}

// NativeAmount is a mutator that configures a payment to be using native
// currency and have the amount provided (in lumens).
type NativeAmount struct {
	Amount string
}

// OfferID is a mutator that sets offer ID on offer operations
type OfferID uint64

// PayWithPath is a mutator that configures a path_payment's send asset and max amount
type PayWithPath struct {
	Asset
	MaxAmount string
	Path      []Asset
}

// Through appends a new asset to the path
func (pathSend PayWithPath) Through(asset Asset) PayWithPath {
	pathSend.Path = append(pathSend.Path, asset)
	return pathSend
}

// PayWith is a helper to create PayWithPath struct
func PayWith(sendAsset Asset, maxAmount string) PayWithPath {
	return PayWithPath{
		Asset:     sendAsset,
		MaxAmount: maxAmount,
	}
}

// Price is a mutator that sets price on offer operations
type Price string

// Rate is a mutator that sets selling/buying asset and price on offer operations
type Rate struct {
	Selling Asset
	Buying  Asset
	Price
}

// Sequence is a mutator that sets the sequence number on a transaction
type Sequence struct {
	Sequence uint64
}

// SequenceProvider is the interface that other packages may implement to be
// used with the `AutoSequence` mutator.
type SequenceProvider interface {
	SequenceForAccount(aid string) (xdr.SequenceNumber, error)
}

// Sign is a mutator that contributes a signature of the provided envelope's
// transaction with the configured key
type Sign struct {
	Seed string
}

// SetFlag is a mutator capable of setting account flags
type SetFlag int32

// ClearFlag is a mutator capable of clearing account flags
type ClearFlag int32

// Signer is a mutator capable of adding, updating and deleting an account
// signer
type Signer struct {
	Address string
	Weight  uint32
}

// SourceAccount is a mutator capable of setting the source account on
// an xdr.Operation and an xdr.Transaction
type SourceAccount struct {
	AddressOrSeed string
}

// Thresholds is a mutator capable of setting account thresholds
type Thresholds struct {
	Low    *uint32
	Medium *uint32
	High   *uint32
}

type Timebounds struct {
	MinTime uint64
	MaxTime uint64
}

// Trustor is a mutator capable of setting the trustor on
// allow_trust operation.
type Trustor struct {
	Address string
}

// Network establishes the stellar network that a transaction should apply to.
// This modifier influences how a transaction is hashed for the purposes of signature generation.
type Network struct {
	Passphrase string
}

// ID returns the network ID derived from this struct's Passphrase
func (n *Network) ID() [32]byte {
	return network.ID(n.Passphrase)
}

// BaseFee is a mutator capable of setting the base fee
type BaseFee struct {
	Amount uint64
}
