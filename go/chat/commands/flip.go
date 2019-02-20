package commands

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Flip struct {
	*baseCommand
}

func NewFlip(g *globals.Context) *Flip {
	return &Flip{
		baseCommand: newBaseCommand(g, "flip", "", "Flip a cryptographic coin"),
	}
}

func (s *Flip) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Execute")()
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	return s.G().CoinFlipManager.StartFlip(ctx, uid, convID, tlfName, text)
}

func (s *Flip) Preview(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, text string) {
	defer s.Trace(ctx, func() error { return nil }, "Preview")()
	if !s.Match(ctx, text) {
		s.getChatUI().ChatCommandMarkdown(ctx, convID, "")
		return
	}
	cur := s.G().CoinFlipManager.DescribeFlipText(ctx, text)
	var usage string
	if s.G().GetAppType() == libkb.MobileAppType {
		usage = fmt.Sprintf(flipMobileUsage, cur, "```", "```", "```", "```")
	} else {
		usage = fmt.Sprintf(flipDesktopUsage, "```", "```", "```", "```", cur)
	}
	s.getChatUI().ChatCommandMarkdown(ctx, convID, usage)
}

const flipDesktopUsage = `Example commands: %s
/flip          coin flip
/flip 6        roll a 6-sided die (1..6)
/flip 10..20   pick a number 10 to 20 (inclusive)
/flip a,b,c,d  shuffle some options and pick where to eat or whom to wrestle
/flip cards    shuffle and deal a deck %s
And for a quick game of face-up poker: %s		/flip cards 5 @user1 @user2 @user3
		(shuffle a deck and deal 5 cards to 3 different people%s
The blog post announcing this feature and how it works:
https://keybase.io/coin-flipping

_Current Flip_: %s`

const flipMobileUsage = `_Current Flip_: %s
Example commands: %s
/flip          coin flip
/flip 6        roll a 6-sided die
/flip 10..20   pick a number 10 to 20 (inclusive)
/flip a,b,c,d  shuffle a,b,c,d
/flip cards    deal cards %s
And for a quick game of face-up poker: %s
/flip cards 5 @user1 @user2 @user3
(shuffle a deck and deal 5 cards to 3 different people%s
The blog post announcing this feature and how it works:
https://keybase.io/coin-flipping`
