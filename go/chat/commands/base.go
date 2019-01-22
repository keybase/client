package commands

import (
	"context"
	"fmt"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type baseCommand struct {
	globals.Contextified
	utils.DebugLabeler
	name    string
	aliases []string
	usage   string
}

func newBaseCommand(g *globals.Context, name, usage string, aliases ...string) *baseCommand {
	return &baseCommand{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), fmt.Sprintf("Commands.%s", name), false),
		name:         name,
		usage:        usage,
		aliases:      aliases,
	}
}

func (b *baseCommand) getConvByName(ctx context.Context, uid gregor1.UID, name string) (res chat1.ConversationLocal, err error) {
	convs, err := b.G().ChatHelper.FindConversations(ctx, true, name, nil, chat1.TopicType_CHAT,
		chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFVisibility_PRIVATE)
	if err != nil {
		return res, err
	}
	return convs[0], nil
}

func (b *baseCommand) Match(ctx context.Context, text string) bool {
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

func (b *baseCommand) Preview(ctx context.Context, text string) error {
	return nil
}
