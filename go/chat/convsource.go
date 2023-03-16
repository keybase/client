package chat

import (
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type baseConversationSource struct {
	globals.Contextified
	utils.DebugLabeler

	boxer *Boxer
	ri    func() chat1.RemoteInterface

	blackoutPullForTesting bool
}

func newBaseConversationSource(g *globals.Context, ri func() chat1.RemoteInterface, boxer *Boxer) *baseConversationSource {
	labeler := utils.NewDebugLabeler(g.ExternalG(), "baseConversationSource", false)
	return &baseConversationSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: labeler,
		ri:           ri,
		boxer:        boxer,
	}
}

func (s *baseConversationSource) SetRemoteInterface(ri func() chat1.RemoteInterface) {
	s.ri = ri
}

// Sign implements github.com/keybase/go/chat/s3.Signer interface.
func (s *baseConversationSource) Sign(payload []byte) ([]byte, error) {
	arg := chat1.S3SignArg{
		Payload: payload,
		Version: 1,
	}
	return s.ri().S3Sign(context.Background(), arg)
}

// DeleteAssets implements github.com/keybase/go/chat/storage/storage.AssetDeleter interface.
func (s *baseConversationSource) DeleteAssets(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, assets []chat1.Asset) {
	if len(assets) == 0 {
		return
	}
	s.Debug(ctx, "DeleteAssets: deleting %d assets", len(assets))
	// Fire off a background load of the thread with a post hook to delete the bodies cache
	err := s.G().ConvLoader.Queue(ctx, types.NewConvLoaderJob(convID, &chat1.Pagination{Num: 0},
		types.ConvLoaderPriorityHighest, types.ConvLoaderUnique,
		func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
			fetcher := s.G().AttachmentURLSrv.GetAttachmentFetcher()
			if err := fetcher.DeleteAssets(ctx, convID, assets, s.ri, s); err != nil {
				s.Debug(ctx, "DeleteAssets: Error purging ephemeral attachments %v", err)
			}
		}))
	if err != nil {
		s.Debug(ctx, "DeleteAssets: Error queuing conv job: %+v", err)
	}
}

func (s *baseConversationSource) addPendingPreviews(ctx context.Context, thread *chat1.ThreadView) {
	for index, m := range thread.Messages {
		if !m.IsOutbox() {
			continue
		}
		obr := m.Outbox()
		if err := attachments.AddPendingPreview(ctx, s.G(), &obr); err != nil {
			s.Debug(ctx, "addPendingPreviews: failed to get pending preview: outboxID: %s err: %s",
				obr.OutboxID, err)
			continue
		}
		thread.Messages[index] = chat1.NewMessageUnboxedWithOutbox(obr)
	}
}

func (s *baseConversationSource) addConversationCards(ctx context.Context, uid gregor1.UID, reason chat1.GetThreadReason,
	convID chat1.ConversationID, convOptional *chat1.ConversationLocal, thread *chat1.ThreadView) {
	ctxShort, ctxShortCancel := context.WithTimeout(ctx, 2*time.Second)
	defer ctxShortCancel()
	if journeycardShouldNotRunOnReason[reason] {
		s.Debug(ctx, "addConversationCards: skipping due to reason: %v", reason)
		return
	}
	card, err := s.G().JourneyCardManager.PickCard(ctxShort, uid, convID, convOptional, thread)
	ctxShortCancel()
	if err != nil {
		s.Debug(ctx, "addConversationCards: error getting next conversation card: %s", err)
		return
	}
	if card == nil {
		return
	}
	// Slot it in to the left of its prev.
	addLeftOf := 0
	for i := len(thread.Messages) - 1; i >= 0; i-- {
		msgID := thread.Messages[i].GetMessageID()
		if msgID != 0 && msgID >= card.PrevID {
			addLeftOf = i
			break
		}
	}
	// Insert at index: https://github.com/golang/go/wiki/SliceTricks#insert
	thread.Messages = append(thread.Messages, chat1.MessageUnboxed{})
	copy(thread.Messages[addLeftOf+1:], thread.Messages[addLeftOf:])
	thread.Messages[addLeftOf] = chat1.NewMessageUnboxedWithJourneycard(*card)
}

func (s *baseConversationSource) getRi(customRi func() chat1.RemoteInterface) chat1.RemoteInterface {
	if customRi != nil {
		return customRi()
	}
	return s.ri()
}

func (s *baseConversationSource) postProcessThread(ctx context.Context, uid gregor1.UID, reason chat1.GetThreadReason,
	conv types.UnboxConversationInfo, thread *chat1.ThreadView, q *chat1.GetThreadQuery,
	superXform types.SupersedesTransform, replyFiller types.ReplyFiller, checkPrev bool,
	patchPagination bool, verifiedConv *chat1.ConversationLocal) (err error) {
	if q != nil && q.DisablePostProcessThread {
		return nil
	}
	s.Debug(ctx, "postProcessThread: thread messages starting out: %d", len(thread.Messages))
	// Sanity check the prev pointers in this thread.
	// TODO: We'll do this against what's in the cache once that's ready,
	//       rather than only checking the messages we just fetched against
	//       each other.

	if s.blackoutPullForTesting {
		thread.Messages = nil
		return nil
	}

	if checkPrev {
		_, _, err = CheckPrevPointersAndGetUnpreved(thread)
		if err != nil {
			return err
		}
	}

	if patchPagination {
		// Can mutate thread.Pagination.
		s.patchPaginationLast(ctx, conv, uid, thread.Pagination, thread.Messages)
	}

	// Resolve supersedes & replies
	deletedUpTo := conv.GetMaxDeletedUpTo()
	if thread.Messages, err = s.TransformSupersedes(ctx, conv.GetConvID(), uid, thread.Messages, q, superXform,
		replyFiller, &deletedUpTo); err != nil {
		return err
	}
	s.Debug(ctx, "postProcessThread: thread messages after supersedes: %d", len(thread.Messages))

	// Run type filter if it exists
	thread.Messages = utils.FilterByType(thread.Messages, q, true)
	s.Debug(ctx, "postProcessThread: thread messages after type filter: %d", len(thread.Messages))
	// If we have exploded any messages while fetching them from cache, remove
	// them now.
	thread.Messages = utils.FilterExploded(conv, thread.Messages, s.boxer.clock.Now())
	s.Debug(ctx, "postProcessThread: thread messages after explode filter: %d", len(thread.Messages))

	// Add any conversation cards
	s.addConversationCards(ctx, uid, reason, conv.GetConvID(), verifiedConv, thread)

	// Fetch outbox and tack onto the result
	outbox := storage.NewOutbox(s.G(), uid)
	err = outbox.AppendToThread(ctx, conv.GetConvID(), thread)
	switch err.(type) {
	case nil, storage.MissError:
	default:
		return err
	}
	// Add attachment previews to pending messages
	s.addPendingPreviews(ctx, thread)

	return nil
}

