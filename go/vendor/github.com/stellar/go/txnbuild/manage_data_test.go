package txnbuild

import (
	"testing"

	"github.com/stellar/go/network"
	"github.com/stretchr/testify/assert"
)

func TestManageDataValidateName(t *testing.T) {
	kp0 := newKeypair0()
	sourceAccount := NewSimpleAccount(kp0.Address(), int64(3556091187167235))

	manageData := ManageData{
		Name:  "This is a very long name for a field that only accepts 64 characters",
		Value: []byte(""),
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&manageData},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	err := tx.Build()
	if assert.Error(t, err) {
		expected := "validation failed for *txnbuild.ManageData operation: Field: Name, Error: maximum length is 64 characters"
		assert.Contains(t, err.Error(), expected)
	}
}

func TestManageDataValidateValue(t *testing.T) {
	kp0 := newKeypair0()
	sourceAccount := NewSimpleAccount(kp0.Address(), int64(3556091187167235))

	manageData := ManageData{
		Name:  "cars",
		Value: []byte("toyota, ford, porsche, lamborghini, hyundai, volkswagen, gmc, kia"),
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&manageData},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	err := tx.Build()
	if assert.Error(t, err) {
		expected := "validation failed for *txnbuild.ManageData operation: Field: Value, Error: maximum length is 64 bytes"
		assert.Contains(t, err.Error(), expected)
	}
}
