package chat

import (
	"errors"
	"fmt"
	"sort"

	"sync"

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

	boxer   *Boxer
	ri      func() chat1.RemoteInterface
	offline bool
}

func newBaseConversationSource(g *globals.Context, ri func() chat1.RemoteInterface, boxer *Boxer) *baseConversationSource {
	return &baseConversationSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "baseConversationSource", false),
		ri:           ri,
		boxer:        boxer,
	}
}

func (s *baseConversationSource) Connected(ctx context.Context) {
	s.Debug(ctx, "connected")
	s.offline = false
}

func (s *baseConversationSource) Disconnected(ctx context.Context) {
	s.Debug(ctx, "disconnected")
	s.offline = true
}

func (s *baseConversationSource) IsOffline() bool {
	return s.offline
}

func (s *baseConversationSource) SetRemoteInterface(ri func() chat1.RemoteInterface) {
	s.ri = ri
}

func (s *baseConversationSource) postProcessThread(ctx context.Context, uid gregor1.UID,
	conv chat1.Conversation, thread *chat1.ThreadView, q *chat1.GetThreadQuery,
	superXform supersedesTransform, checkPrev bool) (err error) {

	// Sanity check the prev pointers in this thread.
	// TODO: We'll do this against what's in the cache once that's ready,
	//       rather than only checking the messages we just fetched against
	//       each other.
	if checkPrev {
		_, err = CheckPrevPointersAndGetUnpreved(thread)
		if err != nil {
			return err
		}
	}

	// Resolve supersedes
	if q == nil || !q.DisableResolveSupersedes {
		if superXform == nil {
			superXform = newBasicSupersedesTransform(s.G())
		}
		if thread.Messages, err = superXform.Run(ctx, conv, uid, thread.Messages); err != nil {
			return err
		}
	}

	// Run type filter if it exists
	thread.Messages = utils.FilterByType(thread.Messages, q, true)

	// Fetch outbox and tack onto the result
	outbox := storage.NewOutbox(s.G(), uid)
	if err = outbox.SprinkleIntoThread(ctx, conv.GetConvID(), thread); err != nil {
		if _, ok := err.(storage.MissError); !ok {
			return err
		}
	}

	return nil
}

func (s *baseConversationSource) TransformSupersedes(ctx context.Context, conv chat1.Conversation, uid gregor1.UID, msgs []chat1.MessageUnboxed) ([]chat1.MessageUnboxed, error) {
	transform := newBasicSupersedesTransform(s.G())
	return transform.Run(ctx, conv, uid, msgs)
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

func (s *RemoteConversationSource) Push(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg chat1.MessageBoxed) (chat1.MessageUnboxed, bool, error) {
	// Do nothing here, we don't care about pushed messages

	// The bool param here is to indicate the update given is continuous to our current state,
	// which for this source is not relevant, so we just return true
	return chat1.MessageUnboxed{}, true, nil
}

func (s *RemoteConversationSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, []*chat1.RateLimit, error) {

	if convID.IsNil() {
		return chat1.ThreadView{}, []*chat1.RateLimit{}, errors.New("RemoteConversationSource.Pull called with empty convID")
	}

	// Insta fail if we are offline
	if s.IsOffline() {
		return chat1.ThreadView{}, []*chat1.RateLimit{}, OfflineError{}
	}

	var rl []*chat1.RateLimit

	// Get conversation metadata
	conv, ratelim, err := GetUnverifiedConv(ctx, s.G(), uid, convID, true)
	rl = append(rl, ratelim)
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	// Fetch thread
	rarg := chat1.GetThreadRemoteArg{
		ConversationID: convID,
		Query:          query,
		Pagination:     pagination,
	}
	boxed, err := s.ri().GetThreadRemote(ctx, rarg)
	rl = append(rl, boxed.RateLimit)
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	thread, err := s.boxer.UnboxThread(ctx, boxed.Thread, conv)
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	// Post process thread before returning
	if err = s.postProcessThread(ctx, uid, conv, &thread, query, nil, true); err != nil {
		return chat1.ThreadView{}, nil, err
	}

	return thread, rl, nil
}

func (s *RemoteConversationSource) PullLocalOnly(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, error) {
	return chat1.ThreadView{}, storage.MissError{Msg: "PullLocalOnly is unimplemented for RemoteConversationSource"}
}

func (s *RemoteConversationSource) Clear(convID chat1.ConversationID, uid gregor1.UID) error {
	return nil
}

func (s *RemoteConversationSource) GetMessages(ctx context.Context, conv chat1.Conversation,
	uid gregor1.UID, msgIDs []chat1.MessageID) ([]chat1.MessageUnboxed, error) {

	// Insta fail if we are offline
	if s.IsOffline() {
		return nil, OfflineError{}
	}

	rres, err := s.ri().GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
		ConversationID: conv.GetConvID(),
		MessageIDs:     msgIDs,
	})

	msgs, err := s.boxer.UnboxMessages(ctx, rres.Msgs, conv)
	if err != nil {
		return nil, err
	}

	return msgs, nil
}

