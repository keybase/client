package chat

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Storage struct {
	libkb.Contextified
}

func (s *Storage) Merge(convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageFromServerOrError) error {
	return nil
}

func (s *Storage) Fetch(convID chat1.ConversationID, uid gregor1.UID, page *chat1.Pagination) ([]chat1.MessageFromServerOrError, error) {
	return nil, nil
}
