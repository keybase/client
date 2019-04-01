package wallet

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/keybase/client/go/chat/utils"
)

var txPattern = regexp.MustCompile(
	utils.ServiceDecorationPrefix +
		// Have a + in front
		`\+` +
		// Stellar decimal amount
		`(\d+\.?\d*|\d*\.?\d+)` +
		// Currency code
		`([A-Za-z]{2,6})` +
		// At sign and username, optional for direct messages
		`(?:@((?:[a-zA-Z0-9]+_?)+))?` +
		// Sentinel group for advancing the scan
		`()` +
		// Must be followed by a nice character or the end of the string.
		`(?:[\s)\]}:;.,!?"']|\z)`,
)

var maxAmountLength = 100
var maxUsernameLength = 16
var maxTxsPerMessage = 3000

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

	buf := replaced // buf is a suffix of replaced
	bufOffset := 0  // buf[0] is replaced[bufOffset]

	// Munch matches off the front of buf.
	// Can't use FindAllStringSubmatchIndex (emphasis on All) because
	// adjacent matches of txPattern can overlap.
	// For example: "+1xlm +2xlm" -> "+1xlm ", " +2xlm"
	var matches []ChatTxCandidate
	for i := 0; i < maxTxsPerMessage; i++ {
		rawIndices := txPattern.FindStringSubmatchIndex(buf)
		if rawIndices == nil {
			break
		}
		group := func(n int) (s string, startIndex, endIndex int) {
			startIndex, endIndex = rawIndices[2*n], rawIndices[2*n+1]
			if startIndex >= 0 {
				return buf[startIndex:endIndex], startIndex, endIndex
			}
			return "", startIndex, endIndex
		}
		amount, amountStart, _ := group(1)
		_, _, nextIndex := group(4)
		if amount != "0" {
			currencyCode, _, ccEnd := group(2)
			currencyCode = strings.ToUpper(currencyCode)
			var atSign string
			endIndex := ccEnd
			username, _, usernameEndIndex := group(3)
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
					Position:     []int{amountStart - 1 + bufOffset, endIndex + bufOffset},
				})
			}
		}
		if nextIndex == -1 || nextIndex > len(buf) {
			// should never happen
			return nil
		}
		buf = buf[nextIndex:]
		bufOffset += nextIndex
	}
	return matches
}
