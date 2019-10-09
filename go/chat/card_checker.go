package chat

import (
	"context"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

// should probably be in avdl
type Card struct{}

type cardChecker struct{}

func newCardChecker() *cardChecker {
	return &cardChecker{}
}

func (cc *cardChecker) Next(ctx context.Context, uid gregor1.UID, conv *chat1.ConversationLocal, thread *chat1.ThreadView) (*Card, error) {
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

	return nil, nil
}
