package chat

import (
	"context"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type supersedesTransform struct {
	libkb.Contextified
	utils.DebugLabeler
}

func newSupersedesTransform(g *libkb.GlobalContext) *supersedesTransform {
	return &supersedesTransform{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "supersedesTransform", false),
	}
}

func (t *supersedesTransform) transformEdit(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	clientHeader := msg.Valid().ClientHeader
	clientHeader.MessageType = chat1.MessageType_TEXT
	newMsg := chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
		ClientHeader: clientHeader,
		ServerHeader: msg.Valid().ServerHeader,
		MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
			Body: superMsg.Valid().MessageBody.Edit().Body,
		}),
		SenderUsername:        msg.Valid().SenderUsername,
		SenderDeviceName:      msg.Valid().SenderDeviceName,
		SenderDeviceType:      msg.Valid().SenderDeviceType,
		HeaderHash:            msg.Valid().HeaderHash,
		HeaderSignature:       msg.Valid().HeaderSignature,
		SenderDeviceRevokedAt: msg.Valid().SenderDeviceRevokedAt,
	})
	return &newMsg
}

func (t *supersedesTransform) transform(ctx context.Context, msg chat1.MessageUnboxed,
	superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {

	switch superMsg.GetMessageType() {
	case chat1.MessageType_DELETE:
		return nil
	case chat1.MessageType_EDIT:
		return t.transformEdit(msg, superMsg)
	}

	return &msg
}

func (t *supersedesTransform) run(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, thread *chat1.ThreadView,
	finalizeInfo *chat1.ConversationFinalizeInfo) error {

	var superMsgIDs []chat1.MessageID
	smap := make(map[chat1.MessageID]chat1.MessageUnboxed)

	// Collect all superseder messages for messages in the current thread view
	for _, msg := range thread.Messages {
		if msg.IsValid() {
			supersededBy := msg.Valid().ServerHeader.SupersededBy
			if supersededBy > 0 {
				superMsgIDs = append(superMsgIDs, supersededBy)
			}
		}
	}

	// Get superseding messages
	msgs, err := t.G().ConvSource.GetMessages(ctx, convID, uid, superMsgIDs, finalizeInfo)
	if err != nil {
		return err
	}
	for _, m := range msgs {
		if m.IsValid() {
			supers, err := utils.GetSupersedes(m)
			if err != nil {
				continue
			}
			for _, super := range supers {
				smap[super] = m
			}
		}
	}

	// Run through all messages and transform superseded messages into final state
	var newMsgs []chat1.MessageUnboxed
	for _, msg := range thread.Messages {
		if msg.IsValid() {
			// If the message is superseded, then transform it and add that
			if superMsg, ok := smap[msg.GetMessageID()]; ok {
				t.Debug(ctx, "transforming: msgID: %d superMsgID: %d", msg.GetMessageID(),
					superMsg.GetMessageID())
				newMsg := t.transform(ctx, msg, superMsg)
				if newMsg != nil {
					// Might be a delete, so check if transform returned anything
					newMsgs = append(newMsgs, *newMsg)
				}
			} else {
				newMsgs = append(newMsgs, msg)
			}
		} else {
			newMsgs = append(newMsgs, msg)
		}
	}
	thread.Messages = newMsgs

	return nil
}
