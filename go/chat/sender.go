package chat

import (
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/bots"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/msgchecker"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/clockwork"
	context "golang.org/x/net/context"
)

type BlockingSender struct {
	globals.Contextified
	utils.DebugLabeler

	boxer             *Boxer
	store             attachments.Store
	getRi             func() chat1.RemoteInterface
	prevPtrPagination *chat1.Pagination
	clock             clockwork.Clock
}

var _ types.Sender = (*BlockingSender)(nil)

func NewBlockingSender(g *globals.Context, boxer *Boxer, getRi func() chat1.RemoteInterface) *BlockingSender {
	return &BlockingSender{
		Contextified:      globals.NewContextified(g),
		DebugLabeler:      utils.NewDebugLabeler(g.ExternalG(), "BlockingSender", false),
		getRi:             getRi,
		boxer:             boxer,
		store:             attachments.NewS3Store(g, g.GetRuntimeDir()),
		clock:             clockwork.NewRealClock(),
		prevPtrPagination: &chat1.Pagination{Num: 50},
	}
}

func (s *BlockingSender) setPrevPagination(p *chat1.Pagination) {
	s.prevPtrPagination = p
}

func (s *BlockingSender) SetClock(clock clockwork.Clock) {
	s.clock = clock
}

func (s *BlockingSender) addSenderToMessage(msg chat1.MessagePlaintext) (chat1.MessagePlaintext, gregor1.UID, error) {
	uid := s.G().Env.GetUID()
	if uid.IsNil() {
		return chat1.MessagePlaintext{}, nil, libkb.LoginRequiredError{}
	}
	did := s.G().Env.GetDeviceID()
	if did.IsNil() {
		return chat1.MessagePlaintext{}, nil, libkb.DeviceRequiredError{}
	}

	huid := uid.ToBytes()
	if huid == nil {
		return chat1.MessagePlaintext{}, nil, errors.New("invalid UID")
	}

	hdid := make([]byte, libkb.DeviceIDLen)
	if err := did.ToBytes(hdid); err != nil {
		return chat1.MessagePlaintext{}, nil, err
	}

	header := msg.ClientHeader
	header.Sender = gregor1.UID(huid)
	header.SenderDevice = gregor1.DeviceID(hdid)
	updated := chat1.MessagePlaintext{
		ClientHeader:       header,
		MessageBody:        msg.MessageBody,
		SupersedesOutboxID: msg.SupersedesOutboxID,
	}
	return updated, gregor1.UID(huid), nil
}

func (s *BlockingSender) addPrevPointersAndCheckConvID(ctx context.Context, msg chat1.MessagePlaintext,
	conv chat1.ConversationLocal) (resMsg chat1.MessagePlaintext, err error) {

	// Make sure the caller hasn't already assembled this list. For now, this
	// should never happen, and we'll return an error just in case we make a
	// mistake in the future. But if there's some use case in the future where
	// a caller wants to specify custom prevs, we can relax this.
	if len(msg.ClientHeader.Prev) != 0 {
		return resMsg, fmt.Errorf("addPrevPointersToMessage expects an empty prev list")
	}

	var thread chat1.ThreadView
	var prevs []chat1.MessagePreviousPointer
	pagination := &chat1.Pagination{
		Num: s.prevPtrPagination.Num,
	}
	// If we fail to find anything to prev against after maxAttempts, we allow
	// the message to be send with an empty prev list.
	maxAttempts := 5
	attempt := 0
	reachedLast := false
	for {
		thread, err = s.G().ConvSource.Pull(ctx, conv.GetConvID(), msg.ClientHeader.Sender,
			chat1.GetThreadReason_PREPARE, nil,
			&chat1.GetThreadQuery{
				DisableResolveSupersedes: true,
			},
			pagination)
		if err != nil {
			return resMsg, err
		} else if thread.Pagination == nil {
			break
		}
		pagination.Next = thread.Pagination.Next

		if len(thread.Messages) == 0 {
			s.Debug(ctx, "no local messages found for prev pointers")
		}
		newPrevsForRegular, newPrevsForExploding, err := CheckPrevPointersAndGetUnpreved(&thread)
		if err != nil {
			return resMsg, err
		}

		var hasPrev bool
		if msg.IsEphemeral() {
			prevs = newPrevsForExploding
			hasPrev = len(newPrevsForExploding) > 0
		} else {
			prevs = newPrevsForRegular
			// If we have only sent ephemeralMessages and are now sending a regular
			// message, we may have an empty list for newPrevsForRegular. In this
			// case we allow the `Prev` to be empty, so we don't want to abort in
			// the check on numPrev below.
			hasPrev = len(newPrevsForRegular) > 0 || len(newPrevsForExploding) > 0
		}

		if hasPrev {
			break
		} else if thread.Pagination.Last && !reachedLast {
			s.Debug(ctx, "Could not find previous messages for prev pointers (of %v). Nuking local storage and retrying.", len(thread.Messages))
			if err := s.G().ConvSource.Clear(ctx, conv.GetConvID(), msg.ClientHeader.Sender, &types.ClearOpts{
				SendLocalAdminNotification: true,
				Reason:                     "missing prev pointer",
			}); err != nil {
				s.Debug(ctx, "Unable to clear conversation: %v, %v", conv.GetConvID(), err)
				break
			}
			attempt = 0
			pagination.Next = nil
			// Make sure we only reset `attempt` once
			reachedLast = true
			continue
		} else if attempt >= maxAttempts || reachedLast {
			s.Debug(ctx, "Could not find previous messages for prev pointers (of %v), after %v attempts. Giving up.", len(thread.Messages), attempt)
			break
		} else {
			s.Debug(ctx, "Could not find previous messages for prev pointers (of %v), attempt: %v of %v, retrying", len(thread.Messages), attempt, maxAttempts)
		}
		attempt++
	}

	for _, msg2 := range thread.Messages {
		if msg2.IsValid() {
			if err = s.checkConvID(ctx, conv, msg, msg2); err != nil {
				s.Debug(ctx, "Unable to checkConvID: %s", msg2.DebugString())
				return resMsg, err
			}
			break
		}
	}

	// Make an attempt to avoid changing anything in the input message. There
	// are a lot of shared pointers though, so this is
	header := msg.ClientHeader
	header.Prev = prevs
	updated := chat1.MessagePlaintext{
		ClientHeader: header,
		MessageBody:  msg.MessageBody,
	}
	return updated, nil
}

