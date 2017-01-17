package chat

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/protocol/chat1"
)

func ConversationMetadata(ctx context.Context, ri chat1.RemoteInterface, convID chat1.ConversationID, rl *[]*chat1.RateLimit) (chat1.Conversation, error) {
	conv, err := ri.GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query: &chat1.GetInboxQuery{
			ConvID: &convID,
		},
	})
	*rl = append(*rl, conv.RateLimit)
	if err != nil {
		return chat1.Conversation{}, storage.RemoteError{Msg: err.Error()}
	}
	if len(conv.Inbox.Full().Conversations) == 0 {
		return chat1.Conversation{}, storage.RemoteError{Msg: fmt.Sprintf("conv not found: %s", convID)}
	}
	return conv.Inbox.Full().Conversations[0], nil
}