func (s *baseConversationSource) TransformSupersedes(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageUnboxed,
	q *chat1.GetThreadQuery, superXform types.SupersedesTransform, replyFiller types.ReplyFiller,
	maxDeletedUpTo *chat1.MessageID) (res []chat1.MessageUnboxed, err error) {
	defer s.Trace(ctx, &err, "TransformSupersedes")()
	if q == nil || !q.DisableResolveSupersedes {
		deletePlaceholders := q != nil && q.EnableDeletePlaceholders
		if superXform == nil {
			superXform = newBasicSupersedesTransform(s.G(), basicSupersedesTransformOpts{
				UseDeletePlaceholders: deletePlaceholders,
			})
		}
		if res, err = superXform.Run(ctx, convID, uid, msgs, maxDeletedUpTo); err != nil {
			return nil, err
		}
	} else {
		res = msgs
	}
	if replyFiller == nil {
		replyFiller = NewReplyFiller(s.G())
	}
	return replyFiller.Fill(ctx, uid, convID, res)
}

// patchPaginationLast turns on page.Last if the messages are before InboxSource's view of Expunge.
func (s *baseConversationSource) patchPaginationLast(ctx context.Context, conv types.UnboxConversationInfo, uid gregor1.UID,
	page *chat1.Pagination, msgs []chat1.MessageUnboxed) {
	if page == nil || page.Last {
		return
	}
	if len(msgs) == 0 {
		s.Debug(ctx, "patchPaginationLast: true - no msgs")
		page.Last = true
		return
	}
	expunge := conv.GetExpunge()
	if expunge == nil {
		s.Debug(ctx, "patchPaginationLast: no expunge info")
		return
	}
	end1 := msgs[0].GetMessageID()
	end2 := msgs[len(msgs)-1].GetMessageID()
	if end1.Min(end2) <= expunge.Upto {
		s.Debug(ctx, "patchPaginationLast: true - hit upto")
		// If any message is prior to the nukepoint, say this is the last page.
		page.Last = true
	}
}

func (s *baseConversationSource) GetMessage(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgID chat1.MessageID, reason *chat1.GetThreadReason, ri func() chat1.RemoteInterface,
	resolveSupersedes bool) (chat1.MessageUnboxed, error) {
	msgs, err := s.G().ConvSource.GetMessages(ctx, convID, uid, []chat1.MessageID{msgID},
		reason, s.ri, resolveSupersedes)
	if err != nil {
		return chat1.MessageUnboxed{}, err
	}
	if len(msgs) != 1 {
		return chat1.MessageUnboxed{}, errors.New("message not found")
	}
	return msgs[0], nil
}

func (s *baseConversationSource) PullFull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, reason chat1.GetThreadReason,
	query *chat1.GetThreadQuery, maxPages *int) (res chat1.ThreadView, err error) {
	ctx = libkb.WithLogTag(ctx, "PUL")
	pagination := &chat1.Pagination{
		Num: 300,
	}
	if maxPages == nil {
		defaultMaxPages := 10000
		maxPages = &defaultMaxPages
	}
	for i := 0; !pagination.Last && i < *maxPages; i++ {
		thread, err := s.G().ConvSource.Pull(ctx, convID, uid, reason, nil, query, pagination)
		if err != nil {
			return res, err
		}
		res.Messages = append(res.Messages, thread.Messages...)
		if thread.Pagination != nil {
			pagination.Next = thread.Pagination.Next
			pagination.Last = thread.Pagination.Last
		}
	}
	return res, nil
}

func (s *baseConversationSource) getUnreadlineRemote(ctx context.Context, convID chat1.ConversationID,
	readMsgID chat1.MessageID) (*chat1.MessageID, error) {
	res, err := s.ri().GetUnreadlineRemote(ctx, chat1.GetUnreadlineRemoteArg{
		ConvID:    convID,
		ReadMsgID: readMsgID,
	})
	if err != nil {
		return nil, err
	}
	return res.UnreadlineID, nil
}

type RemoteConversationSource struct {
	globals.Contextified
	*baseConversationSource
}

var _ types.ConversationSource = (*RemoteConversationSource)(nil)

func NewRemoteConversationSource(g *globals.Context, b *Boxer, ri func() chat1.RemoteInterface) *RemoteConversationSource {
	return &RemoteConversationSource{
		Contextified:           globals.NewContextified(g),
		baseConversationSource: newBaseConversationSource(g, ri, b),
	}
}

func (s *RemoteConversationSource) AcquireConversationLock(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) error {
	return nil
}

func (s *RemoteConversationSource) ReleaseConversationLock(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) {
}

func (s *RemoteConversationSource) Push(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg chat1.MessageBoxed) (chat1.MessageUnboxed, bool, error) {
	// Do nothing here, we don't care about pushed messages

	// The bool param here is to indicate the update given is continuous to our current state,
	// which for this source is not relevant, so we just return true
	return chat1.MessageUnboxed{}, true, nil
}

func (s *RemoteConversationSource) PushUnboxed(ctx context.Context, conv types.UnboxConversationInfo,
	uid gregor1.UID, msg []chat1.MessageUnboxed) error {
	return nil
}

func (s *RemoteConversationSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, reason chat1.GetThreadReason, customRi func() chat1.RemoteInterface,
	query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, error) {
	ctx = libkb.WithLogTag(ctx, "PUL")

	if convID.IsNil() {
		return chat1.ThreadView{}, errors.New("RemoteConversationSource.Pull called with empty convID")
	}

	// Get conversation metadata
	conv, err := utils.GetVerifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	// Fetch thread
	rarg := chat1.GetThreadRemoteArg{
		ConversationID: convID,
		Query:          query,
		Pagination:     pagination,
		Reason:         reason,
	}
	boxed, err := s.getRi(customRi).GetThreadRemote(ctx, rarg)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	thread, err := s.boxer.UnboxThread(ctx, boxed.Thread, conv)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	// Post process thread before returning
	if err = s.postProcessThread(ctx, uid, reason, conv, &thread, query, nil, nil, true, false, &conv); err != nil {
		return chat1.ThreadView{}, err
	}

	return thread, nil
}

