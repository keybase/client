package chat

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type getMessagesFunc func(context.Context, types.UnboxConversationInfo, gregor1.UID, []chat1.MessageID,
	*chat1.GetThreadReason) ([]chat1.MessageUnboxed, error)

type basicSupersedesTransformOpts struct {
	UseDeletePlaceholders bool
}

type basicSupersedesTransform struct {
	globals.Contextified
	utils.DebugLabeler

	messagesFunc getMessagesFunc
	opts         basicSupersedesTransformOpts
}

var _ types.SupersedesTransform = (*basicSupersedesTransform)(nil)

func newBasicSupersedesTransform(g *globals.Context, opts basicSupersedesTransformOpts) *basicSupersedesTransform {
	return &basicSupersedesTransform{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "supersedesTransform", false),
		messagesFunc: g.ConvSource.GetMessages,
		opts:         opts,
	}
}

// This is only relevant for ephemeralMessages that are deleted since we want
// these to show up in the gui as "explode now"
func (t *basicSupersedesTransform) transformDelete(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	mvalid := msg.Valid()
	if !mvalid.IsEphemeral() {
		return nil
	}
	explodedBy := superMsg.Valid().SenderUsername
	mvalid.ClientHeader.EphemeralMetadata.ExplodedBy = &explodedBy
	newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &newMsg
}

func (t *basicSupersedesTransform) transformEdit(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	mvalid := msg.Valid()
	var payments []chat1.TextPayment
	var replyTo *chat1.MessageID
	if mvalid.MessageBody.IsType(chat1.MessageType_TEXT) {
		payments = mvalid.MessageBody.Text().Payments
		replyTo = mvalid.MessageBody.Text().ReplyTo
	}
	mvalid.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
		Body:     superMsg.Valid().MessageBody.Edit().Body,
		Payments: payments,
		ReplyTo:  replyTo,
	})
	mvalid.AtMentions = superMsg.Valid().AtMentions
	mvalid.AtMentionUsernames = superMsg.Valid().AtMentionUsernames
	mvalid.ChannelMention = superMsg.Valid().ChannelMention
	mvalid.ChannelNameMentions = superMsg.Valid().ChannelNameMentions
	mvalid.SenderDeviceName = superMsg.Valid().SenderDeviceName
	mvalid.SenderDeviceType = superMsg.Valid().SenderDeviceType
	newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &newMsg
}

func (t *basicSupersedesTransform) transformAttachment(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	mvalid := msg.Valid()
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
	mvalid.MessageBody = chat1.NewMessageBodyWithAttachment(attachment)
	newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &newMsg
}

func (t *basicSupersedesTransform) transformReaction(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	if superMsg.Valid().MessageBody.IsNil() {
		return &msg
	}

	reactionMap := msg.Valid().Reactions
	if reactionMap.Reactions == nil {
		reactionMap.Reactions = map[string]map[string]chat1.Reaction{}
	}

	reactionText := superMsg.Valid().MessageBody.Reaction().Body
	reactions, ok := reactionMap.Reactions[reactionText]
	if !ok {
		reactions = map[string]chat1.Reaction{}
	}
	reactions[superMsg.Valid().SenderUsername] = chat1.Reaction{
		ReactionMsgID: superMsg.GetMessageID(),
		Ctime:         superMsg.Valid().ServerHeader.Ctime,
	}
	reactionMap.Reactions[reactionText] = reactions

	mvalid := msg.Valid()
	mvalid.Reactions = reactionMap
	newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &newMsg
}

func (t *basicSupersedesTransform) transformUnfurl(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	if superMsg.Valid().MessageBody.IsNil() {
		return &msg
	}
	mvalid := msg.Valid()
	utils.SetUnfurl(&mvalid, superMsg.GetMessageID(), superMsg.Valid().MessageBody.Unfurl().Unfurl)
	newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &newMsg
}

func (t *basicSupersedesTransform) transform(ctx context.Context, msg chat1.MessageUnboxed,
	superMsgs []chat1.MessageUnboxed) *chat1.MessageUnboxed {

	newMsg := &msg
	for _, superMsg := range superMsgs {
		if !superMsg.IsValidFull() {
			continue
		} else if newMsg == nil {
			return nil
		}

		switch superMsg.GetMessageType() {
		case chat1.MessageType_DELETE:
			newMsg = t.transformDelete(*newMsg, superMsg)
		case chat1.MessageType_DELETEHISTORY:
			return nil
		case chat1.MessageType_EDIT:
			newMsg = t.transformEdit(*newMsg, superMsg)
		case chat1.MessageType_ATTACHMENTUPLOADED:
			newMsg = t.transformAttachment(*newMsg, superMsg)
		case chat1.MessageType_REACTION:
			newMsg = t.transformReaction(*newMsg, superMsg)
		case chat1.MessageType_UNFURL:
			newMsg = t.transformUnfurl(*newMsg, superMsg)
		}

		t.Debug(ctx, "transformed: original:%v super:%v -> %v",
			newMsg.DebugString(), superMsg.DebugString(), newMsg.DebugString())
	}
	return newMsg
}

