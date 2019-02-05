package attachments

import (
	"sort"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type NextMessageOptions struct {
	BackInTime bool
	AssetTypes []chat1.AssetMetadataType
}

type Gallery struct {
	globals.Contextified
	utils.DebugLabeler

	PrevStride, NextStride int
}

func NewGallery(g *globals.Context) *Gallery {
	return &Gallery{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Attachments.Gallery", false),
		NextStride:   10,
		PrevStride:   50,
	}
}

func (g *Gallery) eligibleNextMessage(msg chat1.MessageUnboxed, opts NextMessageOptions) bool {
	if !msg.IsValid() {
		return false
	}
	body := msg.Valid().MessageBody
	typ, err := body.MessageType()
	if err != nil || typ != chat1.MessageType_ATTACHMENT {
		return false
	}
	md := body.Attachment().Object.Metadata
	atyp, err := md.AssetType()
	if err != nil {
		return false
	}
	if len(opts.AssetTypes) == 0 {
		return true
	}
	for _, a := range opts.AssetTypes {
		if atyp == a {
			return true
		}
	}
	return false
}

func (g *Gallery) NextMessage(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, opts NextMessageOptions) (res *chat1.MessageUnboxed, err error) {

	var reverseFn func(chat1.ThreadView) []chat1.MessageUnboxed
	var nextPageFn func(*chat1.Pagination) *chat1.Pagination
	pivot := msgID
	mode := chat1.MessageIDControlMode_NEWERMESSAGES
	if opts.BackInTime {
		mode = chat1.MessageIDControlMode_OLDERMESSAGES
	}
	pagination := utils.MessageIDControlToPagination(&chat1.MessageIDControl{
		Pivot: &pivot,
		Mode:  mode,
	})
	if opts.BackInTime {
		reverseFn = func(tv chat1.ThreadView) []chat1.MessageUnboxed {
			return tv.Messages
		}
		nextPageFn = func(p *chat1.Pagination) (res *chat1.Pagination) {
			res = p
			res.Num = g.NextStride
			res.Previous = nil
			return res
		}
		pagination.Num = g.NextStride
	} else {
		reverseFn = func(tv chat1.ThreadView) (res []chat1.MessageUnboxed) {
			res = make([]chat1.MessageUnboxed, len(tv.Messages))
			copy(res, tv.Messages)
			sort.Sort(sort.Reverse(utils.ByMsgUnboxedMsgID(res)))
			return res
		}
		nextPageFn = func(p *chat1.Pagination) (res *chat1.Pagination) {
			pivot += chat1.MessageID(g.PrevStride)
			return utils.MessageIDControlToPagination(&chat1.MessageIDControl{
				Pivot: &pivot,
				Num:   g.PrevStride,
				Mode:  chat1.MessageIDControlMode_NEWERMESSAGES,
			})
		}
		pagination.Num = g.PrevStride
	}

	for {
		g.Debug(ctx, "NextMessage: starting scan: p: %s pivot: %d", pagination, pivot)
		tv, err := g.G().ConvSource.Pull(ctx, convID, uid, chat1.GetThreadReason_GENERAL,
			&chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{chat1.MessageType_ATTACHMENT},
			}, pagination)
		if err != nil {
			return res, err
		}
		messages := reverseFn(tv)
		for _, m := range messages {
			if !g.eligibleNextMessage(m, opts) {
				continue
			}
			return &m, nil
		}
		g.Debug(ctx, "NextMessage: missed all messages: len: %d", len(tv.Messages))
		if tv.Pagination.Last {
			break
		}
		pagination = nextPageFn(tv.Pagination)
	}
	return res, nil
}
