package search

import (
	"regexp"
	"strings"

	mapset "github.com/deckarep/golang-set"
)

// Split on whitespice but not unicode letters
var tokenizeExpr = regexp.MustCompile("[\\s\\P{L}]")

// getIndexTokens splits the content of the given message on whitespace and
// special characters returning a set of tokens normalized to lowercase.
func tokenize(msgText string) []string {
	if msgText == "" {
		return nil
	}
	tokens := tokenizeExpr.Split(msgText, -1)
	tokenSet := mapset.NewThreadUnsafeSet()
	for _, token := range tokens {
		if token == "" {
			continue
		}
		token = strings.ToLower(token)
		tokenSet.Add(token)
	}
	strSlice := []string{}
	for _, el := range tokenSet.ToSlice() {
		str, ok := el.(string)
		if ok {
			strSlice = append(strSlice, str)
		}
	}
	return strSlice
}
