// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package stellar

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
)

func FormatCurrency(ctx context.Context, g *libkb.GlobalContext, amount string, code stellar1.OutsideCurrencyCode) (string, error) {
	conf, err := g.GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return "", err
	}
	currency, ok := conf.Currencies[code]
	if !ok {
		return "", fmt.Errorf("FormatCurrency error: cannot find curency code %q", code)
	}

	amountFmt, err := FormatAmount(amount, true)
	if err != nil {
		return "", err
	}

	if currency.Symbol.Postfix {
		return fmt.Sprintf("%s %s", amountFmt, currency.Symbol.Symbol), nil
	}

	return fmt.Sprintf("%s%s", currency.Symbol.Symbol, amountFmt), nil
}

func FormatCurrencyLabel(ctx context.Context, g *libkb.GlobalContext, code stellar1.OutsideCurrencyCode) (string, error) {
	conf, err := g.GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return "", err
	}
	currency, ok := conf.Currencies[code]
	if !ok {
		return "", fmt.Errorf("FormatCurrencyLabel error: cannot find curency code %q", code)
	}
	return fmt.Sprintf("%s (%s)", code, currency.Symbol.Symbol), nil
}

func FormatPaymentAmountXLM(amount string, delta stellar1.BalanceDelta) (string, error) {
	desc, err := FormatAmountXLM(amount)
	if err != nil {
		return "", err
	}

	switch delta {
	case stellar1.BalanceDelta_DECREASE:
		desc = "- " + desc
	case stellar1.BalanceDelta_INCREASE:
		desc = "+ " + desc
	}

	return desc, nil
}

// Example: "157.5000000 XLM"
func FormatAmountXLM(amount string) (string, error) {
	return FormatAmountWithSuffix(amount, false, "XLM")
}

func FormatAmountWithSuffix(amount string, precisionTwo bool, suffix string) (string, error) {
	formatted, err := FormatAmount(amount, precisionTwo)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s %s", formatted, suffix), nil
}

func FormatAmount(amount string, precisionTwo bool) (string, error) {
	if amount == "" {
		return "", errors.New("empty amount")
	}
	x, err := stellarnet.ParseDecimalStrict(amount)
	if err != nil {
		return "", fmt.Errorf("unable to parse amount %s: %v", amount, err)
	}
	precision := 7
	if precisionTwo {
		precision = 2
	}
	s := x.FloatString(precision)
	parts := strings.Split(s, ".")
	if len(parts) != 2 {
		return "", fmt.Errorf("unable to parse amount %s", amount)
	}
	var hasComma bool
	head := parts[0]
	if len(head) > 3 {
		sinceComma := 0
		var b bytes.Buffer
		for i := len(head) - 1; i >= 0; i-- {
			if sinceComma == 3 && head[i] != '-' {
				hasComma = true
				b.WriteByte(',')
				sinceComma = 0
			}
			b.WriteByte(head[i])
			sinceComma++
		}
		parts[0] = reverse(b.String())
	}
	if parts[1] == "0000000" {
		if !hasComma {
			// get rid of all zeros after point if default precision, but only
			// for small numbers, so we don't get results with thousand separators
			// but without decimal points.
			parts = parts[:1]
		} else {
			parts[1] = "00"
		}
	}
	return strings.Join(parts, "."), nil
}

func reverse(s string) string {
	r := []rune(s)
	for i, j := 0, len(r)-1; i < len(r)/2; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}

// SimplifyAmount
// Amount must be a decimal amount like "1.0" or "50"
// Strip trailing zeros after a "."
// Example: "1.0010000" -> "1.001"
// Example: "1.0000000" -> "1"
func SimplifyAmount(amount string) string {
	sides := strings.Split(amount, ".")
	if len(sides) != 2 {
		return amount
	}
	simpleRight := strings.TrimRight(sides[1], "0")
	if strings.Contains(sides[0], ",") {
		// If integer part has the thousands separator (comma), always
		// print the fractional part with at least two digits - this
		// is to ensure that thousands separator is not confused with
		// decimal point.
		for len(simpleRight) < 2 {
			simpleRight = simpleRight + "0"
		}
	} else if len(simpleRight) == 0 {
		return sides[0]
	}
	return sides[0] + "." + simpleRight
}
