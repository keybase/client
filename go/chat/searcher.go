package chat

import (
	"context"
	"regexp"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const defaultPageSize = 300

type Searcher struct {
	globals.Contextified
	utils.DebugLabeler

	pageSize int
}

func NewSearcher(g *globals.Context) *Searcher {
	labeler := utils.NewDebugLabeler(g.GetLog(), "searcher", false)
	return &Searcher{
		Contextified: globals.NewContextified(g),
		DebugLabeler: labeler,
		pageSize:     defaultPageSize,
	}
}

func (s *Searcher) SearchRegexp(ctx context.Context, uiCh chan chat1.ChatSearchHit, conversationID chat1.ConversationID, re *regexp.Regexp,
	maxHits, maxMessages, beforeContext, afterContext int) (hits []chat1.ChatSearchHit, err error) {
	uid := gregor1.UID(s.G().Env.GetUID().ToBytes())
	pagination := &chat1.Pagination{Num: s.pageSize}

	// Context cannot exceed the page size.
	if beforeContext >= s.pageSize {
		beforeContext = s.pageSize - 1
	}
	if afterContext >= s.pageSize {
		afterContext = s.pageSize - 1
	}

	// If we have to gather search result context around a pagination boundary,
	// we may have to fetch the next page of the thread
	var prevPage, curPage, nextPage *chat1.ThreadView

	getNextPage := func() (*chat1.ThreadView, error) {
		thread, err := s.G().ConvSource.Pull(ctx, conversationID, uid, &chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, pagination)
		if err != nil {
			return nil, err
		}
		filteredMsgs := []chat1.MessageUnboxed{}
		// Filter out invalid/exploded messages so our search context is
		// correct.
		for _, msg := range thread.Messages {
			if msg.IsValid() && msg.GetMessageType() == chat1.MessageType_TEXT && !msg.Valid().MessageBody.IsNil() {
				filteredMsgs = append(filteredMsgs, msg)
			}
		}
		thread.Messages = filteredMsgs
		pagination = thread.Pagination
		pagination.Num = s.pageSize
		pagination.Previous = nil
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
		// Get all of the context after our hit index of the current page and fetch a new page if available.
		hitContext := cur.Messages[i+1:]
		if next == nil {
			next, err = getNextPage()
			if err != nil {
				return nil, nil, err
			}
		}
		// Get the remaining context from the new current page of the thread.
		remainingContext := beforeContext - len(hitContext)
		if remainingContext > len(next.Messages) {
			remainingContext = len(next.Messages)
		}
		hitContext = append(next.Messages[:remainingContext], hitContext...)
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
			hitContext = append(hitContext, prev.Messages[remainingContext:]...)
		}
		return hitContext
	}

	// Order messages ascending by ID for presentation
	getUIMsgs := func(msgs []chat1.MessageUnboxed) (uiMsgs []chat1.UIMessage) {
		for i := len(msgs) - 1; i >= 0; i-- {
			msg := msgs[i]
			uiMsg := utils.PresentMessageUnboxed(ctx, s.G(), msg, uid, conversationID)
			uiMsgs = append(uiMsgs, uiMsg)
		}
		return uiMsgs
	}

	numHits := 0
	numMessages := 0
	for !pagination.Last && numHits < maxHits && numMessages < maxMessages {
		prevPage = curPage
		if nextPage == nil {
			curPage, err = getNextPage()
			if err != nil {
				return nil, err
			}
		} else { // we pre-fetched the next page when retrieving context
			curPage = nextPage
			nextPage = nil
		}

		for i, msg := range curPage.Messages {
			numMessages++
			msgText := msg.Valid().MessageBody.Text().Body
			matches := re.FindAllString(msgText, -1)

			if matches != nil {
				numHits++

				afterMsgs := getAfterMsgs(i, prevPage, curPage)
				newThread, beforeMsgs, err := getBeforeMsgs(i, curPage, nextPage)
				if err != nil {
					return nil, err
				}
				nextPage = newThread
				searchHit := chat1.ChatSearchHit{
					BeforeMessages: getUIMsgs(beforeMsgs),
					HitMessage:     utils.PresentMessageUnboxed(ctx, s.G(), msg, uid, conversationID),
					AfterMessages:  getUIMsgs(afterMsgs),
					Matches:        matches,
				}
				if uiCh != nil {
					// Stream search hits back to the UI
					// channel
					uiCh <- searchHit
				}
				hits = append(hits, searchHit)
			}
			if numHits >= maxHits || numMessages >= maxMessages {
				break
			}
		}
	}
	if uiCh != nil {
		close(uiCh)
	}
	return hits, nil
}
