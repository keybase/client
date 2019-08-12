package chat

import (
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/attachments"
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
		DebugLabeler:      utils.NewDebugLabeler(g.GetLog(), "BlockingSender", false),
		getRi:             getRi,
		boxer:             boxer,
		store:             attachments.NewS3Store(g.GlobalContext, g.GetRuntimeDir()),
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
			chat1.GetThreadReason_PREPARE,
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
			if err := s.G().ConvSource.Clear(ctx, conv.GetConvID(), msg.ClientHeader.Sender); err != nil {
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
				conv.Info.Visibility == keybase1.TLFVisibility_PUBLIC); err != nil {
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
// Returns (message, assetsToDelete, error)
// If the entire conversation is cached locally, this will find all messages that should be deleted.
// If the conversation is not cached, this relies on the server to get old messages, so the server
// could omit messages. Those messages would then not be signed into the `Deletes` list. And their
// associated attachment assets would be left undeleted.
func (s *BlockingSender) getAllDeletedEdits(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msg chat1.MessagePlaintext) (chat1.MessagePlaintext, []chat1.Asset, error) {

	var pendingAssetDeletes []chat1.Asset

	// Make sure this is a valid delete message
	if msg.ClientHeader.MessageType != chat1.MessageType_DELETE {
		return msg, nil, nil
	}

	deleteTargetID := msg.ClientHeader.Supersedes
	if deleteTargetID == 0 {
		return msg, nil, fmt.Errorf("getAllDeletedEdits: no supersedes specified")
	}

	// Get the one message to be deleted by ID.
	deleteTarget, err := s.getMessage(ctx, uid, convID, deleteTargetID, false /* resolveSupersedes */)
	if err != nil {
		return msg, nil, err
	}
	if deleteTarget.ClientHeader.MessageType == chat1.MessageType_REACTION {
		// Don't do anything here for reactions, they can't be edited
		return msg, nil, nil
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
	tv, err := s.G().ConvSource.Pull(ctx, convID, msg.ClientHeader.Sender,
		chat1.GetThreadReason_PREPARE,
		&chat1.GetThreadQuery{
			MarkAsRead:   false,
			MessageTypes: []chat1.MessageType{chat1.MessageType_EDIT, chat1.MessageType_ATTACHMENTUPLOADED},
			After:        &timeBeforeFirst,
		}, nil)
	if err != nil {
		return msg, nil, err
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

	return msg, pendingAssetDeletes, nil
}

func (s *BlockingSender) getMessage(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, resolveSupersedes bool) (mvalid chat1.MessageUnboxedValid, err error) {
	reason := chat1.GetThreadReason_PREPARE
	messages, err := GetMessages(ctx, s.G(), uid, convID, []chat1.MessageID{msgID}, resolveSupersedes, &reason)
	if err != nil {
		return mvalid, err
	}
	if len(messages) != 1 || !messages[0].IsValid() {
		return mvalid, fmt.Errorf("getMessage returned multiple messages or an invalid result for msgID: %v, numMsgs: %v", msgID, len(messages))
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
	supersededMsg, err := s.getMessage(ctx, uid, convID, msg.ClientHeader.Supersedes, true /* resolveSupersedes */)
	if err != nil {
		return clientHeader, body, err
	}
	found, reactionMsgID := supersededMsg.Reactions.HasReactionFromUser(msg.MessageBody.Reaction().Body, s.G().Env.GetUsername().String())
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
	}

	return msg.ClientHeader, msg.MessageBody, nil
}

func (s *BlockingSender) checkTopicNameAndGetState(ctx context.Context, msg chat1.MessagePlaintext,
	membersType chat1.ConversationMembersType) (topicNameState *chat1.TopicNameState, err error) {
	if msg.ClientHeader.MessageType == chat1.MessageType_METADATA {
		tlfID := msg.ClientHeader.Conv.Tlfid
		topicType := msg.ClientHeader.Conv.TopicType
		newTopicName := msg.MessageBody.Metadata().ConversationTitle
		convs, err := s.G().TeamChannelSource.GetChannelsFull(ctx, msg.ClientHeader.Sender, tlfID, topicType)
		if err != nil {
			return topicNameState, err
		}
		for _, conv := range convs {
			if conv.Info.TopicName == newTopicName {
				return nil, DuplicateTopicNameError{TopicName: newTopicName}
			}
		}

		ts, err := GetTopicNameState(ctx, s.G(), s.DebugLabeler, convs,
			msg.ClientHeader.Sender, tlfID, topicType, membersType)
		if err != nil {
			return topicNameState, err
		}
		topicNameState = &ts
	}
	return topicNameState, nil
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
	tv, err := s.G().ConvSource.Pull(ctx, convID, uid, chat1.GetThreadReason_PREPARE,
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
			s.Debug(ctx, "handleReplyTo: reply message invalid: %s", err)
			return msg, nil
		}
		replyToUID := reply.Valid().ClientHeader.Sender
		return chat1.MessagePlaintext{
			ClientHeader: header,
			MessageBody: chat1.NewMessageBodyWithText(chat1.MessageText{
				Body:       msg.MessageBody.Text().Body,
				Payments:   msg.MessageBody.Text().Payments,
				ReplyTo:    replyTo,
				ReplyToUID: &replyToUID,
			}),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}, nil
	default:
		s.Debug(ctx, "handleReplyTo: skipping message of type: %v", typ)
	}
	return msg, nil
}

func (s *BlockingSender) getParticipantsForMentions(ctx context.Context, uid gregor1.UID,
	conv *chat1.ConversationLocal) (res []chat1.ConversationLocalParticipant, err error) {
	if conv == nil {
		return nil, nil
	}
	defer s.Trace(ctx, func() error { return err }, "getParticipantsForMentions")()
	// get the conv that we will look for @ mentions in
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		if conv.Info.TopicName == globals.DefaultTeamTopic {
			return conv.Info.Participants, nil
		}
		topicType := chat1.TopicType_CHAT
		ib, _, err := s.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
			types.InboxSourceDataSourceAll, nil, &chat1.GetInboxLocalQuery{
				Name: &chat1.NameQuery{
					Name:        conv.Info.TlfName,
					TlfID:       &conv.Info.Triple.Tlfid,
					MembersType: chat1.ConversationMembersType_TEAM,
				},
				TopicName: &globals.DefaultTeamTopic,
				TopicType: &topicType,
			}, nil)
		if err != nil {
			return nil, err
		}
		if len(ib.Convs) == 0 {
			// just make a best effort here and return the current conv
			return conv.Info.Participants, nil
		}
		return ib.Convs[0].Info.Participants, nil
	}
	return conv.Info.Participants, nil
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
				res = append(res, chat1.KnownTeamMention{
					Name:    maybe.Name,
					Channel: maybe.Channel,
				})
			}
		}
		return res
	}

	// find @ mentions
	getConvMembers := func() ([]chat1.ConversationLocalParticipant, error) {
		return s.getParticipantsForMentions(ctx, uid, conv)
	}
	var knownUserMentions []chat1.KnownUserMention
	var maybeMentions []chat1.MaybeMention
	switch msg.ClientHeader.MessageType {
	case chat1.MessageType_TEXT:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return res, atMentions, chanMention, err
		}
		knownUserMentions, maybeMentions, chanMention = utils.GetTextAtMentionedItems(ctx, s.G(),
			uid, conv.GetConvID(), msg.MessageBody.Text(), getConvMembers, &s.DebugLabeler)
		atMentions = atFromKnown(knownUserMentions)
		newBody := msg.MessageBody.Text().DeepCopy()
		newBody.TeamMentions = maybeToTeam(maybeMentions)
		newBody.UserMentions = knownUserMentions
		res = chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithText(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}
	case chat1.MessageType_FLIP:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return res, atMentions, chanMention, err
		}
		knownUserMentions, maybeMentions, chanMention = utils.ParseAtMentionedItems(ctx, s.G(),
			msg.MessageBody.Flip().Text, nil, getConvMembers)
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
			msg.MessageBody.Edit().Body, nil, getConvMembers)
		atMentions = atFromKnown(knownUserMentions)
		newBody := msg.MessageBody.Edit().DeepCopy()
		newBody.TeamMentions = maybeToTeam(maybeMentions)
		newBody.UserMentions = knownUserMentions
		res = chat1.MessagePlaintext{
			ClientHeader:       msg.ClientHeader,
			MessageBody:        chat1.NewMessageBodyWithEdit(newBody),
			SupersedesOutboxID: msg.SupersedesOutboxID,
		}
	case chat1.MessageType_SYSTEM:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return res, atMentions, chanMention, err
		}
		res = msg
		atMentions, chanMention = utils.SystemMessageMentions(ctx, msg.MessageBody.System(),
			s.G().GetUPAKLoader())
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
	if conv != nil {
		convID := (*conv).GetConvID()
		msg.ClientHeader.Conv = conv.Info.Triple
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
			return res, err
		}

		// Be careful not to shadow (msg, pendingAssetDeletes) with this assignment.
		msg, pendingAssetDeletes, err = s.getAllDeletedEdits(ctx, uid, convID, msg)
		if err != nil {
			s.Debug(ctx, "Prepare: error getting deleted edits: %s", err)
			return res, err
		}

		// If no ephemeral data set, then let's double check to make sure no exploding policy
		// or Gregor state should set it
		if msg.EphemeralMetadata() == nil && chat1.IsEphemeralNonSupersederType(msg.ClientHeader.MessageType) {
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

		metadata, err := s.getSupersederEphemeralMetadata(ctx, uid, convID, msg)
		if err != nil {
			s.Debug(ctx, "Prepare: error getting superseder ephemeral metadata: %s", err)
			return res, err
		}
		msg.ClientHeader.EphemeralMetadata = metadata
	}

	// Make sure it is a proper length
	if err := msgchecker.CheckMessagePlaintext(msg); err != nil {
		return res, err
	}

	// Get topic name state if this is a METADATA message, so that we avoid any races to the
	// server
	var topicNameState *chat1.TopicNameState
	if !opts.SkipTopicNameState {
		if topicNameState, err = s.checkTopicNameAndGetState(ctx, msg, membersType); err != nil {
			s.Debug(ctx, "Prepare: error checking topic name state: %s", err)
			return res, err
		}
	}

	// handle mentions
	var atMentions []gregor1.UID
	var chanMention chat1.ChannelMention
	if msg, atMentions, chanMention, err = s.handleMentions(ctx, uid, msg, conv); err != nil {
		return res, err
	}

	// encrypt the message
	skp, err := s.getSigningKeyPair(ctx)
	if err != nil {
		s.Debug(ctx, "Prepare: error getting signing key pair: %s", err)
		return res, err
	}

	// If we are sending a message, and we think the conversation is a KBFS conversation, then set a label
	// on the client header in case this conversation gets upgrade to impteam.
	msg.ClientHeader.KbfsCryptKeysUsed = new(bool)
	if membersType == chat1.ConversationMembersType_KBFS {
		s.Debug(ctx, "setting KBFS crypt keys used flag")
		*msg.ClientHeader.KbfsCryptKeysUsed = true
	} else {
		*msg.ClientHeader.KbfsCryptKeysUsed = false
	}

	encInfo, err := s.boxer.GetEncryptionInfo(ctx, &msg, membersType, skp)
	if err != nil {
		return res, err
	}
	boxed, err := s.boxer.BoxMessage(ctx, msg, membersType, skp, &encInfo)
	if err != nil {
		return res, err
	}
	return types.SenderPrepareResult{
		Boxed:               boxed,
		EncryptionInfo:      encInfo,
		PendingAssetDeletes: pendingAssetDeletes,
		AtMentions:          atMentions,
		ChannelMention:      chanMention,
		TopicNameState:      topicNameState,
	}, nil
}