func (s *RemoteConversationSource) GetMessagesWithRemotes(ctx context.Context,
	conv chat1.Conversation, uid gregor1.UID, msgs []chat1.MessageBoxed) ([]chat1.MessageUnboxed, error) {
	if s.IsOffline() {
		return nil, OfflineError{}
	}
	return s.boxer.UnboxMessages(ctx, msgs, conv)
}

type conversationLock struct {
	refs, shares int
	trace        string
	lock         sync.Mutex
}

type conversationLockTab struct {
	globals.Contextified
	sync.Mutex
	utils.DebugLabeler

	convLocks map[string]*conversationLock
	blockCb   *chan struct{} // Testing
}

func newConversationLockTab(g *globals.Context) *conversationLockTab {
	return &conversationLockTab{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "conversationLockTab", false),
		convLocks:    make(map[string]*conversationLock),
	}
}

func (c *conversationLockTab) key(uid gregor1.UID, convID chat1.ConversationID) string {
	return fmt.Sprintf("%s:%s", uid, convID)
}

// Acquire obtains a per user per conversation lock on a per trace basis. That is, the lock is a
// shared lock for the current chat trace, and serves to synchronize large chat operations. If there is
// no chat trace, this is a no-op.
func (c *conversationLockTab) Acquire(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (blocked bool) {
	key := c.key(uid, convID)
	trace, ok := CtxTrace(ctx)
	if !ok {
		c.Debug(ctx, "Acquire: failed to find trace value, not using a lock: convID: %s", convID)
		return false
	}

	c.Lock()
	if lock, ok := c.convLocks[key]; ok {
		if lock.trace == trace {
			// Our request holds the lock on this conversation ID already, so just plow through it
			lock.shares++
			c.Unlock()
			return
		}
		c.Debug(ctx, "Acquire: blocked by trace: %s on convID: %s", lock.trace, convID)
		if c.blockCb != nil {
			*c.blockCb <- struct{}{} // For testing
		}
		lock.refs++
		c.Unlock() // Give up map lock while we are waiting for conv lock
		lock.lock.Lock()
		c.Lock()
		lock.trace = trace
		lock.shares = 1
		c.Unlock()
		return true
	}

	lock := &conversationLock{
		shares: 1,
		refs:   1,
		trace:  trace,
	}
	c.convLocks[key] = lock
	lock.lock.Lock()
	c.Unlock()
	return false
}

func (c *conversationLockTab) Release(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (released bool) {
	c.Lock()
	defer c.Unlock()
	trace, ok := CtxTrace(ctx)
	if !ok {
		c.Debug(ctx, "Release: failed to find trace value, doing nothing: convID: %s", convID)
		return false
	}

	key := c.key(uid, convID)
	if lock, ok := c.convLocks[key]; ok {
		if lock.trace != trace {
			c.Debug(ctx, "Release: different trace trying to free lock? convID: %s lock.trace: %s trace: %s", convID, lock.trace, trace)
		} else {
			lock.shares--
			if lock.shares == 0 {
				lock.refs--
				if lock.refs == 0 {
					delete(c.convLocks, key)
				}
				lock.trace = ""
				lock.lock.Unlock()
				return true
			}
		}
	}
	return false
}

type HybridConversationSource struct {
	globals.Contextified
	utils.DebugLabeler
	*baseConversationSource

	storage *storage.Storage
	lockTab *conversationLockTab
}

var _ types.ConversationSource = (*HybridConversationSource)(nil)

func NewHybridConversationSource(g *globals.Context, b *Boxer, storage *storage.Storage,
	ri func() chat1.RemoteInterface) *HybridConversationSource {
	return &HybridConversationSource{
		Contextified:           globals.NewContextified(g),
		DebugLabeler:           utils.NewDebugLabeler(g, "HybridConversationSource", false),
		baseConversationSource: newBaseConversationSource(g, ri, b),
		storage:                storage,
		lockTab:                newConversationLockTab(g),
	}
}

func (s *HybridConversationSource) Push(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg chat1.MessageBoxed) (decmsg chat1.MessageUnboxed, continuousUpdate bool, err error) {
	defer s.Trace(ctx, func() error { return err }, "Push")()
	s.lockTab.Acquire(ctx, uid, convID)
	defer s.lockTab.Release(ctx, uid, convID)

	// Grab conversation information before pushing
	conv, _, err := GetUnverifiedConv(ctx, s.G(), uid, convID, true)
	if err != nil {
		return decmsg, continuousUpdate, err
	}

	// Check to see if we are "appending" this message to the current record.
	maxMsgID, err := s.storage.GetMaxMsgID(ctx, convID, uid)
	switch err.(type) {
	case storage.MissError:
		continuousUpdate = true
	case nil:
		continuousUpdate = maxMsgID >= msg.GetMessageID()-1
	default:
		return chat1.MessageUnboxed{}, continuousUpdate, err
	}

	decmsg, err = s.boxer.UnboxMessage(ctx, msg, conv)
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

	if err = s.storage.Merge(ctx, convID, uid, []chat1.MessageUnboxed{decmsg}); err != nil {
		return decmsg, continuousUpdate, err
	}

	return decmsg, continuousUpdate, nil
}

func (s *HybridConversationSource) identifyTLF(ctx context.Context, conv chat1.Conversation,
	uid gregor1.UID, msgs []chat1.MessageUnboxed) error {

	// If we are offline, then bail out of here with no error
	if s.IsOffline() {
		s.Debug(ctx, "identifyTLF: not performing identify because offline")
		return nil
	}

	idMode, _, haveMode := IdentifyMode(ctx)
	for _, msg := range msgs {
		if msg.IsValid() {

			// Early out if we are in GUI mode and don't have any breaks stored
			idBroken := s.storage.IsTLFIdentifyBroken(ctx, msg.Valid().ClientHeader.Conv.Tlfid)
			if haveMode && idMode == keybase1.TLFIdentifyBehavior_CHAT_GUI && !idBroken {
				s.Debug(ctx, "identifyTLF: not performing identify because we stored a clean identify")
				return nil
			}

			switch conv.GetMembersType() {
			case chat1.ConversationMembersType_TEAM:
				// early out of team convs
				return nil
			default:
			}

			tlfName := msg.Valid().ClientHeader.TLFNameExpanded(conv.Metadata.FinalizeInfo)
			s.Debug(ctx, "identifyTLF: identifying from msg ID: %d name: %s convID: %s",
				msg.GetMessageID(), tlfName, conv.GetConvID())

			_, err := CtxKeyFinder(ctx, s.G()).Find(ctx, tlfName, conv.GetMembersType(),
				msg.Valid().ClientHeader.TlfPublic)
			if err != nil {
				s.Debug(ctx, "identifyTLF: failure: name: %s convID: %s", tlfName, conv.GetConvID())
				return err
			}

			return nil
		}
	}

	s.Debug(ctx, "identifyTLF: no identify performed, no valid messages found")
	return nil
}

func (s *HybridConversationSource) resolveHoles(ctx context.Context, uid gregor1.UID,
	thread *chat1.ThreadView, conv chat1.Conversation) (err error) {
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
				return storage.MissError{}
			}
			msgIDs = append(msgIDs, msg.GetMessageID())
		}
	}
	if len(msgIDs) == 0 {
		// Nothing to do
		return nil
	}
	if s.IsOffline() {
		// Don't attempt if we are offline
		return OfflineError{}
	}

	// Fetch all missing messages from server, and sub in the real ones into the placeholder slots
	msgs, err := s.GetMessages(ctx, conv, uid, msgIDs)
	if err != nil {
		s.Debug(ctx, "resolveHoles: failed to get missing messages: %s", err.Error())
		return err
	}
	msgLookup := make(map[chat1.MessageID]chat1.MessageUnboxed)
	for _, msg := range msgs {
		msgLookup[msg.GetMessageID()] = msg
	}
	for i, threadMsg := range thread.Messages {
		state, err := threadMsg.State()
		if err != nil {
			continue
		}
		if state == chat1.MessageUnboxedState_PLACEHOLDER {
			if msg, ok := msgLookup[threadMsg.GetMessageID()]; ok {
				thread.Messages[i] = msg
			} else {
				s.Debug(ctx, "resolveHoles: did not fetch all placeholder messages, missing msgID: %d",
					threadMsg.GetMessageID())
				return fmt.Errorf("did not fetch all placeholder messages")
			}
		}
	}
	s.Debug(ctx, "resolveHoles: success: filled %d holes", len(msgs))
	return nil
}

