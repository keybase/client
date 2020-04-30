package attachments

import (
	"sort"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
	"mvdan.cc/xurls/v2"
)

type NextMessageOptions struct {
	BackInTime  bool
	MessageType chat1.MessageType
	AssetTypes  []chat1.AssetMetadataType
	UnfurlTypes []chat1.UnfurlType
	FilterLinks bool
}

type Gallery struct {
	globals.Contextified
	utils.DebugLabeler

	PrevStride, NextStride int
}

func NewGallery(g *globals.Context) *Gallery {
	return &Gallery{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "Attachments.Gallery", false),
		NextStride:   5,
		PrevStride:   50,
	}
}

func (g *Gallery) eligibleNextMessage(msg chat1.MessageUnboxed, typMap map[chat1.MessageType]bool,
	assetMap map[chat1.AssetMetadataType]bool, unfurlMap map[chat1.UnfurlType]bool) bool {
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
	case chat1.MessageType_UNFURL:
		unfurl := body.Unfurl().Unfurl.Unfurl
		typ, err := unfurl.UnfurlType()
		if err != nil {
			return false
		}
		if len(unfurlMap) > 0 && !unfurlMap[typ] {
			return false
		}
	}
	return true
}

var linkRegexp = xurls.Strict()

func (g *Gallery) searchForLinks(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, num int, uiCh chan chat1.UIMessage) (res []chat1.MessageUnboxed, last bool, err error) {
	var hitCh chan chat1.ChatSearchHit
	if uiCh != nil {
		hitCh = make(chan chat1.ChatSearchHit)
		doneCh := make(chan struct{})
		defer func() { <-doneCh }()
		go func() {
			for hit := range hitCh {
				uiCh <- hit.HitMessage
			}
			close(doneCh)
		}()
	}
	idcontrol := &chat1.MessageIDControl{
		Pivot: &msgID,
		Mode:  chat1.MessageIDControlMode_OLDERMESSAGES,
	}
	if _, res, err = g.G().RegexpSearcher.Search(ctx, uid, convID, linkRegexp, hitCh, chat1.SearchOpts{
		InitialPagination: utils.MessageIDControlToPagination(ctx, g.DebugLabeler, idcontrol, nil),
		MaxHits:           num,
	}); err != nil {
		return res, false, err
	}
	return res, len(res) < num, nil
}

func (g *Gallery) NextMessage(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, opts NextMessageOptions) (res *chat1.MessageUnboxed, last bool, err error) {
	msgs, last, err := g.NextMessages(ctx, uid, convID, msgID, 1, opts, nil)
	if err != nil {
		return res, false, err
	}
	if len(msgs) == 0 {
		return nil, true, nil
	}
	return &msgs[0], last, nil
}

func (g *Gallery) makeMaps(opts NextMessageOptions) (typMap map[chat1.MessageType]bool,
	assetMap map[chat1.AssetMetadataType]bool, unfurlMap map[chat1.UnfurlType]bool) {
	typMap = make(map[chat1.MessageType]bool)
	assetMap = make(map[chat1.AssetMetadataType]bool)
	unfurlMap = make(map[chat1.UnfurlType]bool)
	typMap[opts.MessageType] = true
	for _, atyp := range opts.AssetTypes {
		assetMap[atyp] = true
	}
	for _, utyp := range opts.UnfurlTypes {
		unfurlMap[utyp] = true
	}
	return typMap, assetMap, unfurlMap
}

func (g *Gallery) getUnfurlHost(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msg chat1.MessageUnboxed) (res chat1.MessageUnboxed, err error) {
	if !msg.IsValid() {
		return msg, nil
	}
	if !msg.Valid().MessageBody.IsType(chat1.MessageType_UNFURL) {
		return msg, nil
	}
	hostMsgID := msg.Valid().MessageBody.Unfurl().MessageID
	return g.G().ChatHelper.GetMessage(ctx, uid, convID, hostMsgID, true, nil)
}

func (g *Gallery) NextMessages(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, num int, opts NextMessageOptions,
	uiCh chan chat1.UIMessage) (res []chat1.MessageUnboxed, last bool, err error) {
	defer g.Trace(ctx, &err, "NextMessages")()
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
	if opts.MessageType == chat1.MessageType_NONE {
		opts.MessageType = chat1.MessageType_ATTACHMENT
	} else if opts.MessageType == chat1.MessageType_TEXT && opts.FilterLinks {
		return g.searchForLinks(ctx, uid, convID, msgID, num, uiCh)
	}
	typMap, assetMap, unfurlMap := g.makeMaps(opts)
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
		select {
		case <-ctx.Done():
			return res, false, ctx.Err()
		default:
		}
		g.Debug(ctx, "NextMessage: starting scan: p: %s pivot: %d", pagination, pivot)
		tv, err := g.G().ConvSource.Pull(ctx, convID, uid, chat1.GetThreadReason_GENERAL, nil,
			&chat1.GetThreadQuery{
				MessageTypes: []chat1.MessageType{opts.MessageType},
			}, pagination)
		if err != nil {
			return res, false, err
		}
		messages := reverseFn(tv)
		for _, m := range messages {
			if !g.eligibleNextMessage(m, typMap, assetMap, unfurlMap) {
				continue
			}
			if m, err = g.getUnfurlHost(ctx, uid, convID, m); err != nil {
				return res, false, err
			}
			res = append(res, m)
			if uiCh != nil {
				uiCh <- utils.PresentMessageUnboxed(ctx, g.G(), m, uid, convID)
			}
			if len(res) >= num {
				g.Debug(ctx, "NextMessages: stopping on satisfied")
				return res, false, nil
			}
		}
		g.Debug(ctx, "NextMessages: still need more (%d < %d): len: %d", len(res), num, len(tv.Messages))
		if tv.Pagination.Last {
			g.Debug(ctx, "NextMessages: stopping on last page")
			break
		}
		pagination = nextPageFn(tv.Pagination)
	}
	return res, true, nil
}
