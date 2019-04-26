package search

import (
	"context"
	"unsafe"

	"github.com/keybase/client/go/chat/globals"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type ConversationIndexWrapper struct {
	globals.Contextified
	utils.DebugLabeler

	idx *chat1.ConversationIndex
}

func NewConversationIndexWrapper(g *globals.Context, idx *chat1.ConversationIndex) *ConversationIndexWrapper {
	return &ConversationIndexWrapper{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "ConversationIndexWrapper", false),
		idx:          idx,
	}
}

func (w *ConversationIndexWrapper) GetIndexUnsafe() *chat1.ConversationIndex {
	return w.idx
}

func (w *ConversationIndexWrapper) fetchSupersededMsgs(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID, msg chat1.MessageUnboxed) []chat1.MessageUnboxed {
	superIDs, err := utils.GetSupersedes(msg)
	if err != nil {
		w.Debug(ctx, "fetchSupersededMsgs: unable to get supersedes: %v", err)
		return nil
	}
	reason := chat1.GetThreadReason_INDEXED_SEARCH
	supersededMsgs, err := w.G().ChatHelper.GetMessages(ctx, uid, convID, superIDs,
		false /* resolveSupersedes*/, &reason)
	if err != nil {
		// Log but ignore error
		w.Debug(ctx, "fetchSupersededMsgs: unable to get fetch messages: %v", err)
		return nil
	}
	return supersededMsgs
}

// addTokensLocked add the given tokens to the index under the given message
// id, when ingesting EDIT messages the msgID is of the superseded msg but the
// tokens are from the EDIT itself.
func (w *ConversationIndexWrapper) addTokens(tokens tokenMap, msgID chat1.MessageID) {
	for token, aliases := range tokens {
		msgIDs, ok := w.idx.Index[token]
		if !ok {
			msgIDs = map[chat1.MessageID]chat1.EmptyStruct{}
		}
		msgIDs[msgID] = chat1.EmptyStruct{}
		w.idx.Index[token] = msgIDs
		for alias := range aliases {
			atoken, ok := w.idx.Alias[alias]
			if !ok {
				atoken = map[string]chat1.EmptyStruct{}
			}
			atoken[token] = chat1.EmptyStruct{}
			w.idx.Alias[alias] = atoken
		}
	}
}

func (w *ConversationIndexWrapper) addMsg(msg chat1.MessageUnboxed) {
	tokens := tokensFromMsg(msg)
	w.addTokens(tokens, msg.GetMessageID())
}

func (w *ConversationIndexWrapper) removeMsg(msg chat1.MessageUnboxed) {
	// find the msgID that the index stores
	var msgID chat1.MessageID
	switch msg.GetMessageType() {
	case chat1.MessageType_EDIT, chat1.MessageType_ATTACHMENTUPLOADED:
		superIDs, err := utils.GetSupersedes(msg)
		if err != nil || len(superIDs) != 1 {
			return
		}
		msgID = superIDs[0]
	default:
		msgID = msg.GetMessageID()
	}

	for token, aliases := range tokensFromMsg(msg) {
		msgIDs := w.idx.Index[token]
		delete(msgIDs, msgID)
		if len(msgIDs) == 0 {
			delete(w.idx.Index, token)
		}
		for alias := range aliases {
			for atoken := range w.idx.Alias[alias] {
				_, ok := w.idx.Index[atoken]
				if !ok {
					delete(w.idx.Alias[alias], atoken)
				}
			}
			if len(w.idx.Alias[alias]) == 0 {
				delete(w.idx.Alias, alias)
			}
		}
	}
}

