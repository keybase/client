package stellar

import (
	"testing"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"
)

var convertXLMToOutsideUnits = []struct {
	ok   bool
	rate string
	xlm  string
	out  string
}{
	{false, "", "1", ""},
	{false, "1", "", ""},
	{false, "0", "1", ""},
	{false, "a", "1", ""},
	{false, "1e10", "1", ""},
	{false, "-1", "1", ""}, // negative exchange rate
	// XLM amount too big
	// skip negative variant because MIN_INT64 != -MAX_INT64
	{false, "2", "922337203685.4775808", "skipneg"},
	{false, "2", "0.47758071", ""}, // too many digits of precision for XLM

	{true, "1", "0", "0.0000000"},
	{true, "1", "1", "1.0000000"},
	{true, "0.5", "1", "0.5000000"},
	{true, "0.0000001", "1", "0.0000001"},
	{true, ".75", "4294967290", "3221225467.5000000"},
	{true, "2", "922337203685.4775807", "1844674407370.9551614"},
}

func TestConvertXLMToOutside(t *testing.T) {
	for i, unit := range convertXLMToOutsideUnits {
		for _, neg := range []bool{false, true} {
			t.Logf("%v: %#v", i, unit)
			s := unit.xlm
			if neg {
				s = "-" + s
			}
			y, err := ConvertXLMToOutside(s, stellar1.OutsideExchangeRate{
				Currency: stellar1.OutsideCurrencyCode("PLN"),
				Rate:     unit.rate,
			})
			if unit.out == "skipneg" {
				continue
			}
			require.Equal(t, unit.ok, err == nil, "converted without error: (got err:%v)", err)
			if unit.ok {
				expect := unit.out
				if neg && unit.xlm != "0" {
					expect = "-" + expect
				}
				require.Equal(t, expect, y, "converted to outside amount")
			}
		}
	}
}

var convertOutsideToXLMUnits = []struct {
	ok      bool
	rate    string
	outside string
	xlm     string
}{
	{false, "", "1", ""},
	{false, "1", "", ""},
	{false, "0", "1", ""},
	{false, "a", "1", ""},
	{false, "1e10", "1", ""},
	{false, "-1", "1", ""}, // negative exchange rate

	{true, "2", "0.47758071", "0.2387904"}, // many digits of precision are fine
	{true, "1", "0", "0.0000000"},
	{true, "1", "1", "1.0000000"},
	{true, "0.5", "1", "2.0000000"},
	{true, "0.0000001", "1", "10000000.0000000"},
	{true, ".75", "4294967290", "5726623053.3333333"},
	{true, "0.5", "922337203685.4775808", "1844674407370.9551616"}, // return can be greater than max XLM
}

func TestConvertOutsideToXLM(t *testing.T) {
	for i, unit := range convertOutsideToXLMUnits {
		for _, neg := range []bool{false, true} {
			t.Logf("%v: %#v", i, unit)
			s := unit.outside
			if neg {
				s = "-" + s
			}
			y, err := ConvertOutsideToXLM(s, stellar1.OutsideExchangeRate{
				Currency: stellar1.OutsideCurrencyCode("PLN"),
				Rate:     unit.rate,
			})
			require.Equal(t, unit.ok, err == nil, "converted without error: (got err:%v)", err)
			if unit.ok {
				expect := unit.xlm
				if neg && unit.outside != "0" {
					expect = "-" + expect
				}
				require.Equal(t, expect, y, "converted to xlm amount")
			}
		}
	}
}

var decimalUnits = []struct {
	ok  bool
	s   string
	val string
}{
	{false, "", ""},
	{false, ".", ""},
	{false, "-", ""},
	{false, "1-", ""},
	{false, ".1-", ""},
	{false, ".-1", ""},
	{false, "-1-", ""},
	{false, "1a", ""},
	{false, "a", ""},
	{false, "a1", ""},
	{false, "1.a", ""},
	{false, "a.1", ""},
	{false, ".1.", ""},
	{false, "1e10", ""},
	{false, "1,2", ""},
	{false, "1,", ""},
	{false, ",1", ""},
	{false, "1/2", ""},
	{false, "1b10", ""},
	{false, " 10.95", ""},
	{false, "10.95 ", ""},
	{false, "10. 95 ", ""},
	{false, "1 0.95 ", ""},
	{false, "10.9 5", ""},
	{false, "--10.95", ""},

	{true, "1", "1/1"},
	{true, "1.", ""},
	{true, ".1", "1/10"},
	{true, "1.1", ""},

	{true, "3333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333", ""},
	{true, "3333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333.", ""},
	{true, ".3333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333", ""},
	{true, "3333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333.3333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333", "33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333/10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"},

	{true, "10.95", "219/20"},
	{true, "1234567", "1234567/1"},
	{true, "1234567.8910", ""},
	{true, "005.00500", ""},
}

func TestDecimalStrictRegex(t *testing.T) {
	for i, unit := range decimalUnits {
		for _, neg := range []bool{false, true} {
			t.Logf("%v: %#v", i, unit)
			s := unit.s
			if neg {
				s = "-" + s
			}
			require.Equal(t, unit.ok, decimalStrictRE.MatchString(s))
		}
	}
}

func TestParseDecimalStrict(t *testing.T) {
	for i, unit := range decimalUnits {
		for _, neg := range []bool{false, true} {
			t.Logf("%v: %#v", i, unit)
			s := unit.s
			if neg {
				s = "-" + s
			}
			v, err := ParseDecimalStrict(s)
			t.Logf("-> (%v, %v)", v, err)
			require.Equal(t, unit.ok, err == nil, "parsed without error")
			if unit.ok {
				if unit.val != "" {
					if neg {
						require.Equal(t, "-"+unit.val, v.String())
					} else {
						require.Equal(t, unit.val, v.String())
					}
				}
			}
		}
	}
}