// Check that the {ConvID,ConvTriple,TlfName} of msgToSend matches both the ConvID and an existing message from the questionable ConvID.
// `convID` is the convID that `msgToSend` will be posted to.
// `msgReference` is a validated message from `convID`.
// The misstep that this method checks for is thus: The frontend may post a message while viewing an "untrusted inbox view".
// That message (msgToSend) will have the header.{TlfName,TlfPublic} set to the user's intention.
// But the header.Conv.{Tlfid,TopicType,TopicID} and the convID to post to may be erroneously set to a different conversation's values.
// This method checks that all of those fields match. Using `msgReference` as the validated link from {TlfName,TlfPublic} <-> ConvTriple.
func (s *BlockingSender) checkConvID(ctx context.Context, conv chat1.ConversationLocal,
	msgToSend chat1.MessagePlaintext, msgReference chat1.MessageUnboxed) error {

	headerQ := msgToSend.ClientHeader
	headerRef := msgReference.Valid().ClientHeader

	fmtConv := func(conv chat1.ConversationIDTriple) string { return hex.EncodeToString(conv.Hash()) }

	if !headerQ.Conv.Derivable(conv.GetConvID()) {
		s.Debug(ctx, "checkConvID: ConvID %s </- %s", fmtConv(headerQ.Conv), conv.GetConvID())
		return fmt.Errorf("ConversationID does not match reference message")
	}

	if !headerQ.Conv.Eq(headerRef.Conv) {
		s.Debug(ctx, "checkConvID: Conv %s != %s", fmtConv(headerQ.Conv), fmtConv(headerRef.Conv))
		return fmt.Errorf("ConversationID does not match reference message")
	}

	if headerQ.TlfPublic != headerRef.TlfPublic {
		s.Debug(ctx, "checkConvID: TlfPublic %s != %s", headerQ.TlfPublic, headerRef.TlfPublic)
		return fmt.Errorf("Chat public-ness does not match reference message")
	}
	if headerQ.TlfName != headerRef.TlfName {
		// If we're of type TEAM, we lookup the name info for the team and
		// verify it matches what is on the message itself. If we rename a
		// subteam the names between the current and reference message will
		// differ so we cannot rely on that.
		switch conv.GetMembersType() {
		case chat1.ConversationMembersType_TEAM:
			// Cannonicalize the given TlfName
			teamNameParsed, err := keybase1.TeamNameFromString(headerQ.TlfName)
			if err != nil {
				return fmt.Errorf("invalid team name: %v", err)
			}
			if info, err := CreateNameInfoSource(ctx, s.G(), conv.GetMembersType()).LookupName(ctx,
				conv.Info.Triple.Tlfid,
				conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC,
				headerQ.TlfName); err != nil {
				return err
			} else if info.CanonicalName != teamNameParsed.String() {
				return fmt.Errorf("TlfName does not match conversation tlf [%q vs ref %q]", teamNameParsed.String(), info.CanonicalName)
			}
		default:
			// Try normalizing both tlfnames if simple comparison fails because they may have resolved.
			if namesEq, err := s.boxer.CompareTlfNames(ctx, headerQ.TlfName, headerRef.TlfName,
				conv.GetMembersType(), headerQ.TlfPublic); err != nil {
				return err
			} else if !namesEq {
				s.Debug(ctx, "checkConvID: TlfName %s != %s", headerQ.TlfName, headerRef.TlfName)
				return fmt.Errorf("TlfName does not match reference message [%q vs ref %q]", headerQ.TlfName, headerRef.TlfName)
			}
		}
	}

	return nil
}

// Get all messages to be deleted, and attachments to delete.
// Returns (message, assetsToDelete, flipConvToDelete, error)
// If the entire conversation is cached locally, this will find all messages that should be deleted.
// If the conversation is not cached, this relies on the server to get old messages, so the server
// could omit messages. Those messages would then not be signed into the `Deletes` list. And their
// associated attachment assets would be left undeleted.
func (s *BlockingSender) getAllDeletedEdits(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msg chat1.MessagePlaintext) (chat1.MessagePlaintext, []chat1.Asset, *chat1.ConversationID, error) {

	var pendingAssetDeletes []chat1.Asset
	var deleteFlipConvID *chat1.ConversationID

	// Make sure this is a valid delete message
	if msg.ClientHeader.MessageType != chat1.MessageType_DELETE {
		return msg, nil, nil, nil
	}

	deleteTargetID := msg.ClientHeader.Supersedes
	if deleteTargetID == 0 {
		return msg, nil, nil, fmt.Errorf("getAllDeletedEdits: no supersedes specified")
	}

	// Get the one message to be deleted by ID.
	deleteTarget, err := s.getMessage(ctx, uid, convID, deleteTargetID, false /* resolveSupersedes */)
	if err != nil {
		return msg, nil, nil, err
	}
	bodyTyp, err := deleteTarget.MessageBody.MessageType()
	if err != nil {
		return msg, nil, nil, err
	}
	switch bodyTyp {
	case chat1.MessageType_REACTION:
		// Don't do anything here for reactions/unfurls, they can't be edited
		return msg, nil, nil, nil
	case chat1.MessageType_SYSTEM:
		msgSys := deleteTarget.MessageBody.System()
		typ, err := msgSys.SystemType()
		if err != nil {
			return msg, nil, nil, err
		}
		if !chat1.IsSystemMsgDeletableByDelete(typ) {
			return msg, nil, nil, fmt.Errorf("%v is not deletable", typ)
		}
	case chat1.MessageType_FLIP:
		flipConvID := deleteTarget.MessageBody.Flip().FlipConvID
		deleteFlipConvID = &flipConvID
	}

	// Delete all assets on the deleted message.
	// assetsForMessage logs instead of failing.
	pads2 := utils.AssetsForMessage(s.G(), deleteTarget.MessageBody)
	pendingAssetDeletes = append(pendingAssetDeletes, pads2...)

	// Time of the first message to be deleted.
	timeOfFirst := gregor1.FromTime(deleteTarget.ServerHeader.Ctime)
	// Time a couple seconds before that, because After querying is exclusive.
	timeBeforeFirst := gregor1.ToTime(timeOfFirst.Add(-2 * time.Second))

	// Get all the affected edits/AUs since just before the delete target.
	// Use ConvSource with an `After` which query. Fetches from a combination of local cache
	// and the server. This is an opportunity for the server to retain messages that should
	// have been deleted without getting caught.
	var tv chat1.ThreadView
	switch deleteTarget.ClientHeader.MessageType {
	case chat1.MessageType_UNFURL:
		// no edits/deletes possible here
	default:
		tv, err = s.G().ConvSource.Pull(ctx, convID, msg.ClientHeader.Sender,
			chat1.GetThreadReason_PREPARE, nil,
			&chat1.GetThreadQuery{
				MarkAsRead:   false,
				MessageTypes: []chat1.MessageType{chat1.MessageType_EDIT, chat1.MessageType_ATTACHMENTUPLOADED},
				After:        &timeBeforeFirst,
			}, nil)
		if err != nil {
			return msg, nil, nil, err
		}
	}

	// Get all affected messages to be deleted
	deletes := []chat1.MessageID{deleteTargetID}
	// Add in any reaction/unfurl messages the deleteTargetID may have
	deletes = append(deletes,
		append(deleteTarget.ServerHeader.ReactionIDs, deleteTarget.ServerHeader.UnfurlIDs...)...)
	for _, m := range tv.Messages {
		if !m.IsValid() {
			continue
		}
		body := m.Valid().MessageBody
		typ, err := body.MessageType()
		if err != nil {
			s.Debug(ctx, "getAllDeletedEdits: error getting message type: convID: %s msgID: %d err: %s",
				convID, m.GetMessageID(), err.Error())
			continue
		}
		switch typ {
		case chat1.MessageType_EDIT:
			if body.Edit().MessageID == deleteTargetID {
				deletes = append(deletes, m.GetMessageID())
			}
		case chat1.MessageType_ATTACHMENTUPLOADED:
			if body.Attachmentuploaded().MessageID == deleteTargetID {
				deletes = append(deletes, m.GetMessageID())

				// Delete all assets on AttachmentUploaded's for the deleted message.
				// assetsForMessage logs instead of failing.
				pads2 = utils.AssetsForMessage(s.G(), body)
				pendingAssetDeletes = append(pendingAssetDeletes, pads2...)
			}
		default:
			s.Debug(ctx, "getAllDeletedEdits: unexpected message type: convID: %s msgID: %d typ: %v",
				convID, m.GetMessageID(), typ)
			continue
		}
	}

	// Modify original delete message
	msg.ClientHeader.Deletes = deletes
	// NOTE: If we ever add more fields to MessageDelete, we'll need to be
	//       careful to preserve them here.
	msg.MessageBody = chat1.NewMessageBodyWithDelete(chat1.MessageDelete{MessageIDs: deletes})

	return msg, pendingAssetDeletes, deleteFlipConvID, nil
}

