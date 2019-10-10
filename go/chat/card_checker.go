package chat

import (
	"context"
	"runtime/debug"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type cardChecker struct {
	globals.Contextified
	utils.DebugLabeler
}

func newCardChecker(g *globals.Context) *cardChecker {
	labeler := utils.NewDebugLabeler(g.GetLog(), "cardChecker", false)
	return &cardChecker{
		Contextified: globals.NewContextified(g),
		DebugLabeler: labeler,
	}
}

func (cc *cardChecker) Next(ctx context.Context, uid gregor1.UID, conv *chat1.ConversationLocal, thread *chat1.ThreadView) (*chat1.MessageUnboxedCard, error) {
	if conv == nil {
		// if no verified conversation parameter, don't do anything
		cc.Debug(ctx, "no conversation parameter")
		debug.PrintStack()
		return nil, nil
	}

	//  this isn't working:
	/*
		if !thread.Pagination.FirstPage() {
			// only want cards for the initial conversation load
			cc.Debug(ctx, "not first page: %+v", thread.Pagination)
			return nil, nil
		}
	*/

	if conv.GetMembersType() != chat1.ConversationMembersType_TEAM {
		// currently, cards only exist in team conversations
		cc.Debug(ctx, "not a team conversation")
		return nil, nil
	}

	// for testing initial card, always show one if channel name is kb_cards_kb
	if conv.Info.TopicName == "kb_cards_kb" {
		return &chat1.MessageUnboxedCard{CardType: chat1.MessageUnboxedCardType_HELLO, Data: "nothing"}, nil
	}

	cc.Debug(ctx, "no card needed")

	return nil, nil
}
