package commands

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type baseCommand struct {
	globals.Contextified
	utils.DebugLabeler
	name        string
	aliases     []string
	usage       string
	description string
}

func newBaseCommand(g *globals.Context, name, usage, desc string, aliases ...string) *baseCommand {
	return &baseCommand{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), fmt.Sprintf("Commands.%s", name), false),
		name:         name,
		usage:        usage,
		aliases:      aliases,
		description:  desc,
	}
}

func (b *baseCommand) getRemoteConvByID(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) (res types.RemoteConversation, err error) {
	ib, err := b.G().InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll,
		&chat1.GetInboxQuery{
			ConvID: &convID,
		}, nil)
	if err != nil {
		return res, err
	}
	if len(ib.ConvsUnverified) == 0 {
		return res, errors.New("conv not found")
	}
	return ib.ConvsUnverified[0], nil
}

func (b *baseCommand) getConvByName(ctx context.Context, uid gregor1.UID, name string) (res chat1.ConversationLocal, err error) {
	find := func(mt chat1.ConversationMembersType, name string, topicName *string) (conv chat1.ConversationLocal, err error) {
		convs, err := b.G().ChatHelper.FindConversations(ctx, name, topicName,
			chat1.TopicType_CHAT, mt, keybase1.TLFVisibility_PRIVATE)
		if err != nil {
			return res, err
		}
		if len(convs) == 0 {
			return res, errors.New("conversation not found")
		}
		return convs[0], nil
	}
	if strings.Contains(name, "#") {
		toks := strings.Split(name, "#")
		return find(chat1.ConversationMembersType_TEAM, toks[0], &toks[1])
	}
	if res, err = find(chat1.ConversationMembersType_IMPTEAMNATIVE, name, nil); err != nil {
		return find(chat1.ConversationMembersType_TEAM, name, nil)
	}
	return res, nil
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

func (b *baseCommand) Preview(ctx context.Context, text string) error {
	return nil
}

func (b *baseCommand) Export() chat1.ConversationCommand {
	return chat1.ConversationCommand{
		Name:        b.Name(),
		Usage:       b.Usage(),
		Description: b.Description(),
	}
}