func (s *BlockingSender) getMessage(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, resolveSupersedes bool) (mvalid chat1.MessageUnboxedValid, err error) {
	reason := chat1.GetThreadReason_PREPARE
	messages, err := s.G().ConvSource.GetMessages(ctx, convID, uid, []chat1.MessageID{msgID},
		&reason, nil, resolveSupersedes)
	if err != nil {
		return mvalid, err
	}
	if len(messages) == 0 {
		return mvalid, fmt.Errorf("getMessage: message not found")
	}
	if !messages[0].IsValid() {
		st, err := messages[0].State()
		return mvalid, fmt.Errorf("getMessage returned invalid message: msgID: %v st: %v: err %v",
			msgID, st, err)
	}
	return messages[0].Valid(), nil
}

// If we are superseding an ephemeral message, we have to set the
// ephemeralMetadata on this superseder message.
func (s *BlockingSender) getSupersederEphemeralMetadata(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msg chat1.MessagePlaintext) (metadata *chat1.MsgEphemeralMetadata, err error) {

	if chat1.IsEphemeralNonSupersederType(msg.ClientHeader.MessageType) {
		// Leave whatever was previously set
		return msg.ClientHeader.EphemeralMetadata, nil
	} else if !chat1.IsEphemeralSupersederType(msg.ClientHeader.MessageType) {
		// clear out any defaults, this msg is a non-ephemeral type
		return nil, nil
	}

	supersededMsg, err := s.getMessage(ctx, uid, convID, msg.ClientHeader.Supersedes, false /* resolveSupersedes */)
	if err != nil {
		return nil, err
	}
	if supersededMsg.IsEphemeral() {
		metadata = supersededMsg.EphemeralMetadata()
		metadata.Lifetime = gregor1.ToDurationSec(supersededMsg.RemainingEphemeralLifetime(s.clock.Now()))
	}
	return metadata, nil
}

// processReactionMessage determines if we are trying to post a duplicate
// chat1.MessageType_REACTION, which is considered a chat1.MessageType_DELETE
// and updates the send appropriately.
func (s *BlockingSender) processReactionMessage(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msg chat1.MessagePlaintext) (clientHeader chat1.MessageClientHeader, body chat1.MessageBody, err error) {
	if msg.ClientHeader.MessageType != chat1.MessageType_REACTION {
		// nothing to do here
		return msg.ClientHeader, msg.MessageBody, nil
	}

	// We could either be posting a reaction or removing one that we already posted.
	supersededMsg, err := s.getMessage(ctx, uid, convID, msg.ClientHeader.Supersedes,
		true /* resolveSupersedes */)
	if err != nil {
		return clientHeader, body, err
	}
	found, reactionMsgID := supersededMsg.Reactions.HasReactionFromUser(msg.MessageBody.Reaction().Body,
		s.G().Env.GetUsername().String())
	if found {
		msg.ClientHeader.Supersedes = reactionMsgID
		msg.ClientHeader.MessageType = chat1.MessageType_DELETE
		msg.ClientHeader.Deletes = []chat1.MessageID{reactionMsgID}
		msg.MessageBody = chat1.NewMessageBodyWithDelete(chat1.MessageDelete{
			MessageIDs: []chat1.MessageID{reactionMsgID},
		})
	} else {
		// bookkeep the reaction used so we can keep track of the user's
		// popular reactions in the UI
		if err := storage.NewReacjiStore(s.G()).PutReacji(ctx, uid, msg.MessageBody.Reaction().Body); err != nil {
			s.Debug(ctx, "unable to put in ReacjiStore: %v", err)
		}
		// set an @ mention on the message body for the author of the message we are reacting to
		s.Debug(ctx, "processReactionMessage: adding target: %s", supersededMsg.ClientHeader.Sender)
		body := msg.MessageBody.Reaction().DeepCopy()
		body.TargetUID = &supersededMsg.ClientHeader.Sender
		msg.MessageBody = chat1.NewMessageBodyWithReaction(body)
	}

	return msg.ClientHeader, msg.MessageBody, nil
}

func (s *BlockingSender) checkTopicNameAndGetState(ctx context.Context, msg chat1.MessagePlaintext,
	membersType chat1.ConversationMembersType) (topicNameState *chat1.TopicNameState, convIDs []chat1.ConversationID, err error) {
	if msg.ClientHeader.MessageType != chat1.MessageType_METADATA {
		return topicNameState, convIDs, nil
	}
	tlfID := msg.ClientHeader.Conv.Tlfid
	topicType := msg.ClientHeader.Conv.TopicType
	switch topicType {
	case chat1.TopicType_EMOJICROSS:
		// skip this for this topic type
		return topicNameState, convIDs, nil
	default:
	}
	newTopicName := msg.MessageBody.Metadata().ConversationTitle
	convs, err := s.G().TeamChannelSource.GetChannelsFull(ctx, msg.ClientHeader.Sender, tlfID, topicType)
	if err != nil {
		return nil, nil, err
	}
	var validConvs []chat1.ConversationLocal
	for _, conv := range convs {
		// If we have a conv error consider the conv invalid. Exclude
		// the conv from out TopicNameState forcing the client to retry.
		if conv.Error == nil {
			if conv.GetTopicName() == "" {
				s.Debug(ctx, "checkTopicNameAndGetState: unnamed channel in play: %s", conv.GetConvID())
			}
			validConvs = append(validConvs, conv)
			convIDs = append(convIDs, conv.GetConvID())
		} else {
			s.Debug(ctx, "checkTopicNameAndGetState: skipping conv: %s, will cause an error from server",
				conv.GetConvID())
		}
		if conv.GetTopicName() == newTopicName {
			return nil, nil, DuplicateTopicNameError{Conv: conv}
		}
	}

	ts, err := GetTopicNameState(ctx, s.G(), s.DebugLabeler, validConvs,
		msg.ClientHeader.Sender, tlfID, topicType, membersType)
	if err != nil {
		return nil, nil, err
	}
	topicNameState = &ts
	return topicNameState, convIDs, nil
}

