package commands

import (
	"context"
	"fmt"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type nullChatUI struct {
	libkb.ChatUI
}

func (n nullChatUI) ChatCommandStatus(context.Context, chat1.ConversationID, string,
	chat1.UICommandStatusDisplayTyp, []chat1.UICommandStatusActionTyp) error {
	return nil
}

type baseCommand struct {
	globals.Contextified
	utils.DebugLabeler
	name        string
	aliases     []string
	usage       string
	description string
	hasHelpText bool
}

func newBaseCommand(g *globals.Context, name, usage, desc string, hasHelpText bool, aliases ...string) *baseCommand {
	return &baseCommand{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), fmt.Sprintf("Commands.%s", name), false),
		name:         name,
		usage:        usage,
		aliases:      aliases,
		description:  desc,
		hasHelpText:  hasHelpText,
	}
}

func (b *baseCommand) tokenize(text string, minArgs int) (toks []string, err error) {
	toks = strings.Split(strings.TrimRight(text, " "), " ")
	if len(toks) < minArgs {
		return toks, ErrInvalidArguments
	}
	return toks, nil
}

func (b *baseCommand) commandAndMessage(text string) (cmd string, msg string, err error) {
	toks, err := b.tokenize(text, 1)
	if err != nil {
		return "", "", err
	}
	if len(toks) == 1 {
		return toks[0], "", nil
	}
	return toks[0], strings.Join(toks[1:], " "), nil
}

func (b *baseCommand) getChatUI() libkb.ChatUI {
	ui, err := b.G().UIRouter.GetChatUI()
	if err != nil || ui == nil {
		b.Debug(context.Background(), "getChatUI: no chat UI found: err: %s", err)
		return nullChatUI{}
	}
	return ui
}

func (b *baseCommand) Match(ctx context.Context, text string) bool {
	if !strings.HasPrefix(text, "/") {
		return false
	}
	cands := append(b.aliases, b.name)
	for _, c := range cands {
		if strings.HasPrefix(text, fmt.Sprintf("/%s", c)) {
			return true
		}
	}
	return false
}

func (b *baseCommand) Name() string {
	return b.name
}

func (b *baseCommand) Usage() string {
	return b.usage
}

func (b *baseCommand) Description() string {
	return b.description
}

func (b *baseCommand) HasHelpText() bool {
	return b.hasHelpText
}

func (b *baseCommand) Preview(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) {
}

func (b *baseCommand) Export() chat1.ConversationCommand {
	return chat1.ConversationCommand{
		Name:        b.Name(),
		Usage:       b.Usage(),
		Description: b.Description(),
		HasHelpText: b.HasHelpText(),
	}
}
