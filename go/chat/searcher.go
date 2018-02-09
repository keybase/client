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

func (s *Searcher) SearchRegexp(ctx context.Context, uiCh chan chat1.ChatSearchHit, conversationID chat1.ConversationID, re *regexp.Regexp, maxHits int, maxMessages int) (hits []chat1.ChatSearchHit, rlimits []chat1.RateLimit, err error) {
	uid := gregor1.UID(s.G().Env.GetUID().ToBytes())
	pagination := &chat1.Pagination{Num: pageSize}
	typs := []chat1.MessageType{chat1.MessageType_TEXT}
	getThreadQuery := &chat1.GetThreadQuery{MessageTypes: typs}

	var prev *chat1.MessageUnboxed
	var next *chat1.MessageUnboxed
	var searchHit chat1.ChatSearchHit
	var rlimitsp []*chat1.RateLimit
	numHits := 0
	numMessages := 0
	getPresentMsg := func(msg *chat1.MessageUnboxed) *chat1.UIMessage {
		if msg != nil {
			uiMsg := utils.PresentMessageUnboxed(ctx, *msg, uid, s.G().TeamChannelSource)
			return &uiMsg
		}
		return nil
	}
	for !pagination.Last && numHits < maxHits && numMessages < maxMessages {
		thread, rl, err := s.G().ConvSource.Pull(ctx, conversationID, uid, getThreadQuery, pagination)
		if err != nil {
			return hits, rlimits, err
		}
		pagination = thread.Pagination
		pagination.Previous = nil
		rlimitsp = append(rlimitsp, rl...)

		for i, msg := range thread.Messages {
			msg := msg
			if msg.IsValid() && msg.GetMessageType() == chat1.MessageType_TEXT {
				numMessages++

				if i+1 < len(thread.Messages) {
					prev = &thread.Messages[i+1]
				} else {
					// Clear prev
					prev = nil
				}

				msgText := msg.Valid().MessageBody.Text().Body
				matches := re.FindAllString(msgText, -1)

				if matches != nil {
					numHits++

					searchHit = chat1.ChatSearchHit{
						PrevMessage: getPresentMsg(prev),
						HitMessage:  getPresentMsg(&msg),
						NextMessage: getPresentMsg(next),
						Matches:     matches,
					}
					if uiCh != nil {
						// Stream search hits back to the UI
						// channel
						uiCh <- searchHit
					}
					hits = append(hits, searchHit)
				}
				// Threads are ordered newest to oldest, so the current msg
				// becomes the next msg for search context
				next = &msg
			}
			if numHits >= maxHits || numMessages >= maxMessages {
				break
			}
		}
	}
	if uiCh != nil {
		uiCh <- chat1.ChatSearchHit{}
	}
	return hits, utils.AggRateLimitsP(rlimitsp), nil
}