func (s *BlockingSender) resolveOutboxIDEdit(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msg *chat1.MessagePlaintext) error {
	if msg.SupersedesOutboxID == nil {
		return nil
	}
	s.Debug(ctx, "resolveOutboxIDEdit: resolving edit: outboxID: %s", msg.SupersedesOutboxID)
	typ, err := msg.MessageBody.MessageType()
	if err != nil {
		return err
	}
	if typ != chat1.MessageType_EDIT {
		return errors.New("supersedes outboxID only valid for edit messages")
	}
	body := msg.MessageBody.Edit()
	// try to find the message with the given outbox ID in the first 50 messages.
	tv, err := s.G().ConvSource.Pull(ctx, convID, uid, chat1.GetThreadReason_PREPARE, nil,
		&chat1.GetThreadQuery{
			MessageTypes:             []chat1.MessageType{chat1.MessageType_TEXT},
			DisableResolveSupersedes: true,
		}, &chat1.Pagination{Num: 50})
	if err != nil {
		return err
	}
	for _, m := range tv.Messages {
		if msg.SupersedesOutboxID.Eq(m.GetOutboxID()) {
			s.Debug(ctx, "resolveOutboxIDEdit: resolved edit: outboxID: %s messageID: %v",
				msg.SupersedesOutboxID, m.GetMessageID())
			msg.ClientHeader.Supersedes = m.GetMessageID()
			msg.MessageBody = chat1.NewMessageBodyWithEdit(chat1.MessageEdit{
				MessageID: m.GetMessageID(),
				Body:      body.Body,
			})
			return nil
		}
	}
	return errors.New("failed to find message to edit")
}

func (s *BlockingSender) handleReplyTo(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, replyTo *chat1.MessageID) (chat1.MessagePlaintext, error) {
	if replyTo == nil {
		return msg, nil
	}
	typ, err := msg.MessageBody.MessageType()
	if err != nil {
		s.Debug(ctx, "handleReplyTo: failed to get body type: %s", err)
		return msg, nil
	}
	switch typ {
	case chat1.MessageType_TEXT:
		s.Debug(ctx, "handleReplyTo: handling text message")
		header := msg.ClientHeader
		header.Supersedes = *replyTo
		reply, err := s.G().ChatHelper.GetMessage(ctx, uid, convID, *replyTo, false, nil)
		if err != nil {
			s.Debug(ctx, "handleReplyTo: failed to get reply message: %s", err)
			return msg, err
		}
		if !reply.IsValid() {
			s.Debug(ctx, "handleReplyTo: reply message invalid: %v %v", replyTo, err)
			return msg, nil
		}
		replyToUID := reply.Valid().ClientHeader.Sender
		newBody := msg.MessageBody.Text().DeepCopy()
		newBody.ReplyTo = replyTo
		newBody.ReplyToUID = &replyToUID
		return chat1.MessagePlaintext{
			ClientHeader:       header,
			MessageBody:        chat1.NewMessageBodyWithText(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}, nil
	default:
		s.Debug(ctx, "handleReplyTo: skipping message of type: %v", typ)
	}
	return msg, nil
}

func (s *BlockingSender) handleEmojis(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msg chat1.MessagePlaintext, topicType chat1.TopicType) (chat1.MessagePlaintext, error) {
	if topicType != chat1.TopicType_CHAT {
		return msg, nil
	}
	typ, err := msg.MessageBody.MessageType()
	if err != nil {
		s.Debug(ctx, "handleEmojis: failed to get body type: %s", err)
		return msg, nil
	}
	body := msg.MessageBody.TextForDecoration()
	if len(body) == 0 {
		return msg, nil
	}
	emojis, err := s.G().EmojiSource.Harvest(ctx, body, uid, convID, types.EmojiHarvestModeNormal)
	if err != nil {
		return msg, err
	}
	if len(emojis) == 0 {
		return msg, nil
	}
	ct := make(map[string]chat1.HarvestedEmoji, len(emojis))
	for _, emoji := range emojis {
		ct[emoji.Alias] = emoji
	}
	s.Debug(ctx, "handleEmojis: found %d emojis", len(ct))
	switch typ {
	case chat1.MessageType_TEXT:
		newBody := msg.MessageBody.Text().DeepCopy()
		newBody.Emojis = ct
		return chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithText(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}, nil
	case chat1.MessageType_REACTION:
		newBody := msg.MessageBody.Reaction().DeepCopy()
		newBody.Emojis = ct
		return chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithReaction(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}, nil
	case chat1.MessageType_EDIT:
		newBody := msg.MessageBody.Edit().DeepCopy()
		newBody.Emojis = ct
		return chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithEdit(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}, nil
	case chat1.MessageType_ATTACHMENT:
		newBody := msg.MessageBody.Attachment().DeepCopy()
		newBody.Emojis = ct
		return chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithAttachment(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}, nil
	case chat1.MessageType_HEADLINE:
		newBody := msg.MessageBody.Headline().DeepCopy()
		newBody.Emojis = ct
		return chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithHeadline(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}, nil
	}
	return msg, nil
}

func (s *BlockingSender) getUsernamesForMentions(ctx context.Context, uid gregor1.UID,
	conv *chat1.ConversationLocal) (res []string, err error) {
	if conv == nil {
		return nil, nil
	}
	defer s.Trace(ctx, &err, "getParticipantsForMentions")()
	// get the conv that we will look for @ mentions in
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		teamID, err := keybase1.TeamIDFromString(conv.Info.Triple.Tlfid.String())
		if err != nil {
			return res, err
		}
		team, err := teams.Load(ctx, s.G().ExternalG(), keybase1.LoadTeamArg{
			ID: teamID,
		})
		if err != nil {
			return res, err
		}
		members, err := teams.MembersDetails(ctx, s.G().ExternalG(), team)
		if err != nil {
			return res, err
		}
		for _, memb := range members {
			res = append(res, memb.Username)
		}
		return res, nil
	default:
		res = make([]string, 0, len(conv.Info.Participants))
		for _, p := range conv.Info.Participants {
			res = append(res, p.Username)
		}
		return res, nil
	}
}
func (s *BlockingSender) handleMentions(ctx context.Context, uid gregor1.UID, msg chat1.MessagePlaintext,
	conv *chat1.ConversationLocal) (res chat1.MessagePlaintext, atMentions []gregor1.UID, chanMention chat1.ChannelMention, err error) {
	if msg.ClientHeader.Conv.TopicType != chat1.TopicType_CHAT {
		return msg, atMentions, chanMention, nil
	}
	// Function to check that the header and body types match.
	// Call this before accessing the body.
	// Do not call this for TLFNAME which has no body.
	checkHeaderBodyTypeMatch := func() error {
		bodyType, err := msg.MessageBody.MessageType()
		if err != nil {
			return err
		}
		if msg.ClientHeader.MessageType != bodyType {
			return fmt.Errorf("cannot send message with mismatched header/body types: %v != %v",
				msg.ClientHeader.MessageType, bodyType)
		}
		return nil
	}
	atFromKnown := func(knowns []chat1.KnownUserMention) (res []gregor1.UID) {
		for _, known := range knowns {
			res = append(res, known.Uid)
		}
		return res
	}
	maybeToTeam := func(maybeMentions []chat1.MaybeMention) (res []chat1.KnownTeamMention) {
		for _, maybe := range maybeMentions {
			if s.G().TeamMentionLoader.IsTeamMention(ctx, uid, maybe, nil) {
				res = append(res, chat1.KnownTeamMention(maybe))
			}
		}
		return res
	}

	// find @ mentions
	getConvUsernames := func() ([]string, error) {
		return s.getUsernamesForMentions(ctx, uid, conv)
	}
	var knownUserMentions []chat1.KnownUserMention
	var maybeMentions []chat1.MaybeMention
	switch msg.ClientHeader.MessageType {
	case chat1.MessageType_TEXT:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return res, atMentions, chanMention, err
		}
		knownUserMentions, maybeMentions, chanMention = utils.GetTextAtMentionedItems(ctx, s.G(),
			uid, conv.GetConvID(), msg.MessageBody.Text(), getConvUsernames, &s.DebugLabeler)
		atMentions = atFromKnown(knownUserMentions)
		newBody := msg.MessageBody.Text().DeepCopy()
		newBody.TeamMentions = maybeToTeam(maybeMentions)
		newBody.UserMentions = knownUserMentions
		res = chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithText(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}
	case chat1.MessageType_ATTACHMENT:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return res, atMentions, chanMention, err
		}
		knownUserMentions, maybeMentions, chanMention = utils.ParseAtMentionedItems(ctx, s.G(),
			msg.MessageBody.Attachment().GetTitle(), nil, getConvUsernames)
		atMentions = atFromKnown(knownUserMentions)
		newBody := msg.MessageBody.Attachment().DeepCopy()
		newBody.TeamMentions = maybeToTeam(maybeMentions)
		newBody.UserMentions = knownUserMentions
		res = chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithAttachment(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}
	case chat1.MessageType_FLIP:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return res, atMentions, chanMention, err
		}
		knownUserMentions, maybeMentions, chanMention = utils.ParseAtMentionedItems(ctx, s.G(),
			msg.MessageBody.Flip().Text, nil, getConvUsernames)
		atMentions = atFromKnown(knownUserMentions)
		newBody := msg.MessageBody.Flip().DeepCopy()
		newBody.TeamMentions = maybeToTeam(maybeMentions)
		newBody.UserMentions = knownUserMentions
		res = chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithFlip(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}
	case chat1.MessageType_EDIT:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return res, atMentions, chanMention, err
		}
		knownUserMentions, maybeMentions, chanMention = utils.ParseAtMentionedItems(ctx, s.G(),
			msg.MessageBody.Edit().Body, nil, getConvUsernames)
		atMentions = atFromKnown(knownUserMentions)
		newBody := msg.MessageBody.Edit().DeepCopy()
		newBody.TeamMentions = maybeToTeam(maybeMentions)
		newBody.UserMentions = knownUserMentions
		res = chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithEdit(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}
	case chat1.MessageType_REACTION:
		targetUID := msg.MessageBody.Reaction().TargetUID
		if targetUID != nil {
			atMentions = []gregor1.UID{*targetUID}
		}
		res = msg
	case chat1.MessageType_SYSTEM:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return res, atMentions, chanMention, err
		}
		res = msg
		atMentions, chanMention, _ = utils.SystemMessageMentions(ctx, s.G(), uid, msg.MessageBody.System())
	default:
		res = msg
	}
	return res, atMentions, chanMention, nil
}

