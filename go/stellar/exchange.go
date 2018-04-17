package stellar

import (
	"fmt"
	"math/big"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/amount"
)

func ConvertXLMToOutside(XLMAmount string, rate stellar1.OutsideExchangeRate) (localAmount string, err error) {
	var zero big.Rat
	rateRat := new(big.Rat)
	_, ok := rateRat.SetString(rate.Rate)
	if !ok {
		return "", fmt.Errorf("error parsing exchange rate: %v", rate.Rate)
	}
	if rateRat.Cmp(&zero) == 0 {
		return "", fmt.Errorf("zero-value exchange rate")
	}
	amountInt64, err := amount.ParseInt64(XLMAmount)
	if err != nil {
		return "", fmt.Errorf("parsing amount to convert: %v", err)
	}
	acc := big.NewRat(amountInt64, amount.One)
	acc.Mul(acc, rateRat)
	return acc.FloatString(7), nil
}

func ConvertLocalToXLM(localAmount string, rate stellar1.OutsideExchangeRate) (XLMAmount string, err error) {
	var zero big.Rat
	rateRat := new(big.Rat)
	_, ok := rateRat.SetString(rate.Rate)
	if !ok {
		return "", fmt.Errorf("error parsing exchange rate: %v", rate.Rate)
	}
	if rateRat.Cmp(&zero) == 0 {
		return "", fmt.Errorf("zero-value exchange rate")
	}
	amountInt64, err := amount.ParseInt64(localAmount)
	if err != nil {
		return "", fmt.Errorf("parsing amount to convert: %v", err)
	}
	acc := big.NewRat(amountInt64, amount.One)
	acc.Quo(acc, rateRat)
	return acc.FloatString(7), nil
}
