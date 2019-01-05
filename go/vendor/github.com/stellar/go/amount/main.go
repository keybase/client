// Package amount provides utilities for converting numbers to/from
// the format used internally to stellar-core.
//
// stellar-core represents asset "amounts" as 64-bit integers, but to enable
// fractional units of an asset, horizon, the client-libraries and other built
// on top of stellar-core use a convention, encoding amounts as a string of
// decimal digits with up to seven digits of precision in the fractional
// portion. For example, an amount shown as "101.001" in horizon would be
// represented in stellar-core as 1010010000.
package amount

import (
	"math/big"
	"regexp"
	"strconv"
	"strings"

	"github.com/stellar/go/support/errors"
	"github.com/stellar/go/xdr"
)

// One is the value of one whole unit of currency. Stellar uses 7 fixed digits
// for fractional values, thus One is 10 million (10^7).
const (
	One = 10000000
)

var (
	bigOne = big.NewRat(One, 1)
	// validAmountSimple is a simple regular expression checking if a string looks like
	// a number, more or less. The details will be checked in `math/big` internally.
	// What we want to prevent is passing very big numbers like `1e9223372036854775807`
	// to `big.Rat.SetString` triggering long calculations.
	// Note: {1,20} because the biggest amount you can use in Stellar is:
	// len("922337203685.4775807") = 20.
	validAmountSimple          = regexp.MustCompile("^-?[.0-9]{1,20}$")
	negativePositiveNumberOnly = regexp.MustCompile("^-?[0-9]+$")
)

// MustParse is the panicking version of Parse.
func MustParse(v string) xdr.Int64 {
	ret, err := Parse(v)
	if err != nil {
		panic(err)
	}
	return ret
}

// Parse parses the provided as a stellar "amount", i.e. a 64-bit signed integer
// that represents a decimal number with 7 digits of significance in the
// fractional portion of the number, and returns a xdr.Int64.
func Parse(v string) (xdr.Int64, error) {
	i, err := ParseInt64(v)
	if err != nil {
		return xdr.Int64(0), err
	}
	return xdr.Int64(i), nil
}

// ParseInt64 parses the provided as a stellar "amount", i.e. a 64-bit signed
// integer that represents a decimal number with 7 digits of significance in
// the fractional portion of the number.
func ParseInt64(v string) (int64, error) {
	if !validAmountSimple.MatchString(v) {
		return 0, errors.Errorf("invalid amount format: %s", v)
	}

	r := &big.Rat{}
	if _, ok := r.SetString(v); !ok {
		return 0, errors.Errorf("cannot parse amount: %s", v)
	}

	r.Mul(r, bigOne)
	if !r.IsInt() {
		return 0, errors.Errorf("more than 7 significant digits: %s", v)
	}

	i, err := strconv.ParseInt(r.FloatString(0), 10, 64)
	if err != nil {
		return 0, errors.Wrapf(err, "amount outside bounds of int64: %s", v)
	}
	return i, nil
}

// IntStringToAmount converts string integer value and converts it to stellar
// "amount". In other words, it divides the given string integer value by 10^7
// and returns the string representation of that number.
// It is safe to use with values exceeding int64 limits.
func IntStringToAmount(v string) (string, error) {
	if !negativePositiveNumberOnly.MatchString(v) {
		return "", errors.Errorf("invalid amount format: %s", v)
	}

	negative := false
	if v[0] == '-' {
		negative = true
		v = v[1:]
	}

	l := len(v)
	var r string
	if l <= 7 {
		r = "0." + strings.Repeat("0", 7-l) + v
	} else {
		r = v[0:l-7] + "." + v[l-7:l]
	}

	if negative {
		r = "-" + r
	}

	return r, nil
}

// String returns an "amount string" from the provided raw xdr.Int64 value `v`.
func String(v xdr.Int64) string {
	return StringFromInt64(int64(v))
}

// StringFromInt64 returns an "amount string" from the provided raw int64 value `v`.
func StringFromInt64(v int64) string {
	r := big.NewRat(v, 1)
	r.Quo(r, bigOne)
	return r.FloatString(7)
}
