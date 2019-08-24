package commands

import (
	"context"
	"errors"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func getConvByID(ctx context.Context, g *globals.Context, uid gregor1.UID, convID chat1.ConversationID) (res types.RemoteConversation, err error) {
	ib, err := g.InboxSource.ReadUnverified(ctx, uid, types.InboxSourceDataSourceAll,
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

func getConvByName(ctx context.Context, g *globals.Context, uid gregor1.UID, name string) (res chat1.ConversationLocal, err error) {
	find := func(mt chat1.ConversationMembersType, name string, topicName *string) (conv chat1.ConversationLocal, err error) {
		convs, err := g.ChatHelper.FindConversations(ctx, name, topicName,
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
