package search

import (
	"regexp"
	"strings"

	mapset "github.com/deckarep/golang-set"
	"github.com/keybase/client/go/protocol/chat1"
)

// Split on whitespace, punctuation, code and quote markdown separators
var tokenizeExpr = regexp.MustCompile("[\\s\\.,\\?!`>]")

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

func tokensFromMsg(msg chat1.MessageUnboxed) []string {
	return tokenize(msg.SearchableText())
}

// getQueryRe returns a regex to match the query string on message text. This
// is used for result highlighting.
func getQueryRe(query string) (*regexp.Regexp, error) {
	return regexp.Compile("(?i)" + regexp.QuoteMeta(query))
}

func msgIDsFromSet(set mapset.Set) []chat1.MessageID {
	if set == nil {
		return nil
	}
	msgIDSlice := []chat1.MessageID{}
	for _, el := range set.ToSlice() {
		msgID, ok := el.(chat1.MessageID)
		if ok {
			msgIDSlice = append(msgIDSlice, msgID)
		}
	}
	return msgIDSlice
}
