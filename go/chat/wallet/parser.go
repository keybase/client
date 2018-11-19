package wallet

import (
	"regexp"
	"strings"

	chat1 "github.com/keybase/client/go/protocol/chat1"
)

var txPattern = regexp.MustCompile(
	// Prevent two txs directly next to each other
	`\B` +
		// Must explicitly have a + in front
		`\+` +
		// Stellar decimal amount
		`(\d+\.?\d*|\d*\.?\d+)` +
		// Currency code
		`([A-Za-z]{2,6})` +
		// At sign
		`@` +
		// Username (optional in direct messages)
		`([a-zA-Z0-9]+_?)+`,
)

var maxAmountLength = 100
var maxUsernameLength = 16
var maxTxsPerMessage = -1

func findChatTxCandidates(xs string) []chat1.ChatTxCandidate {
	// A string that does not appear in the candidate regex so we don't get false positives from concatenations.
	replacer := "$"
	replaced := replaceQuotedSubstrings(xs, replacer)

	rawMatches := txPattern.FindAllStringSubmatch(replaced, maxTxsPerMessage)
	matches := make([]chat1.ChatTxCandidate, 0, len(rawMatches))
	for _, rawMatch := range rawMatches {
		amount := rawMatch[1]
		currencyCode := rawMatch[2]
		username := rawMatch[3]
		if len(amount) <= maxAmountLength && len(username) <= maxUsernameLength {
			matches = append(matches, chat1.ChatTxCandidate{Amount: amount, CurrencyCode: currencyCode, Username: &username})
		}
	}
	return matches
}

var startQuote = ">"
var startCodeLine = []rune("`")
var startCodeBlock = []rune("```")
var endCodeLine = []rune("`")
var endCodeBlock = []rune("```")
var newline = []rune("\n")

type newlineBehavior = int

const (
	sameLine newlineBehavior = iota
	multiLine
)

func replaceQuotedSubstrings(xs string, replacer string) string {
	t := []rune(nil)
	runes := []rune(xs)
	replacerRunes := []rune(replacer)

	// First, split the string up into runes and remove all codelines and codeblocks.
	i := 0
	for i < len(runes) {
		foundEndCodeblock := false
		// Loop while the string starts with `, to handle adjacent codelines
		for startsWithAt(runes, i, startCodeLine) {
			// If it starts with ```, try to find the close block across newlines.
			// If it exists, skip to it, otherwise fallback to codeline handling.
			if startsWithAt(runes, i, startCodeBlock) {
				if ret := findNextAt(runes, i+len(startCodeBlock), endCodeBlock, multiLine); ret != -1 {
					i = ret + len(endCodeBlock)
					t = append(t, replacerRunes...)
					foundEndCodeblock = true
				}
			}
			// If we're starting with a ` or a ``` that isn't closed, treat the first ` as the start of a
			// codeline and try to find the close ` in the same line. If found, skip to it, otherwise
			// break out of the loop and add the unmatched ` to the returned string.
			if !foundEndCodeblock {
				if ret := findNextAt(runes, i+len(startCodeLine), endCodeLine, sameLine); ret != -1 {
					i = ret + len(endCodeLine)
					t = append(t, replacerRunes...)
				} else {
					break
				}
			}
		}
		// If the first letter is a regular letter or an unmatched `, add it to the returned string
		if i < len(runes) {
			t = append(t, runes[i])
			i++
		}
	}

	// Finally, remove all quoted lines. Because we removed all codeblocks
	// before, we only need to consider single lines.
	var r []string
	for _, line := range strings.Split(string(t), string(newline)) {
		if !strings.HasPrefix(strings.TrimLeft(line, " "), startQuote) {
			r = append(r, line)
		}
	}
	return strings.Join(r, string(newline))
}