// maxHolesForPull is the number of misses in the body storage cache we will tolerate missing. A good
// way to think about this number is the number of extra reads from the cache we need to do before
// formally declaring the request a failure.
var maxHolesForPull = 10

func (s *HybridConversationSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (thread chat1.ThreadView, rl []*chat1.RateLimit, err error) {
	defer s.Trace(ctx, func() error { return err }, "Pull")()
	if convID.IsNil() {
		return chat1.ThreadView{}, rl, errors.New("HybridConversationSource.Pull called with empty convID")
	}
	s.lockTab.Acquire(ctx, uid, convID)
	defer s.lockTab.Release(ctx, uid, convID)

	// Get conversation metadata
	conv, ratelim, err := GetUnverifiedConv(ctx, s.G(), uid, convID, true)
	rl = append(rl, ratelim)

	// Post process thread before returning
	defer func() {
		if err == nil {
			err = s.postProcessThread(ctx, uid, conv, &thread, query, nil, true)
		}
	}()

	var unboxConv unboxConversationInfo
	if err == nil {
		unboxConv = conv
		// Try locally first
		rc := storage.NewHoleyResultCollector(maxHolesForPull,
			s.storage.ResultCollectorFromQuery(ctx, query, pagination))
		thread, err = s.storage.Fetch(ctx, conv, uid, rc, query, pagination)
		if err == nil {
			// Since we are using the "holey" collector, we need to resolve any placeholder
			// messages that may have been fetched.
			s.Debug(ctx, "Pull: cache hit: convID: %s uid: %s holes: %d", convID, uid, rc.Holes())
			err = s.resolveHoles(ctx, uid, &thread, conv)
		}
		if err == nil {
			// Do online only things
			if !s.IsOffline() {

				// Identify this TLF by running crypt keys
				if ierr := s.identifyTLF(ctx, conv, uid, thread.Messages); ierr != nil {
					s.Debug(ctx, "Pull: identify failed: %s", ierr.Error())
					return chat1.ThreadView{}, rl, ierr
				}

				// Before returning the stuff, update SenderDeviceRevokedAt on each message.
				updatedMessages, err := s.updateMessages(ctx, thread.Messages)
				if err != nil {
					return chat1.ThreadView{}, rl, err
				}
				thread.Messages = updatedMessages

				// Before returning the stuff, send remote request to mark as read if
				// requested.
				if query != nil && query.MarkAsRead && len(thread.Messages) > 0 {
					readMsgID := thread.Messages[0].GetMessageID()
					res, err := s.ri().MarkAsRead(ctx, chat1.MarkAsReadArg{
						ConversationID: convID,
						MsgID:          readMsgID,
					})
					if err != nil {
						return chat1.ThreadView{}, nil, err
					}
					if _, err = s.G().InboxSource.ReadMessage(ctx, uid, 0, convID, readMsgID); err != nil {
						return chat1.ThreadView{}, nil, err
					}

					rl = append(rl, res.RateLimit)
				} else {
					s.Debug(ctx, "Pull: skipping mark as read call")
				}
			}
			return thread, rl, nil
		}
		s.Debug(ctx, "Pull: cache miss: err: %s", err.Error())
	} else {
		s.Debug(ctx, "Pull: error fetching conv metadata: convID: %s uid: %s err: %s", convID, uid,
			err.Error())
		// Assume this is a public convo for unbox purposes, since it is the only way any unboxing
		// will succeed here since we don't know the members type.
		unboxConv = newPublicUnboxConverstionInfo(convID)
	}

	// Insta fail if we are offline
	if s.IsOffline() {
		return chat1.ThreadView{}, rl, OfflineError{}
	}

	// Fetch the entire request on failure
	rarg := chat1.GetThreadRemoteArg{
		ConversationID: convID,
		Query:          query,
		Pagination:     pagination,
	}
	boxed, err := s.ri().GetThreadRemote(ctx, rarg)
	rl = append(rl, boxed.RateLimit)
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	// Unbox
	thread, err = s.boxer.UnboxThread(ctx, boxed.Thread, unboxConv)
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	// Store locally (just warn on error, don't abort the whole thing)
	if err = s.storage.Merge(ctx, convID, uid, thread.Messages); err != nil {
		s.Debug(ctx, "Pull: unable to commit thread locally: convID: %s uid: %s", convID, uid)
	}

	return thread, rl, nil
}

func (s *HybridConversationSource) updateMessages(ctx context.Context, messages []chat1.MessageUnboxed) ([]chat1.MessageUnboxed, error) {
	updatedMessages := make([]chat1.MessageUnboxed, 0, len(messages))
	for _, m := range messages {
		m2, err := s.updateMessage(ctx, m)
		if err != nil {
			return updatedMessages, err
		}
		updatedMessages = append(updatedMessages, m2)
	}
	return updatedMessages, nil
}

func (s *HybridConversationSource) updateMessage(ctx context.Context, message chat1.MessageUnboxed) (chat1.MessageUnboxed, error) {
	typ, err := message.State()
	if err != nil {
		return chat1.MessageUnboxed{}, err
	}
	switch typ {
	case chat1.MessageUnboxedState_VALID:
		m := message.Valid()

		var verificationKey []byte

		if m.HeaderSignature != nil {
			verificationKey = m.HeaderSignature.K
		}

		if m.VerificationKey != nil {
			verificationKey = *m.VerificationKey
		}

		if verificationKey == nil {
			// Skip revocation check for messages cached before the sig/key was part of the cache.
			s.Debug(ctx, "updateMessage skipping message (%v) with no cached HeaderSignature", m.ServerHeader.MessageID)
			return message, nil
		}

		sender := m.ClientHeader.Sender
		ctime := m.ServerHeader.Ctime
		found, validAtCtime, revoked, err := s.boxer.ValidSenderKey(ctx, sender, verificationKey, ctime)
		if err != nil {
			return chat1.MessageUnboxed{}, err
		}
		if !found {
			return chat1.MessageUnboxed{}, NewPermanentUnboxingError(libkb.NoKeyError{Msg: "sender key not found"})
		}
		if !validAtCtime {
			return chat1.MessageUnboxed{}, NewPermanentUnboxingError(libkb.NoKeyError{Msg: "key invalid for sender at message ctime"})
		}
		m.SenderDeviceRevokedAt = revoked
		updatedMessage := chat1.NewMessageUnboxedWithValid(m)
		return updatedMessage, nil
	default:
		return message, nil
	}
}

type pullLocalResultCollector struct {
	*storage.SimpleResultCollector
	num int
}

func (p *pullLocalResultCollector) Name() string {
	return "pulllocal"
}

func (p *pullLocalResultCollector) String() string {
	return fmt.Sprintf("[ %s: t: %d ]", p.Name(), p.num)
}

func (p *pullLocalResultCollector) Error(err storage.Error) storage.Error {
	// Swallow this error, we know we can miss if we get anything at all
	if _, ok := err.(storage.MissError); ok && len(p.Result()) > 0 {
		return nil
	}
	return err
}

func newPullLocalResultCollector(num int) *pullLocalResultCollector {
	return &pullLocalResultCollector{
		num: num,
		SimpleResultCollector: storage.NewSimpleResultCollector(num),
	}
}

func (s *HybridConversationSource) PullLocalOnly(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (tv chat1.ThreadView, err error) {
	defer s.Trace(ctx, func() error { return err }, "PullLocalOnly")()
	s.lockTab.Acquire(ctx, uid, convID)
	defer s.lockTab.Release(ctx, uid, convID)

	// Post process thread before returning
	defer func() {
		if err == nil {
			superXform := newBasicSupersedesTransform(s.G())
			superXform.SetMessagesFunc(func(ctx context.Context, conv chat1.Conversation,
				uid gregor1.UID, msgIDs []chat1.MessageID) (res []chat1.MessageUnboxed, err error) {
				msgs, err := storage.New(s.G()).FetchMessages(ctx, conv.GetConvID(), uid, msgIDs)
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
			// Form a fake version of a conversation so we don't need to hit the network ever here
			var conv chat1.Conversation
			conv.Metadata.ConversationID = convID
			err = s.postProcessThread(ctx, uid, conv, &tv, query, superXform, false)
		}
	}()

	// A number < 0 means it will fetch until it hits the end of the local copy. Our special
	// result collector will suppress any miss errors
	num := -1
	if pagination != nil {
		num = pagination.Num
	}
	tv, err = s.storage.FetchUpToLocalMaxMsgID(ctx, convID, uid, newPullLocalResultCollector(num),
		query, pagination)
	if err != nil {
		s.Debug(ctx, "PullLocalOnly: failed to fetch local messages: %s", err.Error())
		return chat1.ThreadView{}, err
	}

	return tv, nil
}

func (s *HybridConversationSource) Clear(convID chat1.ConversationID, uid gregor1.UID) error {
	return s.storage.MaybeNuke(true, nil, convID, uid)
}

type ByMsgID []chat1.MessageUnboxed

func (m ByMsgID) Len() int           { return len(m) }
func (m ByMsgID) Swap(i, j int)      { m[i], m[j] = m[j], m[i] }
func (m ByMsgID) Less(i, j int) bool { return m[i].GetMessageID() > m[j].GetMessageID() }

func (s *HybridConversationSource) GetMessages(ctx context.Context, conv chat1.Conversation,
	uid gregor1.UID, msgIDs []chat1.MessageID) ([]chat1.MessageUnboxed, error) {
	convID := conv.GetConvID()
	s.lockTab.Acquire(ctx, uid, convID)
	defer s.lockTab.Release(ctx, uid, convID)

	rmsgsTab := make(map[chat1.MessageID]chat1.MessageUnboxed)

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
	s.Debug(ctx, "GetMessages: convID: %s uid: %s total msgs: %d remote: %d", convID, uid, len(msgIDs),
		len(remoteMsgs))
	if len(remoteMsgs) > 0 {

		// Insta fail if we are offline
		if s.IsOffline() {
			return nil, OfflineError{}
		}

		rmsgs, err := s.ri().GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
			ConversationID: convID,
			MessageIDs:     remoteMsgs,
		})
		if err != nil {
			return nil, err
		}

		// Unbox all the remote messages
		rmsgsUnboxed, err := s.boxer.UnboxMessages(ctx, rmsgs.Msgs, conv)
		if err != nil {
			return nil, err
		}

		sort.Sort(ByMsgID(rmsgsUnboxed))
		for _, rmsg := range rmsgsUnboxed {
			rmsgsTab[rmsg.GetMessageID()] = rmsg
		}

		// Write out messages
		if err := s.storage.Merge(ctx, convID, uid, rmsgsUnboxed); err != nil {
			return nil, err
		}
	}

	// Form final result
	var res []chat1.MessageUnboxed
	for index, msg := range msgs {
		if msg != nil {
			res = append(res, *msg)
		} else {
			res = append(res, rmsgsTab[msgIDs[index]])
		}
	}

	// Identify this TLF by running crypt keys
	if ierr := s.identifyTLF(ctx, conv, uid, res); ierr != nil {
		s.Debug(ctx, "GetMessages: identify failed: %s", ierr.Error())
		return nil, ierr
	}

	return res, nil
}

func (s *HybridConversationSource) GetMessagesWithRemotes(ctx context.Context,
	conv chat1.Conversation, uid gregor1.UID, msgs []chat1.MessageBoxed) ([]chat1.MessageUnboxed, error) {
	convID := conv.GetConvID()
	s.lockTab.Acquire(ctx, uid, convID)
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
			// Insta fail if we are offline
			if s.IsOffline() {
				return nil, OfflineError{}
			}

			unboxed, err := s.boxer.UnboxMessage(ctx, msg, conv)
			if err != nil {
				return res, err
			}
			merges = append(merges, unboxed)
			res = append(res, unboxed)
		}
	}
	if len(merges) > 0 {
		sort.Sort(ByMsgID(merges))
		if err = s.storage.Merge(ctx, convID, uid, merges); err != nil {
			return res, err
		}
	}

	// Identify this TLF by running crypt keys
	if ierr := s.identifyTLF(ctx, conv, uid, res); ierr != nil {
		s.Debug(ctx, "Pull: identify failed: %s", ierr.Error())
		return res, ierr
	}

	sort.Sort(ByMsgID(res))
	return res, nil
}

func NewConversationSource(g *globals.Context, typ string, boxer *Boxer, storage *storage.Storage,
	ri func() chat1.RemoteInterface) types.ConversationSource {
	if typ == "hybrid" {
		return NewHybridConversationSource(g, boxer, storage, ri)
	}
	return NewRemoteConversationSource(g, boxer, ri)
}