// Prepare a message to be sent.
// Returns (boxedMessage, pendingAssetDeletes, error)
func (s *BlockingSender) Prepare(ctx context.Context, plaintext chat1.MessagePlaintext,
	membersType chat1.ConversationMembersType, conv *chat1.ConversationLocal,
	inopts *chat1.SenderPrepareOptions) (res types.SenderPrepareResult, err error) {

	if plaintext.ClientHeader.MessageType == chat1.MessageType_NONE {
		return res, fmt.Errorf("cannot send message without type")
	}
	// set default options unless some are given to us
	var opts chat1.SenderPrepareOptions
	if inopts != nil {
		opts = *inopts
	}

	msg, uid, err := s.addSenderToMessage(plaintext)
	if err != nil {
		return res, err
	}

	// Make sure our delete message gets everything it should
	var pendingAssetDeletes []chat1.Asset
	var deleteFlipConvID *chat1.ConversationID
	if conv != nil {
		convID := conv.GetConvID()
		msg.ClientHeader.Conv = conv.Info.Triple
		if len(msg.ClientHeader.TlfName) == 0 {
			msg.ClientHeader.TlfName = conv.Info.TlfName
			msg.ClientHeader.TlfPublic = conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC
		}
		s.Debug(ctx, "Prepare: performing convID based checks")

		// Check for outboxID based edits
		if err = s.resolveOutboxIDEdit(ctx, uid, convID, &msg); err != nil {
			s.Debug(ctx, "Prepare: error resolving outboxID edit: %s", err)
			return res, err
		}

		// Add and check prev pointers
		msg, err = s.addPrevPointersAndCheckConvID(ctx, msg, *conv)
		if err != nil {
			s.Debug(ctx, "Prepare: error adding prev pointers: %s", err)
			return res, err
		}

		// First process the reactionMessage in case we convert it to a delete
		header, body, err := s.processReactionMessage(ctx, uid, convID, msg)
		if err != nil {
			s.Debug(ctx, "Prepare: error processing reactions: %s", err)
			return res, err
		}
		msg.ClientHeader = header
		msg.MessageBody = body

		// Handle reply to
		if msg, err = s.handleReplyTo(ctx, uid, convID, msg, opts.ReplyTo); err != nil {
			s.Debug(ctx, "Prepare: error processing reply: %s", err)
			return res, err
		}

		// Handle cross team emoji
		if msg, err = s.handleEmojis(ctx, uid, convID, msg, conv.GetTopicType()); err != nil {
			s.Debug(ctx, "Prepare: error processing cross team emoji: %s", err)
			return res, err
		}

		// Be careful not to shadow (msg, pendingAssetDeletes, deleteFlipConvID) with this assignment.
		msg, pendingAssetDeletes, deleteFlipConvID, err = s.getAllDeletedEdits(ctx, uid, convID, msg)
		if err != nil {
			s.Debug(ctx, "Prepare: error getting deleted edits: %s", err)
			return res, err
		}

		if !conv.GetTopicType().EphemeralAllowed() {
			if msg.EphemeralMetadata() != nil {
				return res, fmt.Errorf("%v messages cannot be ephemeral", conv.GetTopicType())
			}
		} else {
			// If no ephemeral data set, then let's double check to make sure
			// no exploding policy or Gregor state should set it if it's required.
			if msg.EphemeralMetadata() == nil &&
				chat1.IsEphemeralNonSupersederType(msg.ClientHeader.MessageType) &&
				conv.GetTopicType().EphemeralRequired() {
				s.Debug(ctx, "Prepare: attempting to set ephemeral policy from conversation")
				elf, err := utils.EphemeralLifetimeFromConv(ctx, s.G(), *conv)
				if err != nil {
					s.Debug(ctx, "Prepare: failed to get ephemeral lifetime from conv: %s", err)
					elf = nil
				}
				if elf != nil {
					s.Debug(ctx, "Prepare: setting ephemeral lifetime from conv: %v", *elf)
					msg.ClientHeader.EphemeralMetadata = &chat1.MsgEphemeralMetadata{
						Lifetime: *elf,
					}
				}
			}

			msg.ClientHeader.EphemeralMetadata, err = s.getSupersederEphemeralMetadata(ctx, uid, convID, msg)
			if err != nil {
				s.Debug(ctx, "Prepare: error getting superseder ephemeral metadata: %s", err)
				return res, err
			}
		}
	}

	// Make sure it is a proper length
	if err := msgchecker.CheckMessagePlaintext(msg); err != nil {
		s.Debug(ctx, "Prepare: error checking message plaintext: %s", err)
		return res, err
	}

	// Get topic name state if this is a METADATA message, so that we avoid any races to the
	// server
	var topicNameState *chat1.TopicNameState
	var topicNameStateConvs []chat1.ConversationID
	if !opts.SkipTopicNameState {
		if topicNameState, topicNameStateConvs, err = s.checkTopicNameAndGetState(ctx, msg, membersType); err != nil {
			s.Debug(ctx, "Prepare: error checking topic name state: %s", err)
			return res, err
		}
	}

	// handle mentions
	var atMentions []gregor1.UID
	var chanMention chat1.ChannelMention
	if msg, atMentions, chanMention, err = s.handleMentions(ctx, uid, msg, conv); err != nil {
		s.Debug(ctx, "Prepare: error handling mentions: %s", err)
		return res, err
	}

	// encrypt the message
	skp, err := s.getSigningKeyPair(ctx)
	if err != nil {
		s.Debug(ctx, "Prepare: error getting signing key pair: %s", err)
		return res, err
	}

	// If we are sending a message, and we think the conversation is a KBFS conversation, then set a label
	// on the client header in case this conversation gets upgraded to impteam.
	msg.ClientHeader.KbfsCryptKeysUsed = new(bool)
	if membersType == chat1.ConversationMembersType_KBFS {
		s.Debug(ctx, "setting KBFS crypt keys used flag")
		*msg.ClientHeader.KbfsCryptKeysUsed = true
	} else {
		*msg.ClientHeader.KbfsCryptKeysUsed = false
	}

	var convID *chat1.ConversationID
	if conv != nil {
		id := conv.GetConvID()
		convID = &id
	}
	botUIDs, err := s.applyTeamBotSettings(ctx, uid, &msg, convID, membersType, atMentions, opts)
	if err != nil {
		s.Debug(ctx, "Prepare: failed to apply team bot settings: %s", err)
		return res, err
	}
	if len(botUIDs) > 0 {
		// TODO HOTPOT-330 Add support for "hidden" messages for multiple bots
		msg.ClientHeader.BotUID = &botUIDs[0]
	}
	s.Debug(ctx, "applyTeamBotSettings: matched %d bots, applied %v", len(botUIDs), msg.ClientHeader.BotUID)

	encInfo, err := s.boxer.GetEncryptionInfo(ctx, &msg, membersType, skp)
	if err != nil {
		s.Debug(ctx, "Prepare: error getting encryption info: %s", err)
		return res, err
	}
	boxed, err := s.boxer.BoxMessage(ctx, msg, membersType, skp, &encInfo)
	if err != nil {
		s.Debug(ctx, "Prepare: error boxing message: %s", err)
		return res, err
	}
	return types.SenderPrepareResult{
		Boxed:               boxed,
		EncryptionInfo:      encInfo,
		PendingAssetDeletes: pendingAssetDeletes,
		DeleteFlipConv:      deleteFlipConvID,
		AtMentions:          atMentions,
		ChannelMention:      chanMention,
		TopicNameState:      topicNameState,
		TopicNameStateConvs: topicNameStateConvs,
	}, nil
}

