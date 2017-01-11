package chat

import (
	"errors"
	"fmt"
	"sort"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type RemoteConversationSource struct {
	libkb.Contextified
	ri    func() chat1.RemoteInterface
	boxer *Boxer
}

func NewRemoteConversationSource(g *libkb.GlobalContext, b *Boxer, ri func() chat1.RemoteInterface) *RemoteConversationSource {
	return &RemoteConversationSource{
		Contextified: libkb.NewContextified(g),
		ri:           ri,
		boxer:        b,
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

	rarg := chat1.GetThreadRemoteArg{
		ConversationID: convID,
		Query:          query,
		Pagination:     pagination,
	}
	boxed, err := s.ri().GetThreadRemote(ctx, rarg)
	rl := []*chat1.RateLimit{boxed.RateLimit}
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	thread, err := s.boxer.UnboxThread(ctx, boxed.Thread, convID)
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	return thread, rl, nil
}

func (s *RemoteConversationSource) PullLocalOnly(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, error) {
	return chat1.ThreadView{}, libkb.ChatStorageMissError{Msg: "PullLocalOnly is unimplemented for RemoteConversationSource"}
}

func (s *RemoteConversationSource) Clear(convID chat1.ConversationID, uid gregor1.UID) error {
	return nil
}

func (s *RemoteConversationSource) GetMessages(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgIDs []chat1.MessageID, finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error) {

	rres, err := s.ri().GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
		ConversationID: convID,
		MessageIDs:     msgIDs,
	})

	rres.Msgs = AppendTLFResetSuffix(rres.Msgs, finalizeInfo)

	msgs, err := s.boxer.UnboxMessages(ctx, rres.Msgs)
	if err != nil {
		return nil, err
	}

	return msgs, nil
}

func (s *RemoteConversationSource) GetMessagesWithRemotes(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageBoxed,
	finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error) {
	return s.boxer.UnboxMessages(ctx, msgs)
}

type HybridConversationSource struct {
	libkb.Contextified
	ri      func() chat1.RemoteInterface
	boxer   *Boxer
	storage *storage.Storage
}

func NewHybridConversationSource(g *libkb.GlobalContext, b *Boxer, storage *storage.Storage,
	ri func() chat1.RemoteInterface) *HybridConversationSource {
	return &HybridConversationSource{
		Contextified: libkb.NewContextified(g),
		ri:           ri,
		boxer:        b,
		storage:      storage,
	}
}

func (s *HybridConversationSource) debug(msg string, args ...interface{}) {
	s.G().Log.Debug("HybridConversationSource: "+msg, args...)
}

func (s *HybridConversationSource) Push(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg chat1.MessageBoxed) (chat1.MessageUnboxed, bool, error) {

	var err error
	continuousUpdate := false

	decmsg, err := s.boxer.UnboxMessage(ctx, msg)
	if err != nil {
		return decmsg, continuousUpdate, err
	}

	// Check conversation ID and change to error if it is wrong
	if decmsg.IsValid() && !decmsg.Valid().ClientHeader.Conv.Derivable(convID) {
		decmsg = chat1.NewMessageUnboxedWithError(chat1.MessageUnboxedError{
			ErrMsg:      "invalid conversation ID",
			MessageID:   msg.GetMessageID(),
			MessageType: msg.GetMessageType(),
		})
	}

	// Check to see if we are "appending" this message to the current record.
	maxMsgID, err := s.storage.GetMaxMsgID(ctx, convID, uid)
	switch err.(type) {
	case libkb.ChatStorageMissError:
		continuousUpdate = true
	case nil:
		continuousUpdate = maxMsgID >= decmsg.GetMessageID()-1
	default:
		return decmsg, continuousUpdate, err
	}
	if err = s.storage.Merge(ctx, convID, uid, []chat1.MessageUnboxed{decmsg}); err != nil {
		return decmsg, continuousUpdate, err
	}

	return decmsg, continuousUpdate, nil
}