func (w *ConversationIndexWrapper) Add(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed) (err error) {
	defer w.Trace(ctx, func() error { return err }, "Add: convID: %s", convID)()
	for _, msg := range msgs {
		seenIDs := w.idx.Metadata.SeenIDs
		// Don't add if we've seen
		if _, ok := seenIDs[msg.GetMessageID()]; ok {
			continue
		}
		seenIDs[msg.GetMessageID()] = chat1.EmptyStruct{}
		// NOTE DELETE and DELETEHISTORY are handled through calls to `remove`,
		// other messages will be added if there is any content that can be
		// indexed.
		switch msg.GetMessageType() {
		case chat1.MessageType_ATTACHMENTUPLOADED:
			supersededMsgs := w.fetchSupersededMsgs(ctx, convID, uid, msg)
			for _, sm := range supersededMsgs {
				seenIDs[sm.GetMessageID()] = chat1.EmptyStruct{}
				w.addMsg(sm)
			}
		case chat1.MessageType_EDIT:
			tokens := tokensFromMsg(msg)
			supersededMsgs := w.fetchSupersededMsgs(ctx, convID, uid, msg)
			// remove the original message text and replace it with the edited
			// contents (using the original id in the index)
			for _, sm := range supersededMsgs {
				seenIDs[sm.GetMessageID()] = chat1.EmptyStruct{}
				w.removeMsg(sm)
				w.addTokens(tokens, sm.GetMessageID())
			}
		default:
			w.addMsg(msg)
		}
	}
	return nil
}

func (w *ConversationIndexWrapper) Remove(ctx context.Context, convID chat1.ConversationID,
	msgs []chat1.MessageUnboxed) (err error) {
	defer w.Trace(ctx, func() error { return err }, "Remove: convID: %s", convID)()
	seenIDs := w.idx.Metadata.SeenIDs
	for _, msg := range msgs {
		// Don't remove if we haven't seen
		if _, ok := seenIDs[msg.GetMessageID()]; !ok {
			continue
		}
		seenIDs[msg.GetMessageID()] = chat1.EmptyStruct{}
		w.removeMsg(msg)
	}
	return nil
}

func (w *ConversationIndexWrapper) Index(token string) map[chat1.MessageID]chat1.EmptyStruct {
	return w.idx.Index[token]
}

func (w *ConversationIndexWrapper) Alias(token string) map[string]chat1.EmptyStruct {
	return w.idx.Alias[token]
}

func (w *ConversationIndexWrapper) strSize(s string) uintptr {
	return uintptr(len(s)) + unsafe.Sizeof(s)
}

func (w *ConversationIndexWrapper) Size() int64 {
	if w.idx == nil {
		return 0
	}
	size := unsafe.Sizeof(w.idx.Index)
	for token, msgMap := range w.idx.Index {
		size += w.strSize(token)
		size += uintptr(len(msgMap)) * unsafe.Sizeof(chat1.MessageID(0))
	}
	size += unsafe.Sizeof(w.idx.Alias)
	for alias, tokenMap := range w.idx.Alias {
		size += w.strSize(alias)
		for token := range tokenMap {
			size += w.strSize(token)
		}
	}
	return int64(size) + w.idx.Metadata.Size()
}

func (w *ConversationIndexWrapper) MinMaxIDs(conv chat1.Conversation) (min, max chat1.MessageID) {
	// lowest msgID we care about
	min = conv.GetMaxDeletedUpTo()
	if min == 0 {
		min = 1
	}
	// highest msgID we care about
	max = conv.GetMaxMessageID()
	return min, max
}

func (w *ConversationIndexWrapper) MissingIDForConv(conv chat1.Conversation) (res []chat1.MessageID) {
	min, max := w.MinMaxIDs(conv)
	for i := min; i <= max; i++ {
		if _, ok := w.idx.Metadata.SeenIDs[i]; !ok {
			res = append(res, i)
		}
	}
	return res
}

func (w *ConversationIndexWrapper) numMissing(min, max chat1.MessageID) (numMissing int) {
	for i := min; i <= max; i++ {
		if _, ok := w.idx.Metadata.SeenIDs[i]; !ok {
			numMissing++
		}
	}
	return numMissing
}

func (w *ConversationIndexWrapper) PercentIndexed(conv chat1.Conversation) int {
	if w.idx == nil {
		return 0
	}
	min, max := w.MinMaxIDs(conv)
	numMessages := int(max) - int(min) + 1
	if numMessages <= 1 {
		return 100
	}
	numMissing := w.numMissing(min, max)
	return int(100 * (1 - (float64(numMissing) / float64(numMessages))))
}

func (w *ConversationIndexWrapper) FullyIndexed(conv chat1.Conversation) bool {
	if w.idx == nil {
		return false
	}
	min, max := w.MinMaxIDs(conv)
	if max <= min {
		return true
	}
	return w.numMissing(min, max) == 0
}
