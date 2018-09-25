package search

import (
	"context"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
)

// Indexer keeps an encrypted index of chat messages for all conversations to enable full inbox search locally.
// Data is stored in leveldb in the form:
// (term,convID) -> [(msgID,senderUID), ...]
//     ...       ->        ...
// The workload is expected to be write heavy with keeping the index up to date.
type Indexer struct{}

var _ types.Indexer = (*Indexer)(nil)

// Search tokenizes the given query and finds the intersection of all matches
// for each token, returning (convID,msgID) pairs with match information.
func (i *Indexer) Search(ctx context.Context, query string, opts chat1.SearchOpts) ([]chat1.ChatConvSearchHit, error) {
	return nil, nil
}

// Add tokenizes the message content and creates/updates index keys for each token.
func (i *Indexer) Add(ctx context.Context, convID chat1.ConversationID, msg chat1.MessageUnboxed) error {
	return nil
}

// Remove tokenizes the message content and updates/removes index keys for each token.
func (i *Indexer) Remove(ctx context.Context, convID chat1.ConversationID, msg chat1.MessageUnboxed) error {
	return nil
}
