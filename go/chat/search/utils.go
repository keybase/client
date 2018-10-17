package search

import (
	"context"
	"regexp"
	"strings"

	mapset "github.com/deckarep/golang-set"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	porterstemmer "github.com/keybase/go-porterstemmer"
)

// Split on whitespace, punctuation, code and quote markdown separators
var splitExpr = regexp.MustCompile("[\\s\\.,\\?!]")

// Strip the following separators to create tokens
var stripSeps = []string{
	// groupings
	"<", ">",
	"\\(", "\\)",
	"\\[", "\\]",
	"\\{", "\\}",
	"\"",
	"'",
	// mentions
	"@",
	"#",
	// markdown
	"\\*",
	"_",
	"~",
	"`",
}
var stripExpr = regexp.MustCompile(strings.Join(stripSeps, "|"))

// getIndexTokens splits the content of the given message on whitespace and
// special characters returning a set of tokens normalized to lowercase.
func tokenize(msgText string) []string {
	if msgText == "" {
		return nil
	}
	tokens := splitExpr.Split(msgText, -1)
	tokenSet := mapset.NewThreadUnsafeSet()
	for _, token := range tokens {
		if token == "" {
			continue
		}
		token = strings.ToLower(token)
		tokenSet.Add(token)
		stripped := stripExpr.ReplaceAllString(token, "")
		tokenSet.Add(stripped)
		stemmed := porterstemmer.StemWithoutLowerCasing([]rune(stripped))
		tokenSet.Add(string(stemmed))
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

// Order messages ascending by ID for presentation
func getUIMsgs(ctx context.Context, g *globals.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) (uiMsgs []chat1.UIMessage) {
	for i := len(msgs) - 1; i >= 0; i-- {
		msg := msgs[i]
		uiMsg := utils.PresentMessageUnboxed(ctx, g, msg, uid, convID)
		uiMsgs = append(uiMsgs, uiMsg)
	}
	return uiMsgs
}
