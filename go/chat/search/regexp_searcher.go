package search

import (
	"context"
	"regexp"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type RegexpSearcher struct {
	globals.Contextified
	utils.DebugLabeler

	pageSize int
}

var _ types.RegexpSearcher = (*RegexpSearcher)(nil)

func NewRegexpSearcher(g *globals.Context) *RegexpSearcher {
	labeler := utils.NewDebugLabeler(g.GetLog(), "RegexpSearcher", false)
	return &RegexpSearcher{
		Contextified: globals.NewContextified(g),
		DebugLabeler: labeler,
		pageSize:     defaultPageSize,
	}
}

func (s *RegexpSearcher) SetPageSize(pageSize int) {
	s.pageSize = pageSize
}

func (s *RegexpSearcher) Search(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	queryRe *regexp.Regexp, uiCh chan chat1.ChatSearchHit, opts chat1.SearchOpts) (hits []chat1.ChatSearchHit, msgHits []chat1.MessageUnboxed, err error) {
	defer s.Trace(ctx, func() error { return err }, "Search")()
	defer func() {
		if uiCh != nil {
			close(uiCh)
		}
	}()
	pagination := opts.InitialPagination
	if pagination == nil {
		pagination = &chat1.Pagination{Num: s.pageSize}
	} else {
		pagination.Num = s.pageSize
	}
	maxHits := opts.MaxHits
	maxMessages := opts.MaxMessages
	beforeContext := opts.BeforeContext
	afterContext := opts.AfterContext

	if beforeContext >= MaxContext || beforeContext < 0 {
		beforeContext = MaxContext - 1
	}
	if afterContext >= MaxContext || afterContext < 0 {
		afterContext = MaxContext - 1
	}

	if maxHits > MaxAllowedSearchHits || maxHits <= 0 {
		maxHits = MaxAllowedSearchHits
	}

	if maxMessages > MaxAllowedSearchMessages || maxMessages <= 0 {
		maxMessages = MaxAllowedSearchMessages
	}

	// If we have to gather search result context around a pagination boundary,
	// we may have to fetch the next page of the thread
	var prevPage, curPage, nextPage *chat1.ThreadView

	getNextPage := func() (*chat1.ThreadView, error) {
		thread, err := s.G().ConvSource.Pull(ctx, convID, uid,
			chat1.GetThreadReason_SEARCHER,
			&chat1.GetThreadQuery{
				MarkAsRead: false,
			}, pagination)
		if err != nil {
			return nil, err
		}
		filteredMsgs := []chat1.MessageUnboxed{}
		// Filter out invalid/exploded messages so our search context is
		// correct.
		for _, msg := range thread.Messages {
			if msg.IsValidFull() && msg.IsVisible() {
				filteredMsgs = append(filteredMsgs, msg)
			}
		}
		thread.Messages = filteredMsgs
		return &thread, nil
	}

	// Returns search context before the search hit, at position `i` in
	// `cur.Messages` possibly fetching and returning a new page of results if
	// we are at a pagination boundary.
	getBeforeMsgs := func(i int, cur, next *chat1.ThreadView) (*chat1.ThreadView, []chat1.MessageUnboxed, error) {
		// context is contained entirely in this page of the thread.
		if i+beforeContext < len(cur.Messages) {
			return next, cur.Messages[i+1 : i+beforeContext+1], nil
		}
		// Get all of the context after our hit index of the current page and
		// fetch a new page if available.
		hitContext := cur.Messages[i+1:]
		if next == nil {
			next, err = getNextPage()
			if err != nil {
				if utils.IsPermanentErr(err) {
					return nil, nil, err
				}
				s.Debug(ctx, "transient search failure: %v", err)
				return nil, nil, nil
			}
		}
		// Get the remaining context from the new current page of the thread.
		remainingContext := beforeContext - len(hitContext)
		if remainingContext > len(next.Messages) {
			remainingContext = len(next.Messages)
		}
		hitContext = append(hitContext, next.Messages[:remainingContext]...)
		return next, hitContext, nil
	}

	// Returns the search context surrounding a search result at index `i` in
	// `cur.Messages`, possibly using prev if we are at a
	// pagination boundary (since msgs are ordered last to first).
	getAfterMsgs := func(i int, prev, cur *chat1.ThreadView) []chat1.MessageUnboxed {
		// Return context from the current thread only
		if afterContext < i {
			return cur.Messages[i-afterContext : i]
		}
		hitContext := cur.Messages[:i]
		if prev != nil {
			// Get the remaining context from the previous page of the thread.
			remainingContext := len(prev.Messages) - (afterContext - len(hitContext))
			if remainingContext < 0 {
				remainingContext = 0
			}
			hitContext = append(prev.Messages[remainingContext:], hitContext...)
		}
		return hitContext
	}

	numHits := 0
	numMessages := 0
	for !pagination.Last && numHits < maxHits && numMessages < maxMessages {
		prevPage = curPage
		if nextPage == nil {
			curPage, err = getNextPage()
			if err != nil {
				return nil, nil, err
			} else if curPage == nil {
				break
			}
		} else { // we pre-fetched the next page when retrieving context
			curPage = nextPage
			nextPage = nil
		}
		// update our global pagination so we can correctly fetch the next page.
		pagination = curPage.Pagination
		pagination.Num = s.pageSize
		pagination.Previous = nil

		for i, msg := range curPage.Messages {
			numMessages++
			if !opts.Matches(msg) {
				continue
			}
			matches := searchMatches(msg, queryRe)
			if len(matches) > 0 {
				numHits++

				afterMsgs := getAfterMsgs(i, prevPage, curPage)
				newThread, beforeMsgs, err := getBeforeMsgs(i, curPage, nextPage)
				if err != nil {
					return nil, nil, err
				}
				nextPage = newThread
				searchHit := chat1.ChatSearchHit{
					BeforeMessages: getUIMsgs(ctx, s.G(), convID, uid, beforeMsgs),
					HitMessage:     utils.PresentMessageUnboxed(ctx, s.G(), msg, uid, convID),
					AfterMessages:  getUIMsgs(ctx, s.G(), convID, uid, afterMsgs),
					Matches:        matches,
				}
				if uiCh != nil {
					// Stream search hits back to the UI channel
					select {
					case <-ctx.Done():
						return nil, nil, ctx.Err()
					case uiCh <- searchHit:
					}
				}
				hits = append(hits, searchHit)
				msgHits = append(msgHits, msg)
			}
			if numHits >= maxHits || numMessages >= maxMessages {
				break
			}
		}
	}
	return hits, msgHits, nil
}