func (s *HybridConversationSource) getConvMetadata(ctx context.Context, convID chat1.ConversationID,
	rl *[]*chat1.RateLimit) (chat1.Conversation, error) {

	conv, err := s.ri().GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
		Query: &chat1.GetInboxQuery{
			ConvID: &convID,
		},
	})
	*rl = append(*rl, conv.RateLimit)
	if err != nil {
		return chat1.Conversation{}, libkb.ChatStorageRemoteError{Msg: err.Error()}
	}
	if len(conv.Inbox.Full().Conversations) == 0 {
		return chat1.Conversation{}, libkb.ChatStorageRemoteError{Msg: fmt.Sprintf("conv not found: %s", convID)}
	}
	return conv.Inbox.Full().Conversations[0], nil
}

func (s *HybridConversationSource) identifyTLF(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed, finalizeInfo *chat1.ConversationFinalizeInfo) error {

	for _, msg := range msgs {
		if msg.IsValid() {
			tlfName := msg.Valid().ClientHeader.TLFNameExpanded(finalizeInfo)

			s.debug("identifyTLF: identifying from msg ID: %d name: %s convID: %s",
				msg.GetMessageID(), tlfName, convID)

			vis := chat1.TLFVisibility_PRIVATE
			if msg.Valid().ClientHeader.TlfPublic {
				vis = chat1.TLFVisibility_PUBLIC
			}
			if _, err := LookupTLF(ctx, s.boxer.tlf, tlfName, vis); err != nil {
				s.debug("identifyTLF: failure: name: %s convID: %s", tlfName, convID)
				return err
			}
			return nil
		}
	}

	s.debug("identifyTLF: no identify performed, no valid messages found")
	return nil
}

