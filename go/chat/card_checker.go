package chat

import (
	"context"

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

	// for testing, do special stuff based on channel name:
	switch conv.Info.TopicName {
	case "kb_cards_0_kb":
		return &chat1.MessageUnboxedCard{CardType: chat1.MessageUnboxedCardType_WELCOME, Data: "{\"msg\": \"hello\"}"}, nil
	case "kb_cards_1_kb":
		return &chat1.MessageUnboxedCard{CardType: chat1.MessageUnboxedCardType_POPULAR_CHANNELS, Data: "{\"msg\": \"Other popular channels:\", \"channels\": [\"public\", \"announcements\"]}"}, nil
	case "kb_cards_2_kb":
		return &chat1.MessageUnboxedCard{CardType: chat1.MessageUnboxedCardType_ADD_PEOPLE, Data: "{\"msg\": \"add some friends\"}"}, nil
	case "kb_cards_3_kb":
		return &chat1.MessageUnboxedCard{CardType: chat1.MessageUnboxedCardType_CREATE_CHANNELS, Data: "{\"msg\": \"create some channels\"}"}, nil
	case "kb_cards_4_kb":
		return &chat1.MessageUnboxedCard{CardType: chat1.MessageUnboxedCardType_MSG_ATTENTION, Data: "{\"msg\": \"one of your messages got a lot of attention\", \"msgid\": 2}"}, nil
	case "kb_cards_5_kb":
		return &chat1.MessageUnboxedCard{CardType: chat1.MessageUnboxedCardType_USER_AWAY_FOR_LONG, Data: "{\"msg\": \"see what you missed\", \"lastread_msgid\": 2}"}, nil
	case "kb_cards_6_kb":
		return &chat1.MessageUnboxedCard{CardType: chat1.MessageUnboxedCardType_CHANNEL_INACTIVE, Data: "{\"msg\": \"This channel isn't very active.  Revive it?\"}"}, nil
	case "kb_cards_7_kb":
		return &chat1.MessageUnboxedCard{CardType: chat1.MessageUnboxedCardType_POPULAR_CHANNELS, Data: "{\"msg\": \"People haven't been talkative in a while. Perhaps post in another channel?\", \"channels\": [\"public\", \"announcements\", \"random\"]}"}, nil
	}

	cc.Debug(ctx, "no card needed")

	return nil, nil
}
