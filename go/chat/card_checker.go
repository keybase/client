package chat

import (
	"context"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type cardChecker struct{}

func newCardChecker() *cardChecker {
	return &cardChecker{}
}

func (cc *cardChecker) Next(ctx context.Context, uid gregor1.UID, conv *chat1.ConversationLocal, thread *chat1.ThreadView) (*chat1.MessageUnboxedCard, error) {
	if conv == nil {
		// if no verified conversation parameter, don't do anything
		return nil, nil
	}
	if !thread.Pagination.FirstPage() {
		// only want cards for the initial conversation load
		return nil, nil
	}

	if conv.GetMembersType() != chat1.ConversationMembersType_TEAM {
		// currently, cards only exist in team conversations
		return nil, nil
	}

	// for testing initial card, always show one if channel name is kb_cards_kb
	if conv.Info.TopicName == "kb_cards_kb" {
		return &chat1.MessageUnboxedCard{CardType: chat1.MessageUnboxedCardType_HELLO, Data: "nothing"}, nil
	}

	return nil, nil
}
