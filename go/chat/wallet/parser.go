package wallet

import (
	"fmt"
	"regexp"
	"strings"
)

var txPattern = regexp.MustCompile(
	// Must explicitly have a + in front
	`\+` +
		// Stellar decimal amount
		`(\d+\.?\d*|\d*\.?\d+)` +
		// Currency code
		`([A-Za-z]{2,6})` +
		// At sign and username, optional for direct messages
		// If not used, must be followed by a non-tx-character or end of string
		`(?:(?:@((?:[a-zA-Z0-9]+_?)+))|(?:[^A-Za-z@]|\z))`,
)

var maxAmountLength = 100
var maxUsernameLength = 16
var maxTxsPerMessage = -1

type ChatTxCandidate struct {
	Amount       string
	CurrencyCode string
	Username     *string
	Full         string
	Position     []int
}

func FindChatTxCandidates(xs string) []ChatTxCandidate {
	// A string that does not appear in the candidate regex so we don't get false positives from concatenations.
	replaced := replaceQuotedSubstrings(xs)

	allRawIndices := txPattern.FindAllStringSubmatchIndex(replaced, maxTxsPerMessage)
	matches := make([]ChatTxCandidate, 0, len(allRawIndices))
	for _, rawIndices := range allRawIndices {
		amount := xs[rawIndices[2]:rawIndices[3]]
		currencyCode := strings.ToUpper(xs[rawIndices[4]:rawIndices[5]])
		var username, atSign string
		endIndex := rawIndices[5]
		if rawIndices[6] >= 0 {
			username = xs[rawIndices[6]:rawIndices[7]]
			atSign = "@"
			endIndex = rawIndices[7]
		}
		full := fmt.Sprintf("+%s%s%s%s", amount, currencyCode, atSign, username)
		if len(amount) <= maxAmountLength && len(username) <= maxUsernameLength {
			var txUsername *string
			if username == "" {
				txUsername = nil
			} else {
				txUsername = &username
			}
			matches = append(matches, ChatTxCandidate{
				Full:         full,
				Amount:       amount,
				CurrencyCode: currencyCode,
				Username:     txUsername,
				Position:     []int{rawIndices[0], endIndex},
			})
		}
	}
	return matches
}

var startQuote = ">"
var newline = []rune("\n")

func replaceQuotedSubstrings(xs string) string {
	replacer := func(s string) string {
		return strings.Repeat("$", len(s))
	}
	xs = regexp.MustCompile("((?s)```.*?```)").ReplaceAllStringFunc(xs, replacer)
	xs = regexp.MustCompile("((?s)`.*?`)").ReplaceAllStringFunc(xs, replacer)

	// Remove all quoted lines. Because we removed all codeblocks
	// before, we only need to consider single lines.
	var ret []string
	for _, line := range strings.Split(xs, string(newline)) {
		if !strings.HasPrefix(strings.TrimLeft(line, " "), startQuote) {
			ret = append(ret, line)
		} else {
			ret = append(ret, replacer(line))
		}
	}
	return strings.Join(ret, string(newline))
}
