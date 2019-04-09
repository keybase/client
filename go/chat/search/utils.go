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

func prefixes(token string) (res []string) {
	if len(token) <= 2 {
		return nil
	}
	for i := range token {
		if i <= 2 {
			continue
		}
		// Skip any prefixes longer than 20 to limit the index size.
		if i >= 20 {
			break
		}
		res = append(res, token[:i])
	}
	return res
}

type tokenMap map[string]map[string]chat1.EmptyStruct

// getIndexTokens splits the content of the given message on whitespace and
// special characters returning a map of tokens to aliases  normalized to lowercase.
func tokenize(msgText string) tokenMap {
	if msgText == "" {
		return nil
	}

	// split the message text up on basic punctuation/spaces
	tokens := splitExpr.Split(msgText, -1)
	tokenMap := tokenMap{}
	for _, token := range tokens {
		if token == "" {
			continue
		}

		token = strings.ToLower(token)
		if _, ok := tokenMap[token]; !ok {
			tokenMap[token] = map[string]chat1.EmptyStruct{}
		}

		// strip separators to raw tokens which we count as an alias to the
		// original token
		stripped := stripExpr.Split(token, -1)
		for _, s := range stripped {
			if s == "" {
				continue
			}
			tokenMap[token][s] = chat1.EmptyStruct{}

			// add the stem as an alias
			stemmed := porterstemmer.StemWithoutLowerCasing([]rune(s))
			tokenMap[token][string(stemmed)] = chat1.EmptyStruct{}

			// calculate prefixes to alias to the token
			for _, prefix := range prefixes(s) {
				tokenMap[token][prefix] = chat1.EmptyStruct{}
			}
		}
		// drop the original token from the set of aliases
		delete(tokenMap[token], token)
	}
	return tokenMap
}

func tokensFromMsg(msg chat1.MessageUnboxed) tokenMap {
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
