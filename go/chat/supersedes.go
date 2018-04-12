package chat

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type supersedesTransform interface {
	Run(ctx context.Context,
		conv types.UnboxConversationInfo, uid gregor1.UID, originalMsgs []chat1.MessageUnboxed) ([]chat1.MessageUnboxed, error)
}

type getMessagesFunc func(context.Context, types.UnboxConversationInfo, gregor1.UID, []chat1.MessageID) ([]chat1.MessageUnboxed, error)

type basicSupersedesTransform struct {
	globals.Contextified
	utils.DebugLabeler

	messagesFunc getMessagesFunc
}

var _ supersedesTransform = (*basicSupersedesTransform)(nil)

func newBasicSupersedesTransform(g *globals.Context) *basicSupersedesTransform {
	return &basicSupersedesTransform{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "supersedesTransform", false),
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
		AtMentions:            superMsg.Valid().AtMentions,
		AtMentionUsernames:    superMsg.Valid().AtMentionUsernames,
		ChannelMention:        superMsg.Valid().ChannelMention,
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

	if !superMsg.IsValidFull() {
		return nil
	}
	switch superMsg.GetMessageType() {
	case chat1.MessageType_DELETE, chat1.MessageType_DELETEHISTORY:
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
	conv types.UnboxConversationInfo, uid gregor1.UID, originalMsgs []chat1.MessageUnboxed) (res []chat1.MessageUnboxed, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("Run(%s)", conv.GetConvID()))()

	// MessageIDs that supersede
	var superMsgIDs []chat1.MessageID
	// Map from a MessageID to the message that supersedes it
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

	// Get superseding messages
	var deleteHistoryUpto chat1.MessageID
	// If there are no superseding messages we still need to run
	// the bottom loop to filter out messages deleted by retention.
	if len(superMsgIDs) > 0 {
		msgs, err := t.messagesFunc(ctx, conv, uid, superMsgIDs)
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

				delh, err := m.Valid().AsDeleteHistory()
				if err == nil {
					if delh.Upto > deleteHistoryUpto {
						deleteHistoryUpto = delh.Upto
					}
				}
			}
		}
	}

	// Run through all messages and transform superseded messages into final state
	var newMsgs []chat1.MessageUnboxed
	for i, msg := range originalMsgs {
		if msg.IsValid() {
			newMsg := &originalMsgs[i]
			// If the message is superseded, then transform it and add that
			if superMsg, ok := smap[msg.GetMessageID()]; ok {
				newMsg = t.transform(ctx, msg, superMsg)
				t.Debug(ctx, "transformed: original:%v super:%v -> %v",
					msg.DebugString(), superMsg.DebugString(), newMsg.DebugString())
			}
			if newMsg == nil {
				// Transform might return nil in case of a delete.
				continue
			}
			if newMsg.GetMessageID() < deleteHistoryUpto && chat1.IsDeletableByDeleteHistory(newMsg.GetMessageType()) {
				// Hide messages which are or should have been deleted by a DeleteHistory.
				continue
			}
			if !newMsg.IsValidFull() {
				// Drop the message. It has been deleted locally but not
				// superseded by anything.  Could have been deleted by a
				// delete-history, retention expunge, or was an exploding
				// message.
				continue
			}
			newMsgs = append(newMsgs, *newMsg)
		} else {
			newMsgs = append(newMsgs, msg)
		}
	}

	return newMsgs, nil
}
