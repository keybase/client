package chat

import (
	"context"
	"regexp"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const pageSize = 300

type Searcher struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewSearcher(g *globals.Context) *Searcher {
	labeler := utils.NewDebugLabeler(g.GetLog(), "searcher", false)
	return &Searcher{
		Contextified: globals.NewContextified(g),
		DebugLabeler: labeler,
	}
}

func (s *Searcher) SearchRegexp(ctx context.Context, uiCh chan chat1.ChatSearchHit, conversationID chat1.ConversationID, re *regexp.Regexp,
	maxHits, maxMessages, beforeContext, afterContext int) (hits []chat1.ChatSearchHit, rlimits []chat1.RateLimit, err error) {
	uid := gregor1.UID(s.G().Env.GetUID().ToBytes())
	pagination := &chat1.Pagination{Num: pageSize}

	if beforeContext >= pageSize {
		beforeContext = pageSize - 1
	}
	if afterContext >= pageSize {
		afterContext = pageSize - 1
	}

	var rlimitsp []*chat1.RateLimit
	// If we have to gather search result context around a pagination boundary
	// we may have to fetch a thread and need to prevent refetching after this.
	var prevThread, curThread *chat1.ThreadView
	fetchThread := true

	getThread := func() error {
		prevThread = curThread
		thread, rl, err := s.G().ConvSource.Pull(ctx, conversationID, uid, &chat1.GetThreadQuery{
			MessageTypes: []chat1.MessageType{chat1.MessageType_TEXT},
		}, pagination)
		if err != nil {
			return err
		}
		curThread = &thread
		pagination = curThread.Pagination
		pagination.Num = pageSize
		pagination.Previous = nil
		rlimitsp = append(rlimitsp, rl...)
		return nil
	}

	getBeforeMsgs := func(i int) ([]chat1.MessageUnboxed, error) {
		// Return context from the current thread only
		if i+beforeContext < len(curThread.Messages) {
			return curThread.Messages[i+1 : i+beforeContext+1], nil
		}
		hitContext := curThread.Messages[i+1:]
		if prevThread != nil {
			err := getThread()
			if err != nil {
				return nil, err
			}
			fetchThread = false
			// Get the remaining context from the new current page  of the thread.
			hitContext = append(curThread.Messages[:beforeContext-len(hitContext)], hitContext...)
		}
		return hitContext, nil
	}

	getAfterMsgs := func(i int) []chat1.MessageUnboxed {
		// Return context from the current thread only
		if afterContext < i {
			return curThread.Messages[i-afterContext : i]
		}
		hitContext := curThread.Messages[:i]
		if prevThread != nil {
			// Get the remaining context from the previous page of the thread.
			hitContext = append(prevThread.Messages[len(prevThread.Messages)-afterContext+i:], hitContext...)
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
		if fetchThread {
			err := getThread()
			if err != nil {
				return nil, nil, err
			}
		}
		// Reset this since we want to fetch on the next iteration.
		fetchThread = true

		for i, msg := range curThread.Messages {
			if msg.IsValid() && msg.GetMessageType() == chat1.MessageType_TEXT {
				numMessages++
				if msg.Valid().MessageBody.IsNil() {
					continue
				}
				msgText := msg.Valid().MessageBody.Text().Body
				matches := re.FindAllString(msgText, -1)

				if matches != nil {
					numHits++

					// First we fetch the msgs after the search hit, possibly
					// using prevThread if we are at a pagination boundary
					// (since msgs are ordered last to first).
					afterMsgs := getAfterMsgs(i)
					// Now we fetch the msgs before the search hit, possibly
					// fetching a new page of results if we are at a pagination
					// boundary.
					beforeMsgs, err := getBeforeMsgs(i)
					if err != nil {
						return nil, nil, err
					}
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
			}
			if numHits >= maxHits || numMessages >= maxMessages {
				break
			}
		}
	}
	if uiCh != nil {
		close(uiCh)
	}
	return hits, utils.AggRateLimitsP(rlimitsp), nil
}
