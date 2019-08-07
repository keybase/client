package chat

import (
	"errors"
	"fmt"
	"sort"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
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
	labeler := utils.NewDebugLabeler(g.GetLog(), "baseConversationSource", false)
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
	defer s.Trace(ctx, func() error { return nil }, "DeleteAssets: %v", assets)()

	if len(assets) == 0 {
		return
	}

	// Fire off a background load of the thread with a post hook to delete the bodies cache
	s.G().ConvLoader.Queue(ctx, types.NewConvLoaderJob(convID, nil /*query*/, nil /*pagination*/, types.ConvLoaderPriorityHigh,
		func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
			fetcher := s.G().AttachmentURLSrv.GetAttachmentFetcher()
			if err := fetcher.DeleteAssets(ctx, convID, assets, s.ri, s); err != nil {
				s.Debug(ctx, "Error purging ephemeral attachments %v", err)
			}
		}))
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

func (s *baseConversationSource) postProcessThread(ctx context.Context, uid gregor1.UID,
	conv types.UnboxConversationInfo, thread *chat1.ThreadView, q *chat1.GetThreadQuery,
	superXform types.SupersedesTransform, replyFiller types.ReplyFiller, checkPrev bool, patchPagination bool) (err error) {
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
	if thread.Messages, err = s.TransformSupersedes(ctx, conv, uid, thread.Messages, q, superXform,
		replyFiller); err != nil {
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

	// Fetch outbox and tack onto the result
	outbox := storage.NewOutbox(s.G(), uid)
	if err = outbox.SprinkleIntoThread(ctx, conv.GetConvID(), thread); err != nil {
		if _, ok := err.(storage.MissError); !ok {
			return err
		}
	}
	// Add attachment previews to pending messages
	s.addPendingPreviews(ctx, thread)
	return nil
}

func (s *baseConversationSource) TransformSupersedes(ctx context.Context,
	unboxInfo types.UnboxConversationInfo, uid gregor1.UID, msgs []chat1.MessageUnboxed,
	q *chat1.GetThreadQuery, superXform types.SupersedesTransform, replyFiller types.ReplyFiller) (res []chat1.MessageUnboxed, err error) {
	defer s.Trace(ctx, func() error { return err }, "TransformSupersedes")()
	if q == nil || !q.DisableResolveSupersedes {
		deletePlaceholders := q != nil && q.EnableDeletePlaceholders
		if superXform == nil {
			superXform = newBasicSupersedesTransform(s.G(), basicSupersedesTransformOpts{
				UseDeletePlaceholders: deletePlaceholders,
			})
		}
		if res, err = superXform.Run(ctx, unboxInfo, uid, msgs); err != nil {
			return nil, err
		}
	} else {
		res = msgs
	}
	if replyFiller == nil {
		replyFiller = NewReplyFiller(s.G())
	}
	return replyFiller.Fill(ctx, uid, unboxInfo, res)
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

func (s *baseConversationSource) PullFull(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, reason chat1.GetThreadReason,
	query *chat1.GetThreadQuery, maxPages *int) (res chat1.ThreadView, err error) {
	pagination := &chat1.Pagination{
		Num: 300,
	}
	if maxPages == nil {
		defaultMaxPages := 10000
		maxPages = &defaultMaxPages
	}
	for i := 0; !pagination.Last && i < *maxPages; i++ {
		thread, err := s.G().ConvSource.Pull(ctx, convID, uid, reason, query, pagination)
		if err != nil {
			return res, err
		}
		res.Messages = append(res.Messages, thread.Messages...)
		pagination.Next = thread.Pagination.Next
		pagination.Last = thread.Pagination.Last
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

func (s *RemoteConversationSource) PushUnboxed(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg []chat1.MessageUnboxed) error {
	return nil
}

func (s *RemoteConversationSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, reason chat1.GetThreadReason, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, error) {

	if convID.IsNil() {
		return chat1.ThreadView{}, errors.New("RemoteConversationSource.Pull called with empty convID")
	}

	// Get conversation metadata
	conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
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
	boxed, err := s.ri().GetThreadRemote(ctx, rarg)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	thread, err := s.boxer.UnboxThread(ctx, boxed.Thread, conv.Conv)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	// Post process thread before returning
	if err = s.postProcessThread(ctx, uid, conv.Conv, &thread, query, nil, nil, true, false); err != nil {
		return chat1.ThreadView{}, err
	}

	return thread, nil
}

func (s *RemoteConversationSource) PullLocalOnly(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination, maxPlaceholders int) (chat1.ThreadView, error) {
	return chat1.ThreadView{}, storage.MissError{Msg: "PullLocalOnly is unimplemented for RemoteConversationSource"}
}

func (s *RemoteConversationSource) Clear(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) error {
	return nil
}

func (s *RemoteConversationSource) GetMessages(ctx context.Context, conv types.UnboxConversationInfo,
	uid gregor1.UID, msgIDs []chat1.MessageID, threadReason *chat1.GetThreadReason) ([]chat1.MessageUnboxed, error) {

	rres, err := s.ri().GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
		ConversationID: conv.GetConvID(),
		MessageIDs:     msgIDs,
		ThreadReason:   threadReason,
	})
	if err != nil {
		return nil, err
	}

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
	convID chat1.ConversationID, uid gregor1.UID, expunge chat1.Expunge) error {
	return nil
}

func (s *RemoteConversationSource) ClearFromDelete(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID) bool {
	return false
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
		DebugLabeler:           utils.NewDebugLabeler(g.GetLog(), "HybridConversationSource", false),
		baseConversationSource: newBaseConversationSource(g, ri, b),
		storage:                storage,
		lockTab:                utils.NewConversationLockTab(g),
		numExpungeReload:       100,
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

func (s *HybridConversationSource) Push(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg chat1.MessageBoxed) (decmsg chat1.MessageUnboxed, continuousUpdate bool, err error) {
	defer s.Trace(ctx, func() error { return err }, "Push")()
	if _, err = s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return decmsg, continuousUpdate, err
	}
	defer s.lockTab.Release(ctx, uid, convID)

	// Grab conversation information before pushing
	conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return decmsg, continuousUpdate, err
	}

	// Check to see if we are "appending" this message to the current record.
	if continuousUpdate, err = s.isContinuousPush(ctx, convID, uid, msg.GetMessageID()); err != nil {
		return decmsg, continuousUpdate, err
	}

	decmsg, err = s.boxer.UnboxMessage(ctx, msg, conv.Conv, nil)
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
	if err = s.mergeMaybeNotify(ctx, convID, uid, []chat1.MessageUnboxed{decmsg}); err != nil {
		return decmsg, continuousUpdate, err
	}
	// Remove any pending previews from storage
	s.completeAttachmentUpload(ctx, decmsg)
	// complete any active unfurl
	s.completeUnfurl(ctx, decmsg)

	return decmsg, continuousUpdate, nil
}

func (s *HybridConversationSource) PushUnboxed(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) (err error) {
	defer s.Trace(ctx, func() error { return err }, "PushUnboxed")()
	if _, err = s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return err
	}
	defer s.lockTab.Release(ctx, uid, convID)
	if err = s.mergeMaybeNotify(ctx, convID, uid, msgs); err != nil {
		return err
	}
	return nil
}

