package chat

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type fillerReplyMsgs struct {
	msgIDs  map[chat1.MessageID]bool
	fetcher getMessagesFunc
}

func newFillerReplyMsgs(fetcher getMessagesFunc) *fillerReplyMsgs {
	return &fillerReplyMsgs{
		msgIDs:  make(map[chat1.MessageID]bool),
		fetcher: fetcher,
	}
}

func (f *fillerReplyMsgs) add(msgID chat1.MessageID) {
	f.msgIDs[msgID] = true
}

func (f *fillerReplyMsgs) fill(ctx context.Context, uid gregor1.UID, conv types.UnboxConversationInfo) (res []chat1.MessageUnboxed, err error) {
	var msgIDs []chat1.MessageID
	for msgID := range f.msgIDs {
		msgIDs = append(msgIDs, msgID)
	}
	return f.fetcher(ctx, conv, uid, msgIDs, nil)
}

func LocalOnlyReplyFill(enabled bool) func(*ReplyFiller) {
	return func(f *ReplyFiller) {
		f.SetLocalOnlyReplyFill(enabled)
	}
}

type ReplyFiller struct {
	globals.Contextified
	utils.DebugLabeler

	localOnly bool
}

func NewReplyFiller(g *globals.Context, config ...func(*ReplyFiller)) *ReplyFiller {
	f := &ReplyFiller{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "ReplyFiller", false),
	}
	for _, c := range config {
		c(f)
	}
	return f
}

func (f *ReplyFiller) SetLocalOnlyReplyFill(enabled bool) {
	f.localOnly = enabled
}

func (f *ReplyFiller) localFetcher(ctx context.Context, conv types.UnboxConversationInfo,
	uid gregor1.UID, msgIDs []chat1.MessageID, _ *chat1.GetThreadReason) (res []chat1.MessageUnboxed, err error) {
	msgs, err := storage.New(f.G(), nil).FetchMessages(ctx, conv.GetConvID(), uid, msgIDs)
	if err != nil {
		return nil, err
	}
	for _, msg := range msgs {
		if msg != nil {
			res = append(res, *msg)
		}
	}
	return res, nil
}

func (f *ReplyFiller) validReplyTo(msgID *chat1.MessageID) bool {
	return msgID != nil && *msgID > 0
}

func (f *ReplyFiller) getReplyTo(msg chat1.MessageUnboxed) *chat1.MessageID {
	st, err := msg.State()
	if err != nil {
		return nil
	}
	switch st {
	case chat1.MessageUnboxedState_VALID:
		if msg.Valid().MessageBody.IsType(chat1.MessageType_TEXT) &&
			f.validReplyTo(msg.Valid().MessageBody.Text().ReplyTo) {
			return msg.Valid().MessageBody.Text().ReplyTo
		}
	case chat1.MessageUnboxedState_OUTBOX:
		if f.validReplyTo(msg.Outbox().PrepareOpts.ReplyTo) {
			return msg.Outbox().PrepareOpts.ReplyTo
		}
	}
	return nil
}

func (f *ReplyFiller) Fill(ctx context.Context, uid gregor1.UID, conv types.UnboxConversationInfo,
	msgs []chat1.MessageUnboxed) (res []chat1.MessageUnboxed) {

	// Gather up the message IDs we need
	repliedToMsgIDsLocal := newFillerReplyMsgs(f.localFetcher)
	repliedToMsgIDsRemote := newFillerReplyMsgs(f.G().ConvSource.GetMessages)
	for _, msg := range msgs {
		st, err := msg.State()
		if err != nil {
			continue
		}
		switch st {
		case chat1.MessageUnboxedState_VALID:
			if msgID := f.getReplyTo(msg); msgID != nil {
				if f.localOnly {
					repliedToMsgIDsLocal.add(*msgID)
				} else {
					repliedToMsgIDsRemote.add(*msgID)
				}
			}
		case chat1.MessageUnboxedState_OUTBOX:
			if msgID := f.getReplyTo(msg); msgID != nil {
				repliedToMsgIDsLocal.add(*msgID)
			}
		}
	}

	// Fetch messages
	localMsgs, err := repliedToMsgIDsLocal.fill(ctx, uid, conv)
	if err != nil {
		localMsgs = nil
		f.Debug(ctx, "Fill: failed to get local messages: %s", err)
	}
	remoteMsgs, err := repliedToMsgIDsRemote.fill(ctx, uid, conv)
	if err != nil {
		remoteMsgs = nil
		f.Debug(ctx, "Fill: failed to get remote messages: %s", err)
	}
	replyMap := make(map[chat1.MessageID]chat1.MessageUnboxed)
	for _, msg := range append(localMsgs, remoteMsgs...) {
		replyMap[msg.GetMessageID()] = msg
	}

	// Modify messages
	for _, msg := range msgs {
		if replyToID := f.getReplyTo(msg); replyToID != nil {
			st, err := msg.State()
			if err != nil {
				continue
			}
			replyTo, found := replyMap[*replyToID]
			if !found {
				continue
			}
			switch st {
			case chat1.MessageUnboxedState_VALID:
				mvalid := msg.Valid()
				mvalid.ReplyTo = &replyTo
				res = append(res, chat1.NewMessageUnboxedWithValid(mvalid))
			case chat1.MessageUnboxedState_OUTBOX:
				obr := msg.Outbox()
				obr.ReplyTo = &replyTo
				res = append(res, chat1.NewMessageUnboxedWithOutbox(obr))
			default:
				res = append(res, msg)
			}
		} else {
			res = append(res, msg)
		}
	}
	return res
}
