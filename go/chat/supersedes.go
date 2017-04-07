package chat

import (
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type supersedesTransform interface {
	Run(ctx context.Context,
		convID chat1.ConversationID, uid gregor1.UID, originalMsgs []chat1.MessageUnboxed,
		finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error)
}

type nullSupersedesTransform struct {
}

func (t nullSupersedesTransform) Run(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, originalMsgs []chat1.MessageUnboxed,
	finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error) {
	return originalMsgs, nil
}

func newNullSupersedesTransform() nullSupersedesTransform {
	return nullSupersedesTransform{}
}

type getMessagesFunc func(context.Context, chat1.ConversationID, gregor1.UID, []chat1.MessageID,
	*chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error)

type basicSupersedesTransform struct {
	libkb.Contextified
	utils.DebugLabeler

	messagesFunc getMessagesFunc
}

func newBasicSupersedesTransform(g *libkb.GlobalContext) *basicSupersedesTransform {
	return &basicSupersedesTransform{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "supersedesTransform", false),
		messagesFunc: g.ConvSource.GetMessages,
	}
}

func (t *basicSupersedesTransform) transformEdit(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
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

func (t *basicSupersedesTransform) transformAttachment(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	clientHeader := msg.Valid().ClientHeader
	clientHeader.MessageType = chat1.MessageType_ATTACHMENT
	uploaded := superMsg.Valid().MessageBody.Attachmentuploaded()
	attachment := chat1.MessageAttachment{
		Object:   uploaded.Object,
		Previews: uploaded.Previews,
		Metadata: uploaded.Metadata,
		Uploaded: true,
	}
	if len(uploaded.Previews) > 0 {
		attachment.Preview = &uploaded.Previews[0]
	}
	newMsg := chat1.NewMessageUnboxedWithValid(chat1.MessageUnboxedValid{
		ClientHeader:          clientHeader,
		ServerHeader:          msg.Valid().ServerHeader,
		MessageBody:           chat1.NewMessageBodyWithAttachment(attachment),
		SenderUsername:        msg.Valid().SenderUsername,
		SenderDeviceName:      msg.Valid().SenderDeviceName,
		SenderDeviceType:      msg.Valid().SenderDeviceType,
		HeaderHash:            msg.Valid().HeaderHash,
		HeaderSignature:       msg.Valid().HeaderSignature,
		SenderDeviceRevokedAt: msg.Valid().SenderDeviceRevokedAt,
	})
	return &newMsg
}

func (t *basicSupersedesTransform) transform(ctx context.Context, msg chat1.MessageUnboxed,
	superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {

	switch superMsg.GetMessageType() {
	case chat1.MessageType_DELETE:
		return nil
	case chat1.MessageType_EDIT:
		return t.transformEdit(msg, superMsg)
	case chat1.MessageType_ATTACHMENTUPLOADED:
		return t.transformAttachment(msg, superMsg)
	}

	return &msg
}

func (t *basicSupersedesTransform) SetMessagesFunc(f getMessagesFunc) {
	t.messagesFunc = f
}

func (t *basicSupersedesTransform) Run(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, originalMsgs []chat1.MessageUnboxed,
	finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error) {

	// MessageIDs that supersede
	var superMsgIDs []chat1.MessageID
	// Map from MessageIDs to their superseder messages
	smap := make(map[chat1.MessageID]chat1.MessageUnboxed)

	// Collect all superseder messages for messages in the current thread view
	for _, msg := range originalMsgs {
		if msg.IsValid() {
			supersededBy := msg.Valid().ServerHeader.SupersededBy
			if supersededBy > 0 {
				superMsgIDs = append(superMsgIDs, supersededBy)
			}
		}
	}
	if len(superMsgIDs) == 0 {
		return originalMsgs, nil
	}

	// Get superseding messages
	msgs, err := t.messagesFunc(ctx, convID, uid, superMsgIDs, finalizeInfo)
	if err != nil {
		return nil, err
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
	for _, msg := range originalMsgs {
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

	return newMsgs, nil
}