func (s *RemoteConversationSource) PullLocalOnly(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, reason chat1.GetThreadReason, query *chat1.GetThreadQuery, pagination *chat1.Pagination, maxPlaceholders int) (chat1.ThreadView, error) {
	return chat1.ThreadView{}, storage.MissError{Msg: "PullLocalOnly is unimplemented for RemoteConversationSource"}
}

func (s *RemoteConversationSource) Clear(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, opts *types.ClearOpts) error {
	return nil
}

func (s *RemoteConversationSource) GetMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgIDs []chat1.MessageID, threadReason *chat1.GetThreadReason,
	customRi func() chat1.RemoteInterface, resolveSupersedes bool) (res []chat1.MessageUnboxed, err error) {
	defer func() {
		// unless arg says not to, transform the superseded messages
		if !resolveSupersedes {
			return
		}
		res, err = s.TransformSupersedes(ctx, convID, uid, res, nil, nil, nil, nil)
	}()

	rres, err := s.ri().GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
		ConversationID: convID,
		MessageIDs:     msgIDs,
		ThreadReason:   threadReason,
	})
	if err != nil {
		return nil, err
	}

	conv := newBasicUnboxConversationInfo(convID, rres.MembersType, nil, rres.Visibility)
	msgs, err := s.boxer.UnboxMessages(ctx, rres.Msgs, conv)
	if err != nil {
		return nil, err
	}

	return msgs, nil
}

func (s *RemoteConversationSource) GetMessagesWithRemotes(ctx context.Context,
	conv chat1.Conversation, uid gregor1.UID, msgs []chat1.MessageBoxed) ([]chat1.MessageUnboxed, error) {
	return s.boxer.UnboxMessages(ctx, msgs, conv)
}

func (s *RemoteConversationSource) GetUnreadline(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, readMsgID chat1.MessageID) (*chat1.MessageID, error) {
	return s.getUnreadlineRemote(ctx, convID, readMsgID)
}

func (s *RemoteConversationSource) Expunge(ctx context.Context,
	conv types.UnboxConversationInfo, uid gregor1.UID, expunge chat1.Expunge) error {
	return nil
}

func (s *RemoteConversationSource) EphemeralPurge(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) (*chat1.EphemeralPurgeInfo, []chat1.MessageUnboxed, error) {
	return nil, nil, nil
}

type HybridConversationSource struct {
	globals.Contextified
	utils.DebugLabeler
	*baseConversationSource

	numExpungeReload int
	storage          *storage.Storage
	lockTab          *utils.ConversationLockTab
}

var _ types.ConversationSource = (*HybridConversationSource)(nil)

func NewHybridConversationSource(g *globals.Context, b *Boxer, storage *storage.Storage,
	ri func() chat1.RemoteInterface) *HybridConversationSource {
	return &HybridConversationSource{
		Contextified:           globals.NewContextified(g),
		DebugLabeler:           utils.NewDebugLabeler(g.ExternalG(), "HybridConversationSource", false),
		baseConversationSource: newBaseConversationSource(g, ri, b),
		storage:                storage,
		lockTab:                utils.NewConversationLockTab(g),
		numExpungeReload:       50,
	}
}

func (s *HybridConversationSource) AcquireConversationLock(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) error {
	_, err := s.lockTab.Acquire(ctx, uid, convID)
	return err
}

func (s *HybridConversationSource) ReleaseConversationLock(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) {
	s.lockTab.Release(ctx, uid, convID)
}

func (s *HybridConversationSource) isContinuousPush(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgID chat1.MessageID) (continuousUpdate bool, err error) {
	maxMsgID, err := s.storage.GetMaxMsgID(ctx, convID, uid)
	switch err.(type) {
	case storage.MissError:
		continuousUpdate = true
	case nil:
		continuousUpdate = maxMsgID >= msgID-1
	default:
		return false, err
	}
	return continuousUpdate, nil
}

// completeAttachmentUpload removes any attachment previews from pending preview storage
func (s *HybridConversationSource) completeAttachmentUpload(ctx context.Context, msg chat1.MessageUnboxed) {
	if msg.GetMessageType() == chat1.MessageType_ATTACHMENT {
		outboxID := msg.OutboxID()
		if outboxID != nil {
			s.G().AttachmentUploader.Complete(ctx, *outboxID)
		}
	}
}

func (s *HybridConversationSource) completeUnfurl(ctx context.Context, msg chat1.MessageUnboxed) {
	if msg.GetMessageType() == chat1.MessageType_UNFURL {
		outboxID := msg.OutboxID()
		if outboxID != nil {
			s.G().Unfurler.Complete(ctx, *outboxID)
		}
	}
}

func (s *HybridConversationSource) maybeNuke(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, err *error) {
	if err != nil && utils.IsDeletedConvError(*err) {
		s.Debug(ctx, "purging caches on: %v for convID: %v, uid: %v", *err, convID, uid)
		if ierr := s.Clear(ctx, convID, uid, &types.ClearOpts{
			SendLocalAdminNotification: true,
			Reason:                     "Got unexpected conversation deleted error. Cleared conv and inbox cache",
		}); ierr != nil {
			s.Debug(ctx, "unable to Clear conv: %v", ierr)
		}
		if ierr := s.G().InboxSource.Clear(ctx, uid, nil); ierr != nil {
			s.Debug(ctx, "unable to Clear inbox: %v", ierr)
		}
		s.G().UIInboxLoader.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "ConvSource#maybeNuke")
		*err = nil
	}
}