func (s *BlockingSender) applyTeamBotSettings(ctx context.Context, uid gregor1.UID,
	msg *chat1.MessagePlaintext, convID *chat1.ConversationID, membersType chat1.ConversationMembersType,
	atMentions []gregor1.UID, opts chat1.SenderPrepareOptions) ([]gregor1.UID, error) {
	// no bots in KBFS convs
	if membersType == chat1.ConversationMembersType_KBFS {
		return nil, nil
	}

	// Skip checks if botUID already set
	if msg.ClientHeader.BotUID != nil {
		s.Debug(ctx, "applyTeamBotSettings: found existing botUID %v", msg.ClientHeader.BotUID)
		// verify this value is actually a restricted bot of the team.
		teamBotSettings, err := CreateNameInfoSource(ctx, s.G(), membersType).TeamBotSettings(ctx,
			msg.ClientHeader.TlfName, msg.ClientHeader.Conv.Tlfid, membersType, msg.ClientHeader.TlfPublic)
		if err != nil {
			return nil, err
		}
		for uv := range teamBotSettings {
			botUID := gregor1.UID(uv.Uid.ToBytes())
			if botUID.Eq(*msg.ClientHeader.BotUID) {
				s.Debug(ctx, "applyTeamBotSettings: existing botUID matches, short circuiting.")
				return nil, nil
			}
		}
		s.Debug(ctx, "applyTeamBotSettings: existing botUID %v does not match any bot, clearing")
		// Caller was mistaken, this uid is not actually a bot so we unset the
		// value.
		msg.ClientHeader.BotUID = nil
	}

	// Check if we are superseding a bot message. If so, just take what the
	// superseded has. Don't automatically key for replies, run the normal checks.
	if msg.ClientHeader.Supersedes > 0 && opts.ReplyTo == nil && convID != nil {
		target, err := s.getMessage(ctx, uid, *convID, msg.ClientHeader.Supersedes, false /*resolveSupersedes */)
		if err != nil {
			return nil, err
		}
		botUID := target.ClientHeader.BotUID
		if botUID == nil {
			s.Debug(ctx, "applyTeamBotSettings: skipping, supersedes has nil botUID from msgID %d", msg.ClientHeader.Supersedes)
			return nil, nil
		}
		s.Debug(ctx, "applyTeamBotSettings: supersedes botUID %v from msgID %d", botUID, msg.ClientHeader.Supersedes)
		return []gregor1.UID{*botUID}, nil
	}

	// Fetch the bot settings, if any
	teamBotSettings, err := CreateNameInfoSource(ctx, s.G(), membersType).TeamBotSettings(ctx,
		msg.ClientHeader.TlfName, msg.ClientHeader.Conv.Tlfid, membersType, msg.ClientHeader.TlfPublic)
	if err != nil {
		return nil, err
	}

	mentionMap := make(map[string]struct{})
	for _, uid := range atMentions {
		mentionMap[uid.String()] = struct{}{}
	}

	var botUIDs []gregor1.UID
	for uv, botSettings := range teamBotSettings {
		botUID := gregor1.UID(uv.Uid.ToBytes())

		// If the bot is the sender encrypt only for them.
		if msg.ClientHeader.Sender.Eq(botUID) {
			if convID == nil || botSettings.ConvIDAllowed(convID.String()) {
				return []gregor1.UID{botUID}, nil
			}
			// Bot channel restrictions only apply to CHAT types.
			conv, err := utils.GetVerifiedConv(ctx, s.G(), uid, *convID, types.InboxSourceDataSourceAll)
			if err == nil && conv.GetTopicType() != chat1.TopicType_CHAT {
				return []gregor1.UID{botUID}, nil
			}
			return nil, NewRestrictedBotChannelError()
		}

		isMatch, err := bots.ApplyTeamBotSettings(ctx, s.G(), botUID, botSettings, *msg,
			convID, mentionMap, s.DebugLabeler)
		if err != nil {
			return nil, err
		}
		s.Debug(ctx, "applyTeamBotSettings: applied settings for %+v for botuid: %v, senderUID: %v, convID: %v isMatch: %v",
			botSettings, uv.Uid, msg.ClientHeader.Sender, convID, isMatch)
		if isMatch {
			botUIDs = append(botUIDs, botUID)
		}
	}
	return botUIDs, nil
}

