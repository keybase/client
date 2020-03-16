package emoji

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type DevConvEmojiSource struct {
	globals.Contextified
	utils.DebugLabeler
}

var _ types.EmojiSource = (*DevConvEmojiSource)(nil)

func NewEmojiSource(g *globals.Context) *DevConvEmojiSource {
	return &DevConvEmojiSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "DevConvEmojiSource", false),
	}
}

func (s *DevConvEmojiSource) Add(ctx context.Context, alias, filename string) error {

}

func (s *DevConvEmojiSource) Get(ctx context.Context, uid gregor1.UID) (res chat1.UserEmojis, err error) {
	// TODO
	return res, nil
}

func (s *DevConvEmojiSource) Decorate(ctx context.Context, body string) string {
	// TODO
	return body
}
