package search

import (
	"regexp"
	"strings"
)

var tokenizeExpr = regexp.MustCompile("[\\s\\W]")

// getIndexTokens splits the content of the given message on whitespace and
// special characters returning a set of tokens normalized to lowercase.
func tokenize(msgText string) []string {
	if msgText == "" {
		return nil
	}
	tokens := tokenizeExpr.Split(msgText, -1)
	tokenMap := map[string]bool{}
	uniqueTokens := []string{}
	for _, token := range tokens {
		if token == "" {
			continue
		}
		token = strings.ToLower(token)
		if _, ok := tokenMap[token]; !ok {
			tokenMap[token] = true
			uniqueTokens = append(uniqueTokens, token)
		}
	}
	return uniqueTokens
}