func (s *HybridConversationSource) Push(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg chat1.MessageBoxed) (decmsg chat1.MessageUnboxed, continuousUpdate bool, err error) {
	defer s.Trace(ctx, &err, "Push")()
	if _, err = s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return decmsg, continuousUpdate, err
	}
	defer s.lockTab.Release(ctx, uid, convID)
	defer s.maybeNuke(ctx, convID, uid, &err)

	// Grab conversation information before pushing
	conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return decmsg, continuousUpdate, err
	}

	// Check to see if we are "appending" this message to the current record.
	if continuousUpdate, err = s.isContinuousPush(ctx, convID, uid, msg.GetMessageID()); err != nil {
		return decmsg, continuousUpdate, err
	}

	decmsg, err = s.boxer.UnboxMessage(ctx, msg, conv, nil)
	if err != nil {
		return decmsg, continuousUpdate, err
	}

	// Check conversation ID and change to error if it is wrong
	if decmsg.IsValid() && !decmsg.Valid().ClientHeader.Conv.Derivable(convID) {
		s.Debug(ctx, "invalid conversation ID detected, not derivable: %s", convID)
		decmsg = chat1.NewMessageUnboxedWithError(chat1.MessageUnboxedError{
			ErrMsg:      "invalid conversation ID",
			MessageID:   msg.GetMessageID(),
			MessageType: msg.GetMessageType(),
		})
	}

	// Add to the local storage
	if err = s.mergeMaybeNotify(ctx, conv, uid, []chat1.MessageUnboxed{decmsg}, chat1.GetThreadReason_GENERAL); err != nil {
		return decmsg, continuousUpdate, err
	}
	if msg.ClientHeader.Sender.Eq(uid) && conv.GetMembersType() == chat1.ConversationMembersType_TEAM {
		teamID, err := keybase1.TeamIDFromString(conv.Conv.Metadata.IdTriple.Tlfid.String())
		if err != nil {
			s.Debug(ctx, "Push: failed to get team ID: %v", err)
		} else {
			go s.G().JourneyCardManager.SentMessage(globals.BackgroundChatCtx(ctx, s.G()), uid, teamID, convID)
		}
	}
	// Remove any pending previews from storage
	s.completeAttachmentUpload(ctx, decmsg)
	// complete any active unfurl
	s.completeUnfurl(ctx, decmsg)

	return decmsg, continuousUpdate, nil
}

func (s *HybridConversationSource) PushUnboxed(ctx context.Context, conv types.UnboxConversationInfo,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) (err error) {
	defer s.Trace(ctx, &err, "PushUnboxed")()
	convID := conv.GetConvID()
	if _, err = s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return err
	}
	defer s.lockTab.Release(ctx, uid, convID)
	defer s.maybeNuke(ctx, convID, uid, &err)

	// sanity check against conv ID
	for _, msg := range msgs {
		if msg.IsValid() && !msg.Valid().ClientHeader.Conv.Derivable(convID) {
			s.Debug(ctx, "PushUnboxed: pushing an unboxed message from wrong conv: correct: %s trip: %+v id: %d",
				convID, msg.Valid().ClientHeader.Conv, msg.GetMessageID())
			return errors.New("cannot push into a different conversation")
		}
	}
	if err = s.mergeMaybeNotify(ctx, conv, uid, msgs, chat1.GetThreadReason_PUSH); err != nil {
		return err
	}
	return nil
}

func (s *HybridConversationSource) resolveHoles(ctx context.Context, uid gregor1.UID,
	thread *chat1.ThreadView, conv chat1.Conversation, reason chat1.GetThreadReason,
	customRi func() chat1.RemoteInterface) (err error) {
	defer s.Trace(ctx, &err, "resolveHoles")()
	var msgIDs []chat1.MessageID
	// Gather all placeholder messages so we can go fetch them
	for index, msg := range thread.Messages {
		if msg.IsPlaceholder() {
			if index == len(thread.Messages)-1 {
				// If the last message is a hole, we might not have fetched everything,
				// so fail this case like a normal miss
				return storage.MissError{}
			}
			msgIDs = append(msgIDs, msg.GetMessageID())
		}
	}
	if len(msgIDs) == 0 {
		// Nothing to do
		return nil
	}
	// Fetch all missing messages from server, and sub in the real ones into the placeholder slots
	msgs, err := s.GetMessages(ctx, conv.GetConvID(), uid, msgIDs, &reason, customRi, false)
	if err != nil {
		s.Debug(ctx, "resolveHoles: failed to get missing messages: %s", err.Error())
		return err
	}
	s.Debug(ctx, "resolveHoles: success: filled %d holes", len(msgs))
	msgMap := make(map[chat1.MessageID]chat1.MessageUnboxed)
	for _, msg := range msgs {
		msgMap[msg.GetMessageID()] = msg
	}
	for index, msg := range thread.Messages {
		if msg.IsPlaceholder() {
			newMsg, ok := msgMap[msg.GetMessageID()]
			if !ok {
				return fmt.Errorf("failed to find hole resolution: %v", msg.GetMessageID())
			}
			thread.Messages[index] = newMsg
		}
	}
	return nil
}

func (s *HybridConversationSource) getConvForPull(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID) (res types.RemoteConversation, err error) {
	rconv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return res, err
	}
	if !rconv.Conv.HasMemberStatus(chat1.ConversationMemberStatus_NEVER_JOINED) {
		return rconv, nil
	}
	s.Debug(ctx, "getConvForPull: in conversation with never joined, getting conv from remote")
	return utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceRemoteOnly)
}

// maxHolesForPull is the number of misses in the body storage cache we will tolerate missing. A good
// way to think about this number is the number of extra reads from the cache we need to do before
// formally declaring the request a failure.
var maxHolesForPull = 50

