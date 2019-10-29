package stellar

import (
	"errors"

	chatstorage "github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
)

type ChatIDs struct {
	ConvID          *stellar1.ChatConversationID
	OutboxID        *stellar1.ChatOutboxID
	OutboxIDForChat chat1.OutboxID
}

func NewChatIDs(mctx libkb.MetaContext, inConvID chat1.ConversationID, inOutboxID chat1.OutboxID) (*ChatIDs, error) {
	r := &ChatIDs{
		ConvID:          stellar1.NewChatConversationID(inConvID),
		OutboxID:        stellar1.NewChatOutboxID(inOutboxID),
		OutboxIDForChat: inOutboxID,
	}

	if r.ConvID == nil {
		return nil, errors.New("NewChatIDs called with nil ConvID")
	}

	if r.OutboxID == nil {
		obid, err := chatstorage.NewOutboxID()
		if err != nil {
			return nil, err
		}
		r.OutboxID = stellar1.NewChatOutboxID(obid)
		r.OutboxIDForChat = obid
	}

	return r, nil
}

func NewChatIDsFindConv(mctx libkb.MetaContext, recipient string, inOutboxID chat1.OutboxID) (*ChatIDs, error) {
	uid := mctx.CurrentUID()
	if uid.IsNil() {
		return nil, libkb.LoginRequiredError{}
	}
	guid := gregor1.UID(uid.ToBytes())
	conv, err := mctx.G().ChatHelper.NewConversation(mctx.Ctx(), guid, recipient, nil, chat1.TopicType_CHAT, chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFVisibility_PRIVATE)
	if err != nil {
		return nil, err
	}
	convID := conv.Info.Id

	return NewChatIDs(mctx, convID, inOutboxID)
}
