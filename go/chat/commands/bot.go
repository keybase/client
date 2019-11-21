package commands

import (
	"context"
	"errors"
	"strings"
	"sync"

	"github.com/keybase/client/go/chat/bots"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Bot struct {
	*baseCommand
	sync.Mutex
	extendedDisplay bool
}

func NewBot(g *globals.Context) *Bot {
	return &Bot{
		baseCommand: newBaseCommand(g, "bot", "", "Bot commands", true),
	}
}

func (b *Bot) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	return errors.New("bot command cannot be executed")
}

func (b *Bot) clearExtendedDisplayLocked(ctx context.Context, convID chat1.ConversationID) {
	if b.extendedDisplay {
		err := b.getChatUI().ChatCommandMarkdown(ctx, convID, nil)
		if err != nil {
			b.Debug(ctx, "clearExtendedDisplayLocked: error on markdown: %+v", err)
		}
		b.extendedDisplay = false
	}
}

func (b *Bot) Preview(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) {
	defer b.Trace(ctx, func() error { return nil }, "Preview")()
	b.Lock()
	defer b.Unlock()
	if !strings.HasPrefix(text, "!") {
		b.clearExtendedDisplayLocked(ctx, convID)
		return
	}
	if text == "!" {
		// spawn an update if the user is attempting to see bot commands
		go func(ctx context.Context) {
			errCh, err := b.G().BotCommandManager.UpdateCommands(ctx, convID, nil)
			if err != nil {
				b.Debug(ctx, "Preview: failed to attempt to update bot commands: %s", err)
				return
			}
			if err := <-errCh; err != nil {
				b.Debug(ctx, "Preview: failed to update bot commands: %s", err)
			}
		}(globals.BackgroundChatCtx(ctx, b.G()))
	}

	cmds, _, err := b.G().BotCommandManager.ListCommands(ctx, convID)
	if err != nil {
		b.Debug(ctx, "Preview: failed to list commands: %s", err)
		return
	}

	bots.SortCommandsForMatching(cmds)

	// Since we have a list of all valid commands for this conversation, don't do any tokenizing
	// Instead, just check if any valid bot command (followed by a space) is a prefix of this message
	for _, cmd := range cmds {
		// If we decide to support the !<command>@<username> syntax, we can just add another check here
		if cmd.Matches(text) && cmd.ExtendedDescription != nil {
			var body string
			if b.G().IsMobileAppType() {
				body = cmd.ExtendedDescription.MobileBody
			} else {
				body = cmd.ExtendedDescription.DesktopBody
			}
			var title *string
			if cmd.ExtendedDescription.Title != "" {
				title = new(string)
				*title = cmd.ExtendedDescription.Title
			}
			err := b.getChatUI().ChatCommandMarkdown(ctx, convID, &chat1.UICommandMarkdown{
				Body:  body,
				Title: title,
			})
			if err != nil {
				b.Debug(ctx, "Preview: markdown error: %+v", err)
			}
			b.extendedDisplay = true
			return
		}
	}
	b.clearExtendedDisplayLocked(ctx, convID)
}
