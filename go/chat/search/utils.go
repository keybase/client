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
		token = strings.ToLower(token)
		tokenSet.Add(token)
		stripped := stripExpr.Split(token, -1)
		for _, s := range stripped {
			tokenSet.Add(s)
			stemmed := porterstemmer.StemWithoutLowerCasing([]rune(s))
			tokenSet.Add(string(stemmed))
		}
	}
	strSlice := []string{}
	for _, el := range tokenSet.ToSlice() {
		str, ok := el.(string)
		if ok && str != "" {
			strSlice = append(strSlice, str)
		}
	}
	return strSlice
}

func tokensFromMsg(msg chat1.MessageUnboxed) []string {
	return tokenize(msg.SearchableText())
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

func searchMatches(msg chat1.MessageUnboxed, queryRe *regexp.Regexp) (validMatches []chat1.ChatSearchMatch) {
	msgText := msg.SearchableText()
	matches := queryRe.FindAllStringIndex(msgText, -1)
	for _, m := range matches {
		if len(m) != 2 {
			// sanity check but regex package should always return a two
			// element slice
			continue
		}
		startIndex := m[0]
		endIndex := m[1]
		if startIndex != endIndex {
			validMatches = append(validMatches, chat1.ChatSearchMatch{
				StartIndex: startIndex,
				EndIndex:   endIndex,
				Match:      msgText[startIndex:endIndex],
			})
		}
	}
	return validMatches
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

var fromRegex = regexp.MustCompile("^from:(@?[a-z0-9][a-z0-9_]+)")

func UpgradeRegexpArgFromQuery(arg chat1.SearchRegexpArg, username string) chat1.SearchRegexpArg {
	query := arg.Query
	// From
	if match := fromRegex.FindStringSubmatch(query); match != nil && len(match) == 2 {
		query = strings.TrimSpace(strings.Replace(query, match[0], "", 1))
		sentBy := strings.TrimSpace(strings.Replace(match[1], "@", "", -1))
		if sentBy == "me" {
			sentBy = username
		}
		arg.Opts.SentBy = sentBy
		if len(query) == 0 {
			query = "/.*/"
		}
	}
	// Regex
	if len(query) > 0 && query[0] == '/' && query[len(query)-1] == '/' {
		query = query[1 : len(query)-1]
		arg.IsRegex = true
	}
	arg.Query = query
	return arg
}