func (s *HybridConversationSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, reason chat1.GetThreadReason, customRi func() chat1.RemoteInterface,
	query *chat1.GetThreadQuery, pagination *chat1.Pagination) (thread chat1.ThreadView, err error) {
	ctx = libkb.WithLogTag(ctx, "PUL")
	defer s.Trace(ctx, &err, "Pull(%s)", convID)()
	if convID.IsNil() {
		return chat1.ThreadView{}, errors.New("HybridConversationSource.Pull called with empty convID")
	}
	if _, err = s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return thread, err
	}
	defer s.lockTab.Release(ctx, uid, convID)
	defer s.maybeNuke(ctx, convID, uid, &err)

	// Get conversation metadata
	rconv, err := s.getConvForPull(ctx, uid, convID)
	var unboxConv types.UnboxConversationInfo
	if err == nil && !rconv.Conv.HasMemberStatus(chat1.ConversationMemberStatus_NEVER_JOINED) {
		conv := rconv.Conv
		unboxConv = conv
		// Try locally first
		rc := storage.NewHoleyResultCollector(maxHolesForPull,
			s.storage.ResultCollectorFromQuery(ctx, query, pagination))
		thread, err = s.fetchMaybeNotify(ctx, conv.GetConvID(), uid, rc, conv.ReaderInfo.MaxMsgid,
			query, pagination)
		if err == nil {
			// Since we are using the "holey" collector, we need to resolve any placeholder
			// messages that may have been fetched.
			s.Debug(ctx, "Pull: (holey) cache hit: convID: %s uid: %s holes: %d msgs: %d",
				unboxConv.GetConvID(), uid, rc.Holes(), len(thread.Messages))
			err = s.resolveHoles(ctx, uid, &thread, conv, reason, customRi)
		}
		if err == nil {
			// Before returning the stuff, send remote request to mark as read if
			// requested.
			if query != nil && query.MarkAsRead && len(thread.Messages) > 0 {
				readMsgID := thread.Messages[0].GetMessageID()
				if err = s.G().InboxSource.MarkAsRead(ctx, convID, uid, &readMsgID, false /* forceUnread */); err != nil {
					return chat1.ThreadView{}, err
				}
				if _, err = s.G().InboxSource.ReadMessage(ctx, uid, 0, convID, readMsgID); err != nil {
					return chat1.ThreadView{}, err
				}
			} else {
				s.Debug(ctx, "Pull: skipping mark as read call")
			}
			// Run post process stuff
			vconv, err := utils.GetVerifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
			if err == nil {
				if err = s.postProcessThread(ctx, uid, reason, conv, &thread, query, nil, nil, true, true, &vconv); err != nil {
					return thread, err
				}
			}
			return thread, nil
		}
		s.Debug(ctx, "Pull: cache miss: err: %s", err)
	} else {
		s.Debug(ctx, "Pull: error fetching conv metadata: convID: %s uid: %s err: %s", convID, uid, err)
	}

	// Fetch the entire request on failure
	rarg := chat1.GetThreadRemoteArg{
		ConversationID: convID,
		Query:          query,
		Pagination:     pagination,
		Reason:         reason,
	}
	boxed, err := s.getRi(customRi).GetThreadRemote(ctx, rarg)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	// Set up public inbox info if we don't have one with members type from remote call. Assume this is a
	// public chat here, since it is the only chance we have to unbox it.
	if unboxConv == nil {
		unboxConv = newExtraInboxUnboxConverstionInfo(convID, boxed.MembersType, boxed.Visibility)
	}

	// Unbox
	thread, err = s.boxer.UnboxThread(ctx, boxed.Thread, unboxConv)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	// Store locally (just warn on error, don't abort the whole thing)
	if err = s.mergeMaybeNotify(ctx, unboxConv, uid, thread.Messages, reason); err != nil {
		s.Debug(ctx, "Pull: unable to commit thread locally: convID: %s uid: %s", convID, uid)
	}

	// Run post process stuff
	if err = s.postProcessThread(ctx, uid, reason, unboxConv, &thread, query, nil, nil, true, true, nil); err != nil {
		return thread, err
	}
	return thread, nil
}

type pullLocalResultCollector struct {
	storage.ResultCollector
}

func (p *pullLocalResultCollector) Name() string {
	return "pulllocal"
}

func (p *pullLocalResultCollector) String() string {
	return fmt.Sprintf("[ %s: base: %s ]", p.Name(), p.ResultCollector)
}

func (p *pullLocalResultCollector) hasRealResults() bool {
	for _, m := range p.Result() {
		st, err := m.State()
		if err != nil {
			// count these
			return true
		}
		switch st {
		case chat1.MessageUnboxedState_PLACEHOLDER:
			// don't count!
		default:
			return true
		}
	}
	return false
}

func (p *pullLocalResultCollector) Error(err storage.Error) storage.Error {
	// Swallow this error, we know we can miss if we get anything at all
	if _, ok := err.(storage.MissError); ok && p.hasRealResults() {
		return nil
	}
	return err
}

func newPullLocalResultCollector(baseRC storage.ResultCollector) *pullLocalResultCollector {
	return &pullLocalResultCollector{
		ResultCollector: baseRC,
	}
}

func (s *HybridConversationSource) PullLocalOnly(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, reason chat1.GetThreadReason, query *chat1.GetThreadQuery, pagination *chat1.Pagination, maxPlaceholders int) (tv chat1.ThreadView, err error) {
	ctx = libkb.WithLogTag(ctx, "PUL")
	defer s.Trace(ctx, &err, "PullLocalOnly")()
	if _, err = s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return tv, err
	}
	defer s.lockTab.Release(ctx, uid, convID)
	defer s.maybeNuke(ctx, convID, uid, &err)

	// Post process thread before returning
	defer func() {
		if err == nil {
			superXform := newBasicSupersedesTransform(s.G(), basicSupersedesTransformOpts{})
			superXform.SetMessagesFunc(func(ctx context.Context, convID chat1.ConversationID,
				uid gregor1.UID, msgIDs []chat1.MessageID,
				_ *chat1.GetThreadReason, _ func() chat1.RemoteInterface, _ bool) (res []chat1.MessageUnboxed, err error) {
				msgs, err := storage.New(s.G(), s).FetchMessages(ctx, convID, uid, msgIDs)
				if err != nil {
					return nil, err
				}
				for _, msg := range msgs {
					if msg != nil {
						res = append(res, *msg)
					}
				}
				return res, nil
			})
			replyFiller := NewReplyFiller(s.G(), LocalOnlyReplyFill(true))
			// Form a fake version of a conversation so we don't need to hit the network ever here
			var conv chat1.Conversation
			conv.Metadata.ConversationID = convID
			err = s.postProcessThread(ctx, uid, reason, conv, &tv, query, superXform, replyFiller, false,
				true, nil)
		}
	}()

	// Fetch the inbox max message ID as well to compare against the local stored max messages
	// if the caller is ok with receiving placeholders
	var iboxMaxMsgID chat1.MessageID
	if maxPlaceholders > 0 {
		iboxRes, err := storage.NewInbox(s.G()).GetConversation(ctx, uid, convID)
		if err != nil {
			s.Debug(ctx, "PullLocalOnly: failed to read inbox for conv, not using: %s", err)
		} else if iboxRes.Conv.ReaderInfo == nil {
			s.Debug(ctx, "PullLocalOnly: no reader infoconv returned for conv, not using")
		} else {
			iboxMaxMsgID = iboxRes.Conv.ReaderInfo.MaxMsgid
			s.Debug(ctx, "PullLocalOnly: found ibox max msgid: %d", iboxMaxMsgID)
		}
	}

	// A number < 0 means it will fetch until it hits the end of the local copy. Our special
	// result collector will suppress any miss errors
	num := -1
	if pagination != nil {
		num = pagination.Num
	}
	baseRC := s.storage.ResultCollectorFromQuery(ctx, query, pagination)
	baseRC.SetTarget(num)
	rc := storage.NewHoleyResultCollector(maxPlaceholders, newPullLocalResultCollector(baseRC))
	tv, err = s.fetchMaybeNotify(ctx, convID, uid, rc, iboxMaxMsgID, query, pagination)
	if err != nil {
		s.Debug(ctx, "PullLocalOnly: failed to fetch local messages with iboxMaxMsgID: %v: err %s, trying again with local max", iboxMaxMsgID, err)
		tv, err = s.fetchMaybeNotify(ctx, convID, uid, rc, 0, query, pagination)
		if err != nil {
			s.Debug(ctx, "PullLocalOnly: failed to fetch local messages with local max: %s", err)
			return chat1.ThreadView{}, err
		}
	}
	return tv, nil
}

