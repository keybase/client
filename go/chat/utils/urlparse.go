package utils

import (
	"strings"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/mvdan/xurls"
	context "golang.org/x/net/context"
)

var urlRegex = xurls.Relaxed()

type ParsedURL struct {
	Text     string
	Position []int
}

func (p ParsedURL) Len() int {
	return p.Position[1] - p.Position[0]
}

func (p ParsedURL) FullURL() string {
	if strings.Contains(p.Text, "://") {
		return p.Text
	}
	return "https://" + p.Text
}

func ParseURLs(ctx context.Context, body string) (res []ParsedURL) {
	allIndexMatches := urlRegex.FindAllStringIndex(body, -1)
	for _, indexMatch := range allIndexMatches {
		hit := body[indexMatch[0]:indexMatch[1]]
		url := ParsedURL{
			Text:     hit,
			Position: indexMatch,
		}
		res = append(res, url)
	}
	return res
}

func DecorateWithURLs(ctx context.Context, body string) string {
	var added int
	parsed := ParseURLs(ctx, body)
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
