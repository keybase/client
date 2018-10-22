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
	ImagesOnly bool
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
	if !opts.ImagesOnly {
		return true
	}
	md := body.Attachment().Object.Metadata
	atyp, err := md.AssetType()
	if err != nil {
		return false
	}
	return atyp == chat1.AssetMetadataType_IMAGE || atyp == chat1.AssetMetadataType_VIDEO
}

func (g *Gallery) NextMessage(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, opts NextMessageOptions) (res *chat1.MessageUnboxed, err error) {

	var reverseFn func(chat1.ThreadView) []chat1.MessageUnboxed
	pivot := msgID
	pagination := utils.XlateMessageIDControlToPagination(&chat1.MessageIDControl{
		Pivot:  &pivot,
		Recent: !opts.BackInTime,
	})
	if opts.BackInTime {
		reverseFn = func(tv chat1.ThreadView) []chat1.MessageUnboxed {
			return tv.Messages
		}
		pagination.Num = g.NextStride
	} else {
		reverseFn = func(tv chat1.ThreadView) (res []chat1.MessageUnboxed) {
			res = make([]chat1.MessageUnboxed, len(tv.Messages))
			copy(res, tv.Messages)
			sort.Sort(sort.Reverse(utils.ByMsgUnboxedMsgID(res)))
			return res
		}
		pagination.Num = g.PrevStride
	}

	for {
		g.Debug(ctx, "NextMessage: starting scan: next: %x", pagination.Next)
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
		if opts.BackInTime {
			pagination = tv.Pagination
			pagination.Num = g.NextStride
			pagination.Previous = nil
		} else {
			pivot += chat1.MessageID(g.PrevStride)
			pagination = utils.XlateMessageIDControlToPagination(&chat1.MessageIDControl{
				Pivot:  &pivot,
				Num:    g.PrevStride,
				Recent: true,
			})
		}

	}
	return res, nil
}