func (s *BlockingSender) getSigningKeyPair(ctx context.Context) (kp libkb.NaclSigningKeyPair, err error) {
	// get device signing key for this user
	signingKey, err := engine.GetMySecretKey(ctx, s.G().ExternalG(), storage.DefaultSecretUI,
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

func (s *BlockingSender) presentUIItem(ctx context.Context, conv *chat1.ConversationLocal) (res *chat1.InboxUIItem) {
	if conv != nil {
		pc := utils.PresentConversationLocal(ctx, *conv, s.G().Env.GetUsername().String())
		res = &pc
	}
	return res
}

func (s *BlockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID,
	outboxID *chat1.OutboxID, sendOpts *chat1.SenderSendOptions, prepareOpts *chat1.SenderPrepareOptions) (obid chat1.OutboxID, boxed *chat1.MessageBoxed, err error) {
	defer s.Trace(ctx, func() error { return err }, fmt.Sprintf("Send(%s)", convID))()
	defer utils.SuspendComponent(ctx, s.G(), s.G().InboxSource)()

	// Get conversation metadata first. If we can't find it, we will just attempt to join
	// the conversation in case that is an option. If it succeeds, then we just keep going,
	// otherwise we give up and return an error.
	var conv chat1.ConversationLocal
	sender := gregor1.UID(s.G().Env.GetUID().ToBytes())
	conv, err = utils.GetVerifiedConv(ctx, s.G(), sender, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		s.Debug(ctx, "Send: error getting conversation metadata: %s", err.Error())
		return nil, nil, err
	}
	s.Debug(ctx, "Send: uid: %s in conversation %s with status: %v", sender,
		conv.GetConvID(), conv.ReaderInfo.Status)

	// If we are in preview mode, then just join the conversation right now.
	switch conv.ReaderInfo.Status {
	case chat1.ConversationMemberStatus_PREVIEW, chat1.ConversationMemberStatus_NEVER_JOINED:
		switch msg.ClientHeader.MessageType {
		case chat1.MessageType_JOIN, chat1.MessageType_LEAVE:
			// pass so we don't loop between Send and Join/Leave.
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
			s.Debug(ctx, "Send: error in Prepare: %s", err.Error())
			return nil, nil, err
		}
		boxed = &prepareRes.Boxed

		// Delete assets associated with a delete operation.
		// Logs instead of returning an error. Assets can be left undeleted.
		if len(prepareRes.PendingAssetDeletes) > 0 {
			err = s.deleteAssets(ctx, convID, prepareRes.PendingAssetDeletes)
			if err != nil {
				s.Debug(ctx, "Send: failure in deleteAssets (charging forward): %s", err.Error())
			}
		}

		// Log some useful information about the message we are sending
		obidstr := "(none)"
		if boxed.ClientHeader.OutboxID != nil {
			obidstr = fmt.Sprintf("%s", *boxed.ClientHeader.OutboxID)
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
			switch err.(type) {
			case libkb.ChatStalePreviousStateError:
				// If we hit the stale previous state error, that means we should try again, since our view is
				// out of date.
				s.Debug(ctx, "Send: failed because of stale previous state, trying the whole thing again")
				if !clearedCache {
					s.Debug(ctx, "Send: clearing inbox cache to retry stale previous state")
					s.G().InboxSource.Clear(ctx, sender)
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
				merr := err.(libkb.EphemeralPairwiseMACsMissingUIDsError)
				s.Debug(ctx, "Send: failed because of missing KIDs for pairwise MACs, reloading UPAKs for %v and retrying.", merr.UIDs)
				utils.ForceReloadUPAKsForUIDs(ctx, s.G(), merr.UIDs)
				continue
			default:
				s.Debug(ctx, "Send: failed to PostRemote, bailing: %s", err.Error())
				return nil, nil, err
			}
		}
		boxed.ServerHeader = &plres.MsgHeader
		break
	}
	if err != nil {
		return nil, nil, err
	}

	// If this message was sent from the Outbox, then we can remove it now
	if boxed.ClientHeader.OutboxID != nil {
		if err = storage.NewOutbox(s.G(), sender).RemoveMessage(ctx, *boxed.ClientHeader.OutboxID); err != nil {
			s.Debug(ctx, "d: %s", err)
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
		if cerr = s.G().ConvSource.PushUnboxed(ctx, convID, boxed.ClientHeader.Sender,
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
		if convLocal != nil {
			unboxedMsg, err = NewReplyFiller(s.G()).FillSingle(ctx, boxed.ClientHeader.Sender, *convLocal,
				unboxedMsg)
			if err != nil {
				s.Debug(ctx, "Send: failed to fill reply: %s", err)
			}
		}
		activity := chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
			Message: utils.PresentMessageUnboxed(ctx, s.G(), unboxedMsg, boxed.ClientHeader.Sender,
				convID),
			ConvID:                     convID,
			DisplayDesktopNotification: false,
			Conv:                       s.presentUIItem(ctx, convLocal),
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
	}
	return nil, boxed, nil
}

const deliverMaxAttempts = 24            // two minutes in default mode
const deliverDisconnectLimitMinutes = 10 // need to be offline for at least 10 minutes before auto failing a send

type DelivererInfoError interface {
	IsImmediateFail() (chat1.OutboxErrorType, bool)
}

// delivererExpireError is used when a message fails because it has languished in the outbox for too long.
type delivererExpireError struct{}

func (e delivererExpireError) Error() string {
	return "message failed to send"
}

func (e delivererExpireError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_EXPIRED, true
}

type Deliverer struct {
	globals.Contextified
	sync.Mutex
	utils.DebugLabeler

	sender        types.Sender
	outbox        *storage.Outbox
	identNotifier types.IdentifyNotifier
	shutdownCh    chan chan struct{}
	msgSentCh     chan struct{}
	reconnectCh   chan struct{}
	delivering    bool
	connected     bool
	disconnTime   time.Time
	clock         clockwork.Clock

	notifyFailureChsMu sync.Mutex
	notifyFailureChs   map[string]chan []chat1.OutboxRecord

	// Testing
	testingNameInfoSource types.NameInfoSource
}

var _ types.MessageDeliverer = (*Deliverer)(nil)

func NewDeliverer(g *globals.Context, sender types.Sender) *Deliverer {
	d := &Deliverer{
		Contextified:     globals.NewContextified(g),
		DebugLabeler:     utils.NewDebugLabeler(g.GetLog(), "Deliverer", false),
		shutdownCh:       make(chan chan struct{}, 1),
		msgSentCh:        make(chan struct{}, 100),
		reconnectCh:      make(chan struct{}, 100),
		sender:           sender,
		identNotifier:    NewCachingIdentifyNotifier(g),
		clock:            clockwork.NewRealClock(),
		notifyFailureChs: make(map[string]chan []chat1.OutboxRecord),
	}

	g.PushShutdownHook(func() error {
		d.Stop(context.Background())
		return nil
	})

	d.identNotifier.ResetOnGUIConnect()

	return d
}

func (s *Deliverer) setTestingNameInfoSource(ni types.NameInfoSource) {
	s.testingNameInfoSource = ni
}

func (s *Deliverer) Start(ctx context.Context, uid gregor1.UID) {
	s.Lock()
	defer s.Unlock()

	<-s.doStop(ctx)

	s.outbox = storage.NewOutbox(s.G(), uid,
		storage.PendingPreviewer(func(ctx context.Context, obr *chat1.OutboxRecord) error {
			return attachments.AddPendingPreview(ctx, s.G(), obr)
		}),
		storage.NewMessageNotifier(func(ctx context.Context, obr chat1.OutboxRecord) {
			uid := obr.Msg.ClientHeader.Sender
			convID := obr.ConvID
			vis := keybase1.TLFVisibility_PRIVATE
			if obr.Msg.ClientHeader.TlfPublic {
				vis = keybase1.TLFVisibility_PUBLIC
			}
			conv := newBasicUnboxConversationInfo(convID, chat1.ConversationMembersType_IMPTEAMNATIVE, nil,
				vis)
			msg, err := NewReplyFiller(s.G()).FillSingle(ctx, uid, conv,
				chat1.NewMessageUnboxedWithOutbox(obr))
			if err != nil {
				s.Debug(ctx, "outboxNotify: failed to get replyto: %s", err)
			} else {
				obr.ReplyTo = &msg
			}
			act := chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
				Message: utils.PresentMessageUnboxed(ctx, s.G(), chat1.NewMessageUnboxedWithOutbox(obr),
					uid, convID),
				ConvID: convID,
			})
			s.G().ActivityNotifier.Activity(ctx, uid, obr.Msg.ClientHeader.Conv.TopicType, &act,
				chat1.ChatActivitySource_LOCAL)
		}))
	s.outbox.SetClock(s.clock)

	s.delivering = true
	go s.deliverLoop()
}

func (s *Deliverer) Stop(ctx context.Context) chan struct{} {
	s.Lock()
	defer s.Unlock()
	return s.doStop(ctx)
}

func (s *Deliverer) doStop(ctx context.Context) chan struct{} {
	cb := make(chan struct{})
	if s.delivering {
		s.Debug(ctx, "stopping")
		s.shutdownCh <- cb
		s.delivering = false
		return cb
	}

	close(cb)
	return cb
}

func (s *Deliverer) ForceDeliverLoop(ctx context.Context) {
	s.Debug(ctx, "force deliver loop invoked")
	s.msgSentCh <- struct{}{}
}

func (s *Deliverer) SetSender(sender types.Sender) {
	s.sender = sender
}

func (s *Deliverer) SetClock(clock clockwork.Clock) {
	s.clock = clock
}

func (s *Deliverer) Connected(ctx context.Context) {
	s.connected = true

	// Wake up deliver loop on reconnect
	s.Debug(ctx, "reconnected: forcing deliver loop run")
	s.reconnectCh <- struct{}{}
}

func (s *Deliverer) Disconnected(ctx context.Context) {
	s.Debug(ctx, "disconnected: all errors from now on will be permanent")
	s.connected = false
	s.disconnTime = s.clock.Now()
}

func (s *Deliverer) disconnectedTime() time.Duration {
	if s.connected {
		return 0
	}
	return s.clock.Now().Sub(s.disconnTime)
}

func (s *Deliverer) IsOffline(ctx context.Context) bool {
	return !s.connected
}

func (s *Deliverer) IsDelivering() bool {
	s.Lock()
	defer s.Unlock()
	return s.delivering
}

func (s *Deliverer) Queue(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
	outboxID *chat1.OutboxID, sendOpts *chat1.SenderSendOptions, prepareOpts *chat1.SenderPrepareOptions,
	identifyBehavior keybase1.TLFIdentifyBehavior) (obr chat1.OutboxRecord, err error) {
	defer s.Trace(ctx, func() error { return err }, "Queue")()
	// Push onto outbox and immediately return
	obr, err = s.outbox.PushMessage(ctx, convID, msg, outboxID, sendOpts, prepareOpts, identifyBehavior)
	if err != nil {
		return obr, err
	}
	s.Debug(ctx, "Queue: queued new message: convID: %s outboxID: %s uid: %s ident: %v", convID,
		obr.OutboxID, s.outbox.GetUID(), identifyBehavior)

	// Alert the deliver loop it should wake up
	s.msgSentCh <- struct{}{}

	return obr, nil
}

func (s *Deliverer) ActiveDeliveries(ctx context.Context) (res []chat1.OutboxRecord, err error) {
	defer s.Trace(ctx, func() error { return err }, "ActiveDeliveries")()
	if !s.IsDelivering() {
		s.Debug(ctx, "ActiveDeliveries: not delivering, returning empty")
		return nil, nil
	}
	obrs, err := s.outbox.PullAllConversations(ctx, false, false)
	if err != nil {
		s.Debug(ctx, "ActiveDeliveries: failed to pull convs: %s", err)
		return res, err
	}

	for _, obr := range obrs {
		styp, err := obr.State.State()
		if err != nil {
			s.Debug(ctx, "ActiveDeliveries: bogus state: outboxID: %s err: %s", obr.OutboxID, err)
			continue
		}
		if styp == chat1.OutboxStateType_SENDING {
			res = append(res, obr)
		}
	}
	return res, nil
}

func (s *Deliverer) NextFailure() (chan []chat1.OutboxRecord, func()) {
	s.notifyFailureChsMu.Lock()
	defer s.notifyFailureChsMu.Unlock()
	ch := make(chan []chat1.OutboxRecord, 1)
	id := libkb.RandStringB64(3)
	s.notifyFailureChs[id] = ch
	return ch, func() {
		s.notifyFailureChsMu.Lock()
		defer s.notifyFailureChsMu.Unlock()
		delete(s.notifyFailureChs, id)
	}
}

func (s *Deliverer) alertFailureChannels(obrs []chat1.OutboxRecord) {
	s.notifyFailureChsMu.Lock()
	defer s.notifyFailureChsMu.Unlock()
	for _, ch := range s.notifyFailureChs {
		ch <- obrs
	}
	s.notifyFailureChs = make(map[string]chan []chat1.OutboxRecord)
}

func (s *Deliverer) doNotRetryFailure(ctx context.Context, obr chat1.OutboxRecord, err error) (chat1.OutboxErrorType, error, bool) {
	// Check attempts
	if obr.State.Sending() >= deliverMaxAttempts {
		return chat1.OutboxErrorType_TOOMANYATTEMPTS, errors.New("max send attempts reached"), true
	}
	if !s.connected {
		// Check to see how long we have been disconnected to see if this should be retried
		disconnTime := s.disconnectedTime()
		noretry := false
		if disconnTime.Minutes() > deliverDisconnectLimitMinutes {
			noretry = true
			s.Debug(ctx, "doNotRetryFailure: not retrying offline failure, disconnected for: %v",
				disconnTime)
		}
		if noretry {
			return chat1.OutboxErrorType_OFFLINE, err, noretry
		}
	}
	// Check for any errors that should cause us to give up right away
	if berr, ok := err.(DelivererInfoError); ok {
		if typ, ok := berr.IsImmediateFail(); ok {
			return typ, err, true
		}
	}
	return 0, err, false
}

func (s *Deliverer) failMessage(ctx context.Context, obr chat1.OutboxRecord,
	oserr chat1.OutboxStateError) (err error) {
	var marked []chat1.OutboxRecord
	switch oserr.Typ {
	case chat1.OutboxErrorType_TOOMANYATTEMPTS:
		s.Debug(ctx, "failMessage: too many attempts failure, marking whole outbox failed")
		if marked, err = s.outbox.MarkAllAsError(ctx, oserr); err != nil {
			s.Debug(ctx, "failMessage: unable to mark all as error on outbox: uid: %s err: %s",
				s.outbox.GetUID(), err.Error())
			return err
		}
	case chat1.OutboxErrorType_DUPLICATE, chat1.OutboxErrorType_ALREADY_DELETED:
		// Here we don't send a notification to the frontend, we just want
		// these to go away
		if err = s.outbox.RemoveMessage(ctx, obr.OutboxID); err != nil {
			s.Debug(ctx, "deliverLoop: failed to remove duplicate delete msg: %s", err)
			return err
		}
	default:
		var m chat1.OutboxRecord
		if m, err = s.outbox.MarkAsError(ctx, obr, oserr); err != nil {
			s.Debug(ctx, "failMessage: unable to mark as error: %s", err)
			return err
		}
		marked = []chat1.OutboxRecord{m}
	}

	if len(marked) > 0 {
		act := chat1.NewChatActivityWithFailedMessage(chat1.FailedMessageInfo{
			OutboxRecords: marked,
		})
		s.G().ActivityNotifier.Activity(context.Background(), s.outbox.GetUID(), chat1.TopicType_NONE, &act,
			chat1.ChatActivitySource_LOCAL)
		s.alertFailureChannels(marked)
	}
	return nil
}

type delivererBackgroundTaskError struct {
	Typ string
}

func (e delivererBackgroundTaskError) Error() string {
	return fmt.Sprintf("%s in progress", e.Typ)
}

var errDelivererUploadInProgress = delivererBackgroundTaskError{Typ: "attachment upload"}
var errDelivererUnfurlInProgress = delivererBackgroundTaskError{Typ: "unfurl"}
var errDelivererFlipConvCreationInProgress = delivererBackgroundTaskError{Typ: "flip"}

func (s *Deliverer) processAttachment(ctx context.Context, obr chat1.OutboxRecord) (chat1.OutboxRecord, error) {
	if !obr.IsAttachment() {
		return obr, nil
	}
	status, res, err := s.G().AttachmentUploader.Status(ctx, obr.OutboxID)
	if err != nil {
		return obr, err
	}
	switch status {
	case types.AttachmentUploaderTaskStatusSuccess:
		// Modify the attachment message
		att := chat1.MessageAttachment{
			Object:   res.Object,
			Metadata: res.Metadata,
			Uploaded: true,
			Preview:  res.Preview,
		}
		if res.Preview != nil {
			att.Previews = []chat1.Asset{*res.Preview}
		}
		obr.Msg.MessageBody = chat1.NewMessageBodyWithAttachment(att)
		if _, err := s.outbox.UpdateMessage(ctx, obr); err != nil {
			return obr, err
		}
	case types.AttachmentUploaderTaskStatusFailed:
		errStr := "<unknown>"
		if res.Error != nil {
			errStr = *res.Error
		}
		// register this as a failure, but still attempt a retry
		if _, err := s.G().AttachmentUploader.Retry(ctx, obr.OutboxID); err != nil {
			s.Debug(ctx, "processAttachment: failed to retry upload on in progress task: %s", err)
			return obr, NewAttachmentUploadError(err.Error(), true)
		}
		return obr, NewAttachmentUploadError(errStr, false)
	case types.AttachmentUploaderTaskStatusUploading:
		// Make sure we are actually trying to upload this guy
		if _, err := s.G().AttachmentUploader.Retry(ctx, obr.OutboxID); err != nil {
			s.Debug(ctx, "processAttachment: failed to retry upload on in progress task: %s", err)
			return obr, NewAttachmentUploadError(err.Error(), true)
		}
		return obr, errDelivererUploadInProgress
	}
	return obr, nil
}

type unfurlerPermError struct{}

func (e unfurlerPermError) Error() string {
	return "unfurler permanent error"
}

func (e unfurlerPermError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, true
}

var _ (DelivererInfoError) = (*unfurlerPermError)(nil)

func (s *Deliverer) processUnfurl(ctx context.Context, obr chat1.OutboxRecord) (chat1.OutboxRecord, error) {
	if !obr.IsUnfurl() {
		return obr, nil
	}
	status, res, err := s.G().Unfurler.Status(ctx, obr.OutboxID)
	if err != nil {
		return obr, err
	}
	switch status {
	case types.UnfurlerTaskStatusSuccess:
		if res == nil {
			return obr, errors.New("unfurl success with no result")
		}
		unfurl := chat1.MessageUnfurl{
			MessageID: obr.Msg.ClientHeader.Supersedes,
			Unfurl:    *res,
		}
		obr.Msg.MessageBody = chat1.NewMessageBodyWithUnfurl(unfurl)
		if _, err := s.outbox.UpdateMessage(ctx, obr); err != nil {
			return obr, err
		}
	case types.UnfurlerTaskStatusUnfurling:
		s.G().Unfurler.Retry(ctx, obr.OutboxID)
		return obr, errDelivererUnfurlInProgress
	case types.UnfurlerTaskStatusFailed:
		s.G().Unfurler.Retry(ctx, obr.OutboxID)
		return obr, errors.New("failed to unfurl temporary")
	case types.UnfurlerTaskStatusPermFailed:
		return obr, unfurlerPermError{}
	}
	return obr, nil
}

type flipPermError struct{}

func (e flipPermError) Error() string {
	return "unable to start flip"
}

func (e flipPermError) IsImmediateFail() (chat1.OutboxErrorType, bool) {
	return chat1.OutboxErrorType_MISC, true
}

func (s *Deliverer) processFlip(ctx context.Context, obr chat1.OutboxRecord) (chat1.OutboxRecord, error) {
	if !obr.IsChatFlip() {
		return obr, nil
	}
	body := obr.Msg.MessageBody.Flip()
	flipConvID, status := s.G().CoinFlipManager.IsFlipConversationCreated(ctx, obr.OutboxID)
	switch status {
	case types.FlipSendStatusInProgress:
		return obr, errDelivererFlipConvCreationInProgress
	case types.FlipSendStatusError:
		return obr, flipPermError{}
	case types.FlipSendStatusSent:
		s.Debug(ctx, "processFlip: sending with convID: %s", flipConvID)
		obr.Msg.MessageBody = chat1.NewMessageBodyWithFlip(chat1.MessageFlip{
			Text:       body.Text,
			GameID:     body.GameID,
			FlipConvID: flipConvID,
		})
		if _, err := s.outbox.UpdateMessage(ctx, obr); err != nil {
			return obr, err
		}
		return obr, nil
	}
	return obr, nil
}

func (s *Deliverer) processBackgroundTaskMessage(ctx context.Context, obr chat1.OutboxRecord) (chat1.OutboxRecord, error) {
	switch obr.MessageType() {
	case chat1.MessageType_ATTACHMENT:
		return s.processAttachment(ctx, obr)
	case chat1.MessageType_UNFURL:
		return s.processUnfurl(ctx, obr)
	case chat1.MessageType_FLIP:
		return s.processFlip(ctx, obr)
	default:
		return obr, nil
	}
}

// cancelPendingDuplicateReactions removes duplicate reactions in the outbox.
// If we cancel an odd number of items we cancel ourselves since the current
// reaction state is correct.
func (s *Deliverer) cancelPendingDuplicateReactions(ctx context.Context, obr chat1.OutboxRecord) (bool, error) {
	if obr.Msg.ClientHeader.MessageType != chat1.MessageType_REACTION {
		// nothing to do here
		return false, nil
	}
	// While holding the outbox lock, let's remove any duplicate reaction
	// messages and  make sure we are in the outbox, otherwise someone else
	// canceled us.
	inOutbox := false
	numCanceled, err := s.outbox.CancelMessagesWithPredicate(ctx, func(o chat1.OutboxRecord) bool {
		if !o.ConvID.Eq(obr.ConvID) {
			return false
		}
		if o.Msg.ClientHeader.MessageType != chat1.MessageType_REACTION {
			return false
		}

		idEq := o.OutboxID.Eq(&obr.OutboxID)
		bodyEq := o.Msg.MessageBody.Reaction().Eq(obr.Msg.MessageBody.Reaction())
		// Don't delete ourselves from the outbox, but we want to make sure we
		// are in here.
		inOutbox = inOutbox || idEq
		shouldCancel := bodyEq && !idEq
		if shouldCancel {
			s.Debug(ctx, "canceling outbox message convID: %v obid: %v", o.ConvID, o.OutboxID)
		}
		return shouldCancel
	})

	if err != nil {
		return false, err
	} else if !inOutbox {
		// we were canceled previously, the jig is up
		return true, nil
	} else if numCanceled%2 == 1 {
		// Since we're just toggling the reaction on/off, we should abort here
		// and remove ourselves from the outbox since our message wouldn't
		// change the reaction state.
		err = s.outbox.RemoveMessage(ctx, obr.OutboxID)
		return true, err
	}
	return false, nil
}

func (s *Deliverer) shouldRecordError(ctx context.Context, err error) bool {
	switch err {
	case ErrDuplicateConnection:
		// This just happens when threads are racing to reconnect to Gregor, don't count it as
		// an error to send.
		return false
	}
	return true
}

func (s *Deliverer) shouldBreakLoop(ctx context.Context, obr chat1.OutboxRecord) bool {
	if obr.Msg.ClientHeader.MessageType == chat1.MessageType_UNFURL {
		s.Debug(ctx, "shouldBreakLoop: not breaking deliverer loop for unfurl failure: outboxID: %s",
			obr.OutboxID)
		return false
	}
	return true
}

func (s *Deliverer) deliverLoop() {
	bgctx := context.Background()
	s.Debug(bgctx, "deliverLoop: starting non blocking sender deliver loop: uid: %s duration: %v",
		s.outbox.GetUID(), s.G().Env.GetChatDelivererInterval())
	for {
		// Wait for the signal to take action
		select {
		case cb := <-s.shutdownCh:
			s.Debug(bgctx, "deliverLoop: shutting down outbox deliver loop: uid: %s", s.outbox.GetUID())
			defer close(cb)
			return
		case <-s.reconnectCh:
			s.Debug(bgctx, "deliverLoop: flushing outbox on reconnect: uid: %s", s.outbox.GetUID())
		case <-s.msgSentCh:
			s.Debug(bgctx, "deliverLoop: flushing outbox on new message: uid: %s", s.outbox.GetUID())
		case <-s.G().Clock().After(s.G().Env.GetChatDelivererInterval()):
		}

		// Fetch outbox
		obrs, err := s.outbox.PullAllConversations(bgctx, false, false)
		if err != nil {
			if _, ok := err.(storage.MissError); !ok {
				s.Debug(bgctx, "deliverLoop: unable to pull outbox: uid: %s err: %s", s.outbox.GetUID(),
					err.Error())
			}
			continue
		}
		if len(obrs) > 0 {
			s.Debug(bgctx, "deliverLoop: flushing %d items from the outbox: uid: %s", len(obrs),
				s.outbox.GetUID())
		}

		// Send messages
		var breaks []keybase1.TLFIdentifyFailure
		for _, obr := range obrs {
			bctx := globals.ChatCtx(context.Background(), s.G(), obr.IdentifyBehavior, &breaks,
				s.identNotifier)
			if s.testingNameInfoSource != nil {
				bctx = globals.CtxAddOverrideNameInfoSource(bctx, s.testingNameInfoSource)
			}
			if !s.connected {
				err = errors.New("disconnected from chat server")
			} else if s.clock.Now().Sub(obr.Ctime.Time()) > time.Hour {
				// If we are re-trying a message after an hour, let's just give up. These times can
				// get very long if the app is suspended on mobile.
				s.Debug(bctx, "deliverLoop: expiring pending message because it is too old: obid: %s dur: %v",
					obr.OutboxID, s.clock.Now().Sub(obr.Ctime.Time()))
				err = delivererExpireError{}
			} else {
				// Check for special messages and process based on completion status
				obr, err = s.processBackgroundTaskMessage(bctx, obr)
				if err == nil {
					canceled, err := s.cancelPendingDuplicateReactions(bctx, obr)
					if err == nil && canceled {
						s.Debug(bctx, "deliverLoop: aborting send, duplicate send convID: %s, obid: %s",
							obr.ConvID, obr.OutboxID)
						continue
					}
				} else if _, ok := err.(delivererBackgroundTaskError); ok {
					// check for bkg task error and loop around if we hit one
					s.Debug(bctx, "deliverLoop: bkg task in progress, skipping: convID: %s obid: %s task: %s",
						obr.ConvID, obr.OutboxID, err)
					continue
				}
				if err == nil {
					_, _, err = s.sender.Send(bctx, obr.ConvID, obr.Msg, 0, nil, obr.SendOpts,
						obr.PrepareOpts)
				}
			}
			if err != nil {
				s.Debug(bctx,
					"deliverLoop: failed to send msg: uid: %s convID: %s obid: %s err: %s attempts: %d",
					s.outbox.GetUID(), obr.ConvID, obr.OutboxID, err.Error(), obr.State.Sending())

				// Process failure. If we determine that the message is unrecoverable, then bail out.
				if errTyp, newErr, ok := s.doNotRetryFailure(bctx, obr, err); ok {
					// Record failure if we hit this case, and put the rest of this loop in a
					// mode where all other entries also fail.
					s.Debug(bctx, "deliverLoop: failure condition reached, marking as error and notifying: obid: %s errTyp: %v attempts: %d", obr.OutboxID, errTyp, obr.State.Sending())

					if err := s.failMessage(bctx, obr, chat1.OutboxStateError{
						Message: newErr.Error(),
						Typ:     errTyp,
					}); err != nil {
						s.Debug(bctx, "deliverLoop: unable to fail message: err: %s", err.Error())
					}
				} else if s.shouldRecordError(bctx, err) {
					if err = s.outbox.RecordFailedAttempt(bctx, obr); err != nil {
						s.Debug(bgctx, "deliverLoop: unable to record failed attempt on outbox: uid %s err: %s",
							s.outbox.GetUID(), err.Error())
					}
				}
				// Check if we should break out of the deliverer loop on this failure
				if s.shouldBreakLoop(bctx, obr) {
					break
				}
			} else {
				// BlockingSender actually does this too, so this will likely fail, but to maintain
				// the types.Sender abstraction we will do it here too and likely fail.
				if err = s.outbox.RemoveMessage(bctx, obr.OutboxID); err != nil {
					s.Debug(bgctx, "deliverLoop: failed to remove successful message send: %s", err)
				}
			}
		}
	}
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
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "NonblockingSender", false),
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
