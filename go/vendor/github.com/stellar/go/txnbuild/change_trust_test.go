package txnbuild

import (
	"testing"

	"github.com/stellar/go/network"
	"github.com/stretchr/testify/assert"
)

func TestChangeTrustMaxLimit(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	changeTrust := ChangeTrust{
		Line: CreditAsset{"ABCD", kp0.Address()},
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&changeTrust},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}
	received := buildSignEncode(t, tx, kp0)

	// https://www.stellar.org/laboratory/#xdr-viewer?input=AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAGAAAAAUFCQ0QAAAAA4Nxt4XJcrGZRYrUvrOc1sooiQ%2BQdEk1suS1wo%2BoucsV%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwAAAAAAAAAB6i5yxQAAAEBen%2BAa821qqfb%2BASHhCg074ulPcCbIsUNvzUg2x92R%2FvRRKIGF5RztvPGBkktWkXLarDe5yqlBA%2BL3zpcVs%2BwB&type=TransactionEnvelope&network=test
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAGAAAAAUFCQ0QAAAAA4Nxt4XJcrGZRYrUvrOc1sooiQ+QdEk1suS1wo+oucsV//////////wAAAAAAAAAB6i5yxQAAAEBen+Aa821qqfb+ASHhCg074ulPcCbIsUNvzUg2x92R/vRRKIGF5RztvPGBkktWkXLarDe5yqlBA+L3zpcVs+wB"
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestChangeTrustValidateInvalidAsset(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	changeTrust := ChangeTrust{
		Line: NativeAsset{},
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&changeTrust},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}
	err := tx.Build()
	if assert.Error(t, err) {
		expected := "validation failed for *txnbuild.ChangeTrust operation: Field: Line, Error: native (XLM) asset type is not allowed"
		assert.Contains(t, err.Error(), expected)
	}
}

func TestChangeTrustValidateInvalidLimit(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	changeTrust := ChangeTrust{
		Line:  CreditAsset{"ABCD", kp0.Address()},
		Limit: "-1",
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&changeTrust},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}
	err := tx.Build()
	if assert.Error(t, err) {
		expected := "validation failed for *txnbuild.ChangeTrust operation: Field: Limit, Error: amount can not be negative"
		assert.Contains(t, err.Error(), expected)
	}
}
