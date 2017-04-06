package chat

import (
	"errors"
	"sort"

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
	libkb.Contextified
	utils.DebugLabeler

	boxer   *Boxer
	ri      func() chat1.RemoteInterface
	offline bool
}

func newBaseConversationSource(g *libkb.GlobalContext, ri func() chat1.RemoteInterface, boxer *Boxer) *baseConversationSource {
	return &baseConversationSource{
		Contextified: libkb.NewContextified(g),
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

func (s *baseConversationSource) SetTLFInfoSource(tlfInfoSource types.TLFInfoSource) {
	s.boxer.tlfInfoSource = tlfInfoSource
}

func (s *baseConversationSource) postProcessThread(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, thread *chat1.ThreadView, q *chat1.GetThreadQuery,
	finalizeInfo *chat1.ConversationFinalizeInfo, superXform supersedesTransform, checkPrev bool) (err error) {

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
		if thread.Messages, err = superXform.Run(ctx, convID, uid, thread.Messages, finalizeInfo); err != nil {
			return err
		}
	}

	// Run type filter if it exists
	thread.Messages = utils.FilterByType(thread.Messages, q, true)

	// Fetch outbox and tack onto the result
	outbox := storage.NewOutbox(s.G(), uid)
	if err = outbox.SprinkleIntoThread(ctx, convID, thread); err != nil {
		if _, ok := err.(storage.MissError); !ok {
			return err
		}
	}

	return nil
}

func (s *baseConversationSource) TransformSupersedes(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageUnboxed, finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error) {
	transform := newBasicSupersedesTransform(s.G())
	return transform.Run(ctx, convID, uid, msgs, finalizeInfo)
}

type RemoteConversationSource struct {
	*baseConversationSource
	libkb.Contextified
}

func NewRemoteConversationSource(g *libkb.GlobalContext, b *Boxer, ri func() chat1.RemoteInterface) *RemoteConversationSource {
	return &RemoteConversationSource{
		Contextified:           libkb.NewContextified(g),
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
	conv, ratelim, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, true)
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

	thread, err := s.boxer.UnboxThread(ctx, boxed.Thread, convID, conv.Metadata.FinalizeInfo)
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	// Post process thread before returning
	if err = s.postProcessThread(ctx, uid, convID, &thread, query, conv.Metadata.FinalizeInfo, nil, true); err != nil {
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

func (s *RemoteConversationSource) GetMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgIDs []chat1.MessageID, finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error) {

	// Insta fail if we are offline
	if s.IsOffline() {
		return nil, OfflineError{}
	}

	rres, err := s.ri().GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
		ConversationID: convID,
		MessageIDs:     msgIDs,
	})

	msgs, err := s.boxer.UnboxMessages(ctx, rres.Msgs, convID, finalizeInfo)
	if err != nil {
		return nil, err
	}

	return msgs, nil
}

type HybridConversationSource struct {
	libkb.Contextified
	utils.DebugLabeler
	*baseConversationSource

	storage *storage.Storage
}

func NewHybridConversationSource(g *libkb.GlobalContext, b *Boxer, storage *storage.Storage,
	ri func() chat1.RemoteInterface) *HybridConversationSource {
	return &HybridConversationSource{
		Contextified:           libkb.NewContextified(g),
		DebugLabeler:           utils.NewDebugLabeler(g, "HybridConversationSource", false),
		baseConversationSource: newBaseConversationSource(g, ri, b),
		storage:                storage,
	}
}

func (s *HybridConversationSource) Push(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg chat1.MessageBoxed) (chat1.MessageUnboxed, bool, error) {

	var err error
	continuousUpdate := false

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

	// leaving this empty for message Push.
	// In a rare case, this will result in an error if a push message
	// coincides with an account reset.
	var emptyFinalizeInfo *chat1.ConversationFinalizeInfo

	decmsg, err := s.boxer.UnboxMessage(ctx, msg, convID, emptyFinalizeInfo)
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

func (s *HybridConversationSource) identifyTLF(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed, finalizeInfo *chat1.ConversationFinalizeInfo) error {

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

			tlfName := msg.Valid().ClientHeader.TLFNameExpanded(finalizeInfo)
			s.Debug(ctx, "identifyTLF: identifying from msg ID: %d name: %s convID: %s",
				msg.GetMessageID(), tlfName, convID)

			vis := chat1.TLFVisibility_PRIVATE
			if msg.Valid().ClientHeader.TlfPublic {
				vis = chat1.TLFVisibility_PUBLIC
			}

			_, err := s.boxer.tlfInfoSource.Lookup(ctx, tlfName, vis)
			if err != nil {
				s.Debug(ctx, "identifyTLF: failure: name: %s convID: %s", tlfName, convID)
				return err
			}

			return nil
		}
	}

	s.Debug(ctx, "identifyTLF: no identify performed, no valid messages found")
	return nil
}

