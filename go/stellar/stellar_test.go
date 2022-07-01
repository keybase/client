package stellar

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/stellarnet"
	"github.com/stretchr/testify/require"
)

type fmtTest struct {
	amount  string
	precTwo bool

	// "": both 'round' and 'truncate' are expected to return the same result
	// "round": round the value
	// "truncate": truncate the value
	rounding string

	out   string
	valid bool
}

var fmtTests = []fmtTest{
	{amount: "0", precTwo: false, out: "0", valid: true},
	{amount: "0.00", precTwo: false, out: "0", valid: true},
	{amount: "0.0000000", precTwo: false, out: "0", valid: true},
	{amount: "0", precTwo: true, out: "0.00", valid: true},
	{amount: "0.00", precTwo: true, out: "0.00", valid: true},
	{amount: "0.0000000", precTwo: true, out: "0.00", valid: true},
	{amount: "0.123", precTwo: false, out: "0.1230000", valid: true},
	{amount: "0.123", precTwo: true, out: "0.12", valid: true},
	{amount: "123", precTwo: false, out: "123", valid: true},
	{amount: "123", precTwo: true, out: "123.00", valid: true},
	{amount: "123.456", precTwo: false, out: "123.4560000", valid: true},
	{amount: "1234.456", precTwo: false, out: "1,234.4560000", valid: true},
	{amount: "1234.456", precTwo: true, rounding: "round", out: "1,234.46", valid: true},
	{amount: "1234.456", precTwo: true, rounding: "truncate", out: "1,234.45", valid: true},
	{amount: "1234.1234567", precTwo: false, out: "1,234.1234567", valid: true},
	{amount: "123123123.1234567", precTwo: false, out: "123,123,123.1234567", valid: true},
	{amount: "123123123.1234567", precTwo: true, out: "123,123,123.12", valid: true},
	{amount: "9123123123.1234567", precTwo: false, out: "9,123,123,123.1234567", valid: true},
	{amount: "89123123123.1234567", precTwo: false, out: "89,123,123,123.1234567", valid: true},
	{amount: "456456456123123123.1234567", precTwo: false, out: "456,456,456,123,123,123.1234567", valid: true},
	{amount: "-0.123", precTwo: false, out: "-0.1230000", valid: true},
	{amount: "-0.123", precTwo: true, out: "-0.12", valid: true},
	{amount: "-123", precTwo: false, out: "-123", valid: true},
	{amount: "-123", precTwo: true, out: "-123.00", valid: true},
	{amount: "-123.456", precTwo: false, out: "-123.4560000", valid: true},
	{amount: "-1234.456", precTwo: false, out: "-1,234.4560000", valid: true},
	{amount: "-1234.456", precTwo: true, rounding: "round", out: "-1,234.46", valid: true},
	{amount: "-1234.456", precTwo: true, rounding: "truncate", out: "-1,234.45", valid: true},
	{amount: "-1234.1234567", precTwo: false, out: "-1,234.1234567", valid: true},
	{amount: "-123123123.1234567", precTwo: false, out: "-123,123,123.1234567", valid: true},
	{amount: "-123123123.1234567", precTwo: true, out: "-123,123,123.12", valid: true},
	{amount: "-9123123123.1234567", precTwo: false, out: "-9,123,123,123.1234567", valid: true},
	{amount: "-89123123123.1234567", precTwo: false, out: "-89,123,123,123.1234567", valid: true},
	{amount: "-456456456123123123.1234567", precTwo: false, out: "-456,456,456,123,123,123.1234567", valid: true},
	{amount: "123123", precTwo: true, out: "123,123.00", valid: true},
	{amount: "123123", precTwo: false, out: "123,123.00", valid: true},
	// error cases
	{amount: "", out: "", valid: false},
	{amount: "garbage", out: "", valid: false},
	{amount: "3/4", out: "", valid: false},
	{amount: "1.234e5", out: "", valid: false},
	{amount: "132E5", out: "", valid: false},
	{amount: "132.5 3", out: "", valid: false},
}

func TestFormatAmount(t *testing.T) {
	tc := libkb.SetupTest(t, "fmt", 1)
	defer tc.Cleanup()

	for i, test := range fmtTests {
		switch test.rounding {
		case "", "round", "truncate":
		default:
			t.Fatalf("%v: invalid rounding '%v'", i, test.rounding)
		}
		for _, rounding := range []stellarnet.FmtRoundingBehavior{stellarnet.Round, stellarnet.Truncate} {
			if test.rounding == "round" && rounding == stellarnet.Truncate {
				continue
			}
			if test.rounding == "truncate" && rounding == stellarnet.Round {
				continue
			}
			desc := fmt.Sprintf("amount: %v (2pt prec %v) (rounding %v)", test.amount, test.precTwo, rounding)
			x, err := FormatAmount(libkb.NewMetaContextForTest(tc), test.amount, test.precTwo, rounding)
			if test.valid {
				require.NoError(t, err, "%v => error: %v", desc, err)
				require.Equal(t, test.out, x, "%v => %q, expected: %q", desc, x, test.out)
			} else {
				require.Errorf(t, err, "%v is supposed to be invalid input", desc)
				require.Equal(t, test.out, x)
			}
		}
	}
}
