package chat

import (
	"fmt"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type RemoteConversationSource struct {
	libkb.Contextified
	ri    chat1.RemoteInterface
	boxer *Boxer
}

func NewRemoteConversationSource(g *libkb.GlobalContext, b *Boxer, ri chat1.RemoteInterface) *RemoteConversationSource {
	return &RemoteConversationSource{
		Contextified: libkb.NewContextified(g),
		ri:           ri,
		boxer:        b,
	}
}

func (s *RemoteConversationSource) Push(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg chat1.MessageBoxed) (chat1.MessageUnboxed, error) {
	// Do nothing here, we don't care about pushed messages
	return chat1.MessageUnboxed{}, nil
}

func (s *RemoteConversationSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, []*chat1.RateLimit, error) {

	rarg := chat1.GetThreadRemoteArg{
		ConversationID: convID,
		Query:          query,
		Pagination:     pagination,
	}
	boxed, err := s.ri.GetThreadRemote(ctx, rarg)
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

type HybridConversationSource struct {
	libkb.Contextified
	ri      chat1.RemoteInterface
	boxer   *Boxer
	storage *storage.Storage
}

func NewHybridConversationSource(g *libkb.GlobalContext, b *Boxer, storage *storage.Storage, ri chat1.RemoteInterface) *HybridConversationSource {
	return &HybridConversationSource{
		Contextified: libkb.NewContextified(g),
		ri:           ri,
		boxer:        b,
		storage:      storage,
	}
}

func (s *HybridConversationSource) Push(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg chat1.MessageBoxed) (chat1.MessageUnboxed, error) {
	var err error

	decmsg, err := s.boxer.UnboxMessage(ctx, NewKeyFinder(), msg)
	if err != nil {
		return decmsg, err
	}

	// Check conversation ID and change to error if it is wrong
	if decmsg.IsValid() && !decmsg.Valid().ClientHeader.Conv.Derivable(convID) {
		decmsg = chat1.NewMessageUnboxedWithError(chat1.MessageUnboxedError{
			ErrMsg:      "invalid conversation ID",
			MessageID:   msg.GetMessageID(),
			MessageType: msg.GetMessageType(),
		})
	}

	// Store the message
	if err = s.storage.Merge(ctx, convID, uid, []chat1.MessageUnboxed{decmsg}); err != nil {
		return decmsg, err
	}

	return decmsg, nil
}

func (s *HybridConversationSource) getConvMetadata(ctx context.Context, convID chat1.ConversationID,
	rl *[]*chat1.RateLimit) (chat1.Conversation, error) {

	conv, err := s.ri.GetInboxRemote(ctx, chat1.GetInboxRemoteArg{
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

func (s *HybridConversationSource) Pull(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, query *chat1.GetThreadQuery, pagination *chat1.Pagination) (chat1.ThreadView, []*chat1.RateLimit, error) {

	var err error
	var rl []*chat1.RateLimit

	// Get conversation metadata
	if conv, err := s.getConvMetadata(ctx, convID, &rl); err == nil {
		// Try locally first
		localData, err := s.storage.Fetch(ctx, conv, uid, query, pagination)
		if err == nil {
			// If found, then return the stuff
			s.G().Log.Debug("Pull: cache hit: convID: %s uid: %s", convID, uid)

			// Before returning the stuff, update FromRevokedDevice on each message.
			updatedMessages, err := s.updateMessages(ctx, localData.Messages)
			if err != nil {
				return chat1.ThreadView{}, rl, err
			}
			localData.Messages = updatedMessages

			// Before returning the stuff, send remote request to mark as read if
			// requested.
			if query != nil && query.MarkAsRead && len(localData.Messages) > 0 {
				res, err := s.ri.MarkAsRead(ctx, chat1.MarkAsReadArg{
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
		s.G().Log.Debug("Pull: error fetching conv metadata: convID: %s uid: %s err: %s", convID, uid,
			err.Error())
	}

	// Fetch the entire request on failure
	rarg := chat1.GetThreadRemoteArg{
		ConversationID: convID,
		Query:          query,
		Pagination:     pagination,
	}
	boxed, err := s.ri.GetThreadRemote(ctx, rarg)
	rl = append(rl, boxed.RateLimit)
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	// Unbox
	thread, err := s.boxer.UnboxThread(ctx, boxed.Thread, convID)
	if err != nil {
		return chat1.ThreadView{}, rl, err
	}

	// Store locally (just warn on error, don't abort the whole thing)
	if err = s.storage.Merge(ctx, convID, uid, thread.Messages); err != nil {
		s.G().Log.Warning("Pull: unable to commit thread locally: convID: %s uid: %s", convID, uid)
		s.G().Log.Warning("@@@ %v", err)
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
		s.G().Log.Warning("@@@ updating message msgid:%v from cache hit", m.ServerHeader.MessageID)
		if m.HeaderSignature == nil {
			// Skip revocation check for messages cached before the sig was part of the cache.
			s.G().Log.Warning("updateMessage skipping message (%v) with no cached HeaderSignature", m.ServerHeader.MessageID)
			return message, nil
		}

		sender := m.ClientHeader.Sender
		key := m.HeaderSignature.K
		ctime := m.ServerHeader.Ctime
		validAtCtime, revoked, err := s.boxer.ValidSenderKey(ctx, sender, key, ctime)
		if err != nil {
			return chat1.MessageUnboxed{}, err
		}
		if !validAtCtime {
			return chat1.MessageUnboxed{}, libkb.NewPermanentChatUnboxingError(libkb.NoKeyError{Msg: "key invalid for sender at message ctime"})
		}
		// TODO delete this var
		oldval := m.FromRevokedDevice
		m.FromRevokedDevice = revoked
		s.G().Log.Warning("@@@ updated msgid:%v revoked:%v (was:%v)", m.ServerHeader.MessageID, m.FromRevokedDevice, oldval)
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
	return tv, nil
}

func (s *HybridConversationSource) Clear(convID chat1.ConversationID, uid gregor1.UID) error {
	return s.storage.MaybeNuke(true, nil, convID, uid)
}

func NewConversationSource(g *libkb.GlobalContext, typ string, boxer *Boxer, storage *storage.Storage,
	ri chat1.RemoteInterface) libkb.ConversationSource {
	if typ == "hybrid" {
		return NewHybridConversationSource(g, boxer, storage, ri)
	}
	return NewRemoteConversationSource(g, boxer, ri)
}
