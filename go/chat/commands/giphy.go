package commands

import (
	"context"
	"sync"

	"github.com/keybase/client/go/chat/giphy"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type giphySearcher interface {
	Search(mctx libkb.MetaContext, apiKeySource types.ExternalAPIKeySource, query *string, limit int,
		urlsrv types.AttachmentURLSrv) ([]chat1.GiphySearchResult, error)
}

type defaultGiphySearcher struct{}

func (d defaultGiphySearcher) Search(mctx libkb.MetaContext, apiKeySource types.ExternalAPIKeySource,
	query *string, limit int, urlsrv types.AttachmentURLSrv) ([]chat1.GiphySearchResult, error) {
	return giphy.Search(mctx, apiKeySource, query, limit, urlsrv)
}

type Giphy struct {
	sync.Mutex
	*baseCommand
	shownResults      map[chat1.ConvIDStr]*string
	shownWindow       map[chat1.ConvIDStr]bool
	currentOpCancelFn context.CancelFunc
	currentOpDoneCb   chan struct{}
	searcher          giphySearcher
}

func NewGiphy(g *globals.Context) *Giphy {
	usage := "Search for and post GIFs"
	return &Giphy{
		baseCommand:  newBaseCommand(g, "giphy", "[search terms]", usage, true),
		shownResults: make(map[chat1.ConvIDStr]*string),
		shownWindow:  make(map[chat1.ConvIDStr]bool),
		searcher:     defaultGiphySearcher{},
	}
}

func (s *Giphy) getQuery(text string) *string {
	var query *string
	_, q, err := s.commandAndMessage(text)
	if err != nil {
		return nil
	}
	if len(q) > 0 {
		query = &q
	}
	return query
}

func (s *Giphy) getLimit() int {
	limit := 25
	if s.G().IsMobileAppType() {
		limit = 10
	}
	return limit
}

func (s *Giphy) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string, replyTo *chat1.MessageID) (err error) {
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	results, err := s.searcher.Search(libkb.NewMetaContext(ctx, s.G().ExternalG()),
		s.G().ExternalAPIKeySource, s.getQuery(text), s.getLimit(), s.G().AttachmentURLSrv)
	if err != nil {
		s.Debug(ctx, "Execute: failed to get Giphy results: %s", err)
		return err
	}
	if len(results) == 0 {
		s.Debug(ctx, "Execute: failed to find any results")
		return nil
	}
	res := results[libkb.RandIntn(len(results))]
	_, err = s.G().ChatHelper.SendTextByIDNonblock(ctx, convID, tlfName, res.TargetUrl, nil, replyTo)
	return err
}

func (s *Giphy) queryEqual(query *string, shown *string) bool {
	if query == nil && shown == nil {
		return true
	} else if query == nil && shown != nil || query != nil && shown == nil {
		return false
	}
	return *query == *shown
}

func (s *Giphy) Preview(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) {
	defer s.Trace(ctx, nil, "Preview")()
	s.Lock()
	if s.currentOpCancelFn != nil {
		s.currentOpCancelFn()
	}
	select {
	case <-s.currentOpDoneCb:
		s.Debug(ctx, "Preview: waiting for previous run to terminate")
	default:
	}
	s.Debug(ctx, "Preview: cleared for takeoff")
	ctx, s.currentOpCancelFn = context.WithCancel(ctx)
	s.currentOpDoneCb = make(chan struct{})
	s.Unlock()
	defer close(s.currentOpDoneCb)

	if !s.Match(ctx, text) {
		if _, ok := s.shownWindow[convID.ConvIDStr()]; ok {
			// tell UI to clear
			err := s.getChatUI().ChatGiphyToggleResultWindow(ctx, convID, false, false)
			if err != nil {
				s.Debug(ctx, "Preview: error on toggle result: %+v", err)
			}
			delete(s.shownResults, convID.ConvIDStr())
			delete(s.shownWindow, convID.ConvIDStr())
		}
		return
	}
	query := s.getQuery(text)
	if shown, ok := s.shownResults[convID.ConvIDStr()]; ok && s.queryEqual(query, shown) {
		s.Debug(ctx, "Preview: same query given, skipping")
		return
	}
	err := s.getChatUI().ChatGiphyToggleResultWindow(ctx, convID, true, false)
	if err != nil {
		s.Debug(ctx, "Preview: error on toggle result: %+v", err)
	}

	s.shownWindow[convID.ConvIDStr()] = true

	results, err := s.searcher.Search(libkb.NewMetaContext(ctx, s.G().ExternalG()),
		s.G().ExternalAPIKeySource, query, s.getLimit(), s.G().AttachmentURLSrv)
	if err != nil {
		s.Debug(ctx, "Preview: failed to get Giphy results: %s", err)
		return
	}
	err = s.getChatUI().ChatGiphySearchResults(ctx, convID, chat1.GiphySearchResults{
		Results:    results,
		GalleryUrl: s.G().AttachmentURLSrv.GetGiphyGalleryURL(ctx, convID, tlfName, results),
	})
	if err != nil {
		s.Debug(ctx, "Preview: error on search results: %+v", err)
		return
	}

	s.shownResults[convID.ConvIDStr()] = query
}
