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
	Search(mctx libkb.MetaContext, query *string, urlsrv types.AttachmentURLSrv) (chat1.GiphySearchResults, error)
}

type defaultGiphySearcher struct{}

func (d defaultGiphySearcher) Search(mctx libkb.MetaContext, query *string, urlsrv types.AttachmentURLSrv) (chat1.GiphySearchResults, error) {
	return giphy.Search(mctx, query, urlsrv)
}

type Giphy struct {
	sync.Mutex
	*baseCommand
	shownResults      map[string]*string
	currentOpCancelFn context.CancelFunc
	currentOpDoneCb   chan struct{}
	searcher          giphySearcher
}

func NewGiphy(g *globals.Context) *Giphy {
	usage := "Search for and post GIFs"
	if g.GetAppType() == libkb.MobileAppType {
		usage = "Post a random GIF"
	}
	return &Giphy{
		baseCommand:  newBaseCommand(g, "giphy", "[search terms]", usage, true),
		shownResults: make(map[string]*string),
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

func (s *Giphy) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	results, err := s.searcher.Search(libkb.NewMetaContext(ctx, s.G().ExternalG()), s.getQuery(text),
		s.G().AttachmentURLSrv)
	if err != nil {
		s.Debug(ctx, "Execute: failed to get Giphy results: %s", err)
		return err
	}
	if len(results.Results) == 0 {
		s.Debug(ctx, "Execute: failed to find any results")
		return nil
	}
	res := results.Results[libkb.RandIntn(len(results.Results))]
	_, err = s.G().ChatHelper.SendTextByIDNonblock(ctx, convID, tlfName, res.TargetUrl, nil)
	return err
}

func (n nullChatUI) ChatGiphySearchResults(ctx context.Context, convID chat1.ConversationID,
	results chat1.GiphySearchResults) error {
	return nil
}

func (n nullChatUI) ChatGiphyToggleResultWindow(ctx context.Context, convID chat1.ConversationID, show bool) error {
	return nil
}

func (s *Giphy) Preview(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, text string) {
	defer s.Trace(ctx, func() error { return nil }, "Preview")()
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
		if _, ok := s.shownResults[convID.String()]; ok {
			// tell UI to clear
			s.getChatUI().ChatGiphyToggleResultWindow(ctx, convID, false)
			delete(s.shownResults, convID.String())
		}
		return
	}
	query := s.getQuery(text)
	if shown, ok := s.shownResults[convID.String()]; ok && shown == query {
		s.Debug(ctx, "Preview: same query given, skipping")
		return
	}
	s.getChatUI().ChatGiphyToggleResultWindow(ctx, convID, true)
	s.shownResults[convID.String()] = query
	results, err := s.searcher.Search(libkb.NewMetaContext(ctx, s.G().ExternalG()), query,
		s.G().AttachmentURLSrv)
	if err != nil {
		s.Debug(ctx, "Preview: failed to get Giphy results: %s", err)
		return
	}
	s.getChatUI().ChatGiphySearchResults(ctx, convID, results)
}
