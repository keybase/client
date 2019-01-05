package xdr_test

import (
	"testing"

	. "github.com/stellar/go/xdr"
	"github.com/stretchr/testify/assert"
)

func TestSignerKey_SetAddress(t *testing.T) {
	cases := []struct {
		Name    string
		Address string
	}{

		{
			Name:    "AccountID",
			Address: "GA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQHES5",
		},
		{
			Name:    "HashTx",
			Address: "TBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHXL7",
		},
		{
			Name:    "HashX",
			Address: "XBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWGTOG",
		},
	}

	for _, kase := range cases {
		var dest SignerKey

		err := dest.SetAddress(kase.Address)
		if assert.NoError(t, err, "error in case: %s", kase.Name) {
			assert.Equal(t, kase.Address, dest.Address(), "address set incorrectly")
		}
	}

	// setting a seed causes an error
	var dest SignerKey
	err := dest.SetAddress("SBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHOKR")
	assert.Error(t, err)
}
