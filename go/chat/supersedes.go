package chat

import (
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	context "golang.org/x/net/context"
)

type getMessagesFunc func(context.Context, chat1.ConversationID, gregor1.UID, []chat1.MessageID,
	*chat1.GetThreadReason, func() chat1.RemoteInterface, bool) ([]chat1.MessageUnboxed, error)

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
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "supersedesTransform", false),
		messagesFunc: g.ConvSource.GetMessages,
		opts:         opts,
	}
}

// This is only relevant for ephemeralMessages that are deleted since we want
// these to show up in the gui as "explode now"
func (t *basicSupersedesTransform) transformDelete(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	if !msg.IsEphemeral() {
		return nil
	}
	if msg.IsValid() {
		mvalid := msg.Valid()
		explodedBy := superMsg.Valid().SenderUsername
		mvalid.ClientHeader.EphemeralMetadata.ExplodedBy = &explodedBy
		newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
		return &newMsg
	} else if msg.IsError() {
		// Transform an erred exploding message if it was exploded
		merr := msg.Error()
		explodedBy := superMsg.Valid().SenderUsername
		merr.ExplodedBy = &explodedBy
		newMsg := chat1.NewMessageUnboxedWithError(merr)
		return &newMsg
	}
	return nil
}

func (t *basicSupersedesTransform) transformEdit(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	if !msg.IsValid() {
		return nil
	}

	mvalid := msg.Valid()
	var payments []chat1.TextPayment
	var replyTo *chat1.MessageID
	if mvalid.MessageBody.IsType(chat1.MessageType_TEXT) {
		payments = mvalid.MessageBody.Text().Payments
		replyTo = mvalid.MessageBody.Text().ReplyTo
		mvalid.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{
			Body:     superMsg.Valid().MessageBody.Edit().Body,
			Payments: payments,
			ReplyTo:  replyTo,
		})
	} else if mvalid.MessageBody.IsType(chat1.MessageType_ATTACHMENT) {
		body := mvalid.MessageBody.Attachment()
		body.Object.Title = superMsg.Valid().MessageBody.Edit().Body
		mvalid.MessageBody = chat1.NewMessageBodyWithAttachment(body)
	}
	mvalid.AtMentions = superMsg.Valid().AtMentions
	mvalid.AtMentionUsernames = superMsg.Valid().AtMentionUsernames
	mvalid.ChannelMention = superMsg.Valid().ChannelMention
	mvalid.ChannelNameMentions = superMsg.Valid().ChannelNameMentions
	mvalid.SenderDeviceName = superMsg.Valid().SenderDeviceName
	mvalid.SenderDeviceType = superMsg.Valid().SenderDeviceType
	mvalid.ServerHeader.SupersededBy = superMsg.GetMessageID()
	mvalid.Emojis = append(mvalid.Emojis, superMsg.Valid().Emojis...)
	newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &newMsg
}

func (t *basicSupersedesTransform) transformAttachment(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	if !msg.IsValid() {
		return nil
	}
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
	mvalid.ServerHeader.SupersededBy = superMsg.GetMessageID()
	newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &newMsg
}

func (t *basicSupersedesTransform) transformReaction(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	if !msg.IsValid() {
		return nil
	}
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
	mvalid.Emojis = append(mvalid.Emojis, superMsg.Valid().Emojis...)
	mvalid.Reactions = reactionMap
	newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &newMsg
}

func (t *basicSupersedesTransform) transformUnfurl(msg chat1.MessageUnboxed, superMsg chat1.MessageUnboxed) *chat1.MessageUnboxed {
	if !msg.IsValid() {
		return nil
	}
	if superMsg.Valid().MessageBody.IsNil() {
		return &msg
	}
	mvalid := msg.Valid()
	utils.SetUnfurl(&mvalid, superMsg.GetMessageID(), superMsg.Valid().MessageBody.Unfurl().Unfurl)
	newMsg := chat1.NewMessageUnboxedWithValid(mvalid)
	return &newMsg
}