func (t *basicSupersedesTransform) SetMessagesFunc(f getMessagesFunc) {
	t.messagesFunc = f
}

func (t *basicSupersedesTransform) Run(ctx context.Context,
	conv types.UnboxConversationInfo, uid gregor1.UID, originalMsgs []chat1.MessageUnboxed) (res []chat1.MessageUnboxed, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("Run(%s)", conv.GetConvID()))()

	// MessageIDs that supersede
	var superMsgIDs []chat1.MessageID
	// Map from a MessageID to the message that supersedes it It's possible
	// that a message can be 'superseded' my multiple messages, by multiple
	// reactions.
	smap := make(map[chat1.MessageID][]chat1.MessageUnboxed)

	// Collect all superseder messages for messages in the current thread view
	for _, msg := range originalMsgs {
		if msg.IsValid() {
			supersededBy := msg.Valid().ServerHeader.SupersededBy
			if supersededBy > 0 {
				superMsgIDs = append(superMsgIDs, supersededBy)
			}
			superMsgIDs = append(superMsgIDs, msg.Valid().ServerHeader.ReactionIDs...)
			superMsgIDs = append(superMsgIDs, msg.Valid().ServerHeader.UnfurlIDs...)
		}
	}

	// Get superseding messages
	var deleteHistoryUpto chat1.MessageID
	// If there are no superseding messages we still need to run
	// the bottom loop to filter out messages deleted by retention.
	if len(superMsgIDs) > 0 {
		msgs, err := t.messagesFunc(ctx, conv, uid, superMsgIDs, nil)
		if err != nil {
			return nil, err
		}
		for _, m := range msgs {
			if m.IsValid() {
				supersedes, err := utils.GetSupersedes(m)
				if err != nil {
					continue
				}
				for _, super := range supersedes {
					supers, ok := smap[super]
					if !ok {
						supers = []chat1.MessageUnboxed{}
					}
					supers = append(supers, m)
					smap[super] = supers
				}

				delh, err := m.Valid().AsDeleteHistory()
				if err == nil {
					if delh.Upto > deleteHistoryUpto {
						t.Debug(ctx, "found delete history: id: %v", m.GetMessageID())
						deleteHistoryUpto = delh.Upto
					}
				}
			}
		}
	}

	// Run through all messages and transform superseded messages into final state
	var newMsgs []chat1.MessageUnboxed
	xformDelete := func(msgID chat1.MessageID) {
		if t.opts.UseDeletePlaceholders {
			newMsgs = append(newMsgs, utils.CreateHiddenPlaceholder(msgID))
		}
	}
	for i, msg := range originalMsgs {
		if msg.IsValid() {
			newMsg := &originalMsgs[i]
			// If the message is superseded, then transform it and add that
			if superMsgs, ok := smap[msg.GetMessageID()]; ok {
				newMsg = t.transform(ctx, msg, superMsgs)
			}
			if newMsg == nil {
				// Transform might return nil in case of a delete.
				t.Debug(ctx, "skipping: %d because it was deleted", msg.GetMessageID())
				xformDelete(msg.GetMessageID())
				continue
			}
			if newMsg.GetMessageID() < deleteHistoryUpto &&
				chat1.IsDeletableByDeleteHistory(newMsg.GetMessageType()) {
				xformDelete(msg.GetMessageID())
				continue
			}
			if !newMsg.IsValidFull() {
				// Drop the message unless it is ephemeral. It has been deleted
				// locally but not superseded by anything.  Could have been
				// deleted by a delete-history, retention expunge, or was an
				// exploding message.
				mvalid := newMsg.Valid()
				if !mvalid.IsEphemeral() || mvalid.HideExplosion(conv.GetMaxDeletedUpTo(), time.Now()) {
					btyp, _ := mvalid.MessageBody.MessageType()
					t.Debug(ctx, "skipping: %d because not valid full: typ: %v bodymatch: %v btyp: %v",
						msg.GetMessageID(), msg.GetMessageType(),
						mvalid.MessageBody.IsType(msg.GetMessageType()), btyp)
					xformDelete(msg.GetMessageID())
					continue
				}
			}
			newMsgs = append(newMsgs, *newMsg)
		} else {
			newMsgs = append(newMsgs, msg)
		}
	}

	return newMsgs, nil
}