func (s *HybridConversationSource) Clear(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	opts *types.ClearOpts) (err error) {
	defer s.Trace(ctx, &err, "Clear(%v,%v)", uid, convID)()
	defer s.PerfTrace(ctx, &err, "Clear(%v,%v)", uid, convID)()
	start := time.Now()
	defer func() {
		var message string
		if err == nil {
			message = fmt.Sprintf("Clearing conv for %s", convID)
		} else {
			message = fmt.Sprintf("Failed to clear conv %s", convID)
		}
		s.G().RuntimeStats.PushPerfEvent(keybase1.PerfEvent{
			EventType: keybase1.PerfEventType_CLEARCONV,
			Message:   message,
			Ctime:     keybase1.ToTime(start),
		})
	}()
	kuid := keybase1.UID(uid.String())
	if (s.G().Env.GetRunMode() == libkb.DevelRunMode || libkb.IsKeybaseAdmin(kuid)) &&
		s.G().UIRouter != nil && opts != nil && opts.SendLocalAdminNotification {
		ui, err := s.G().UIRouter.GetLogUI()
		if err == nil && ui != nil {
			ui.Critical("Clearing conv %s", opts.Reason)
		}
	}

	epick := libkb.FirstErrorPicker{}
	epick.Push(s.storage.ClearAll(ctx, convID, uid))
	epick.Push(s.G().Indexer.Clear(ctx, uid, convID))
	return epick.Error()
}

func (s *HybridConversationSource) GetMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgIDs []chat1.MessageID, threadReason *chat1.GetThreadReason,
	customRi func() chat1.RemoteInterface, resolveSupersedes bool) (res []chat1.MessageUnboxed, err error) {
	defer s.Trace(ctx, &err, "GetMessages: convID: %s msgIDs: %d",
		convID, len(msgIDs))()
	if _, err := s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return nil, err
	}
	defer s.lockTab.Release(ctx, uid, convID)
	defer s.maybeNuke(ctx, convID, uid, &err)
	defer func() {
		// unless arg says not to, transform the superseded messages
		if !resolveSupersedes {
			return
		}
		res, err = s.TransformSupersedes(ctx, convID, uid, res, nil, nil, nil, nil)
	}()

	// Grab local messages
	msgs, err := s.storage.FetchMessages(ctx, convID, uid, msgIDs)
	if err != nil {
		return nil, err
	}

	// Make a pass to determine which message IDs we need to grab remotely
	var remoteMsgs []chat1.MessageID
	for index, msg := range msgs {
		if msg == nil {
			remoteMsgs = append(remoteMsgs, msgIDs[index])
		}
	}

	// Grab message from remote
	rmsgsTab := make(map[chat1.MessageID]chat1.MessageUnboxed)
	s.Debug(ctx, "GetMessages: convID: %s uid: %s total msgs: %d remote: %d", convID, uid, len(msgIDs),
		len(remoteMsgs))
	if len(remoteMsgs) > 0 {
		rmsgs, err := s.getRi(customRi).GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
			ConversationID: convID,
			MessageIDs:     remoteMsgs,
			ThreadReason:   threadReason,
		})
		if err != nil {
			return nil, err
		}

		// Unbox all the remote messages
		conv := newBasicUnboxConversationInfo(convID, rmsgs.MembersType, nil, rmsgs.Visibility)
		rmsgsUnboxed, err := s.boxer.UnboxMessages(ctx, rmsgs.Msgs, conv)
		if err != nil {
			return nil, err
		}

		sort.Sort(utils.ByMsgUnboxedMsgID(rmsgsUnboxed))
		for _, rmsg := range rmsgsUnboxed {
			rmsgsTab[rmsg.GetMessageID()] = rmsg
		}

		reason := chat1.GetThreadReason_GENERAL
		if threadReason != nil {
			reason = *threadReason
		}
		// Write out messages
		if err := s.mergeMaybeNotify(ctx, conv, uid, rmsgsUnboxed, reason); err != nil {
			return nil, err
		}

		// The localizer uses UnboxQuickMode for unboxing and storing messages. Because of this, if there
		// is a message in the deep past used for something like a channel name, headline, or pin, then we
		// will never actually cache it. Detect this case here and put a load of the messages onto the
		// background loader so we can get these messages cached with the full checks on UnboxMessage.
		if reason == chat1.GetThreadReason_LOCALIZE && globals.CtxUnboxMode(ctx) == types.UnboxModeQuick {
			s.Debug(ctx, "GetMessages: convID: %s remoteMsgs: %d: cache miss on localizer mode with UnboxQuickMode, queuing job", convID, len(remoteMsgs))
			// implement the load entirely in the post load hook since we only want to load those
			// messages in remoteMsgs. We can do that by specifying a 0 length pagination object.
			if err := s.G().ConvLoader.Queue(ctx, types.NewConvLoaderJob(convID, &chat1.Pagination{Num: 0},
				types.ConvLoaderPriorityLowest, types.ConvLoaderUnique,
				func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
					reason := chat1.GetThreadReason_BACKGROUNDCONVLOAD
					if _, err := s.G().ConvSource.GetMessages(ctx, convID, uid, remoteMsgs, &reason,
						customRi, resolveSupersedes); err != nil {
						s.Debug(ctx, "GetMessages: error loading UnboxQuickMode cache misses: ", err)
					}

				})); err != nil {
				s.Debug(ctx, "GetMessages: error queuing conv loader job: %+v", err)
			}
		}
	}

	// Form final result
	for index, msg := range msgs {
		if msg != nil {
			res = append(res, *msg)
		} else {
			res = append(res, rmsgsTab[msgIDs[index]])
		}
	}
	return res, nil
}