func (s *HybridConversationSource) resolveHoles(ctx context.Context, uid gregor1.UID,
	thread *chat1.ThreadView, conv chat1.Conversation, reason chat1.GetThreadReason) (holesFilled int, err error) {
	defer s.Trace(ctx, func() error { return err }, "resolveHoles")()
	var msgIDs []chat1.MessageID
	// Gather all placeholder messages so we can go fetch them
	for index, msg := range thread.Messages {
		state, err := msg.State()
		if err != nil {
			continue
		}
		if state == chat1.MessageUnboxedState_PLACEHOLDER {
			if index == len(thread.Messages)-1 {
				// If the last message is a hole, we might not have fetched everything,
				// so fail this case like a normal miss
				return 0, storage.MissError{}
			}
			msgIDs = append(msgIDs, msg.GetMessageID())
		}
	}
	if len(msgIDs) == 0 {
		// Nothing to do
		return 0, nil
	}
	// Fetch all missing messages from server, and sub in the real ones into the placeholder slots
	msgs, err := s.GetMessages(ctx, conv, uid, msgIDs, &reason)
	if err != nil {
		s.Debug(ctx, "resolveHoles: failed to get missing messages: %s", err.Error())
		return 0, err
	}
	s.Debug(ctx, "resolveHoles: success: filled %d holes", len(msgs))
	return len(msgs), nil
}