func (s *BlockingSender) getSigningKeyPair(ctx context.Context) (kp libkb.NaclSigningKeyPair, err error) {
	// get device signing key for this user
	signingKey, err := engine.GetMySecretKey(ctx, s.G().ExternalG(),
		libkb.DeviceSigningKeyType, "sign chat message")
	if err != nil {
		return libkb.NaclSigningKeyPair{}, err
	}
	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return libkb.NaclSigningKeyPair{}, libkb.KeyCannotSignError{}
	}

	return kp, nil
}

// deleteAssets deletes assets from s3.
// Logs but does not return errors. Assets may be left undeleted.
func (s *BlockingSender) deleteAssets(ctx context.Context, convID chat1.ConversationID, assets []chat1.Asset) error {
	// get s3 params from server
	params, err := s.getRi().GetS3Params(ctx, convID)
	if err != nil {
		s.G().Log.Warning("error getting s3 params: %s", err)
		return nil
	}

	if err := s.store.DeleteAssets(ctx, params, s, assets); err != nil {
		s.G().Log.Warning("error deleting assets: %s", err)

		// there's no way to get asset information after this point.
		// any assets not deleted will be stranded on s3.

		return nil
	}

	s.G().Log.Debug("deleted %d assets", len(assets))
	return nil
}

// Sign implements github.com/keybase/go/chat/s3.Signer interface.
func (s *BlockingSender) Sign(payload []byte) ([]byte, error) {
	arg := chat1.S3SignArg{
		Payload: payload,
		Version: 1,
	}
	return s.getRi().S3Sign(context.Background(), arg)
}

func (s *BlockingSender) presentUIItem(ctx context.Context, uid gregor1.UID, conv *chat1.ConversationLocal) (res *chat1.InboxUIItem) {
	if conv != nil {
		pc := utils.PresentConversationLocal(ctx, s.G(), uid, *conv, utils.PresentParticipantsModeSkip)
		res = &pc
	}
	return res
}

func (s *BlockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID,
	outboxID *chat1.OutboxID, sendOpts *chat1.SenderSendOptions, prepareOpts *chat1.SenderPrepareOptions) (obid chat1.OutboxID, boxed *chat1.MessageBoxed, err error) {
	defer s.Trace(ctx, &err, fmt.Sprintf("Send(%s)", convID))()
	defer utils.SuspendComponent(ctx, s.G(), s.G().InboxSource)()

	// Get conversation metadata first. If we can't find it, we will just attempt to join
	// the conversation in case that is an option. If it succeeds, then we just keep going,
	// otherwise we give up and return an error.
	var conv chat1.ConversationLocal
	sender := gregor1.UID(s.G().Env.GetUID().ToBytes())
	conv, err = utils.GetVerifiedConv(ctx, s.G(), sender, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		s.Debug(ctx, "Send: error getting conversation metadata: %v", err)
		return nil, nil, err
	}
	s.Debug(ctx, "Send: uid: %s in conversation %s (tlfName: %s) with status: %v", sender,
		conv.GetConvID(), conv.Info.TlfName, conv.ReaderInfo.Status)

	// If we are in preview mode, then just join the conversation right now.
	switch conv.ReaderInfo.Status {
	case chat1.ConversationMemberStatus_PREVIEW, chat1.ConversationMemberStatus_NEVER_JOINED:
		switch msg.ClientHeader.MessageType {
		case chat1.MessageType_JOIN,
			chat1.MessageType_LEAVE,
			chat1.MessageType_HEADLINE,
			chat1.MessageType_METADATA,
			chat1.MessageType_SYSTEM: // don't need to join to send a system message.
			// pass so we don't loop between Send and Join/Leave or join when
			// updating the metadata/headline.
		default:
			s.Debug(ctx, "Send: user is in mode: %v, joining conversation", conv.ReaderInfo.Status)
			if err = JoinConversation(ctx, s.G(), s.DebugLabeler, s.getRi, sender, convID); err != nil {
				return nil, nil, err
			}
		}
	default:
		// do nothing
	}

	var prepareRes types.SenderPrepareResult
	var plres chat1.PostRemoteRes
	// If we get a ChatStalePreviousStateError we blow away in the box cache
	// once to allow the retry to get fresh data.
	clearedCache := false
	// Try this up to 5 times in case we are trying to set the topic name, and the topic name
	// state is moving around underneath us.
	for i := 0; i < 5; i++ {
		// Add a bunch of stuff to the message (like prev pointers, sender info, ...)
		if prepareRes, err = s.Prepare(ctx, msg, conv.GetMembersType(), &conv, prepareOpts); err != nil {
			s.Debug(ctx, "Send: error in Prepare: %s", err)
			return nil, nil, err
		}
		boxed = &prepareRes.Boxed

		// Log some useful information about the message we are sending
		obidstr := "(none)"
		if boxed.ClientHeader.OutboxID != nil {
			obidstr = boxed.ClientHeader.OutboxID.String()
		}
		s.Debug(ctx, "Send: sending message: convID: %s outboxID: %s", convID, obidstr)

		// Keep trying if we get an error on topicNameState for a fixed number of times
		rarg := chat1.PostRemoteArg{
			ConversationID: convID,
			MessageBoxed:   *boxed,
			AtMentions:     prepareRes.AtMentions,
			ChannelMention: prepareRes.ChannelMention,
			TopicNameState: prepareRes.TopicNameState,
			JoinMentionsAs: sendOpts.GetJoinMentionsAs(),
		}
		plres, err = s.getRi().PostRemote(ctx, rarg)
		if err != nil {
			switch e := err.(type) {
			case libkb.ChatStalePreviousStateError:
				// If we hit the stale previous state error, that means we should try again, since our view is
				// out of date.
				s.Debug(ctx, "Send: failed because of stale previous state, trying the whole thing again")
				if !clearedCache {
					s.Debug(ctx, "Send: clearing inbox cache to retry stale previous state")
					if err := s.G().InboxSource.Clear(ctx, sender, &types.ClearOpts{
						SendLocalAdminNotification: true,
						Reason:                     "stale previous topic state",
					}); err != nil {
						s.Debug(ctx, "Send: error clearing: %+v", err)
					}
					s.Debug(ctx, "Send: clearing conversation cache to retry stale previous state: %d convs",
						len(prepareRes.TopicNameStateConvs))
					for _, convID := range prepareRes.TopicNameStateConvs {
						if err := s.G().ConvSource.Clear(ctx, convID, sender, nil); err != nil {
							s.Debug(ctx, "Send: error clearing: %v %+v", convID, err)
						}
					}
					clearedCache = true
				}
				continue
			case libkb.ChatEphemeralRetentionPolicyViolatedError:
				s.Debug(ctx, "Send: failed because of invalid ephemeral policy, trying the whole thing again")
				var cerr error
				conv, cerr = utils.GetVerifiedConv(ctx, s.G(), sender, convID,
					types.InboxSourceDataSourceRemoteOnly)
				if cerr != nil {
					return nil, nil, cerr
				}
				continue
			case libkb.EphemeralPairwiseMACsMissingUIDsError:
				s.Debug(ctx, "Send: failed because of missing KIDs for pairwise MACs, reloading UPAKs for %v and retrying.", e.UIDs)
				err := utils.ForceReloadUPAKsForUIDs(ctx, s.G(), e.UIDs)
				if err != nil {
					s.Debug(ctx, "Send: error forcing reloads: %+v", err)
				}
				continue
			default:
				s.Debug(ctx, "Send: failed to PostRemote, bailing: %s", err)
				return nil, nil, err
			}
		}
		boxed.ServerHeader = &plres.MsgHeader

		// Delete assets associated with a delete operation.
		// Logs instead of returning an error. Assets can be left undeleted.
		if len(prepareRes.PendingAssetDeletes) > 0 {
			err = s.deleteAssets(ctx, convID, prepareRes.PendingAssetDeletes)
			if err != nil {
				s.Debug(ctx, "Send: failure in deleteAssets: %s", err)
			}
		}

		if prepareRes.DeleteFlipConv != nil {
			_, err = s.getRi().DeleteConversation(ctx, *prepareRes.DeleteFlipConv)
			if err != nil {
				s.Debug(ctx, "Send: failure in DeleteConversation: %s", err)
			}
		}
		break
	}
	if err != nil {
		return nil, nil, err
	}

	// If this message was sent from the Outbox, then we can remove it now
	if boxed.ClientHeader.OutboxID != nil {
		if _, err = storage.NewOutbox(s.G(), sender).RemoveMessage(ctx, *boxed.ClientHeader.OutboxID); err != nil {
			s.Debug(ctx, "unable to remove outbox message: %v", err)
		}
	}

	// Write new message out to cache and other followup
	var cerr error
	var convLocal *chat1.ConversationLocal
	s.Debug(ctx, "sending local updates to chat sources")
	// unbox using encryption info we already have
	unboxedMsg, err := s.boxer.UnboxMessage(ctx, *boxed, conv, &prepareRes.EncryptionInfo)
	if err != nil {
		s.Debug(ctx, "Send: failed to unbox sent message: %s", err)
	} else {
		if cerr = s.G().ConvSource.PushUnboxed(ctx, conv, boxed.ClientHeader.Sender,
			[]chat1.MessageUnboxed{unboxedMsg}); cerr != nil {
			s.Debug(ctx, "Send: failed to push new message into convsource: %s", err)
		}
	}
	if convLocal, err = s.G().InboxSource.NewMessage(ctx, boxed.ClientHeader.Sender, 0, convID,
		*boxed, nil); err != nil {
		s.Debug(ctx, "Send: failed to update inbox: %s", err)
	}
	// Send up to frontend
	if cerr == nil && boxed.GetMessageType() != chat1.MessageType_LEAVE {
		unboxedMsg, err = NewReplyFiller(s.G()).FillSingle(ctx, boxed.ClientHeader.Sender, convID,
			unboxedMsg)
		if err != nil {
			s.Debug(ctx, "Send: failed to fill reply: %s", err)
		}
		activity := chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
			Message: utils.PresentMessageUnboxed(ctx, s.G(), unboxedMsg, boxed.ClientHeader.Sender,
				convID),
			ConvID:                     convID,
			DisplayDesktopNotification: false,
			Conv:                       s.presentUIItem(ctx, boxed.ClientHeader.Sender, convLocal),
		})
		s.G().ActivityNotifier.Activity(ctx, boxed.ClientHeader.Sender, conv.GetTopicType(), &activity,
			chat1.ChatActivitySource_LOCAL)
	}
	if conv.GetTopicType() == chat1.TopicType_CHAT {
		// Unfurl
		go s.G().Unfurler.UnfurlAndSend(globals.BackgroundChatCtx(ctx, s.G()), boxed.ClientHeader.Sender,
			convID, unboxedMsg)
		// Start tracking any live location sends
		if unboxedMsg.IsValid() && unboxedMsg.GetMessageType() == chat1.MessageType_TEXT &&
			unboxedMsg.Valid().MessageBody.Text().LiveLocation != nil {
			if unboxedMsg.Valid().MessageBody.Text().LiveLocation.EndTime.IsZero() {
				s.G().LiveLocationTracker.GetCurrentPosition(ctx, conv.GetConvID(),
					unboxedMsg.GetMessageID())
			} else {
				s.G().LiveLocationTracker.StartTracking(ctx, conv.GetConvID(), unboxedMsg.GetMessageID(),
					gregor1.FromTime(unboxedMsg.Valid().MessageBody.Text().LiveLocation.EndTime))
			}
		}
		if conv.GetMembersType() == chat1.ConversationMembersType_TEAM {
			teamID, err := keybase1.TeamIDFromString(conv.Info.Triple.Tlfid.String())
			if err != nil {
				s.Debug(ctx, "Send: failed to get team ID: %v", err)
			} else {
				go s.G().JourneyCardManager.SentMessage(globals.BackgroundChatCtx(ctx, s.G()), sender, teamID, convID)
			}
		}
	}
	return nil, boxed, nil
}

