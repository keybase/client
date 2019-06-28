package stellarnet

import (
	"fmt"
	"math/big"
	"regexp"

	"github.com/pkg/errors"
	stellaramount "github.com/stellar/go/amount"
	"github.com/stellar/go/xdr"
)

const (
	// StroopsPerLumen is the number of stroops in a lumen.
	StroopsPerLumen = 10000000
)

var (
	// Alow "-1", "1.", ".1", "1.1".
	// But not "." or "" or fractions or exponents
	decimalStrictRE = regexp.MustCompile(`^-?((\d+\.?\d*)|(\d*\.?\d+))$`)
)

func validateNumericalString(s string) (ok bool, err error) {
	if s == "" {
		return false, fmt.Errorf("expected decimal number but found empty string")
	}
	if !decimalStrictRE.MatchString(s) {
		return false, fmt.Errorf("expected decimal number: %s", s)
	}
	return true, nil
}

// ParseStellarAmount parses a decimal number into an int64 suitable
// for the stellar protocol (7 significant digits).
// See also stellar/go/amount#ParseInt64
func ParseStellarAmount(s string) (int64, error) {
	if _, err := validateNumericalString(s); err != nil {
		return 0, err
	}
	return stellaramount.ParseInt64(s)
}

// StringFromStellarAmount returns an "amount string" from the provided raw int64 value `v`.
func StringFromStellarAmount(v int64) string {
	return stellaramount.StringFromInt64(v)
}

// StringFromStellarXdrAmount returns StringFromStellarAmount with casting to int64.
func StringFromStellarXdrAmount(v xdr.Int64) string {
	return stellaramount.String(v)
}

// ParseAmount parses a decimal number into a big rational.
// Used instead of big.Rat.SetString because the latter accepts
// additional formats like "1/2" and "1e10".
func ParseAmount(s string) (*big.Rat, error) {
	if _, err := validateNumericalString(s); err != nil {
		return nil, err
	}
	v, ok := new(big.Rat).SetString(s)
	if !ok {
		return nil, fmt.Errorf("expected decimal number: %s", s)
	}
	return v, nil
}

// ConvertXLMToOutside converts an amount of lumens into an amount of outside currency.
// `rate` is the amount of outside currency that 1 XLM is worth. Example: "0.9389014463" = PLN / XLM
// The result is rounded to 7 digits past the decimal.
// The rounding is arbitrary but expected to be sufficient precision.
func ConvertXLMToOutside(xlmAmount, rate string) (outsideAmount string, err error) {
	rateRat, err := parseExchangeRate(rate)
	if err != nil {
		return "", err
	}
	amountInt64, err := ParseStellarAmount(xlmAmount)
	if err != nil {
		return "", fmt.Errorf("parsing amount to convert: %q", err)
	}
	acc := big.NewRat(amountInt64, StroopsPerLumen)
	acc.Mul(acc, rateRat)
	return acc.FloatString(7), nil
}

// ConvertOutsideToXLM converts an amount of outside currency into an amount of lumens.
// `rate` is the amount of outside currency that 1 XLM is worth. Example: "0.9389014463" = PLN / XLM
// The result is rounded to 7 digits past the decimal (which is what XLM supports).
// The result returned can of a greater magnitude than XLM supports.
func ConvertOutsideToXLM(outsideAmount, rate string) (xlmAmount string, err error) {
	rateRat, err := parseExchangeRate(rate)
	if err != nil {
		return "", err
	}
	acc, err := ParseAmount(outsideAmount)
	if err != nil {
		return "", fmt.Errorf("parsing amount to convert: %q", outsideAmount)
	}
	acc.Quo(acc, rateRat)
	return acc.FloatString(7), nil
}

// CompareStellarAmounts compares amounts of stellar assets.
// Returns:
//
//   -1 if x <  y
//    0 if x == y
//   +1 if x >  y
//
func CompareStellarAmounts(amount1, amount2 string) (int, error) {
	amountx, err := ParseStellarAmount(amount1)
	if err != nil {
		return 0, err
	}
	amounty, err := ParseStellarAmount(amount2)
	if err != nil {
		return 0, err
	}
	switch {
	case amountx < amounty:
		return -1, nil
	case amountx > amounty:
		return 1, nil
	default:
		return 0, nil
	}
}

// WithinFactorStellarAmounts returns whether two amounts are within a factor of
// `maxFactor` of each other.
// For example maxFactor="0.01" returns whether they are within 1% of each other.
// <- (abs((a - b) / a) < fac) || (abs((a - b) / b < fac)
func WithinFactorStellarAmounts(amount1, amount2, maxFactor string) (bool, error) {
	a, err := ParseStellarAmount(amount1)
	if err != nil {
		return false, err
	}
	b, err := ParseStellarAmount(amount2)
	if err != nil {
		return false, err
	}
	fac, err := ParseAmount(maxFactor)
	if err != nil {
		return false, fmt.Errorf("error parsing factor: %q %v", maxFactor, err)
	}
	if fac.Sign() < 0 {
		return false, fmt.Errorf("negative factor: %q", maxFactor)
	}
	if a == 0 && b == 0 {
		return true, nil
	}
	if a == 0 || b == 0 {
		return false, nil
	}
	// BigRat method signatures are bizarre. This does not do what it looks like.
	left := big.NewRat(a, StroopsPerLumen)
	left.Sub(left, big.NewRat(b, StroopsPerLumen))
	right := big.NewRat(1, 1)
	right.Set(left)
	left.Quo(left, big.NewRat(a, StroopsPerLumen))
	right.Quo(right, big.NewRat(b, StroopsPerLumen))
	left.Abs(left)
	right.Abs(right)
	return (left.Cmp(fac) < 1) || (right.Cmp(fac) < 1), nil
}

func parseExchangeRate(rate string) (*big.Rat, error) {
	rateRat, err := ParseAmount(rate)
	if err != nil {
		return nil, fmt.Errorf("error parsing exchange rate: %q", rate)
	}
	sign := rateRat.Sign()
	switch sign {
	case 1:
		return rateRat, nil
	case 0:
		return nil, errors.New("zero-value exchange rate")
	case -1:
		return nil, errors.New("negative exchange rate")
	default:
		return nil, fmt.Errorf("exchange rate of unknown sign (%v)", sign)
	}
}

// PathPaymentMaxValue returns 105% * amount.
func PathPaymentMaxValue(amount string) (string, error) {
	amtInt, err := stellaramount.ParseInt64(amount)
	if err != nil {
		return "", err
	}
	amtMax := (105 * amtInt) / 100

	return StringFromStellarAmount(amtMax), nil
}

// FeeString converts a horizon.Transaction.FeePaid int32 from
// stroops to a lumens string.
func FeeString(fee int32) string {
	n := big.NewRat(int64(fee), StroopsPerLumen)
	return n.FloatString(7)
}

// GetStellarExchangeRate takes two amounts, and returns the exchange rate of 1 source unit to destination units.
// This is useful for comparing two different assets on the Stellar network, say XLM and AnchorUSD.
func GetStellarExchangeRate(source, destination string) (string, error) {
	s, err := ParseStellarAmount(source)
	if err != nil {
		return "", fmt.Errorf("parsing source amount: %q", err)
	}
	if s == 0 {
		return "", fmt.Errorf("cannot have a source amount of 0")
	}

	d, err := ParseStellarAmount(destination)
	if err != nil {
		return "", fmt.Errorf("parsing destination amount: %q", err)
	}

	rate := big.NewRat(d, s)
	return rate.FloatString(7), nil
}