func (s *HybridConversationSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, []*chat1.RateLimit, error) {

	var err error
	var rl []*chat1.RateLimit

	if convID.IsNil() {
		return chat1.ThreadView{}, rl, errors.New("HybridConversationSource.Pull called with empty convID")
	}

	// Get conversation metadata
	conv, err := s.getConvMetadata(ctx, convID, &rl)
	if err == nil {
		// Try locally first
		localData, err := s.storage.Fetch(ctx, conv, uid, query, pagination)
		if err == nil {
			// If found, then return the stuff
			s.debug("Pull: cache hit: convID: %s uid: %s", convID, uid)

			// Identify this TLF by running crypt keys
			if ierr := s.identifyTLF(ctx, convID, uid, localData.Messages, conv.Metadata.FinalizeInfo); ierr != nil {
				s.debug("Pull: identify failed: %s", ierr.Error())
				return chat1.ThreadView{}, nil, ierr
			}

			// Before returning the stuff, update SenderDeviceRevokedAt on each message.
			updatedMessages, err := s.updateMessages(ctx, localData.Messages)
			if err != nil {
				return chat1.ThreadView{}, rl, err
			}
			localData.Messages = updatedMessages

			// Before returning the stuff, send remote request to mark as read if
			// requested.
			if query != nil && query.MarkAsRead && len(localData.Messages) > 0 {
				res, err := s.ri().MarkAsRead(ctx, chat1.MarkAsReadArg{
					ConversationID: convID,
					MsgID:          localData.Messages[0].GetMessageID(),
				})
				if err != nil {
					return chat1.ThreadView{}, nil, err
				}
				rl = append(rl, res.RateLimit)
			}

			return localData, rl, nil
		}
	} else {
		s.debug("Pull: error fetching conv metadata: convID: %s uid: %s err: %s", convID, uid,
			err.Error())
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

	boxed.Thread.Messages = AppendTLFResetSuffix(boxed.Thread.Messages, conv.Metadata.FinalizeInfo)

	// Unbox
	thread, err := s.boxer.UnboxThread(ctx, boxed.Thread, convID)
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	// Store locally (just warn on error, don't abort the whole thing)
	if err = s.storage.Merge(ctx, convID, uid, thread.Messages); err != nil {
		s.G().Log.Warning("Pull: unable to commit thread locally: convID: %s uid: %s", convID, uid)
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
		if m.HeaderSignature == nil {
			// Skip revocation check for messages cached before the sig was part of the cache.
			s.debug("updateMessage skipping message (%v) with no cached HeaderSignature", m.ServerHeader.MessageID)
			return message, nil
		}

		sender := m.ClientHeader.Sender
		key := m.HeaderSignature.K
		ctime := m.ServerHeader.Ctime
		found, validAtCtime, revoked, err := s.boxer.ValidSenderKey(ctx, sender, key, ctime)
		if err != nil {
			return chat1.MessageUnboxed{}, err
		}
		if !found {
			return chat1.MessageUnboxed{}, libkb.NewPermanentChatUnboxingError(libkb.NoKeyError{Msg: "sender key not found"})
		}
		if !validAtCtime {
			return chat1.MessageUnboxed{}, libkb.NewPermanentChatUnboxingError(libkb.NoKeyError{Msg: "key invalid for sender at message ctime"})
		}
		m.SenderDeviceRevokedAt = revoked
		updatedMessage := chat1.NewMessageUnboxedWithValid(m)
		return updatedMessage, nil
	default:
		return message, nil
	}
}

func (s *HybridConversationSource) PullLocalOnly(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, error) {

	tv, err := s.storage.FetchUpToLocalMaxMsgID(ctx, convID, uid, query, pagination)
	if err != nil {
		return chat1.ThreadView{}, err
	}

	// Identify this TLF by running crypt keys
	// XXX might need finalize info
	if ierr := s.identifyTLF(ctx, convID, uid, tv.Messages, nil); ierr != nil {
		s.debug("PullLocalOnly: identify failed: %s", ierr.Error())
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
	s.debug("GetMessages: convID: %s uid: %s total msgs: %d remote: %d", convID, uid, len(msgIDs),
		len(remoteMsgs))
	if len(remoteMsgs) > 0 {
		rmsgs, err := s.ri().GetMessagesRemote(ctx, chat1.GetMessagesRemoteArg{
			ConversationID: convID,
			MessageIDs:     remoteMsgs,
		})
		if err != nil {
			return nil, err
		}

		rmsgs.Msgs = AppendTLFResetSuffix(rmsgs.Msgs, finalizeInfo)

		// Unbox all the remote messages
		rmsgsUnboxed, err := s.boxer.UnboxMessages(ctx, rmsgs.Msgs)
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
		var m chat1.MessageUnboxed
		if msg != nil {
			m = *msg
		} else {
			m = rmsgsTab[msgIDs[index]]
		}

		res = append(res, m)
	}

	// Identify this TLF by running crypt keys
	if ierr := s.identifyTLF(ctx, convID, uid, res, finalizeInfo); ierr != nil {
		s.debug("GetMessages: identify failed: %s", ierr.Error())
		return nil, ierr
	}

	return res, nil
}

func (s *HybridConversationSource) GetMessagesWithRemotes(ctx context.Context,
	convID chat1.ConversationID, uid gregor1.UID, msgs []chat1.MessageBoxed,
	finalizeInfo *chat1.ConversationFinalizeInfo) ([]chat1.MessageUnboxed, error) {

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

	s.debug("GetMessagesWithRemotes: convID: %s uid: %s total msgs: %d hits: %d", convID, uid,
		len(msgs), len(lmsgsTab))
	var merges []chat1.MessageUnboxed
	for _, msg := range msgs {
		if lmsg, ok := lmsgsTab[msg.GetMessageID()]; ok {
			res = append(res, lmsg)
		} else {
			unboxed, err := s.boxer.UnboxMessage(ctx, msg)
			if err != nil {
				return res, err
			}
			merges = append(merges, unboxed)
			res = append(res, unboxed)
		}
	}
	if len(merges) > 0 {
		if err = s.storage.Merge(ctx, convID, uid, merges); err != nil {
			return res, err
		}
	}

	// Identify this TLF by running crypt keys
	if ierr := s.identifyTLF(ctx, convID, uid, res, finalizeInfo); ierr != nil {
		s.debug("GetMessagesWithRemotes: identify failed: %s", ierr.Error())
		return nil, ierr
	}

	return res, nil
}

func NewConversationSource(g *libkb.GlobalContext, typ string, boxer *Boxer, storage *storage.Storage,
	ri func() chat1.RemoteInterface) libkb.ConversationSource {
	if typ == "hybrid" {
		return NewHybridConversationSource(g, boxer, storage, ri)
	}
	return NewRemoteConversationSource(g, boxer, ri)
}
