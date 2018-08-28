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
	{amount: "0.123", precTwo: false, out: "0.123"},
	{amount: "0.123", precTwo: true, out: "0.12"},
	{amount: "123", precTwo: false, out: "123"},
	{amount: "123", precTwo: true, out: "123.00"},
	{amount: "123.456", precTwo: false, out: "123.456"},
	{amount: "1234.456", precTwo: false, out: "1,234.456"},
	{amount: "1234.456", precTwo: true, out: "1,234.46"},
	{amount: "1234.1234567", precTwo: false, out: "1,234.1234567"},
	{amount: "123123123.1234567", precTwo: false, out: "123,123,123.1234567"},
	{amount: "123123123.1234567", precTwo: true, out: "123,123,123.12"},
	{amount: "9123123123.1234567", precTwo: false, out: "9,123,123,123.1234567"},
	{amount: "89123123123.1234567", precTwo: false, out: "89,123,123,123.1234567"},
	{amount: "456456456123123123.1234567", precTwo: false, out: "456,456,456,123,123,123.1234567"},
	{amount: "-0.123", precTwo: false, out: "-0.123"},
	{amount: "-0.123", precTwo: true, out: "-0.12"},
	{amount: "-123", precTwo: false, out: "-123"},
	{amount: "-123", precTwo: true, out: "-123.00"},
	{amount: "-123.456", precTwo: false, out: "-123.456"},
	{amount: "-1234.456", precTwo: false, out: "-1,234.456"},
	{amount: "-1234.456", precTwo: true, out: "-1,234.46"},
	{amount: "-1234.1234567", precTwo: false, out: "-1,234.1234567"},
	{amount: "-123123123.1234567", precTwo: false, out: "-123,123,123.1234567"},
	{amount: "-123123123.1234567", precTwo: true, out: "-123,123,123.12"},
	{amount: "-9123123123.1234567", precTwo: false, out: "-9,123,123,123.1234567"},
	{amount: "-89123123123.1234567", precTwo: false, out: "-89,123,123,123.1234567"},
	{amount: "-456456456123123123.1234567", precTwo: false, out: "-456,456,456,123,123,123.1234567"},
}

func TestFormatAmount(t *testing.T) {
	for _, test := range fmtTests {
		x, err := FormatAmount(test.amount, test.precTwo)
		require.NoError(t, err, "%q (2pt prec %v) => error: %s", test.amount, test.precTwo, err)
		require.Equal(t, test.out, x, "%q (2pt prec %v) => %q, expected: %q", test.amount,
			test.precTwo, x, test.out)
	}
}

func TestDefaultFormatting(t *testing.T) {
	// Most callers will probably use `FormatAmount(val, false)`
	// when trying to format monetary amount. Make sure the default
	// formatting is sane as far as precision and removal of
	// leading/trailing zeroes is concerned.

	units := []struct {
		a, b string
	}{
		{"1", "1"},
		{"100", "100"},
		{"100.00", "100"},
		{"100.0000001", "100.0000001"},
		{"100.000000100", "100.0000001"},
		{"0100.00", "100"},
		{".1", "0.1"},
		{".01", "0.01"},
		{".010", "0.01"},
		{"1.0010000", "1.001"},
		{"1.0000000", "1"},
	}
	for i, u := range units {
		val, err := FormatAmount(u.a, false)
		require.NoError(t, err)
		require.Equal(t, u.b, val, "units[%v]", i)
	}
}

func TestFormattingError(t *testing.T) {
	testBadAmount := func(amt string) {
		_, err := FormatAmount(amt, false)
		require.Error(t, err)
	}

	testBadAmount("")
	testBadAmount("aaa")
}
