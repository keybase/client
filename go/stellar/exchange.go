package stellar

import (
	"errors"
	"fmt"
	"math/big"
	"regexp"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/amount"
)

// ConvertXLMToOutside converts an amount of lumens into an amount of outside currency.
// The result is rounded to 7 digits past the decimal.
// The rounding is arbitrary but expected to be sufficient precision.
func ConvertXLMToOutside(XLMAmount string, rate stellar1.OutsideExchangeRate) (outsideAmount string, err error) {
	rateRat, err := parseExchangeRate(rate.Rate)
	if err != nil {
		return "", err
	}
	amountInt64, err := amount.ParseInt64(XLMAmount)
	if err != nil {
		return "", fmt.Errorf("parsing amount to convert: %q", err)
	}
	acc := big.NewRat(amountInt64, amount.One)
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
	acc, err := parseDecimalStrict(outsideAmount)
	if err != nil {
		return "", fmt.Errorf("parsing amount to convert: %q", outsideAmount)
	}
	acc.Quo(acc, rateRat)
	return acc.FloatString(7), nil
}

func parseExchangeRate(rate string) (*big.Rat, error) {
	rateRat, err := parseDecimalStrict(rate)
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
func parseDecimalStrict(s string) (*big.Rat, error) {
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
