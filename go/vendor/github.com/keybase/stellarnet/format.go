package stellarnet

import (
	"bytes"
	"fmt"
	"strings"
)

// FmtRoundingBehavior determines how the formatting functions handle excess precision,
// either rounding up/down, or truncating.
type FmtRoundingBehavior int

const (
	_ FmtRoundingBehavior = iota
	// Round the amount up or down.  1.234 => 1.23, 1.236 => 1.24
	Round
	// Truncate the amount.  1.234 => 1.23, 1.236 => 1.23
	Truncate
)

// FmtCurrencyWithCodeSuffix will return a fiat currency amount formatted with
// its currency code suffix at the end, like "$123.12 CLP"
func FmtCurrencyWithCodeSuffix(amount string, rounding FmtRoundingBehavior, code, symbol string, postfix bool) (string, error) {
	pre, err := FmtCurrency(amount, rounding, symbol, postfix)
	if err != nil {
		return "", err
	}

	// some currencies have the same symbol as code (CHF)
	if postfix && symbol == code {
		return pre, nil
	}

	return fmt.Sprintf("%s %s", pre, code), nil
}

// FmtCurrency returns amount formatted with the currency symbol.
func FmtCurrency(amount string, rounding FmtRoundingBehavior, symbol string, postfix bool) (string, error) {
	amountFmt, err := FmtAmount(amount, true, rounding)
	if err != nil {
		return "", err
	}

	if postfix {
		return fmt.Sprintf("%s %s", amountFmt, symbol), nil
	}

	return fmt.Sprintf("%s%s", symbol, amountFmt), nil
}

// FmtAmount formats amount in a clear, precise manner, minimizing the
// length of the output string when possible.
func FmtAmount(amount string, precisionTwo bool, rounding FmtRoundingBehavior) (string, error) {
	if amount == "" {
		return "", fmt.Errorf("empty amount")
	}
	x, err := ParseAmount(amount)
	if err != nil {
		return "", fmt.Errorf("unable to parse amount %s: %v", amount, err)
	}
	precision := 7
	if precisionTwo {
		precision = 2
	}
	var s string
	if rounding == Round {
		s = x.FloatString(precision)
	} else {
		s = x.FloatString(precision + 1)
		s = s[:len(s)-1]
	}
	parts := strings.Split(s, ".")
	if len(parts) != 2 {
		return "", fmt.Errorf("unable to parse amount %s", amount)
	}
	var hasComma bool
	head := parts[0]
	if len(head) > 0 {
		sinceComma := 0
		var b bytes.Buffer
		for i := len(head) - 1; i >= 0; i-- {
			if sinceComma == 3 && head[i] != '-' {
				b.WriteByte(',')
				sinceComma = 0
				hasComma = true
			}
			b.WriteByte(head[i])
			sinceComma++
		}
		parts[0] = reverse(b.String())
	}
	if parts[1] == "0000000" {
		// Remove decimal part if it's all zeroes in 7-digit precision.
		if hasComma {
			// With the exception of big numbers where we inserted
			// thousands separator - leave fractional part with two
			// digits so we can have decimal point, but not all the
			// distracting 7 zeroes.
			parts[1] = "00"
		} else {
			parts = parts[:1]
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