func (s *HybridConversationSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (thread chat1.ThreadView, rl []*chat1.RateLimit, err error) {
	defer s.Trace(ctx, func() error { return err }, "Pull")()
	if convID.IsNil() {
		return chat1.ThreadView{}, rl, errors.New("HybridConversationSource.Pull called with empty convID")
	}

	// Get conversation metadata
	var finalizeInfo *chat1.ConversationFinalizeInfo
	conv, ratelim, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, true)
	rl = append(rl, ratelim)
	if err == nil {
		finalizeInfo = conv.Metadata.FinalizeInfo
	}

	// Post process thread before returning
	defer func() {
		if err == nil {
			err = s.postProcessThread(ctx, uid, convID, &thread, query,
				finalizeInfo, nil, true)
		}
	}()

	if err == nil {
		// Try locally first
		thread, err = s.storage.Fetch(ctx, conv, uid, query, pagination)
		if err == nil {
			// If found, then return the stuff
			s.Debug(ctx, "Pull: cache hit: convID: %s uid: %s", convID, uid)

			// Do online only things
			if !s.IsOffline() {

				// Identify this TLF by running crypt keys
				if ierr := s.identifyTLF(ctx, convID, uid, thread.Messages, conv.Metadata.FinalizeInfo); ierr != nil {
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
				}
			}

			return thread, rl, nil
		}
	} else {
		s.Debug(ctx, "Pull: error fetching conv metadata: convID: %s uid: %s err: %s", convID, uid,
			err.Error())
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
	thread, err = s.boxer.UnboxThread(ctx, boxed.Thread, convID, conv.Metadata.FinalizeInfo)
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

func (s *HybridConversationSource) PullLocalOnly(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (tv chat1.ThreadView, err error) {
	defer s.Trace(ctx, func() error { return err }, "PullLocalOnly")()
	// Post process thread before returning
	defer func() {
		if err == nil {
			superXform := newBasicSupersedesTransform(s.G())
			superXform.SetMessagesFunc(func(ctx context.Context, convID chat1.ConversationID,
				uid gregor1.UID, msgIDs []chat1.MessageID,
				finalizeInfo *chat1.ConversationFinalizeInfo) (res []chat1.MessageUnboxed, err error) {
				msgs, err := storage.New(s.G()).FetchMessages(ctx, convID, uid, msgIDs)
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
			err = s.postProcessThread(ctx, uid, convID, &tv, query, nil, superXform, false)
		}
	}()

	tv, err = s.storage.FetchUpToLocalMaxMsgID(ctx, convID, uid, query, pagination)
	if err != nil {
		s.Debug(ctx, "PullLocalOnly: failed to fetch local messages: %s", err.Error())
		return chat1.ThreadView{}, err
	}

	// Identify this TLF by running crypt keys
	// XXX might need finalize info
	if ierr := s.identifyTLF(ctx, convID, uid, tv.Messages, nil); ierr != nil {
		s.Debug(ctx, "PullLocalOnly: identify failed: %s", ierr.Error())
		return chat1.ThreadView{}, ierr
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

func (s *HybridConversationSource) GetMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgIDs []chat1.MessageID, finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error) {

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
		rmsgsUnboxed, err := s.boxer.UnboxMessages(ctx, rmsgs.Msgs, convID, finalizeInfo)
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
	if ierr := s.identifyTLF(ctx, convID, uid, res, finalizeInfo); ierr != nil {
		s.Debug(ctx, "GetMessages: identify failed: %s", ierr.Error())
		return nil, ierr
	}

	return res, nil
}

func NewConversationSource(g *libkb.GlobalContext, typ string, boxer *Boxer, storage *storage.Storage,
	ri func() chat1.RemoteInterface) types.ConversationSource {
	if typ == "hybrid" {
		return NewHybridConversationSource(g, boxer, storage, ri)
	}
	return NewRemoteConversationSource(g, boxer, ri)
}
