package wallet

import (
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
}

func FindChatTxCandidates(xs string) []ChatTxCandidate {
	// A string that does not appear in the candidate regex so we don't get false positives from concatenations.
	replacer := "$"
	replaced := replaceQuotedSubstrings(xs, replacer)

	rawMatches := txPattern.FindAllStringSubmatch(replaced, maxTxsPerMessage)
	matches := make([]ChatTxCandidate, 0, len(rawMatches))
	for _, rawMatch := range rawMatches {
		amount := rawMatch[1]
		currencyCode := rawMatch[2]
		username := rawMatch[3]
		if len(amount) <= maxAmountLength && len(username) <= maxUsernameLength {
			var txUsername *string
			if username == "" {
				txUsername = nil
			} else {
				txUsername = &username
			}
			matches = append(matches, ChatTxCandidate{Amount: amount, CurrencyCode: currencyCode, Username: txUsername})
		}
	}
	return matches
}

var startQuote = ">"
var newline = []rune("\n")

func replaceQuotedSubstrings(xs string, replacer string) string {
	xs = regexp.MustCompile("(?s)```.*?```").ReplaceAllString(xs, replacer)
	xs = regexp.MustCompile("(?s)`.*?`").ReplaceAllString(xs, replacer)

	// Remove all quoted lines. Because we removed all codeblocks
	// before, we only need to consider single lines.
	var ret []string
	for _, line := range strings.Split(xs, string(newline)) {
		if !strings.HasPrefix(strings.TrimLeft(line, " "), startQuote) {
			ret = append(ret, line)
		}
	}
	return strings.Join(ret, string(newline))
}