func (s *HybridConversationSource) GetMessagesWithRemotes(ctx context.Context,
	conv chat1.Conversation, uid gregor1.UID, msgs []chat1.MessageBoxed) (res []chat1.MessageUnboxed, err error) {
	convID := conv.GetConvID()
	if _, err := s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return nil, err
	}
	defer s.lockTab.Release(ctx, uid, convID)
	defer s.maybeNuke(ctx, convID, uid, &err)

	var msgIDs []chat1.MessageID
	for _, msg := range msgs {
		msgIDs = append(msgIDs, msg.GetMessageID())
	}

	lmsgsTab := make(map[chat1.MessageID]chat1.MessageUnboxed)

	lmsgs, err := s.storage.FetchMessages(ctx, convID, uid, msgIDs)
	if err != nil {
		return nil, err
	}
	for _, lmsg := range lmsgs {
		if lmsg != nil {
			lmsgsTab[lmsg.GetMessageID()] = *lmsg
		}
	}

	s.Debug(ctx, "GetMessagesWithRemotes: convID: %s uid: %s total msgs: %d hits: %d", convID, uid,
		len(msgs), len(lmsgsTab))
	var merges []chat1.MessageUnboxed
	for _, msg := range msgs {
		if lmsg, ok := lmsgsTab[msg.GetMessageID()]; ok {
			res = append(res, lmsg)
		} else {
			unboxed, err := s.boxer.UnboxMessage(ctx, msg, conv, nil)
			if err != nil {
				return res, err
			}
			merges = append(merges, unboxed)
			res = append(res, unboxed)
		}
	}
	if len(merges) > 0 {
		sort.Sort(utils.ByMsgUnboxedMsgID(merges))
		if err := s.mergeMaybeNotify(ctx, utils.RemoteConv(conv), uid, merges, chat1.GetThreadReason_GENERAL); err != nil {
			return res, err
		}
	}
	sort.Sort(utils.ByMsgUnboxedMsgID(res))
	return res, nil
}

func (s *HybridConversationSource) GetUnreadline(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, readMsgID chat1.MessageID) (unreadlineID *chat1.MessageID, err error) {
	defer s.Trace(ctx, &err, fmt.Sprintf("GetUnreadline: convID: %v, readMsgID: %v", convID, readMsgID))()
	defer s.maybeNuke(ctx, convID, uid, &err)

	conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceLocalOnly)
	if err != nil { // short circuit to the server
		s.Debug(ctx, "unable to GetUnverifiedConv: %v", err)
		return s.getUnreadlineRemote(ctx, convID, readMsgID)
	}
	// Don't bother checking anything if we don't have any unread messages.
	if !conv.Conv.IsUnreadFromMsgID(readMsgID) {
		return nil, nil
	}

	unreadlineID, err = storage.New(s.G(), s).FetchUnreadlineID(ctx, convID, uid, readMsgID)
	if err != nil {
		return nil, err
	}
	if unreadlineID == nil {
		return s.getUnreadlineRemote(ctx, convID, readMsgID)
	}
	return unreadlineID, nil
}

func (s *HybridConversationSource) notifyExpunge(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, mergeRes storage.MergeResult) {
	if mergeRes.Expunged != nil {
		topicType := chat1.TopicType_NONE
		conv, err := utils.GetVerifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
		if err != nil {
			s.Debug(ctx, "notifyExpunge: failed to get conversations: %s", err)
		} else {
			topicType = conv.GetTopicType()
		}
		act := chat1.NewChatActivityWithExpunge(chat1.ExpungeInfo{
			ConvID:  convID,
			Expunge: *mergeRes.Expunged,
		})
		s.G().ActivityNotifier.Activity(ctx, uid, topicType, &act, chat1.ChatActivitySource_LOCAL)
		s.G().InboxSource.NotifyUpdate(ctx, uid, convID)
	}
}

func (s *HybridConversationSource) notifyUpdated(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgs []chat1.MessageUnboxed) {
	if len(msgs) == 0 {
		s.Debug(ctx, "notifyUpdated: nothing to do")
		return
	}
	s.Debug(ctx, "notifyUpdated: notifying %d messages", len(msgs))
	conv, err := utils.GetVerifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		s.Debug(ctx, "notifyUpdated: failed to get conv: %s", err)
		return
	}
	maxDeletedUpTo := conv.GetMaxDeletedUpTo()
	updatedMsgs, err := s.TransformSupersedes(ctx, convID, uid, msgs, nil, nil, nil, &maxDeletedUpTo)
	if err != nil {
		s.Debug(ctx, "notifyUpdated: failed to transform supersedes: %s", err)
		return
	}
	s.Debug(ctx, "notifyUpdated: %d messages after transform", len(updatedMsgs))
	if updatedMsgs, err = NewReplyFiller(s.G()).Fill(ctx, uid, convID, updatedMsgs); err != nil {
		s.Debug(ctx, "notifyUpdated: failed to fill replies %s", err)
		return
	}
	notif := chat1.MessagesUpdated{
		ConvID: convID,
	}
	for _, msg := range updatedMsgs {
		notif.Updates = append(notif.Updates, utils.PresentMessageUnboxed(ctx, s.G(), msg, uid, convID))
	}
	act := chat1.NewChatActivityWithMessagesUpdated(notif)
	s.G().ActivityNotifier.Activity(ctx, uid, conv.GetTopicType(),
		&act, chat1.ChatActivitySource_LOCAL)
}

// notifyReactionUpdates notifies the GUI after reactions are received
func (s *HybridConversationSource) notifyReactionUpdates(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgs []chat1.MessageUnboxed) {
	s.Debug(ctx, "notifyReactionUpdates: %d msgs to update", len(msgs))
	if len(msgs) > 0 {
		conv, err := utils.GetVerifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
		if err != nil {
			s.Debug(ctx, "notifyReactionUpdates: failed to get conversations: %s", err)
			return
		}
		maxDeletedUpTo := conv.GetMaxDeletedUpTo()
		msgs, err = s.TransformSupersedes(ctx, convID, uid, msgs, nil, nil, nil, &maxDeletedUpTo)
		if err != nil {
			s.Debug(ctx, "notifyReactionUpdates: failed to transform supersedes: %s", err)
			return
		}
		reactionUpdates := []chat1.ReactionUpdate{}
		for _, msg := range msgs {
			if msg.IsValid() {
				d := utils.PresentDecoratedReactionMap(ctx, s.G(), uid, convID, msg.Valid(),
					msg.Valid().Reactions)
				reactionUpdates = append(reactionUpdates, chat1.ReactionUpdate{
					Reactions:   d,
					TargetMsgID: msg.GetMessageID(),
				})
			}
		}
		if len(reactionUpdates) > 0 {
			userReacjis := storage.NewReacjiStore(s.G()).UserReacjis(ctx, uid)
			activity := chat1.NewChatActivityWithReactionUpdate(chat1.ReactionUpdateNotif{
				UserReacjis:     userReacjis,
				ReactionUpdates: reactionUpdates,
				ConvID:          convID,
			})
			s.G().ActivityNotifier.Activity(ctx, uid, conv.GetTopicType(), &activity,
				chat1.ChatActivitySource_LOCAL)
		}
	}
}

