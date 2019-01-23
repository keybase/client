package commands

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type Join struct {
	*baseCommand
}

func NewJoin(g *globals.Context) *Join {
	return &Join{
		baseCommand: newBaseCommand(g, "join", "<conversation|channel in current team>",
			"Join a channel either by the channel name of the current team, or the conversation name"),
	}
}

func (h *Join) findAsChannelName(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	name string) (res chat1.ConversationLocal, err error) {
	convs, err := h.G().ChatHelper.FindConversationsByID(ctx, []chat1.ConversationID{convID})
	if err != nil {
		return res, err
	}
	if len(convs) == 0 {
		return res, errors.New("no conversation found")
	}
	conv := convs[0]
	if conv.GetMembersType() != chat1.ConversationMembersType_TEAM {
		return res, errors.New("not a team conversation")
	}
	teamName := conv.Info.TlfName
	if convs, err = h.G().ChatHelper.FindConversations(ctx, true, teamName, &name, chat1.TopicType_CHAT,
		chat1.ConversationMembersType_TEAM, keybase1.TLFVisibility_PRIVATE); err != nil {
		return res, err
	}
	if len(convs) == 0 {
		return res, errors.New("no conversation found")
	}
	return convs[0], nil
}

func (h *Join) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	defer h.Trace(ctx, func() error { return err }, "Join")()
	if !h.Match(ctx, text) {
		return ErrInvalidCommand
	}
	toks := h.tokenize(text)
	if len(toks) < 2 {
		return ErrInvalidArguments
	}
	conv, err := h.findAsChannelName(ctx, uid, convID, toks[1])
	if err != nil {
		h.Debug(ctx, "failed to find conversation as a channel: %s", err)
		if conv, err = h.getConvByName(ctx, uid, toks[1]); err != nil {
			h.Debug(ctx, "failed to find conversation as full name: %s", err)
			return err
		}
	}
	h.Debug(ctx, "joining channel: tlf: %s topic: %s", conv.Info.TlfName, utils.GetTopicName(conv))
	return h.G().ChatHelper.JoinConversationByID(ctx, uid, conv.GetConvID())
}
