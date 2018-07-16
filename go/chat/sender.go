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
	store             *attachments.Store
	getRi             func() chat1.RemoteInterface
	prevPtrPagination *chat1.Pagination
}

var _ types.Sender = (*BlockingSender)(nil)

func NewBlockingSender(g *globals.Context, boxer *Boxer, store *attachments.Store,
	getRi func() chat1.RemoteInterface) *BlockingSender {
	return &BlockingSender{
		Contextified:      globals.NewContextified(g),
		DebugLabeler:      utils.NewDebugLabeler(g.GetLog(), "BlockingSender", false),
		getRi:             getRi,
		boxer:             boxer,
		store:             store,
		prevPtrPagination: &chat1.Pagination{Num: 50},
	}
}

func (s *BlockingSender) setPrevPagination(p *chat1.Pagination) {
	s.prevPtrPagination = p
}

func (s *BlockingSender) addSenderToMessage(msg chat1.MessagePlaintext) (chat1.MessagePlaintext, error) {
	uid := s.G().Env.GetUID()
	if uid.IsNil() {
		return chat1.MessagePlaintext{}, libkb.LoginRequiredError{}
	}
	did := s.G().Env.GetDeviceID()
	if did.IsNil() {
		return chat1.MessagePlaintext{}, libkb.DeviceRequiredError{}
	}

	huid := uid.ToBytes()
	if huid == nil {
		return chat1.MessagePlaintext{}, errors.New("invalid UID")
	}

	hdid := make([]byte, libkb.DeviceIDLen)
	if err := did.ToBytes(hdid); err != nil {
		return chat1.MessagePlaintext{}, err
	}

	header := msg.ClientHeader
	header.Sender = gregor1.UID(huid)
	header.SenderDevice = gregor1.DeviceID(hdid)
	updated := chat1.MessagePlaintext{
		ClientHeader: header,
		MessageBody:  msg.MessageBody,
	}
	return updated, nil
}

