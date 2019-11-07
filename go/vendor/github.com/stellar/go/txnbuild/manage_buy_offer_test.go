package txnbuild

import (
	"testing"

	"github.com/stellar/go/network"
	"github.com/stretchr/testify/assert"
)

func TestManageBuyOfferValidateSellingAsset(t *testing.T) {
	kp0 := newKeypair0()
	kp1 := newKeypair1()
	sourceAccount := NewSimpleAccount(kp1.Address(), int64(41137196761092))

	buyOffer := ManageBuyOffer{
		Selling: CreditAsset{"", kp0.Address()},
		Buying:  NativeAsset{},
		Amount:  "100",
		Price:   "0.01",
		OfferID: 0,
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&buyOffer},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	err := tx.Build()
	if assert.Error(t, err) {
		expected := "validation failed for *txnbuild.ManageBuyOffer operation: Field: Selling, Error: asset code length must be between 1 and 12 characters"
		assert.Contains(t, err.Error(), expected)
	}
}

func TestManageBuyOfferValidateBuyingAsset(t *testing.T) {
	kp0 := newKeypair0()
	kp1 := newKeypair1()
	sourceAccount := NewSimpleAccount(kp1.Address(), int64(41137196761092))

	buyOffer := ManageBuyOffer{
		Selling: CreditAsset{"ABC", kp0.Address()},
		Buying:  CreditAsset{"XYZ", ""},
		Amount:  "100",
		Price:   "0.01",
		OfferID: 0,
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&buyOffer},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	err := tx.Build()
	if assert.Error(t, err) {
		expected := "validation failed for *txnbuild.ManageBuyOffer operation: Field: Buying, Error: asset issuer: public key is undefined"
		assert.Contains(t, err.Error(), expected)
	}
}

func TestManageBuyOfferValidateAmount(t *testing.T) {
	kp0 := newKeypair0()
	kp1 := newKeypair1()
	sourceAccount := NewSimpleAccount(kp1.Address(), int64(41137196761092))

	buyOffer := ManageBuyOffer{
		Selling: CreditAsset{"ABCD", kp0.Address()},
		Buying:  NativeAsset{},
		Amount:  "",
		Price:   "0.01",
		OfferID: 0,
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&buyOffer},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	err := tx.Build()
	if assert.Error(t, err) {
		expected := "validation failed for *txnbuild.ManageBuyOffer operation: Field: Amount, Error: invalid amount format:"
		assert.Contains(t, err.Error(), expected)
	}
}

func TestManageBuyOfferValidatePrice(t *testing.T) {
	kp0 := newKeypair0()
	kp1 := newKeypair1()
	sourceAccount := NewSimpleAccount(kp1.Address(), int64(41137196761092))

	buyOffer := ManageBuyOffer{
		Selling: CreditAsset{"ABCD", kp0.Address()},
		Buying:  NativeAsset{},
		Amount:  "0",
		Price:   "-0.01",
		OfferID: 0,
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&buyOffer},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	err := tx.Build()
	if assert.Error(t, err) {
		expected := "validation failed for *txnbuild.ManageBuyOffer operation: Field: Price, Error: amount can not be negative"
		assert.Contains(t, err.Error(), expected)
	}
}

func TestManageBuyOfferValidateOfferID(t *testing.T) {
	kp0 := newKeypair0()
	kp1 := newKeypair1()
	sourceAccount := NewSimpleAccount(kp1.Address(), int64(41137196761092))

	buyOffer := ManageBuyOffer{
		Selling: CreditAsset{"ABCD", kp0.Address()},
		Buying:  NativeAsset{},
		Amount:  "0",
		Price:   "0.01",
		OfferID: -1,
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&buyOffer},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	err := tx.Build()
	if assert.Error(t, err) {
		expected := "validation failed for *txnbuild.ManageBuyOffer operation: Field: OfferID, Error: amount can not be negative"
		assert.Contains(t, err.Error(), expected)
	}
}
