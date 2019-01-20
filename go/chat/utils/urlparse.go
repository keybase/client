package utils

import (
	"regexp"
	"strings"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/mvdan/xurls"
	context "golang.org/x/net/context"
)

var urlRegex = xurls.Relaxed()
var emailRegex = regexp.MustCompile(`(([\w-_.]*)@([\w-]+(\.[\w-]+)+))\b`)

type ParsedURL struct {
	Text     string
	Position []int
	Schemes  []string
}

func (p ParsedURL) Len() int {
	return p.Position[1] - p.Position[0]
}

func (p ParsedURL) FullURL() string {
	for _, s := range p.Schemes {
		if strings.Contains(p.Text, s) {
			return p.Text
		}
	}
	return p.Schemes[0] + p.Text
}

func parseURLs(ctx context.Context, body string, schemes []string, r *regexp.Regexp) (res []ParsedURL) {
	allIndexMatches := r.FindAllStringIndex(body, -1)
	for _, indexMatch := range allIndexMatches {
		hit := body[indexMatch[0]:indexMatch[1]]
		url := ParsedURL{
			Text:     hit,
			Position: indexMatch,
			Schemes:  schemes,
		}
		res = append(res, url)
	}
	return res
}

func ParseEmails(ctx context.Context, body string) (res []ParsedURL) {
	return parseURLs(ctx, body, []string{"mailto:"}, emailRegex)
}

func ParseURLs(ctx context.Context, body string) (res []ParsedURL) {
	return parseURLs(ctx, body, []string{"https://", "http://"}, urlRegex)
}

func decorateWithURLs(ctx context.Context, body string, parseFn func(context.Context, string) []ParsedURL) string {
	var added int
	inputBody := ReplaceQuotedSubstrings(body, false)
	parsed := parseFn(ctx, inputBody)
	offset := 0
	for _, p := range parsed {
		body, added = DecorateBody(ctx, body, p.Position[0]+offset, p.Len(),
			chat1.NewUITextDecorationWithUrl(chat1.UITextDecorationUrl{
				Text: p.Text,
				Url:  p.FullURL(),
			}))
		offset += added
	}
	return body
}

func DecorateWithURLs(ctx context.Context, body string) string {
	return decorateWithURLs(ctx, body, ParseURLs)
}

func DecorateWithEmails(ctx context.Context, body string) string {
	return decorateWithURLs(ctx, body, ParseEmails)
}
