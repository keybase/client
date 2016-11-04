package libkb

import (
	"github.com/keybase/client/go/protocol/chat1"
)

const (
	ChatTopicIDLen    = 16
	ChatTopicIDSuffix = 0x20
)

func NewChatTopicID() (id []byte, err error) {
	if id, err = RandBytes(ChatTopicIDLen); err != nil {
		return nil, err
	}
	id[len(id)-1] = ChatTopicIDSuffix
	return id, nil
}

func AllChatConversationStatuses() (res []chat1.ConversationStatus) {
	for _, s := range chat1.ConversationStatusMap {
		res = append(res, s)
	}
	return
}

func VisibleChatConversationStatuses() []chat1.ConversationStatus {
	return []chat1.ConversationStatus{
		chat1.ConversationStatus_UNFILED,
		chat1.ConversationStatus_FAVORITE,
	}
}
