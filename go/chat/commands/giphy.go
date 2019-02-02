package commands

import (
	"context"
	"strings"
	"sync"

	"github.com/keybase/client/go/chat/giphy"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Giphy struct {
	sync.Mutex
	*baseCommand
	shownResults      map[string]bool
	currentOpCancelFn context.CancelFunc
	currentOpDoneCb   chan struct{}
}

func NewGiphy(g *globals.Context) *Giphy {
	return &Giphy{
		baseCommand:  newBaseCommand(g, "giphy", "[search terms]", "Search Giphy for GIFs"),
		shownResults: make(map[string]bool),
	}
}

func (s *Giphy) Execute(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	tlfName, text string) (err error) {
	if !s.Match(ctx, text) {
		return ErrInvalidCommand
	}
	return nil
}

type nullChatUI struct {
	libkb.ChatUI
}

func (n nullChatUI) ChatGiphySearchResults(ctx context.Context, convID chat1.ConversationID,
	results []chat1.GiphySearchResult) error {
	return nil
}

func (s *Giphy) getChatUI() libkb.ChatUI {
	ui, err := s.G().UIRouter.GetChatUI()
	if err != nil || ui == nil {
		return nullChatUI{}
	}
	return ui
}

func (s *Giphy) Preview(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, text string) {
	defer s.Trace(ctx, func() error { return nil }, "Preview")()
	s.Lock()
	if s.currentOpCancelFn != nil {
		s.currentOpCancelFn()
	}
	select {
	case <-s.currentOpDoneCb:
	default:
	}
	ctx, s.currentOpCancelFn = context.WithCancel(ctx)
	s.currentOpDoneCb = make(chan struct{})
	defer close(s.currentOpDoneCb)
	defer func() { s.currentOpCancelFn = nil }()
	s.Unlock()

	if !s.Match(ctx, text) || text == "/giphy" {
		shown := s.shownResults[convID.String()]
		if shown {
			// tell UI to clear
			s.getChatUI().ChatGiphySearchResults(ctx, convID, nil)
			s.shownResults[convID.String()] = false
		}
		return
	}
	var query *string
	toks, err := s.tokenize(text, 1)
	if err != nil {
		return
	}
	q := strings.Join(toks[1:], " ")
	if len(q) > 0 {
		query = &q
	}
	results, err := giphy.Search(libkb.NewMetaContext(ctx, s.G().ExternalG()), query, s.G().AttachmentURLSrv)
	if err != nil {
		s.Debug(ctx, "Preview: failed to get Giphy results: %s", err)
		return
	}
	s.shownResults[convID.String()] = true
	s.getChatUI().ChatGiphySearchResults(ctx, convID, results)
}