func (t *basicSupersedesTransform) transform(ctx context.Context, msg chat1.MessageUnboxed,
	superMsgs []chat1.MessageUnboxed) (newMsg *chat1.MessageUnboxed, isDelete bool) {

	newMsg = &msg
	for _, superMsg := range superMsgs {
		if !superMsg.IsValidFull() {
			continue
		} else if newMsg == nil {
			return nil, true
		}

		switch superMsg.GetMessageType() {
		case chat1.MessageType_DELETE:
			newMsg = t.transformDelete(*newMsg, superMsg)
			if newMsg == nil {
				return nil, true
			}
		case chat1.MessageType_DELETEHISTORY:
			return nil, true
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
	return newMsg, false
}

func (t *basicSupersedesTransform) SetMessagesFunc(f getMessagesFunc) {
	t.messagesFunc = f
}

func (t *basicSupersedesTransform) Run(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, originalMsgs []chat1.MessageUnboxed,
	maxDeletedUpTo *chat1.MessageID) (newMsgs []chat1.MessageUnboxed, err error) {
	defer t.Trace(ctx, &err, fmt.Sprintf("Run(%s)", convID))()
	originalMsgsMap := make(map[chat1.MessageID]chat1.MessageUnboxed, len(originalMsgs))
	for _, msg := range originalMsgs {
		originalMsgsMap[msg.GetMessageID()] = msg
	}
	// Map from a MessageID to the message that supersedes it It's possible
	// that a message can be 'superseded' my multiple messages, by multiple
	// reactions.
	smap := make(map[chat1.MessageID][]chat1.MessageUnboxed)

	// Collect all superseder messages for messages in the current thread view
	superMsgsMap := make(map[chat1.MessageID]chat1.MessageUnboxed)
	superMsgIDsMap := make(map[chat1.MessageID]bool)
	for _, msg := range originalMsgs {
		if msg.IsValid() {
			supersededBy := msg.Valid().ServerHeader.SupersededBy
			if supersededBy > 0 {
				if msg, ok := originalMsgsMap[supersededBy]; ok {
					superMsgsMap[supersededBy] = msg
				} else {
					superMsgIDsMap[supersededBy] = true
				}
			}
			for _, reactID := range msg.Valid().ServerHeader.ReactionIDs {
				if msg, ok := originalMsgsMap[reactID]; ok {
					superMsgsMap[reactID] = msg
				} else {
					superMsgIDsMap[reactID] = true
				}
			}
			for _, unfurlID := range msg.Valid().ServerHeader.UnfurlIDs {
				if msg, ok := originalMsgsMap[unfurlID]; ok {
					superMsgsMap[unfurlID] = msg
				} else {
					superMsgIDsMap[unfurlID] = true
				}
			}
			supersedes, err := utils.GetSupersedes(msg)
			if err != nil {
				continue
			}
			if len(supersedes) > 0 {
				superMsgsMap[msg.GetMessageID()] = msg
			}
		}
	}
	superMsgIDs := make([]chat1.MessageID, 0, len(superMsgIDsMap))
	for superMsgID := range superMsgIDsMap {
		superMsgIDs = append(superMsgIDs, superMsgID)
	}

	// Get superseding messages
	var deleteHistoryUpto chat1.MessageID
	// If there are no superseding messages we still need to run
	// the bottom loop to filter out messages deleted by retention.
	if len(superMsgIDs) > 0 {
		msgs, err := t.messagesFunc(ctx, convID, uid, superMsgIDs, nil, nil, false)
		if err != nil {
			return nil, err
		}
		for _, msg := range msgs {
			superMsgsMap[msg.GetMessageID()] = msg
		}
	}
	for _, m := range superMsgsMap {
		if m.IsValid() {
			supersedes, err := utils.GetSupersedes(m)
			if err != nil {
				continue
			}
			for _, super := range supersedes {
				smap[super] = append(smap[super], m)
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
	// Sort all the super lists
	for _, supers := range smap {
		sort.Slice(supers, func(i, j int) bool {
			return supers[i].GetMessageID() < supers[j].GetMessageID()
		})
	}
	// Run through all messages and transform superseded messages into final state
	xformDelete := func(msgID chat1.MessageID) {
		if t.opts.UseDeletePlaceholders {
			newMsgs = append(newMsgs, utils.CreateHiddenPlaceholder(msgID))
		}
	}
	for i, msg := range originalMsgs {
		if msg.IsValid() || msg.IsError() {
			newMsg := &originalMsgs[i]
			// If the message is superseded, then transform it and add that
			var isDelete bool
			if superMsgs, ok := smap[msg.GetMessageID()]; ok {
				newMsg, isDelete = t.transform(ctx, msg, superMsgs)
			}
			if newMsg == nil {
				if isDelete {
					// Transform might return nil in case of a delete.
					t.Debug(ctx, "skipping: %d because it was deleted by a delete", msg.GetMessageID())
					xformDelete(msg.GetMessageID())
				} else { // just use the original message
					newMsgs = append(newMsgs, msg)
				}
				continue
			}
			if newMsg.GetMessageID() < deleteHistoryUpto &&
				chat1.IsDeletableByDeleteHistory(newMsg.GetMessageType()) {
				t.Debug(ctx, "skipping: %d because it was deleted by delete history", msg.GetMessageID())
				xformDelete(msg.GetMessageID())
				continue
			}
			if !newMsg.IsValidFull() {
				// Drop the message unless it is ephemeral. It has been deleted
				// locally but not superseded by anything.  Could have been
				// deleted by a delete-history, retention expunge, or was an
				// exploding message.
				if newMsg.IsValid() && (!newMsg.IsEphemeral() ||
					(maxDeletedUpTo != nil && newMsg.HideExplosion(*maxDeletedUpTo, time.Now()))) {
					t.Debug(ctx, "skipping: %d because it not valid full",
						msg.GetMessageID())
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
