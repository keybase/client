package chat

import (
	"context"
	"regexp"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
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

func (s *Searcher) Search(ctx context.Context, chatUI libkb.ChatUI, conversationID chat1.ConversationID, query string, maxHits int, maxMessages int) (res []chat1.RateLimit, err error) {
	re, err := regexp.Compile(query)
	if err != nil {
		return res, err
	}
	uid := gregor1.UID(s.G().Env.GetUID().ToBytes())
	pagination := &chat1.Pagination{Num: pageSize}
	typs := []chat1.MessageType{chat1.MessageType_TEXT}
	getThreadQuery := &chat1.GetThreadQuery{MessageTypes: typs}

	var rlimits []*chat1.RateLimit
	var prev chat1.MessageUnboxed
	var next chat1.MessageUnboxed
	numHits := 0
	numMessages := 0
	getPresentMsg := func(msg chat1.MessageUnboxed) chat1.UIMessage {
		return utils.PresentMessageUnboxed(ctx, msg, uid, s.G().TeamChannelSource)
	}
	for !pagination.Last && numHits < maxHits && numMessages < maxMessages {
		thread, rl, err := s.G().ConvSource.Pull(ctx, conversationID, uid, getThreadQuery, pagination)
		if err != nil {
			return res, err
		}
		pagination = thread.Pagination
		pagination.Previous = nil
		rlimits = append(rlimits, rl...)

		for i, msg := range thread.Messages {
			if msg.IsValid() && msg.GetMessageType() == chat1.MessageType_TEXT {
				numMessages++
				msgText := msg.Valid().MessageBody.Text().Body
				hits := re.FindAllString(msgText, -1)
				if hits != nil {
					numHits++
					if i+1 < len(thread.Messages) {
						prev = thread.Messages[i+1]
					} else {
						// Clear prev
						prev = chat1.MessageUnboxed{}
					}
					// Stream search hits back to the UI
					chatUI.ChatSearchHit(ctx, chat1.ChatSearchHitArg{
						PrevMessage: getPresentMsg(prev),
						HitMessage:  getPresentMsg(msg),
						NextMessage: getPresentMsg(next),
						Hits:        hits,
					})
				}
				// Threads are ordered newest to oldest, so the current msg
				// becomes the next msg for search context
				next = msg
			}
			if numHits >= maxHits || numMessages >= maxMessages {
				break
			}
		}
	}
	chatUI.ChatSearchDone(ctx, chat1.ChatSearchDoneArg{
		NumHits: numHits,
	})
	return utils.AggRateLimitsP(rlimits), nil
}