// maxHolesForPull is the number of misses in the body storage cache we will tolerate missing. A good
// way to think about this number is the number of extra reads from the cache we need to do before
// formally declaring the request a failure.
var maxHolesForPull = 50

func (s *HybridConversationSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, reason chat1.GetThreadReason, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (thread chat1.ThreadView, err error) {
	defer s.Trace(ctx, func() error { return err }, "Pull(%s)", convID)()
	if convID.IsNil() {
		return chat1.ThreadView{}, errors.New("HybridConversationSource.Pull called with empty convID")
	}
	if _, err = s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return thread, err
	}
	defer s.lockTab.Release(ctx, uid, convID)

	// Get conversation metadata
	rconv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	var unboxConv types.UnboxConversationInfo
	if err == nil {
		conv := rconv.Conv
		unboxConv = conv
		// Try locally first
		var holesFilled int
		rc := storage.NewHoleyResultCollector(maxHolesForPull,
			s.storage.ResultCollectorFromQuery(ctx, query, pagination))
		thread, err = s.fetchMaybeNotify(ctx, conv.GetConvID(), uid, rc, conv.ReaderInfo.MaxMsgid,
			query, pagination)
		if err == nil {
			// Since we are using the "holey" collector, we need to resolve any placeholder
			// messages that may have been fetched.
			s.Debug(ctx, "Pull: (holey) cache hit: convID: %s uid: %s holes: %d msgs: %d",
				unboxConv.GetConvID(), uid, rc.Holes(), len(thread.Messages))
			holesFilled, err = s.resolveHoles(ctx, uid, &thread, conv, reason)
		}
		if err == nil && holesFilled > 0 {
			s.Debug(ctx, "Pull: %d holes filled, refetching from storage")
			rc := s.storage.ResultCollectorFromQuery(ctx, query, pagination)
			thread, err = s.fetchMaybeNotify(ctx, conv.GetConvID(), uid, rc, conv.ReaderInfo.MaxMsgid,
				query, pagination)
		}
		if err == nil {
			// Before returning the stuff, send remote request to mark as read if
			// requested.
			if query != nil && query.MarkAsRead && len(thread.Messages) > 0 {
				readMsgID := thread.Messages[0].GetMessageID()
				if err = s.G().InboxSource.MarkAsRead(ctx, convID, uid, readMsgID); err != nil {
					return chat1.ThreadView{}, err
				}
				if _, err = s.G().InboxSource.ReadMessage(ctx, uid, 0, convID, readMsgID); err != nil {
					return chat1.ThreadView{}, err
				}
			} else {
				s.Debug(ctx, "Pull: skipping mark as read call")
			}
			// Run post process stuff
			if err = s.postProcessThread(ctx, uid, conv, &thread, query, nil, nil, true, true); err != nil {
				return thread, err
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
	boxed, err := s.ri().GetThreadRemote(ctx, rarg)
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
	if err = s.mergeMaybeNotify(ctx, convID, uid, thread.Messages); err != nil {
		s.Debug(ctx, "Pull: unable to commit thread locally: convID: %s uid: %s", convID, uid)
	}

	// Run post process stuff
	if err = s.postProcessThread(ctx, uid, unboxConv, &thread, query, nil, nil, true, true); err != nil {
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
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination, maxPlaceholders int) (tv chat1.ThreadView, err error) {
	defer s.Trace(ctx, func() error { return err }, "PullLocalOnly")()
	if _, err = s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return tv, err
	}
	defer s.lockTab.Release(ctx, uid, convID)

	// Post process thread before returning
	defer func() {
		if err == nil {
			superXform := newBasicSupersedesTransform(s.G(), basicSupersedesTransformOpts{})
			superXform.SetMessagesFunc(func(ctx context.Context, conv types.UnboxConversationInfo,
				uid gregor1.UID, msgIDs []chat1.MessageID,
				_ *chat1.GetThreadReason) (res []chat1.MessageUnboxed, err error) {
				msgs, err := storage.New(s.G(), s).FetchMessages(ctx, conv.GetConvID(), uid, msgIDs)
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
			err = s.postProcessThread(ctx, uid, conv, &tv, query, superXform, replyFiller, false, true)
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
		s.Debug(ctx, "PullLocalOnly: failed to fetch local messages: %s", err.Error())
		return chat1.ThreadView{}, err
	}
	return tv, nil
}

func (s *HybridConversationSource) Clear(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) error {
	return s.storage.ClearAll(ctx, convID, uid)
}

func (s *HybridConversationSource) GetMessages(ctx context.Context, conv types.UnboxConversationInfo,
	uid gregor1.UID, msgIDs []chat1.MessageID, threadReason *chat1.GetThreadReason) (res []chat1.MessageUnboxed, err error) {
	defer s.Trace(ctx, func() error { return err }, "GetMessages")()
	convID := conv.GetConvID()
	if _, err := s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return nil, err
	}
	defer s.lockTab.Release(ctx, uid, convID)

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
		rmsgs, err := s.ri().GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
			ConversationID: convID,
			MessageIDs:     remoteMsgs,
			ThreadReason:   threadReason,
		})
		if err != nil {
			return nil, err
		}

		// Unbox all the remote messages
		rmsgsUnboxed, err := s.boxer.UnboxMessages(ctx, rmsgs.Msgs, conv)
		if err != nil {
			return nil, err
		}

		sort.Sort(utils.ByMsgUnboxedMsgID(rmsgsUnboxed))
		for _, rmsg := range rmsgsUnboxed {
			rmsgsTab[rmsg.GetMessageID()] = rmsg
		}

		// Write out messages
		if err := s.mergeMaybeNotify(ctx, convID, uid, rmsgsUnboxed); err != nil {
			return nil, err
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
	conv chat1.Conversation, uid gregor1.UID, msgs []chat1.MessageBoxed) ([]chat1.MessageUnboxed, error) {
	convID := conv.GetConvID()
	if _, err := s.lockTab.Acquire(ctx, uid, convID); err != nil {
		return nil, err
	}
	defer s.lockTab.Release(ctx, uid, convID)

	var res []chat1.MessageUnboxed
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
		if err := s.mergeMaybeNotify(ctx, convID, uid, merges); err != nil {
			return res, err
		}
	}
	sort.Sort(utils.ByMsgUnboxedMsgID(res))
	return res, nil
}

func (s *HybridConversationSource) GetUnreadline(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, readMsgID chat1.MessageID) (unreadlineID *chat1.MessageID, err error) {
	defer s.Trace(ctx, func() error { return err }, fmt.Sprintf("GetUnreadline: convID: %v, readMsgID: %v", convID, readMsgID))()

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
		var inboxItem *chat1.InboxUIItem
		topicType := chat1.TopicType_NONE
		conv, err := utils.GetVerifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
		if err != nil {
			s.Debug(ctx, "notifyExpunge: failed to get conversations: %s", err)
		} else {
			inboxItem = PresentConversationLocalWithFetchRetry(ctx, s.G(), uid, conv)
			topicType = conv.GetTopicType()
		}
		act := chat1.NewChatActivityWithExpunge(chat1.ExpungeInfo{
			ConvID:  convID,
			Expunge: *mergeRes.Expunged,
			Conv:    inboxItem,
		})
		s.G().ActivityNotifier.Activity(ctx, uid, topicType, &act, chat1.ChatActivitySource_LOCAL)
	}
}

func (s *HybridConversationSource) notifyUpdated(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgs []chat1.MessageUnboxed) {
	if len(msgs) == 0 {
		s.Debug(ctx, "notifyUpdated: nothing to do")
		return
	}
	s.Debug(ctx, "notifyUpdated: notifying %d messages", len(msgs))
	conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		s.Debug(ctx, "notifyUpdated: failed to get conv: %s", err)
		return
	}
	updatedMsgs, err := s.TransformSupersedes(ctx, conv.Conv, uid, msgs, nil, nil, nil)
	if err != nil {
		s.Debug(ctx, "notifyUpdated: failed to transform supersedes: %s", err)
		return
	}
	s.Debug(ctx, "notifyUpdated: %d messages after transform", len(updatedMsgs))
	if updatedMsgs, err = NewReplyFiller(s.G()).Fill(ctx, uid, conv.Conv, updatedMsgs); err != nil {
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
	s.G().ActivityNotifier.Activity(ctx, uid, chat1.TopicType_CHAT,
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
		msgs, err = s.TransformSupersedes(ctx, conv, uid, msgs, nil, nil, nil)
		if err != nil {
			s.Debug(ctx, "notifyReactionUpdates: failed to transform supersedes: %s", err)
			return
		}
		reactionUpdates := []chat1.ReactionUpdate{}
		for _, msg := range msgs {
			if msg.IsValid() {
				reactionUpdates = append(reactionUpdates, chat1.ReactionUpdate{
					Reactions:   msg.Valid().Reactions,
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
		if err := storage.NewInbox(s.G()).IncrementLocalConvVersion(ctx, uid, convID); err != nil {
			s.Debug(ctx, "notifyEphemeralPurge: unable to IncrementLocalConvVersion, err", err)
		}
		s.G().ActivityNotifier.ThreadsStale(ctx, uid, []chat1.ConversationStaleUpdate{
			chat1.ConversationStaleUpdate{
				ConvID:     convID,
				UpdateType: chat1.StaleUpdateType_CONVUPDATE,
			},
		})
		s.notifyUpdated(ctx, uid, convID, s.storage.GetExplodedReplies(ctx, convID, uid, explodedMsgs))
	}
}

// Expunge from storage and maybe notify the gui of staleness
func (s *HybridConversationSource) Expunge(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, expunge chat1.Expunge) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Expunge")()
	s.Debug(ctx, "Expunge: convID: %s uid: %s upto: %v", convID, uid, expunge.Upto)
	if expunge.Upto == 0 {
		// just get out of here as quickly as possible with a 0 upto
		return nil
	}

	s.lockTab.Acquire(ctx, uid, convID)
	defer s.lockTab.Release(ctx, uid, convID)
	mergeRes, err := s.storage.Expunge(ctx, convID, uid, expunge)
	if err != nil {
		return err
	}

	s.notifyExpunge(ctx, uid, convID, mergeRes)
	return nil
}

// Merge with storage and maybe notify the gui of staleness
func (s *HybridConversationSource) mergeMaybeNotify(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageUnboxed) error {
	switch globals.CtxUnboxMode(ctx) {
	case types.UnboxModeFull:
		s.Debug(ctx, "mergeMaybeNotify: full mode, merging %d messages", len(msgs))
	case types.UnboxModeQuick:
		s.Debug(ctx, "mergeMaybeNotify: quick mode, skipping %d messages", len(msgs))
		globals.CtxAddMessageCacheSkips(ctx, convID, msgs)
		return nil
	}

	mergeRes, err := s.storage.Merge(ctx, convID, uid, msgs)
	if err != nil {
		return err
	}
	s.notifyExpunge(ctx, uid, convID, mergeRes)
	s.notifyEphemeralPurge(ctx, uid, convID, mergeRes.Exploded)
	s.notifyReactionUpdates(ctx, uid, convID, mergeRes.ReactionTargets)
	s.notifyUpdated(ctx, uid, convID, mergeRes.UnfurlTargets)
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

// ClearFromDelete clears the current cache if there is a delete that we don't know about
// and returns true to the caller if it schedules a background loader job
func (s *HybridConversationSource) ClearFromDelete(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, deleteID chat1.MessageID) bool {
	defer s.Trace(ctx, func() error { return nil }, "ClearFromDelete")()

	// Check to see if we have the message stored
	stored, err := s.storage.FetchMessages(ctx, convID, uid, []chat1.MessageID{deleteID})
	if err == nil && stored[0] != nil {
		// Any error is grounds to load this guy into the conv loader aggressively
		s.Debug(ctx, "ClearFromDelete: delete message stored, doing nothing")
		return false
	}

	// Fire off a background load of the thread with a post hook to delete the bodies cache
	s.Debug(ctx, "ClearFromDelete: delete not found, clearing")
	p := &chat1.Pagination{Num: s.numExpungeReload}
	s.G().ConvLoader.Queue(ctx, types.NewConvLoaderJob(convID, nil /*query */, p, types.ConvLoaderPriorityHighest,
		func(ctx context.Context, tv chat1.ThreadView, job types.ConvLoaderJob) {
			if len(tv.Messages) == 0 {
				return
			}
			bound := tv.Messages[0].GetMessageID().Min(tv.Messages[len(tv.Messages)-1].GetMessageID())
			if err := s.storage.ClearBefore(ctx, convID, uid, bound); err != nil {
				s.Debug(ctx, "ClearFromDelete: failed to clear messages: %s", err)
			}
		}))
	return true
}

func (s *HybridConversationSource) EphemeralPurge(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, purgeInfo *chat1.EphemeralPurgeInfo) (newPurgeInfo *chat1.EphemeralPurgeInfo, explodedMsgs []chat1.MessageUnboxed, err error) {
	defer s.Trace(ctx, func() error { return err }, "EphemeralPurge")()
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