func (s *BlockingSender) addPrevPointersAndCheckConvID(ctx context.Context, msg chat1.MessagePlaintext,
	conv chat1.Conversation) (resMsg chat1.MessagePlaintext, err error) {

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
	// If we fail to find anything to prev against after numRetries, we allow
	// the message to be send with an empty prev list.
	numRetries := 5
	for i := 0; i < numRetries; i++ {
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
		} else if thread.Pagination.Last {
			return resMsg, fmt.Errorf("Could not find previous messages for prev pointers (of %v)", len(thread.Messages))
		} else {
			s.Debug(ctx, "Could not find previous messages for prev pointers (of %v), attempt: %v of %v, retrying", len(thread.Messages), i, numRetries)
		}
	}

	for _, msg2 := range thread.Messages {
		if msg2.IsValid() {
			err = s.checkConvID(ctx, conv, msg, msg2)
			if err != nil {
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
func (s *BlockingSender) checkConvID(ctx context.Context, conv chat1.Conversation,
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
		// Try normalizing both tlfnames if simple comparison fails because they may have resolved.
		namesEq, err := s.boxer.CompareTlfNames(ctx, headerQ.TlfName, headerRef.TlfName, conv,
			headerQ.TlfPublic)
		if err != nil {
			return err
		}
		if !namesEq {
			s.Debug(ctx, "checkConvID: TlfName %s != %s", headerQ.TlfName, headerRef.TlfName)
			return fmt.Errorf("TlfName does not match reference message [%q vs ref %q]", headerQ.TlfName, headerRef.TlfName)
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
func (s *BlockingSender) getAllDeletedEdits(ctx context.Context, msg chat1.MessagePlaintext,
	conv chat1.Conversation) (chat1.MessagePlaintext, []chat1.Asset, error) {

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
	var uid gregor1.UID = s.G().Env.GetUID().ToBytes()
	deleteTargets, err := s.G().ConvSource.GetMessages(ctx, conv, uid, []chat1.MessageID{deleteTargetID}, nil)
	if err != nil {
		return msg, nil, err
	}
	if len(deleteTargets) != 1 {
		return msg, nil, fmt.Errorf("getAllDeletedEdits: wrong number of delete targets found (%v but expected 1)", len(deleteTargets))
	}
	deleteTarget := deleteTargets[0]
	state, err := deleteTarget.State()
	if err != nil {
		return msg, nil, err
	}
	switch state {
	case chat1.MessageUnboxedState_VALID:
		// pass
	case chat1.MessageUnboxedState_ERROR:
		return msg, nil, fmt.Errorf("getAllDeletedEdits: delete target: %s", deleteTarget.Error().ErrMsg)
	case chat1.MessageUnboxedState_OUTBOX:
		// TODO You should be able to delete messages that haven't been sent yet. But through a different mechanism.
		return msg, nil, fmt.Errorf("getAllDeletedEdits: delete target still in outbox")
	default:
		return msg, nil, fmt.Errorf("getAllDeletedEdits: delete target invalid (state:%v)", state)
	}

	// Delete all assets on the deleted message.
	// assetsForMessage logs instead of failing.
	pads2 := utils.AssetsForMessage(s.G(), deleteTarget.Valid().MessageBody)
	pendingAssetDeletes = append(pendingAssetDeletes, pads2...)

	// Time of the first message to be deleted.
	timeOfFirst := gregor1.FromTime(deleteTarget.Valid().ServerHeader.Ctime)
	// Time a couple seconds before that, because After querying is exclusive.
	timeBeforeFirst := gregor1.ToTime(timeOfFirst.Add(-2 * time.Second))

	// Get all the affected edits/AUs since just before the delete target.
	// Use ConvSource with an `After` which query. Fetches from a combination of local cache
	// and the server. This is an opportunity for the server to retain messages that should
	// have been deleted without getting caught.
	tv, err := s.G().ConvSource.Pull(ctx, conv.GetConvID(), msg.ClientHeader.Sender,
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
	// Add in any reaction messages the deleteTargetID may have
	deletes = append(deletes, deleteTarget.Valid().ServerHeader.ReactionIDs...)
	for _, m := range tv.Messages {
		if !m.IsValid() {
			continue
		}
		body := m.Valid().MessageBody
		typ, err := body.MessageType()
		if err != nil {
			s.Debug(ctx, "getAllDeletedEdits: error getting message type: convID: %s msgID: %d err: %s",
				conv.GetConvID(), m.GetMessageID(), err.Error())
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
				conv.GetConvID(), m.GetMessageID(), typ)
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

func (s *BlockingSender) checkTopicNameAndGetState(ctx context.Context, msg chat1.MessagePlaintext,
	membersType chat1.ConversationMembersType) (topicNameState *chat1.TopicNameState, err error) {
	if msg.ClientHeader.MessageType == chat1.MessageType_METADATA {
		tlfID := msg.ClientHeader.Conv.Tlfid
		topicType := msg.ClientHeader.Conv.TopicType
		newTopicName := msg.MessageBody.Metadata().ConversationTitle
		convs, err := s.G().TeamChannelSource.GetChannelsFull(ctx, msg.ClientHeader.Sender, tlfID,
			topicType)
		if err != nil {
			return topicNameState, err
		}
		for _, conv := range convs {
			if utils.GetTopicName(conv) == newTopicName {
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

// Prepare a message to be sent.
// Returns (boxedMessage, pendingAssetDeletes, error)
func (s *BlockingSender) Prepare(ctx context.Context, plaintext chat1.MessagePlaintext,
	membersType chat1.ConversationMembersType, conv *chat1.Conversation) (*chat1.MessageBoxed, []chat1.Asset, []gregor1.UID, chat1.ChannelMention, *chat1.TopicNameState, error) {
	if plaintext.ClientHeader.MessageType == chat1.MessageType_NONE {
		return nil, nil, nil, chat1.ChannelMention_NONE, nil, fmt.Errorf("cannot send message without type")
	}

	msg, err := s.addSenderToMessage(plaintext)
	if err != nil {
		return nil, nil, nil, chat1.ChannelMention_NONE, nil, err
	}

	// convID will be nil in makeFirstMessage
	if conv != nil {
		msg.ClientHeader.Conv = conv.Metadata.IdTriple
		msg, err = s.addPrevPointersAndCheckConvID(ctx, msg, *conv)
		if err != nil {
			return nil, nil, nil, chat1.ChannelMention_NONE, nil, err
		}
	}

	// Make sure it is a proper length
	if err := msgchecker.CheckMessagePlaintext(msg); err != nil {
		return nil, nil, nil, chat1.ChannelMention_NONE, nil, err
	}

	// Make sure our delete message gets everything it should
	var pendingAssetDeletes []chat1.Asset
	if conv != nil {
		// Be careful not to shadow (msg, pendingAssetDeletes) with this assignment.
		msg, pendingAssetDeletes, err = s.getAllDeletedEdits(ctx, msg, *conv)
		if err != nil {
			return nil, nil, nil, chat1.ChannelMention_NONE, nil, err
		}
	}

	// Get topic name state if this is a METADATA message, so that we avoid any races to the
	// server
	topicNameState, err := s.checkTopicNameAndGetState(ctx, msg, membersType)
	if err != nil {
		return nil, nil, nil, chat1.ChannelMention_NONE, nil, err
	}

	// encrypt the message
	skp, err := s.getSigningKeyPair(ctx)
	if err != nil {
		return nil, nil, nil, chat1.ChannelMention_NONE, nil, err
	}

	// Function to check that the header and body types match.
	// Call this before accessing the body.
	// Do not call this for TLFNAME which has no body.
	checkHeaderBodyTypeMatch := func() error {
		bodyType, err := plaintext.MessageBody.MessageType()
		if err != nil {
			return err
		}
		if plaintext.ClientHeader.MessageType != bodyType {
			return fmt.Errorf("cannot send message with mismatched header/body types: %v != %v",
				plaintext.ClientHeader.MessageType, bodyType)
		}
		return nil
	}

	// find @ mentions
	var atMentions []gregor1.UID
	chanMention := chat1.ChannelMention_NONE
	switch plaintext.ClientHeader.MessageType {
	case chat1.MessageType_TEXT:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return nil, nil, nil, chat1.ChannelMention_NONE, nil, err
		}
		atMentions, chanMention = utils.ParseAtMentionedUIDs(ctx,
			plaintext.MessageBody.Text().Body, s.G().GetUPAKLoader(), &s.DebugLabeler)
	case chat1.MessageType_EDIT:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return nil, nil, nil, chat1.ChannelMention_NONE, nil, err
		}
		atMentions, chanMention = utils.ParseAtMentionedUIDs(ctx,
			plaintext.MessageBody.Edit().Body, s.G().GetUPAKLoader(), &s.DebugLabeler)
	case chat1.MessageType_SYSTEM:
		if err = checkHeaderBodyTypeMatch(); err != nil {
			return nil, nil, nil, chat1.ChannelMention_NONE, nil, err
		}
		atMentions, chanMention = utils.SystemMessageMentions(ctx, plaintext.MessageBody.System(),
			s.G().GetUPAKLoader())
	}

	if len(atMentions) > 0 {
		s.Debug(ctx, "atMentions: %v", atMentions)
	}
	if chanMention != chat1.ChannelMention_NONE {
		s.Debug(ctx, "channel mention: %v", chanMention)
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

	// For now, BoxMessage canonicalizes the TLF name. We should try to refactor
	// it a bit to do it here.
	boxed, err := s.boxer.BoxMessage(ctx, msg, membersType, skp)
	if err != nil {
		return nil, nil, nil, chanMention, nil, err
	}

	return boxed, pendingAssetDeletes, atMentions, chanMention, topicNameState, nil
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

func (s *BlockingSender) presentUIItem(conv *chat1.ConversationLocal) (res *chat1.InboxUIItem) {
	if conv != nil {
		pc := utils.PresentConversationLocal(*conv, s.G().Env.GetUsername().String())
		res = &pc
	}
	return res
}

func (s *BlockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID, outboxID *chat1.OutboxID) (obid chat1.OutboxID, boxed *chat1.MessageBoxed, err error) {
	defer s.Trace(ctx, func() error { return err }, fmt.Sprintf("Send(%s)", convID))()

	// Record that this user is "active in chat", which we use to determine
	// gregor reconnect backoffs.
	RecordChatSend(ctx, s.G(), s.DebugLabeler)

	// Get conversation metadata first. If we can't find it, we will just attempt to join
	// the conversation in case that is an option. If it succeeds, then we just keep going,
	// otherwise we give up and return an error.
	var conv chat1.Conversation
	sender := gregor1.UID(s.G().Env.GetUID().ToBytes())
	conv, err = GetUnverifiedConv(ctx, s.G(), sender, convID, true)
	if err != nil {
		if err == errGetUnverifiedConvNotFound {
			// If we didn't find it, then just attempt to join it and see what happens
			switch msg.ClientHeader.MessageType {
			case chat1.MessageType_JOIN, chat1.MessageType_LEAVE:
				return chat1.OutboxID{}, nil, err
			default:
				s.Debug(ctx, "conversation not found, attempting to join the conversation and try again")
				if err = JoinConversation(ctx, s.G(), s.DebugLabeler, s.getRi, sender,
					convID); err != nil {
					return chat1.OutboxID{}, nil, err
				}
				// Force hit the remote here, so there is no race condition against the local
				// inbox
				conv, err = GetUnverifiedConv(ctx, s.G(), sender, convID, false)
				if err != nil {
					s.Debug(ctx, "failed to get conversation again, giving up: %s", err.Error())
					return chat1.OutboxID{}, nil, err
				}
			}
		} else {
			s.Debug(ctx, "error getting conversation metadata: %s", err.Error())
			return chat1.OutboxID{}, nil, err
		}
	} else {
		s.Debug(ctx, "uid: %s in conversation %s with status: %v", sender,
			conv.GetConvID(), conv.ReaderInfo.Status)
	}

	// If we are in preview mode, then just join the conversation right now.
	switch conv.ReaderInfo.Status {
	case chat1.ConversationMemberStatus_PREVIEW:
		switch msg.ClientHeader.MessageType {
		case chat1.MessageType_JOIN, chat1.MessageType_LEAVE:
			// pass so we don't loop between Send and Join/Leave.
		default:
			s.Debug(ctx, "user is in preview mode, joining conversation")
			if err = JoinConversation(ctx, s.G(), s.DebugLabeler, s.getRi, sender, convID); err != nil {
				return chat1.OutboxID{}, nil, err
			}
		}
	default:
		// do nothing
	}

	var plres chat1.PostRemoteRes
	// Try this up to 5 times in case we are trying to set the topic name, and the topic name
	// state is moving around underneath us.
	for i := 0; i < 5; i++ {
		// Add a bunch of stuff to the message (like prev pointers, sender info, ...)
		b, pendingAssetDeletes, atMentions, chanMention, topicNameState, err := s.Prepare(ctx, msg,
			conv.GetMembersType(), &conv)
		if err != nil {
			s.Debug(ctx, "error in Prepare: %s", err.Error())
			return chat1.OutboxID{}, nil, err
		}
		boxed = b

		// Delete assets associated with a delete operation.
		// Logs instead of returning an error. Assets can be left undeleted.
		if len(pendingAssetDeletes) > 0 {
			err = s.deleteAssets(ctx, convID, pendingAssetDeletes)
			if err != nil {
				s.Debug(ctx, "failure in deleteAssets (charging forward): %s", err.Error())
			}
		}

		// Log some useful information about the message we are sending
		obidstr := "(none)"
		if boxed.ClientHeader.OutboxID != nil {
			obidstr = fmt.Sprintf("%s", *boxed.ClientHeader.OutboxID)
		}
		s.Debug(ctx, "sending message: convID: %s outboxID: %s", convID, obidstr)

		// Keep trying if we get an error on topicNameState for a fixed number of times
		rarg := chat1.PostRemoteArg{
			ConversationID: convID,
			MessageBoxed:   *boxed,
			AtMentions:     atMentions,
			ChannelMention: chanMention,
			TopicNameState: topicNameState,
		}
		plres, err = s.getRi().PostRemote(ctx, rarg)
		if err != nil {
			switch err.(type) {
			case libkb.ChatStalePreviousStateError:
				// If we hit the stale previous state error, that means we should try again, since our view is
				// out of date.
				s.Debug(ctx, "failed because of stale previous state, trying the whole thing again")
				continue
			case libkb.EphemeralPairwiseMACsMissingUIDsError:
				merr := err.(libkb.EphemeralPairwiseMACsMissingUIDsError)
				s.Debug(ctx, "failed because of missing KIDs for pairwise MACs, reloading UPAKs for %v and retrying.", merr.UIDs)
				utils.ForceReloadUPAKsForUIDs(ctx, s.G(), merr.UIDs)
				continue
			default:
				s.Debug(ctx, "failed to PostRemote, bailing: %s", err.Error())
				return chat1.OutboxID{}, nil, err
			}
		}
		boxed.ServerHeader = &plres.MsgHeader
		break
	}

	// Write new message out to cache
	var cerr error
	var unboxedMsg chat1.MessageUnboxed
	var convLocal *chat1.ConversationLocal
	s.Debug(ctx, "sending local updates to chat sources")
	if unboxedMsg, _, cerr = s.G().ConvSource.Push(ctx, convID, boxed.ClientHeader.Sender, *boxed); cerr != nil {
		s.Debug(ctx, "failed to push new message into convsource: %s", err)
	}
	if convLocal, err = s.G().InboxSource.NewMessage(ctx, boxed.ClientHeader.Sender, 0, convID,
		*boxed, nil); err != nil {
		s.Debug(ctx, "failed to update inbox: %s", err)
	}
	// Send up to frontend
	if cerr == nil && boxed.GetMessageType() != chat1.MessageType_LEAVE {
		activity := chat1.NewChatActivityWithIncomingMessage(chat1.IncomingMessage{
			Message: utils.PresentMessageUnboxed(ctx, s.G(), unboxedMsg, boxed.ClientHeader.Sender, convID),
			ConvID:  convID,
			DisplayDesktopNotification: false,
			Conv: s.presentUIItem(convLocal),
		})
		s.G().ActivityNotifier.Activity(ctx, boxed.ClientHeader.Sender, conv.GetTopicType(), &activity)
	}
	return []byte{}, boxed, nil
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

	// Testing
	testingNameInfoSource types.NameInfoSource
}

var _ types.MessageDeliverer = (*Deliverer)(nil)

func NewDeliverer(g *globals.Context, sender types.Sender) *Deliverer {
	d := &Deliverer{
		Contextified:  globals.NewContextified(g),
		DebugLabeler:  utils.NewDebugLabeler(g.GetLog(), "Deliverer", false),
		shutdownCh:    make(chan chan struct{}, 1),
		msgSentCh:     make(chan struct{}, 100),
		reconnectCh:   make(chan struct{}, 100),
		sender:        sender,
		identNotifier: NewCachingIdentifyNotifier(g),
		clock:         clockwork.NewRealClock(),
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

	s.outbox = storage.NewOutbox(s.G(), uid)
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

func (s *Deliverer) Queue(ctx context.Context, convID chat1.ConversationID, msg chat1.MessagePlaintext,
	outboxID *chat1.OutboxID,
	identifyBehavior keybase1.TLFIdentifyBehavior) (obr chat1.OutboxRecord, err error) {
	defer s.Trace(ctx, func() error { return err }, "Queue")()

	// Push onto outbox and immediately return
	obr, err = s.outbox.PushMessage(ctx, convID, msg, outboxID, identifyBehavior)
	if err != nil {
		return obr, err
	}
	s.Debug(ctx, "queued new message: convID: %s outboxID: %s uid: %s ident: %v", convID,
		obr.OutboxID, s.outbox.GetUID(), identifyBehavior)

	// Alert the deliver loop it should wake up
	s.msgSentCh <- struct{}{}

	return obr, nil
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
		s.G().ActivityNotifier.Activity(context.Background(), s.outbox.GetUID(), chat1.TopicType_NONE, &act)
	}
	return nil
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
			bctx := Context(context.Background(), s.G(), obr.IdentifyBehavior, &breaks,
				s.identNotifier)
			if s.testingNameInfoSource != nil {
				CtxKeyFinder(bctx, s.G()).SetNameInfoSourceOverride(s.testingNameInfoSource)
			}
			if !s.connected {
				err = errors.New("disconnected from chat server")
			} else if s.clock.Now().Sub(obr.Ctime.Time()) > 10*time.Minute {
				// If we are re-trying a message after 10 minutes, let's just give up. These times can
				// get very long if the app is suspended on mobile.
				s.Debug(bgctx, "deliverLoop: expiring pending message because it is too old: obid: %s dur: %v",
					obr.OutboxID, s.clock.Now().Sub(obr.Ctime.Time()))
				err = delivererExpireError{}
			} else {
				_, _, err = s.sender.Send(bctx, obr.ConvID, obr.Msg, 0, nil)
			}
			if err != nil {
				s.Debug(bgctx,
					"deliverLoop: failed to send msg: uid: %s convID: %s obid: %s err: %s attempts: %d",
					s.outbox.GetUID(), obr.ConvID, obr.OutboxID, err.Error(), obr.State.Sending())

				// Process failure. If we determine that the message is unrecoverable, then bail out.
				if errTyp, newErr, ok := s.doNotRetryFailure(bgctx, obr, err); ok {
					// Record failure if we hit this case, and put the rest of this loop in a
					// mode where all other entries also fail.
					s.Debug(bgctx, "deliverLoop: failure condition reached, marking as error and notifying: obid: %s errTyp: %v attempts: %d", obr.OutboxID, errTyp, obr.State.Sending())

					if err := s.failMessage(bgctx, obr, chat1.OutboxStateError{
						Message: newErr.Error(),
						Typ:     errTyp,
					}); err != nil {
						s.Debug(bgctx, "deliverLoop: unable to fail message: err: %s", err.Error())
					}
				} else {
					if err = s.outbox.RecordFailedAttempt(bgctx, obr); err != nil {
						s.Debug(bgctx, "deliverLoop: unable to record failed attempt on outbox: uid %s err: %s",
							s.outbox.GetUID(), err.Error())
					}
				}
				break
			} else {
				if err = s.outbox.RemoveMessage(bgctx, obr.OutboxID); err != nil {
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
	membersType chat1.ConversationMembersType, conv *chat1.Conversation) (*chat1.MessageBoxed, []chat1.Asset, []gregor1.UID, chat1.ChannelMention, *chat1.TopicNameState, error) {
	return s.sender.Prepare(ctx, msg, membersType, conv)
}

func (s *NonblockingSender) Send(ctx context.Context, convID chat1.ConversationID,
	msg chat1.MessagePlaintext, clientPrev chat1.MessageID, outboxID *chat1.OutboxID) (chat1.OutboxID, *chat1.MessageBoxed, error) {
	msg.ClientHeader.OutboxInfo = &chat1.OutboxInfo{
		Prev:        clientPrev,
		ComposeTime: gregor1.ToTime(time.Now()),
	}
	identifyBehavior, _, _ := IdentifyMode(ctx)
	obr, err := s.G().MessageDeliverer.Queue(ctx, convID, msg, outboxID, identifyBehavior)
	return obr.OutboxID, nil, err
}
