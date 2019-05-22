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
	BackInTime   bool
	MessageTypes []chat1.MessageType
	AssetTypes   []chat1.AssetMetadataType
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
		NextStride:   5,
		PrevStride:   50,
	}
}

func (g *Gallery) eligibleNextMessage(msg chat1.MessageUnboxed, typMap map[chat1.MessageType]bool,
	assetMap map[chat1.AssetMetadataType]bool) bool {
	if !msg.IsValid() {
		return false
	}
	body := msg.Valid().MessageBody
	typ, err := body.MessageType()
	if err != nil {
		return false
	}
	if !typMap[typ] {
		return false
	}
	switch typ {
	case chat1.MessageType_ATTACHMENT:
		md := body.Attachment().Object.Metadata
		atyp, err := md.AssetType()
		if err != nil {
			return false
		}
		if len(assetMap) > 0 && !assetMap[atyp] {
			return false
		}
	}
	return true
}

func (g *Gallery) NextMessage(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, opts NextMessageOptions) (res *chat1.MessageUnboxed, err error) {
	msgs, err := g.NextMessages(ctx, uid, convID, msgID, 1, opts, nil)
	if err != nil {
		return res, err
	}
	if len(msgs) == 0 {
		return nil, nil
	}
	return &msgs[0], nil
}

func (g *Gallery) makeMaps(opts NextMessageOptions) (typMap map[chat1.MessageType]bool,
	assetMap map[chat1.AssetMetadataType]bool) {
	typMap = make(map[chat1.MessageType]bool)
	assetMap = make(map[chat1.AssetMetadataType]bool)
	for _, typ := range opts.MessageTypes {
		typMap[typ] = true
	}
	for _, atyp := range opts.AssetTypes {
		assetMap[atyp] = true
	}
	return typMap, assetMap
}

func (g *Gallery) NextMessages(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, num int, opts NextMessageOptions,
	uiCh chan chat1.MessageUnboxed) (res []chat1.MessageUnboxed, err error) {
	defer g.Trace(ctx, func() error { return err }, "NextMessages")()
	defer func() {
		if uiCh != nil {
			close(uiCh)
		}
	}()
	var reverseFn func(chat1.ThreadView) []chat1.MessageUnboxed
	var nextPageFn func(*chat1.Pagination) *chat1.Pagination
	pivot := msgID
	mode := chat1.MessageIDControlMode_NEWERMESSAGES
	if opts.BackInTime {
		mode = chat1.MessageIDControlMode_OLDERMESSAGES
	}
	if len(opts.MessageTypes) == 0 {
		opts.MessageTypes = []chat1.MessageType{chat1.MessageType_ATTACHMENT}
	}
	typMap, assetMap := g.makeMaps(opts)
	pagination := utils.MessageIDControlToPagination(ctx, g.DebugLabeler, &chat1.MessageIDControl{
		Pivot: &pivot,
		Mode:  mode,
	}, nil)
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
			return utils.MessageIDControlToPagination(ctx, g.DebugLabeler, &chat1.MessageIDControl{
				Pivot: &pivot,
				Num:   g.PrevStride,
				Mode:  chat1.MessageIDControlMode_NEWERMESSAGES,
			}, nil)
		}
		pagination.Num = g.PrevStride
	}

	for {
		g.Debug(ctx, "NextMessage: starting scan: p: %s pivot: %d", pagination, pivot)
		tv, err := g.G().ConvSource.Pull(ctx, convID, uid, chat1.GetThreadReason_GENERAL,
			&chat1.GetThreadQuery{
				MessageTypes: opts.MessageTypes,
			}, pagination)
		if err != nil {
			return res, err
		}
		messages := reverseFn(tv)
		for _, m := range messages {
			if !g.eligibleNextMessage(m, typMap, assetMap) {
				continue
			}
			res = append(res, m)
			if uiCh != nil {
				uiCh <- m
			}
			if len(res) >= num {
				return res, nil
			}
		}
		g.Debug(ctx, "NextMessages: still need more (%d < %d): len: %d", len(res), num, len(tv.Messages))
		if tv.Pagination.Last {
			break
		}
		pagination = nextPageFn(tv.Pagination)
	}
	return res, nil
}
