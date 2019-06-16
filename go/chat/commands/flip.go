package commands

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Flip struct {
	*baseCommand
	sync.Mutex
	displayed bool
}

func NewFlip(g *globals.Context) *Flip {
	return &Flip{
		baseCommand: newBaseCommand(g, "flip", "", "Flip a cryptographic coin", true),
	}
}

func (s *Flip) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Execute")()
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	return s.G().CoinFlipManager.StartFlip(ctx, uid, convID, tlfName, text, nil)
}

func (s *Flip) Preview(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) {
	s.Lock()
	defer s.Unlock()
	defer s.Trace(ctx, func() error { return nil }, "Preview")()
	if !s.Match(ctx, text) {
		if s.displayed {
			s.getChatUI().ChatCommandMarkdown(ctx, convID, nil)
			s.displayed = false
		}
		return
	}
	cur := s.G().CoinFlipManager.DescribeFlipText(ctx, text)
	var usage string
	if s.G().GetAppType() == libkb.MobileAppType {
		usage = fmt.Sprintf(flipMobileUsage, "```", "```", cur)
	} else {
		usage = fmt.Sprintf(flipDesktopUsage, "```", "```", cur)
	}
	s.getChatUI().ChatCommandMarkdown(ctx, convID, &chat1.UICommandMarkdown{
		Body:  utils.DecorateWithLinks(ctx, utils.EscapeForDecorate(ctx, usage)),
		Title: &flipTitle,
	})
	s.displayed = true
}

var flipTitle = `*/flip* [options]
Flip a cryptographic coin`

const flipDesktopUsage = `Variations: %s
/flip 6                      # roll a die [1...6]
/flip 10..20                 # pick a number [10...20]
/flip vegan, keto, soylent   # shuffle some options
/flip cards                  # deal 52 cards
/flip cards 5 Ana, Sam, Kat  # deal 5 cards to 3 friends%s
How it all works: https://keybase.io/coin-flip
Current flip: %s`

const flipMobileUsage = `Variations: %s
/flip 6
/flip 10..20
/flip coffee, drinks, dinner
/flip cards
/flip cards 5 Ana, Sam, Kat%s
_Current flip_: %s`
