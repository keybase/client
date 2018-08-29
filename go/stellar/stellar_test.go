package stellar

import (
	"testing"

	"github.com/stretchr/testify/require"
)

type fmtTest struct {
	amount  string
	precTwo bool
	out     string
}

var fmtTests = []fmtTest{
	{amount: "0", precTwo: false, out: "0"},
	{amount: "0.00", precTwo: false, out: "0"},
	{amount: "0.0000000", precTwo: false, out: "0"},
	{amount: "0", precTwo: true, out: "0.00"},
	{amount: "0.00", precTwo: true, out: "0.00"},
	{amount: "0.0000000", precTwo: true, out: "0.00"},
	{amount: "0.123", precTwo: false, out: "0.1230000"},
	{amount: "0.123", precTwo: true, out: "0.12"},
	{amount: "123", precTwo: false, out: "123"},
	{amount: "123", precTwo: true, out: "123.00"},
	{amount: "123.456", precTwo: false, out: "123.4560000"},
	{amount: "1234.456", precTwo: false, out: "1,234.4560000"},
	{amount: "1234.456", precTwo: true, out: "1,234.46"},
	{amount: "1234.1234567", precTwo: false, out: "1,234.1234567"},
	{amount: "123123123.1234567", precTwo: false, out: "123,123,123.1234567"},
	{amount: "123123123.1234567", precTwo: true, out: "123,123,123.12"},
	{amount: "9123123123.1234567", precTwo: false, out: "9,123,123,123.1234567"},
	{amount: "89123123123.1234567", precTwo: false, out: "89,123,123,123.1234567"},
	{amount: "456456456123123123.1234567", precTwo: false, out: "456,456,456,123,123,123.1234567"},
	{amount: "-0.123", precTwo: false, out: "-0.1230000"},
	{amount: "-0.123", precTwo: true, out: "-0.12"},
	{amount: "-123", precTwo: false, out: "-123"},
	{amount: "-123", precTwo: true, out: "-123.00"},
	{amount: "-123.456", precTwo: false, out: "-123.4560000"},
	{amount: "-1234.456", precTwo: false, out: "-1,234.4560000"},
	{amount: "-1234.456", precTwo: true, out: "-1,234.46"},
	{amount: "-1234.1234567", precTwo: false, out: "-1,234.1234567"},
	{amount: "-123123123.1234567", precTwo: false, out: "-123,123,123.1234567"},
	{amount: "-123123123.1234567", precTwo: true, out: "-123,123,123.12"},
	{amount: "-9123123123.1234567", precTwo: false, out: "-9,123,123,123.1234567"},
	{amount: "-89123123123.1234567", precTwo: false, out: "-89,123,123,123.1234567"},
	{amount: "-456456456123123123.1234567", precTwo: false, out: "-456,456,456,123,123,123.1234567"},
	{amount: "123123", precTwo: true, out: "123,123.00"},
	{amount: "123123", precTwo: false, out: "123,123.00"},
}

func TestFormatAmount(t *testing.T) {
	for _, test := range fmtTests {
		x, err := FormatAmount(test.amount, test.precTwo)
		require.NoError(t, err, "%q (2pt prec %v) => error: %s", test.amount, test.precTwo, err)
		require.Equal(t, test.out, x, "%q (2pt prec %v) => %q, expected: %q", test.amount, test.precTwo, x, test.out)
	}
}
