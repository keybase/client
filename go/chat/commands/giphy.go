package commands

import (
	"context"
	"strings"
	"sync"

	"github.com/keybase/client/go/chat/giphy"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
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

func (s *Giphy) getChatUI() chat1.ChatUiInterface {
	ui, err := s.G().UIRouter.GetChatUI()
	if err != nil || ui == nil {
		return utils.DummyChatUI{}
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

	if !s.Match(ctx, text) || text != "/giphy" {
		shown := s.shownResults[convID.String()]
		if shown {
			// tell UI to clear
			s.getChatUI().ChatGiphySearchResults(ctx, chat1.ChatGiphySearchResultsArg{
				ConvID: convID.String(),
			})
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
	results, err := giphy.Search(ctx, query, s.G().AttachmentURLSrv)
	if err != nil {
		s.Debug(ctx, "Preview: failed to get Giphy results: %s", err)
		return
	}
	s.shownResults[convID.String()] = true
	s.getChatUI().ChatGiphySearchResults(ctx, chat1.ChatGiphySearchResultsArg{
		ConvID:  convID.String(),
		Results: results,
	})
}
