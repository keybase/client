package wallet

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/keybase/client/go/chat/utils"
)

var txPattern = regexp.MustCompile(
	// Start at the beginng of the line, space, or some hand picked artisanal characters
	`(?:^|[\s([{:;.,])` +
		// Have a + in front
		`(\+` +
		// Stellar decimal amount
		`(\d+\.?\d*|\d*\.?\d+)` +
		// Currency code
		`([A-Za-z]{2,6})` +
		// At sign and username, optional for direct messages
		// If not used, must be followed by a non-tx-character or end of string
		`(?:(?:@((?:[a-zA-Z0-9]+_?)+))|(?:[^A-Za-z@]|\z)))`,
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
	// A string that does not appear in the candidate regex so we don't get
	// false positives from concatenations.
	replaced := utils.ReplaceQuotedSubstrings(xs, false)

	allRawIndices := txPattern.FindAllStringSubmatchIndex(replaced, maxTxsPerMessage)
	matches := make([]ChatTxCandidate, 0, len(allRawIndices))
	for _, rawIndices := range allRawIndices {
		group := func(n int) (s string, startIndex, endIndex int) {
			startIndex, endIndex = rawIndices[2*n], rawIndices[2*n+1]
			if startIndex >= 0 {
				return xs[startIndex:endIndex], startIndex, endIndex
			}
			return "", startIndex, endIndex
		}
		_, plusStart, _ := group(1)
		amount, _, _ := group(2)
		if amount == "0" {
			continue
		}
		currencyCode, _, ccEnd := group(3)
		currencyCode = strings.ToUpper(currencyCode)
		username, _, usernameEndIndex := group(4)
		var atSign string
		endIndex := ccEnd
		if len(username) > 0 {
			atSign = "@"
			endIndex = usernameEndIndex
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
				Position:     []int{plusStart, endIndex},
			})
		}
	}
	return matches
}
