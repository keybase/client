package chat

import (
	"context"
	"runtime/debug"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type journeyCardChecker struct {
	globals.Contextified
	utils.DebugLabeler
}

func newJourneyCardChecker(g *globals.Context) *journeyCardChecker {
	labeler := utils.NewDebugLabeler(g.GetLog(), "journeyCardChecker", false)
	return &journeyCardChecker{
		Contextified: globals.NewContextified(g),
		DebugLabeler: labeler,
	}
}

func (cc *journeyCardChecker) Next(ctx context.Context, uid gregor1.UID, conv *chat1.ConversationLocal, thread *chat1.ThreadView) (*chat1.MessageUnboxedJourneycard, error) {
	if !cc.G().GetEnv().GetDebugJourneycard() {
		// Journey cards are gated by the client-side flag KEYBASE_DEBUG_JOURNEYCARD
		return nil, nil
	}
	if conv == nil {
		// if no verified conversation parameter, don't do anything
		// if this happens the first question will by "why?", hence the stack
		cc.Debug(ctx, "no conversation parameter\n%v", string(debug.Stack()))
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
		return nil, nil
	}

	// Pick a message to use as the base for a frontend ordinal.
	// Get out of the way of any other messages that have taken ordinal offsets of that message.
	prevID := conv.MaxVisibleMsgID()
	ordinal := 1 // offset within
	for _, message := range thread.Messages {
		if message.GetMessageID() > prevID {
			prevID = message.GetMessageID()
			ordinal = 1
		}
		state, err := message.State()
		if err != nil {
			continue
		}
		foundOrdinal := func(foundOrdinal int) {
			if prevID == message.GetMessageID() && foundOrdinal > ordinal {
				ordinal = foundOrdinal + 1
			}
		}
		switch state {
		case chat1.MessageUnboxedState_OUTBOX:
			foundOrdinal(message.Outbox().Ordinal)
		case chat1.MessageUnboxedState_JOURNEYCARD:
			foundOrdinal(message.Journeycard().Ordinal)
		}
	}
	if prevID == 0 {
		// No message found to use as base for ordinal.
		return nil, nil
	}

	makeCard := func(cardType chat1.JourneycardType, highlightMsgID chat1.MessageID) (*chat1.MessageUnboxedJourneycard, error) {
		return &chat1.MessageUnboxedJourneycard{
			PrevID:         prevID,
			Ordinal:        ordinal,
			CardType:       cardType,
			HighlightMsgID: highlightMsgID,
		}, nil
	}

	// for testing, do special stuff based on channel name:
	switch conv.Info.TopicName {
	case "kb_cards_0_kb":
		return makeCard(chat1.JourneycardType_WELCOME, 0)
	case "kb_cards_1_kb":
		return makeCard(chat1.JourneycardType_POPULAR_CHANNELS, 0)
	case "kb_cards_2_kb":
		return makeCard(chat1.JourneycardType_ADD_PEOPLE, 0)
	case "kb_cards_3_kb":
		return makeCard(chat1.JourneycardType_CREATE_CHANNELS, 0)
	case "kb_cards_4_kb":
		return makeCard(chat1.JourneycardType_MSG_ATTENTION, 3)
	case "kb_cards_5_kb":
		return makeCard(chat1.JourneycardType_USER_AWAY_FOR_LONG, 0)
	case "kb_cards_6_kb":
		return makeCard(chat1.JourneycardType_CHANNEL_INACTIVE, 0)
	case "kb_cards_7_kb":
		return makeCard(chat1.JourneycardType_POPULAR_CHANNELS, 0)
	}
	return nil, nil
}