// notifyEphemeralPurge notifies the GUI after messages are exploded.
func (s *HybridConversationSource) notifyEphemeralPurge(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, explodedMsgs []chat1.MessageUnboxed) {
	s.Debug(ctx, "notifyEphemeralPurge: exploded: %d", len(explodedMsgs))
	if len(explodedMsgs) > 0 {
		// Blast out an EphemeralPurgeNotifInfo since it's time sensitive for the UI
		// to update.
		purgedMsgs := []chat1.UIMessage{}
		for _, msg := range explodedMsgs {
			purgedMsgs = append(purgedMsgs, utils.PresentMessageUnboxed(ctx, s.G(), msg, uid, convID))
		}
		act := chat1.NewChatActivityWithEphemeralPurge(chat1.EphemeralPurgeNotifInfo{
			ConvID: convID,
			Msgs:   purgedMsgs,
		})
		s.G().ActivityNotifier.Activity(ctx, uid, chat1.TopicType_CHAT, &act, chat1.ChatActivitySource_LOCAL)

		// Send an additional notification to refresh the thread after we bump
		// the local inbox version
		s.G().InboxSource.NotifyUpdate(ctx, uid, convID)
		s.notifyUpdated(ctx, uid, convID, s.storage.GetExplodedReplies(ctx, convID, uid, explodedMsgs))
	}
}

// Expunge from storage and maybe notify the gui of staleness
func (s *HybridConversationSource) Expunge(ctx context.Context,
	conv types.UnboxConversationInfo, uid gregor1.UID, expunge chat1.Expunge) (err error) {
	defer s.Trace(ctx, &err, "Expunge")()
	convID := conv.GetConvID()
	defer s.maybeNuke(ctx, convID, uid, &err)
	s.Debug(ctx, "Expunge: convID: %s uid: %s upto: %v", convID, uid, expunge.Upto)
	if expunge.Upto == 0 {
		// just get out of here as quickly as possible with a 0 upto
		return nil
	}
	_, err = s.lockTab.Acquire(ctx, uid, convID)
	if err != nil {
		return err
	}
	defer s.lockTab.Release(ctx, uid, convID)
	mergeRes, err := s.storage.Expunge(ctx, conv, uid, expunge)
	if err != nil {
		return err
	}
	s.notifyExpunge(ctx, uid, convID, mergeRes)
	return nil
}

// Merge with storage and maybe notify the gui of staleness
func (s *HybridConversationSource) mergeMaybeNotify(ctx context.Context,
	conv types.UnboxConversationInfo, uid gregor1.UID, msgs []chat1.MessageUnboxed, reason chat1.GetThreadReason) error {
	convID := conv.GetConvID()
	switch globals.CtxUnboxMode(ctx) {
	case types.UnboxModeFull:
		s.Debug(ctx, "mergeMaybeNotify: full mode, merging %d messages", len(msgs))
	case types.UnboxModeQuick:
		s.Debug(ctx, "mergeMaybeNotify: quick mode, skipping %d messages", len(msgs))
		globals.CtxAddMessageCacheSkips(ctx, convID, msgs)
		return nil
	}

	mergeRes, err := s.storage.Merge(ctx, conv, uid, msgs)
	if err != nil {
		return err
	}

	// skip notifications during background loads
	if reason == chat1.GetThreadReason_BACKGROUNDCONVLOAD {
		return nil
	}

	var unfurlTargets []chat1.MessageUnboxed
	for _, r := range mergeRes.UnfurlTargets {
		if r.IsMapDelete {
			// we don't tell the UI about map deletes so they don't jump in and out
			continue
		}
		unfurlTargets = append(unfurlTargets, r.Msg)
	}
	s.notifyExpunge(ctx, uid, convID, mergeRes)
	s.notifyEphemeralPurge(ctx, uid, convID, mergeRes.Exploded)
	s.notifyReactionUpdates(ctx, uid, convID, mergeRes.ReactionTargets)
	s.notifyUpdated(ctx, uid, convID, unfurlTargets)
	s.notifyUpdated(ctx, uid, convID, mergeRes.RepliesAffected)
	return nil
}

func (s *HybridConversationSource) fetchMaybeNotify(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, rc storage.ResultCollector, maxMsgID chat1.MessageID, query *chat1.GetThreadQuery,
	pagination *chat1.Pagination) (tv chat1.ThreadView, err error) {

	fetchRes, err := s.storage.FetchUpToLocalMaxMsgID(ctx, convID, uid, rc, maxMsgID,
		query, pagination)
	if err != nil {
		return tv, err
	}
	s.notifyEphemeralPurge(ctx, uid, convID, fetchRes.Exploded)
	return fetchRes.Thread, nil
}

func (s *HybridConversationSource) EphemeralPurge(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	purgeInfo *chat1.EphemeralPurgeInfo) (newPurgeInfo *chat1.EphemeralPurgeInfo, explodedMsgs []chat1.MessageUnboxed, err error) {
	defer s.Trace(ctx, &err, "EphemeralPurge")()
	defer s.maybeNuke(ctx, convID, uid, &err)
	if newPurgeInfo, explodedMsgs, err = s.storage.EphemeralPurge(ctx, convID, uid, purgeInfo); err != nil {
		return newPurgeInfo, explodedMsgs, err
	}
	s.notifyEphemeralPurge(ctx, uid, convID, explodedMsgs)
	return newPurgeInfo, explodedMsgs, nil
}

func NewConversationSource(g *globals.Context, typ string, boxer *Boxer, storage *storage.Storage,
	ri func() chat1.RemoteInterface) types.ConversationSource {
	if typ == "hybrid" {
		return NewHybridConversationSource(g, boxer, storage, ri)
	}
	return NewRemoteConversationSource(g, boxer, ri)
}
