package stellar

import (
	"errors"
	"fmt"
	"math/big"
	"regexp"

	"github.com/keybase/client/go/protocol/stellar1"
	stellaramount "github.com/stellar/go/amount"
)

// ConvertXLMToOutside converts an amount of lumens into an amount of outside currency.
// The result is rounded to 7 digits past the decimal.
// The rounding is arbitrary but expected to be sufficient precision.
func ConvertXLMToOutside(XLMAmount string, rate stellar1.OutsideExchangeRate) (outsideAmount string, err error) {
	rateRat, err := parseExchangeRate(rate.Rate)
	if err != nil {
		return "", err
	}
	amountInt64, err := stellaramount.ParseInt64(XLMAmount)
	if err != nil {
		return "", fmt.Errorf("parsing amount to convert: %q", err)
	}
	acc := big.NewRat(amountInt64, stellaramount.One)
	acc.Mul(acc, rateRat)
	return acc.FloatString(7), nil
}

// ConvertOutsideToXLM converts an amount of outside currency into an amount of lumens.
// The result is rounded to 7 digits past the decimal (which is what XLM supports).
// The result returned can of a greater magnitude than XLM supports.
func ConvertOutsideToXLM(outsideAmount string, rate stellar1.OutsideExchangeRate) (XLMAmount string, err error) {
	rateRat, err := parseExchangeRate(rate.Rate)
	if err != nil {
		return "", err
	}
	acc, err := ParseDecimalStrict(outsideAmount)
	if err != nil {
		return "", fmt.Errorf("parsing amount to convert: %q", outsideAmount)
	}
	acc.Quo(acc, rateRat)
	return acc.FloatString(7), nil
}

// CompareAmounts compares amounts of stellar assets.
// Returns:
//
//   -1 if x <  y
//    0 if x == y
//   +1 if x >  y
//
func CompareAmounts(amount1, amount2 string) (int, error) {
	amountx, err := stellaramount.ParseInt64(amount1)
	if err != nil {
		return 0, err
	}
	amounty, err := stellaramount.ParseInt64(amount2)
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

func parseExchangeRate(rate string) (*big.Rat, error) {
	rateRat, err := ParseDecimalStrict(rate)
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

// Alow "-1", "1.", ".1", "1.1".
// But not "." or "".
var decimalStrictRE = regexp.MustCompile(`^-?((\d+\.?\d*)|(\d*\.?\d+))$`)

// parseDecimalStrict parses a decimal number into a big rational.
// Used instead of big.Rat.SetString because the latter accepts
// additional formats like "1/2" and "1e10".
func ParseDecimalStrict(s string) (*big.Rat, error) {
	if s == "" {
		return nil, fmt.Errorf("expected decimal number but found empty string")
	}
	if !decimalStrictRE.MatchString(s) {
		return nil, fmt.Errorf("expected decimal number: %s", s)
	}
	v, ok := new(big.Rat).SetString(s)
	if !ok {
		return nil, fmt.Errorf("expected decimal number: %s", s)
	}
	return v, nil
}