type NonblockingSender struct {
	globals.Contextified
	utils.DebugLabeler
	sender types.Sender
}

var _ types.Sender = (*NonblockingSender)(nil)

func NewNonblockingSender(g *globals.Context, sender types.Sender) *NonblockingSender {
	s := &NonblockingSender{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "NonblockingSender", false),
		sender:       sender,
	}
	return s
}

func (s *NonblockingSender) Prepare(ctx context.Context, msg chat1.MessagePlaintext,
	membersType chat1.ConversationMembersType, conv *chat1.ConversationLocal,
	opts *chat1.SenderPrepareOptions) (types.SenderPrepareResult, error) {
	return s.sender.Prepare(ctx, msg, membersType, conv, opts)
}

func (s *NonblockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID, outboxID *chat1.OutboxID,
	sendOpts *chat1.SenderSendOptions, prepareOpts *chat1.SenderPrepareOptions) (chat1.OutboxID, *chat1.MessageBoxed, error) {
	uid, err := utils.AssertLoggedInUID(ctx, s.G())
	if err != nil {
		return nil, nil, err
	}
	// The strategy here is to select the larger prev between what the UI provides, and what we have
	// stored locally. If we just use the UI version, then we can race for creating ordinals in
	// Outbox.PushMessage. However, in rare cases we might not have something locally, in that case just
	// fallback to the UI provided number.
	var storedPrev chat1.MessageID
	conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceLocalOnly)
	if err != nil {
		s.Debug(ctx, "Send: failed to get local inbox info: %s", err)
	} else {
		storedPrev = conv.Conv.GetMaxMessageID()
	}
	if storedPrev > clientPrev {
		clientPrev = storedPrev
	}
	if clientPrev == 0 {
		clientPrev = 1
	}
	s.Debug(ctx, "Send: using prevMsgID: %d", clientPrev)
	msg.ClientHeader.OutboxInfo = &chat1.OutboxInfo{
		Prev:        clientPrev,
		ComposeTime: gregor1.ToTime(time.Now()),
	}
	identifyBehavior, _, _ := globals.CtxIdentifyMode(ctx)
	obr, err := s.G().MessageDeliverer.Queue(ctx, convID, msg, outboxID, sendOpts, prepareOpts,
		identifyBehavior)
	if err != nil {
		return obr.OutboxID, nil, err
	}
	return obr.OutboxID, nil, nil
}

func (s *NonblockingSender) SendUnfurlNonblock(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID, outboxID chat1.OutboxID) (chat1.OutboxID, error) {
	res, _, err := s.Send(ctx, convID, msg, clientPrev, &outboxID, nil, nil)
	return res, err
}
